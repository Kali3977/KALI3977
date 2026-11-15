import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executeSimulatedCommand,
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

test('validateSimulatorExerciseSubmission validates expected Kali command and rejects unsafe/invalid input', () => {
  const bad = validateSimulatorExerciseSubmission('nmap -sV 1.1.1.1', 'nmap.*192\\.168\\.56\\.10');
  assert.equal(bad.matched, false);

  const good = validateSimulatorExerciseSubmission(
    'nmap -sV 192.168.56.10',
    'nmap\\s+.*-sV.*192\\.168\\.56\\.10',
  );
  assert.equal(good.matched, true);
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
