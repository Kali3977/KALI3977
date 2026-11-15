import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_CATEGORIES_SEED,
  GAMES_SEED,
  GAME_ACHIEVEMENTS_SEED,
  GAME_MISSIONS_SEED,
} from './catalog-data.ts';
import {
  validateGameRoomJoin,
  calculateGameLevel,
  calculateMatchRewards,
  generateGameTournamentBracket,
  advanceGameTournamentMatch,
} from './validation.ts';
import {
  initializeGameSessionState,
  applyGameEngineAction,
  sanitizeSessionForPlayer,
} from './engines.ts';

test('Games Arena catalog defines exact 6 categories (A-F) and 30 enabled games', () => {
  assert.equal(GAME_CATEGORIES_SEED.length, 6);
  assert.deepEqual(
    GAME_CATEGORIES_SEED.map((c) => c.code),
    ['A', 'B', 'C', 'D', 'E', 'F'],
  );
  assert.equal(GAMES_SEED.length, 30);
  const slugs = new Set(GAMES_SEED.map((g) => g.slug));
  assert.equal(slugs.size, 30);
  assert.ok(slugs.has('hacker-among-us'));
  assert.ok(slugs.has('cyber-ctf-battle'));
  assert.ok(slugs.has('cyber-detective'));
  assert.ok(GAME_ACHIEVEMENTS_SEED.length >= 5);
  assert.ok(GAME_MISSIONS_SEED.length >= 4);
});

test('validateGameRoomJoin strictly enforces Room Code vs Team Code separation and capacity/expiry', () => {
  const baseRoom = {
    id: 1,
    roomCode: 'GA-CYB-1001',
    gameId: 1,
    status: 'waiting',
    isLocked: false,
    registrationOpen: true,
    requiresTeamCode: true,
    maxPlayers: 8,
    currentPlayers: 2,
    usageCount: 2,
    usageLimit: 10,
    expiresAt: new Date(Date.now() + 60_000),
  };
  const baseTeam = {
    id: 10,
    roomId: 1,
    campusId: 2,
    teamCode: 'TEAM-ALPHA-99',
    name: 'Alpha Squad',
    isActive: true,
    isSuspended: false,
    maxMembers: 5,
    currentMembers: 2,
    codeUsageCount: 2,
    codeUsageLimit: 10,
    codeExpiresAt: new Date(Date.now() + 60_000),
  };

  // Same code collision rejected
  const sameCode = validateGameRoomJoin({
    room: baseRoom,
    team: { ...baseTeam, teamCode: 'GA-CYB-1001' },
    userId: 5,
    userSuspended: false,
    userBanned: false,
    userCampusId: 2,
    alreadyInRoom: false,
  });
  assert.equal(sameCode.allowed, false);
  assert.equal(sameCode.code, 'CODE_SEPARATION_VIOLATION');

  // Missing required team code rejected
  const missingTeam = validateGameRoomJoin({
    room: baseRoom,
    team: null,
    userId: 5,
    userSuspended: false,
    userBanned: false,
    userCampusId: 2,
    alreadyInRoom: false,
  });
  assert.equal(missingTeam.allowed, false);
  assert.equal(missingTeam.code, 'TEAM_CODE_REQUIRED');

  // Campus mismatch rejected when enforced
  const campusMismatch = validateGameRoomJoin({
    room: baseRoom,
    team: baseTeam,
    userId: 5,
    userSuspended: false,
    userBanned: false,
    userCampusId: 99,
    requiresCampusMatch: true,
    alreadyInRoom: false,
  });
  assert.equal(campusMismatch.allowed, false);
  assert.equal(campusMismatch.code, 'CAMPUS_MISMATCH');

  // Valid distinct Room Code + Team Code accepted
  const valid = validateGameRoomJoin({
    room: baseRoom,
    team: baseTeam,
    userId: 5,
    userSuspended: false,
    userBanned: false,
    userCampusId: 2,
    requiresCampusMatch: true,
    alreadyInRoom: false,
  });
  assert.equal(valid.allowed, true);
});

test('Social Deduction engine hides secret roles from defenders and resolves win conditions accurately', () => {
  const players = [
    { id: 1, username: 'alice', displayName: 'Alice', side: 'solo' },
    { id: 2, username: 'bob', displayName: 'Bob', side: 'solo' },
    { id: 3, username: 'carol', displayName: 'Carol', side: 'solo' },
    { id: 4, username: 'dave', displayName: 'Dave', side: 'solo' },
  ];
  let state = initializeGameSessionState({
    engineType: 'social_deduction',
    gameSlug: 'hacker-among-us',
    mode: 'free_for_all',
    players,
    seed: 'seed-social-test-1',
  });

  const roles = state.roles as Record<string, 'hacker' | 'defender'>;
  const defenderId = Number(Object.keys(roles).find((k) => roles[k] === 'defender'));
  const hackerId = Number(Object.keys(roles).find((k) => roles[k] === 'hacker'));
  assert.ok(defenderId && hackerId);

  // Sanitized view for defender must NOT expose who hackerId is while active
  const defenderView = sanitizeSessionForPlayer(state, defenderId, 'active');
  assert.equal(defenderView.myRole, 'defender');
  const leakedRoles = defenderView.revealedRoles as Record<string, string>;
  assert.equal(leakedRoles[String(hackerId)], undefined);

  // Call emergency meeting & vote out the hacker
  const meet = applyGameEngineAction({
    state,
    userId: defenderId,
    displayName: 'Defender',
    eventType: 'call_meeting',
    payload: {},
    elapsedSeconds: 20,
  });
  assert.equal(meet.valid, true);
  state = meet.nextState;

  let matchEnded = false;
  for (const p of players) {
    const voteTarget = p.id === hackerId ? 'skip' : hackerId;
    const res = applyGameEngineAction({
      state,
      userId: p.id,
      displayName: p.displayName,
      eventType: 'cast_vote',
      payload: { targetId: voteTarget },
      elapsedSeconds: 30,
    });
    assert.equal(res.valid, true);
    state = res.nextState;
    matchEnded = res.matchEnded;
  }

  assert.equal(matchEnded, true);
  assert.equal(state.winnerTeam, 'defenders');
});

test('Cyber CTF Battle, Cyber Detective, Strategy Survival, and Escape Room engines validate server-side', () => {
  const p = [{ id: 7, username: 'neo', displayName: 'Neo', side: 'solo' }];

  // Cyber CTF Battle
  let ctf = initializeGameSessionState({
    engineType: 'cyber_battle',
    gameSlug: 'cyber-ctf-battle',
    mode: 'solo',
    players: p,
    seed: 'ctf-1',
  });
  const ctfSanitized = sanitizeSessionForPlayer(ctf, 7, 'active');
  assert.equal((ctfSanitized.questions as Array<Record<string, unknown>>)[0].acceptedAnswers, undefined);

  const wrong = applyGameEngineAction({
    state: ctf,
    userId: 7,
    displayName: 'Neo',
    eventType: 'submit_answer',
    payload: { questionId: 'ctf-1', answer: 'WRONG{flag}' },
    elapsedSeconds: 5,
  });
  assert.equal(wrong.pointsAwarded, 0);
  ctf = wrong.nextState;

  const right = applyGameEngineAction({
    state: ctf,
    userId: 7,
    displayName: 'Neo',
    eventType: 'submit_answer',
    payload: { questionId: 'ctf-1', answer: 'KALI3977{jwt_alg_none_bypass}' },
    elapsedSeconds: 10,
  });
  assert.ok(right.pointsAwarded >= 150);

  // Cyber Detective
  let det = initializeGameSessionState({
    engineType: 'investigation',
    gameSlug: 'cyber-detective',
    mode: 'solo',
    players: p,
    seed: 'det-1',
  });
  const detSanitized = sanitizeSessionForPlayer(det, 7, 'active');
  assert.equal((detSanitized.caseInfo as Record<string, unknown>).correctSuspect, undefined);

  const detRes = applyGameEngineAction({
    state: det,
    userId: 7,
    displayName: 'Neo',
    eventType: 'submit_case',
    payload: {
      suspect: 'a.sharma (Legacy Token)',
      vector: 'Unrotated Legacy Service Token + Sudo Tar Exfil',
      remediation: 'Revoke legacy token, rotate vault secrets & enforce mandatory MFA',
    },
    elapsedSeconds: 45,
  });
  assert.equal(detRes.matchEnded, true);
  assert.ok(detRes.pointsAwarded >= 400);

  // Strategy Survival
  let strat = initializeGameSessionState({
    engineType: 'strategy_survival',
    gameSlug: 'cyber-war',
    mode: 'solo',
    players: p,
    seed: 'strat-1',
  });
  const wave1 = applyGameEngineAction({
    state: strat,
    userId: 7,
    displayName: 'Neo',
    eventType: 'deploy_wave',
    payload: { firewall: 25, ids: 5, patching: 5, deception: 0 },
    elapsedSeconds: 15,
  });
  assert.equal(wave1.valid, true);
  assert.ok(wave1.pointsAwarded > 0);

  // Escape Room
  let esc = initializeGameSessionState({
    engineType: 'adventure_puzzle',
    gameSlug: 'cyber-escape-room',
    mode: 'solo',
    players: p,
    seed: 'esc-1',
  });
  const lock1 = applyGameEngineAction({
    state: esc,
    userId: 7,
    displayName: 'Neo',
    eventType: 'submit_lock',
    payload: { lockNumber: 1, answer: 'SHIELD3977' },
    elapsedSeconds: 10,
  });
  assert.equal(lock1.valid, true);
  assert.ok(lock1.pointsAwarded >= 150);
});

test('Progression level tiers, match rewards, and tournament brackets compute deterministically', () => {
  const lvl1 = calculateGameLevel(0);
  assert.equal(lvl1.level, 1);
  assert.equal(lvl1.tier, 'Beginner');

  const lvlElite = calculateGameLevel(20000);
  assert.equal(lvlElite.tier, 'Elite');

  const rewards = calculateMatchRewards({
    scoringConfig: GAMES_SEED[0].scoringConfig,
    won: true,
    score: 500,
    accuracyPct: 100,
    isMultiplayer: true,
  });
  assert.ok(rewards.xpAwarded >= 200);
  assert.ok(rewards.coinsAwarded >= 100);

  let bracket = generateGameTournamentBracket(
    [
      { id: 1, displayName: 'Alpha', seedNumber: 1 },
      { id: 2, displayName: 'Beta', seedNumber: 2 },
      { id: 3, displayName: 'Gamma', seedNumber: 3 },
      { id: 4, displayName: 'Delta', seedNumber: 4 },
    ],
    'single_elimination',
  );
  assert.equal(bracket.rounds.length, 1);
  assert.equal(bracket.rounds[0].matches.length, 2);

  bracket = advanceGameTournamentMatch(bracket, 'R1-M1', 1, '420 - 210');
  bracket = advanceGameTournamentMatch(bracket, 'R1-M2', 4, '380 - 300');
  assert.equal(bracket.rounds.length, 2);
  assert.equal(bracket.rounds[1].label, 'Grand Final');
  assert.equal(bracket.rounds[1].matches[0].participantA?.id, 1);
  assert.equal(bracket.rounds[1].matches[0].participantB?.id, 4);
});
