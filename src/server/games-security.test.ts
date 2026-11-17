import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { requirePermission, type AuthRequest, type DbUser } from '../middleware/auth';
import {
  calculateGameLevel,
  calculateMatchRewards,
  generateGameTournamentBracket,
  advanceGameTournamentMatch,
  validateGameRoomJoin,
} from '../lib/games/validation';
import { GAMES_SEED, GAME_CATEGORIES_SEED } from '../lib/games/catalog-data';

function makeFakeUser(overrides: Partial<DbUser> = {}): DbUser {
  return {
    id: 42,
    uid: 'uid-games-42',
    email: 'gamer@campus.edu',
    emailVerified: true,
    username: 'gamer_42',
    displayName: 'Gamer 42',
    avatarUrl: null,
    bio: '',
    country: 'Global',
    role: 'player',
    campusId: 1,
    campusVerificationStatus: 'verified',
    campusVerificationMethod: 'domain',
    xp: 200,
    level: 2,
    ctfPoints: 0,
    dailyStreak: 1,
    lastActiveDate: null,
    mfaEnabled: false,
    mfaSecret: null,
    isSuspended: false,
    isBanned: false,
    suspensionReason: null,
    profileVisibility: 'public',
    preferredLang: 'en',
    appearanceTheme: 'dark',
    learningExperience: 'beginner',
    progressionMode: 'automatic',
    layoutPreference: 'automatic',
    onboardingCompleted: false,
    onboardingGoal: '',
    pendingThemeUpgrade: null,
    dismissedThemeUpgrade: null,
    bookmarksJson: [],
    permissionsJson: { eventIds: [], expiresAt: null },
    notificationPrefsJson: {
      competitions: true,
      teamChat: true,
      securityAlerts: true,
      achievements: true,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    policyAcknowledgedAt: null,
    ...overrides,
  };
}

test('Catalog guarantees exactly 6 categories (A-F) and 30 unique games', () => {
  assert.equal(GAME_CATEGORIES_SEED.length, 6);
  assert.equal(GAMES_SEED.length, 30);

  const slugs = new Set(GAMES_SEED.map((g) => g.slug));
  assert.equal(slugs.size, 30);

  const featured = GAMES_SEED.filter((g) => g.isFeatured).map((g) => g.slug);
  assert.ok(featured.includes('hacker-among-us'));
  assert.ok(featured.includes('cyber-ctf-battle'));
  assert.ok(featured.includes('cyber-detective'));
});

test('Room Code and Team Code remain strictly separated on validation & RBAC blocks players from Games Admin routes', async () => {
  const roomOnlyMissTeam = validateGameRoomJoin({
    room: {
      id: 1,
      roomCode: 'GA-HAC-1001',
      gameId: 1,
      status: 'waiting',
      isLocked: false,
      registrationOpen: true,
      requiresTeamCode: true,
      maxPlayers: 10,
      currentPlayers: 2,
      usageCount: 2,
      usageLimit: 20,
      expiresAt: null,
    },
    team: null,
    userId: 42,
    userSuspended: false,
    userBanned: false,
    userCampusId: 1,
    requiresCampusMatch: false,
    alreadyInRoom: false,
  });
  assert.equal(roomOnlyMissTeam.allowed, false);
  assert.equal(roomOnlyMissTeam.code, 'TEAM_CODE_REQUIRED');

  const crossRoomTeam = validateGameRoomJoin({
    room: {
      id: 1,
      roomCode: 'GA-HAC-1001',
      gameId: 1,
      status: 'waiting',
      isLocked: false,
      registrationOpen: true,
      requiresTeamCode: true,
      maxPlayers: 10,
      currentPlayers: 2,
      usageCount: 2,
      usageLimit: 20,
      expiresAt: null,
    },
    team: {
      id: 9,
      roomId: 99, // belongs to a different room!
      campusId: 1,
      teamCode: 'TM-ALP-9999',
      name: 'Other Room Alpha',
      isActive: true,
      isSuspended: false,
      maxMembers: 5,
      currentMembers: 1,
      codeUsageCount: 1,
      codeUsageLimit: 10,
      codeExpiresAt: null,
    },
    userId: 42,
    userSuspended: false,
    userBanned: false,
    userCampusId: 1,
    requiresCampusMatch: false,
    alreadyInRoom: false,
  });
  assert.equal(crossRoomTeam.allowed, false);
  assert.equal(crossRoomTeam.code, 'TEAM_WRONG_ROOM');

  // Express RBAC middleware verification for Games Arena admin endpoints
  const app = express();
  app.use(express.json());
  app.use((req: AuthRequest, _res, next) => {
    const role = req.headers['x-role'];
    if (role === 'player') req.dbUser = makeFakeUser({ role: 'player' });
    if (role === 'owner') req.dbUser = makeFakeUser({ role: 'owner', mfaEnabled: true });
    next();
  });
  app.get('/api/games/admin/overview', requirePermission('admin:manage_rooms'), (_req, res) => {
    res.json({ ok: true });
  });
  app.patch('/api/games/admin/games/:id', requirePermission('admin:manage_content'), (_req, res) => {
    res.json({ ok: true });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Port bind failed');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const unauth = await fetch(`${baseUrl}/api/games/admin/overview`);
    assert.equal(unauth.status, 401);

    const playerOverview = await fetch(`${baseUrl}/api/games/admin/overview`, {
      headers: { 'x-role': 'player' },
    });
    assert.equal(playerOverview.status, 403);

    const playerPatch = await fetch(`${baseUrl}/api/games/admin/games/1`, {
      method: 'PATCH',
      headers: { 'x-role': 'player' },
    });
    assert.equal(playerPatch.status, 403);

    const ownerOverview = await fetch(`${baseUrl}/api/games/admin/overview`, {
      headers: { 'x-role': 'owner' },
    });
    assert.equal(ownerOverview.status, 200);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Game level tiers, fair-play rewards, and tournament bracket seeding/advancement behave deterministically', () => {
  const beg = calculateGameLevel(50);
  assert.equal(beg.tier, 'Beginner');

  const elite = calculateGameLevel(16000);
  assert.equal(elite.tier, 'Elite');
  assert.ok(elite.level >= 15);

  const winReward = calculateMatchRewards({
    scoringConfig: { baseXp: 60, winXpBonus: 80, baseCoins: 25, winCoinsBonus: 35, timeBonusMax: 30 },
    won: true,
    score: 500,
    accuracyPct: 95,
    isMultiplayer: true,
  });
  assert.ok(winReward.xpAwarded > 140);
  assert.ok(winReward.coinsAwarded >= 60);

  const bracket = generateGameTournamentBracket(
    [
      { id: 1, displayName: 'Alice', seedNumber: 1 },
      { id: 2, displayName: 'Bob', seedNumber: 2 },
      { id: 3, displayName: 'Carol', seedNumber: 3 },
      { id: 4, displayName: 'Dave', seedNumber: 4 },
    ],
    'single_elimination',
  );
  assert.equal(bracket.rounds.length, 1);
  assert.equal(bracket.rounds[0].matches.length, 2);

  const afterR1M1 = advanceGameTournamentMatch(bracket, 'R1-M1', 1, '300 - 150');
  assert.equal(afterR1M1.rounds[0].matches[0].status, 'completed');
  const afterR1M2 = advanceGameTournamentMatch(afterR1M1, 'R1-M2', 3, '280 - 210');
  assert.equal(afterR1M2.rounds.length, 2);
  assert.equal(afterR1M2.rounds[1].label, 'Grand Final');
  assert.equal(afterR1M2.rounds[1].matches[0].participantA?.id, 1);
  assert.equal(afterR1M2.rounds[1].matches[0].participantB?.id, 3);
});
