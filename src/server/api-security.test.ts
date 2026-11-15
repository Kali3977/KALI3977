import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  getServerOwnerEmail,
  requirePermission,
  shouldAssignInitialOwnerRole,
  type AuthRequest,
  type DbUser,
} from '../middleware/auth';
import { evaluateChatAccess, validateRoomAndTeamJoin } from '../lib/domain/arena';
import { hashFlag, sanitizeText, verifyFlagConstantTime } from '../lib/domain/security';
import { AntiScrapingMonitor } from '../lib/domain/anti-abuse';

function makeFakeUser(overrides: Partial<DbUser> = {}): DbUser {
  return {
    id: 10,
    uid: 'uid-test-10',
    email: 'player@campus.edu',
    emailVerified: true,
    username: 'player_10',
    displayName: 'Test Player',
    avatarUrl: null,
    bio: '',
    country: 'Global',
    role: 'player',
    campusId: 1,
    campusVerificationStatus: 'unverified',
    campusVerificationMethod: null,
    xp: 100,
    level: 1,
    ctfPoints: 0,
    dailyStreak: 0,
    lastActiveDate: null,
    mfaEnabled: false,
    mfaSecret: null,
    isSuspended: false,
    isBanned: false,
    suspensionReason: null,
    profileVisibility: 'public',
    preferredLang: 'en',
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

async function withServer(
  setup: (app: express.Express) => void,
  fn: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  setup(app);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to bind ephemeral test port');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('Express requirePermission middleware blocks unauthenticated, standard players, and suspended admins', async () => {
  await withServer(
    (app) => {
      app.use((req: AuthRequest, _res, next) => {
        const hdr = req.headers['x-test-role'];
        if (hdr === 'player') {
          req.dbUser = makeFakeUser({ role: 'player' });
        } else if (hdr === 'suspended-admin') {
          req.dbUser = makeFakeUser({ role: 'event_admin', isSuspended: true });
        } else if (hdr === 'event-admin-1') {
          req.dbUser = makeFakeUser({
            role: 'event_admin',
            permissionsJson: { eventIds: [1], expiresAt: '2027-01-01T00:00:00Z' },
          });
        } else if (hdr === 'owner') {
          req.dbUser = makeFakeUser({ role: 'owner', mfaEnabled: true });
        }
        next();
      });

      app.get('/admin/analytics', requirePermission('admin:view_analytics'), (_req, res) => {
        res.json({ ok: true });
      });
      app.post(
        '/admin/competitions/:id/rules',
        requirePermission('admin:manage_rules', (r) => Number(r.params.id)),
        (_req, res) => {
          res.json({ ok: true });
        },
      );
      app.post('/admin/appoint', requirePermission('admin:appoint_admins'), (_req, res) => {
        res.json({ ok: true });
      });
    },
    async (baseUrl) => {
      // 1. Unauthenticated -> 401
      const unauth = await fetch(`${baseUrl}/admin/analytics`);
      assert.equal(unauth.status, 401);

      // 2. Standard player -> 403
      const playerRes = await fetch(`${baseUrl}/admin/analytics`, {
        headers: { 'x-test-role': 'player' },
      });
      assert.equal(playerRes.status, 403);

      // 3. Suspended admin -> 403
      const suspendedRes = await fetch(`${baseUrl}/admin/analytics`, {
        headers: { 'x-test-role': 'suspended-admin' },
      });
      assert.equal(suspendedRes.status, 403);

      // 4. Scoped event_admin allowed for event 1, denied for event 2, denied for appoint_admins
      const allowedEvent = await fetch(`${baseUrl}/admin/competitions/1/rules`, {
        method: 'POST',
        headers: { 'x-test-role': 'event-admin-1' },
      });
      assert.equal(allowedEvent.status, 200);

      const deniedEvent = await fetch(`${baseUrl}/admin/competitions/2/rules`, {
        method: 'POST',
        headers: { 'x-test-role': 'event-admin-1' },
      });
      assert.equal(deniedEvent.status, 403);

      const deniedAppoint = await fetch(`${baseUrl}/admin/appoint`, {
        method: 'POST',
        headers: { 'x-test-role': 'event-admin-1' },
      });
      assert.equal(deniedAppoint.status, 403);

      // 5. Owner allowed to appoint admins
      const ownerAppoint = await fetch(`${baseUrl}/admin/appoint`, {
        method: 'POST',
        headers: { 'x-test-role': 'owner' },
      });
      assert.equal(ownerAppoint.status, 200);
    },
  );
});

test('XSS payload sanitization, constant-time flag check, and cross-team isolation hold together', () => {
  const dirty = '<script>fetch("https://evil.invalid")</script>   Hello Cyber\u0000';
  const clean = sanitizeText(dirty, 200);
  assert.ok(!clean.includes('\u0000'));
  assert.equal(clean.startsWith('<script>'), true); // Plain-text stored safely & rendered escaped by React

  const hash = hashFlag('KALI3977{zero_trust_ok}', 'unit-secret');
  assert.equal(verifyFlagConstantTime('KALI3977{zero_trust_ok}', hash, 'unit-secret'), true);
  assert.equal(verifyFlagConstantTime('KALI3977{zero_trust_no}', hash, 'unit-secret'), false);

  const crossTeamChat = evaluateChatAccess({
    channelType: 'team',
    channelTeamId: 42,
    channelEnabled: true,
    userRole: 'player',
    userTeamIds: [7],
    isCaptainOfChannelTeam: false,
  });
  assert.equal(crossTeamChat.allowed, false);

  const campusMismatchJoin = validateRoomAndTeamJoin({
    room: {
      id: 1,
      competitionId: 10,
      roomCode: '3977-CTF-A',
      isActive: true,
      isLocked: false,
      maxParticipants: 100,
      currentParticipants: 5,
      usageCount: 5,
      usageLimit: 100,
      expiresAt: null,
    },
    team: {
      id: 2,
      competitionId: 10,
      campusId: 99,
      name: 'Campus Z',
      teamCode: 'CAMPUS-Z',
      isActive: true,
      isSuspended: false,
      maxMembers: 10,
      currentMembers: 1,
      codeUsageCount: 1,
      codeUsageLimit: 10,
      codeExpiresAt: null,
    },
    competition: {
      id: 10,
      status: 'active',
      enrollmentPolicy: 'campus_verified',
      allowLateJoin: true,
      totalCapacity: 100,
      perTeamCapacity: 10,
    },
    userCampusId: 1,
    existingParticipationInCompetition: null,
  });
  assert.equal(campusMismatchJoin.allowed, false);
  assert.equal(campusMismatchJoin.code, 'CAMPUS_VERIFICATION_REQUIRED');
});

test('Server-side initial Owner role bootstrap requires verified exact owner email and zero existing owners', () => {
  assert.equal(getServerOwnerEmail(), 'r.7777rb@gmail.com');

  assert.equal(
    shouldAssignInitialOwnerRole({
      email: 'r.7777rb@gmail.com',
      emailVerified: true,
      existingOwnerCount: 0,
    }),
    true,
  );

  // Case-insensitive match with verified email
  assert.equal(
    shouldAssignInitialOwnerRole({
      email: 'R.7777RB@GMAIL.COM',
      emailVerified: true,
      existingOwnerCount: 0,
    }),
    true,
  );

  // Unverified email cannot bootstrap owner
  assert.equal(
    shouldAssignInitialOwnerRole({
      email: 'r.7777rb@gmail.com',
      emailVerified: false,
      existingOwnerCount: 0,
    }),
    false,
  );

  // Non-owner email cannot bootstrap owner
  assert.equal(
    shouldAssignInitialOwnerRole({
      email: 'attacker@gmail.com',
      emailVerified: true,
      existingOwnerCount: 0,
    }),
    false,
  );

  // Cannot assign second owner when an owner already exists
  assert.equal(
    shouldAssignInitialOwnerRole({
      email: 'r.7777rb@gmail.com',
      emailVerified: true,
      existingOwnerCount: 1,
    }),
    false,
  );
});

test('Moderator custom scopes grant granted permission without granting room management or owner powers even if requested in scopes', async () => {
  await withServer(
    (app) => {
      app.use((req: AuthRequest, _res, next) => {
        if (req.headers['x-test-role'] === 'mod') {
          req.dbUser = makeFakeUser({
            role: 'moderator',
            permissionsJson: {
              eventIds: [5],
              expiresAt: '2027-01-01T00:00:00Z',
              scopes: ['admin:manage_books', 'admin:appoint_admins'],
            },
          });
        }
        next();
      });
      app.post('/admin/books', requirePermission('admin:manage_books', () => 5), (_req, res) => {
        res.json({ ok: true });
      });
      app.post('/admin/rooms/create', requirePermission('admin:manage_rooms'), (_req, res) => {
        res.json({ ok: true });
      });
      app.post('/admin/appoint', requirePermission('admin:appoint_admins'), (_req, res) => {
        res.json({ ok: true });
      });
    },
    async (baseUrl) => {
      const modBooks = await fetch(`${baseUrl}/admin/books`, {
        method: 'POST',
        headers: { 'x-test-role': 'mod' },
      });
      assert.equal(modBooks.status, 200);

      const modRooms = await fetch(`${baseUrl}/admin/rooms/create`, {
        method: 'POST',
        headers: { 'x-test-role': 'mod' },
      });
      assert.equal(modRooms.status, 403);

      const modAppoint = await fetch(`${baseUrl}/admin/appoint`, {
        method: 'POST',
        headers: { 'x-test-role': 'mod' },
      });
      assert.equal(modAppoint.status, 403);
    },
  );
});

test('Anti-scraping HTTP middleware returns 429 with Retry-After, strips X-Powered-By, sets no-store, and protects IP review RBAC', async () => {
  const monitor = new AntiScrapingMonitor();
  await withServer(
    (app) => {
      app.disable('x-powered-by');
      app.use((req: AuthRequest, res, next) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        const hdr = req.headers['x-test-role'];
        if (hdr === 'player') req.dbUser = makeFakeUser({ role: 'player' });
        if (hdr === 'owner') req.dbUser = makeFakeUser({ role: 'owner', mfaEnabled: true });
        next();
      });
      app.use((req, res, next) => {
        const abuse = monitor.checkRequest({
          clientKey: 'test-client',
          path: req.path,
          userAgent: String(req.headers['user-agent'] || ''),
        });
        if (!abuse.allowed) {
          res.setHeader('Retry-After', String(abuse.retryAfterSeconds));
          return res.status(429).json({ error: abuse.reason });
        }
        next();
      });
      app.get('/ctf', (_req, res) => res.json({ ok: true }));
      app.post('/admin/ip-reports/:id/review', requirePermission('admin:view_security'), (_req, res) =>
        res.json({ ok: true }),
      );
    },
    async (baseUrl) => {
      // Unauthenticated and player roles blocked from IP report admin review
      const unauthReview = await fetch(`${baseUrl}/admin/ip-reports/1/review`, { method: 'POST' });
      assert.equal(unauthReview.status, 401);
      assert.equal(unauthReview.headers.get('x-powered-by'), null);
      assert.match(unauthReview.headers.get('cache-control') || '', /no-store/);

      const playerReview = await fetch(`${baseUrl}/admin/ip-reports/1/review`, {
        method: 'POST',
        headers: { 'x-test-role': 'player' },
      });
      assert.equal(playerReview.status, 403);

      const ownerReview = await fetch(`${baseUrl}/admin/ip-reports/1/review`, {
        method: 'POST',
        headers: { 'x-test-role': 'owner' },
      });
      assert.equal(ownerReview.status, 200);

      // Scraper user-agent throttled after quota
      for (let i = 0; i < 5; i += 1) {
        const okRes = await fetch(`${baseUrl}/ctf`, { headers: { 'user-agent': 'Scrapy/2.11' } });
        assert.equal(okRes.status, 200);
      }
      const throttled = await fetch(`${baseUrl}/ctf`, { headers: { 'user-agent': 'Scrapy/2.11' } });
      assert.equal(throttled.status, 429);
      assert.ok(Number(throttled.headers.get('retry-after')) >= 1);
    },
  );
});

test('Production bundle exposes zero source maps, zero server secrets, and zero plaintext CTF flags', () => {
  const distAssetsDir = path.resolve(process.cwd(), 'dist/assets');
  if (!fs.existsSync(distAssetsDir)) {
    // Allow running unit tests standalone before build, though CI/verification runs after build
    return;
  }
  const files = fs.readdirSync(distAssetsDir);
  const mapFiles = files.filter((f) => f.endsWith('.map'));
  assert.equal(mapFiles.length, 0, `Unexpected source maps in dist/assets: ${mapFiles.join(', ')}`);

  for (const f of files.filter((name) => name.endsWith('.js'))) {
    const content = fs.readFileSync(path.join(distAssetsDir, f), 'utf8');
    assert.ok(!content.includes('sourceMappingURL='), `Found sourceMappingURL comment in ${f}`);
    assert.ok(!content.includes('FLAG_HMAC_SECRET'), `Secret identifier leaked in ${f}`);
    assert.ok(!content.includes('PGPASSWORD'), `Database secret leaked in ${f}`);
    assert.ok(!content.includes('FIREBASE_SERVICE_ACCOUNT'), `Service account identifier leaked in ${f}`);
    assert.ok(!content.includes('KALI3977{base64_and_rot13'), `Plaintext CTF answer leaked in ${f}`);
  }
});



