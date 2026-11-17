import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultSimulatorState,
  executeSimulatedCommand,
  validateMissionCommandSequence,
  validateSimulatorExerciseSubmission,
} from './simulator';
import {
  computeToolMasteryScore,
  computeUserKaliLevel,
  sanitizeKaliLessonForStudent,
  sanitizeKaliMissionForStudent,
} from './progression';

test('Simulator executes virtual filesystem navigation and forensic grep safely without host shell', () => {
  const lsRes = executeSimulatedCommand('ls -la', { cwd: '/home/kali', history: [] });
  assert.equal(lsRes.exitCode, 0);
  assert.match(lsRes.output, /evidence\//);
  assert.match(lsRes.output, /README\.txt/);

  const cdRes = executeSimulatedCommand('cd evidence', { cwd: '/home/kali', history: [] });
  assert.equal(cdRes.exitCode, 0);
  assert.equal(cdRes.nextCwd, '/home/kali/evidence');

  const grepRes = executeSimulatedCommand('grep "Accepted" auth.log', {
    cwd: '/home/kali/evidence',
    history: [],
  });
  assert.equal(grepRes.exitCode, 0);
  assert.match(grepRes.output, /203\.0\.113\.77/);
});

test('Part 10 fix: sudo apt update && sudo apt install -y whois and whois kali.org succeed inside sandbox', () => {
  const initialState = createDefaultSimulatorState();
  const installRes = executeSimulatedCommand('sudo apt update && sudo apt install -y whois', initialState);
  assert.equal(installRes.exitCode, 0);
  assert.equal(installRes.safetyBlocked, undefined);
  assert.match(installRes.output, /simulated privilege elevation/i);
  assert.match(installRes.output, /Setting up whois/i);
  assert.ok(installRes.nextState?.installedPackages?.includes('whois'));

  const whoisRes = executeSimulatedCommand('whois kali.org', installRes.nextState);
  assert.equal(whoisRes.exitCode, 0);
  assert.match(whoisRes.output, /Domain Name: KALI\.ORG/);
  assert.match(whoisRes.output, /Name Server:/);

  const blockedWhois = executeSimulatedCommand('whois private-corp-target.internal', initialState);
  assert.equal(blockedWhois.safetyBlocked, true);
  assert.equal(blockedWhois.exitCode, 126);
});

test('Simulator handles SUID find with stderr redirection, malformed grep patterns, and unknown commands cleanly', () => {
  const suidRes = executeSimulatedCommand('find / -perm -4000 2>/dev/null');
  assert.equal(suidRes.exitCode, 0);
  assert.match(suidRes.output, /lab-backup-helper/);

  const badRegexGrep = executeSimulatedCommand('grep "[unclosed_missing" /home/kali/evidence/auth.log');
  assert.equal(badRegexGrep.exitCode, 1);

  const unknownRes = executeSimulatedCommand('nonexistent_tool_xyz --test');
  assert.equal(unknownRes.exitCode, 127);
  assert.match(unknownRes.output, /command not found/i);
});

test('Simulator supports virtual FS creation, pipes, and state reset', () => {
  let st = createDefaultSimulatorState();
  const mk = executeSimulatedCommand('mkdir labs_notes && echo "recon-ok" > labs_notes/note.txt', st);
  assert.equal(mk.exitCode, 0);
  st = mk.nextState!;

  const read = executeSimulatedCommand('cat labs_notes/note.txt', st);
  assert.equal(read.exitCode, 0);
  assert.equal(read.output, 'recon-ok');

  const resetState = createDefaultSimulatorState();
  const afterReset = executeSimulatedCommand('cat labs_notes/note.txt', resetState);
  assert.equal(afterReset.exitCode, 1);
});

test('Simulator blocks external public IP/domain scanning and allows authorized synthetic lab hosts', () => {
  const blockedNmap = executeSimulatedCommand('nmap -sV 8.8.8.8');
  assert.equal(blockedNmap.safetyBlocked, true);
  assert.equal(blockedNmap.exitCode, 126);

  const blockedCurl = executeSimulatedCommand('curl -I https://google.com');
  assert.equal(blockedCurl.safetyBlocked, true);
  assert.equal(blockedCurl.exitCode, 126);

  const allowedNmap = executeSimulatedCommand('nmap -sV -sC 192.168.56.10');
  assert.equal(allowedNmap.exitCode, 0);
  assert.equal(allowedNmap.safetyBlocked, undefined);
  assert.match(allowedNmap.output, /OpenSSH 9\.6p1/);
  assert.ok(allowedNmap.commandBreakdown.some((b) => b.token === '-sV'));
  assert.ok(allowedNmap.commandBreakdown.some((b) => b.token === '-sC'));
});

test('validateSimulatorExerciseSubmission and validateMissionCommandSequence handle cumulative steps strictly', () => {
  const bad = validateSimulatorExerciseSubmission('nmap -sV 1.1.1.1', 'nmap.*192\\.168\\.56\\.10');
  assert.equal(bad.matched, false);

  const good = validateSimulatorExerciseSubmission(
    'nmap -sV 192.168.56.10',
    'nmap\\s+.*-sV.*192\\.168\\.56\\.10',
  );
  assert.equal(good.matched, true);

  const missionSteps = [
    {
      id: 'step-grep',
      instruction: 'Filter Accepted lines from auth.log',
      expectedPattern: 'grep.*Accepted.*auth\\.log',
    },
    {
      id: 'step-nmap',
      instruction: 'Scan 192.168.56.10 with -sV',
      expectedPattern: 'nmap\\s+.*-sV.*192\\.168\\.56\\.10',
    },
  ];

  const partial = validateMissionCommandSequence(['cd evidence', 'grep "Accepted" auth.log'], missionSteps);
  assert.deepEqual(partial.passedStepIds, ['step-grep']);
  assert.equal(partial.missingSteps.length, 1);

  const rejectedBlocked = validateMissionCommandSequence(['nmap -sV 8.8.8.8'], missionSteps);
  assert.equal(rejectedBlocked.passedStepIds.length, 0);
  assert.equal(rejectedBlocked.missingSteps.length, 2);

  const full = validateMissionCommandSequence(
    ['cd evidence', 'grep "Accepted" auth.log', 'nmap -sV 192.168.56.10'],
    missionSteps,
  );
  assert.deepEqual(full.passedStepIds, ['step-grep', 'step-nmap']);
  assert.equal(full.missingSteps.length, 0);
});

test('Progression level, mastery calculation, and answer key sanitization behave deterministically', () => {
  const levels = [
    { levelNumber: 1, title: 'Linux Rookie', xpRequired: 0 },
    { levelNumber: 2, title: 'Terminal Explorer', xpRequired: 200 },
    { levelNumber: 3, title: 'Network Hunter', xpRequired: 550 },
  ];
  const l1 = computeUserKaliLevel(100, levels);
  assert.equal(l1.currentLevel.levelNumber, 1);
  assert.equal(l1.nextLevel?.levelNumber, 2);
  assert.equal(l1.progressPercent, 50);

  const l3 = computeUserKaliLevel(900, levels);
  assert.equal(l3.currentLevel.levelNumber, 3);
  assert.equal(l3.nextLevel, null);
  assert.equal(l3.progressPercent, 100);

  assert.equal(
    computeToolMasteryScore({
      completedLessonsCount: 1,
      totalLessonsCount: 1,
      terminalExercisesPassedCount: 1,
    }),
    100,
  );

  const sanitizedLesson = sanitizeKaliLessonForStudent({
    id: 1,
    title: 'Intro',
    quizQuestion: 'Q?',
    quizOptionsJson: ['A', 'B'],
    quizCorrectIndex: 1,
    quizExplanation: 'Secret explanation',
  }) as Record<string, unknown>;
  assert.equal('quizCorrectIndex' in sanitizedLesson, false);
  assert.equal('quizExplanation' in sanitizedLesson, false);

  const sanitizedMission = sanitizeKaliMissionForStudent({
    id: 1,
    title: 'Mission',
    assessmentJson: {
      question: 'Q?',
      options: ['A', 'B'],
      correctIndex: 0,
      explanation: 'Hidden',
    },
  });
  assert.equal('correctIndex' in (sanitizedMission.assessmentJson as Record<string, unknown>), false);
});
