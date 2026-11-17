import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import http from 'node:http';
import {
  DEFAULT_AI_MENTOR_CONFIG,
  calculateCostMicroUsd,
  evaluateMentorPreflight,
  getUtcWindowKeys,
  microUsdToUsd,
  usdToMicroUsd,
  type AiMentorConfigData,
  type MentorMode,
} from '../lib/ai/mentor-limits.ts';
import type { AuthRequest, DbUser } from '../middleware/auth.ts';
import {
  createAiMentorRouter,
  type AdminMentorOverviewPayload,
  type AiMentorStore,
  type MentorStatusPayload,
} from './ai-mentor-routes.ts';
import type { MentorResponse } from './ai-mentor.ts';

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

class MemoryAiMentorStore implements AiMentorStore {
  config: AiMentorConfigData = { ...DEFAULT_AI_MENTOR_CONFIG };
  counters = new Map<
    number,
    {
      dayKey: string;
      dailyCount: number;
      monthKey: string;
      monthlyCount: number;
      dailyTokens: number;
      monthlyTokens: number;
      monthlyEstimatedCostMicroUsd: number;
      lastRequestAt: Date | null;
      activeRequestId: string | null;
      activeStartedAt: Date | null;
    }
  >();
  ledger = new Map<
    string,
    {
      monthKey: string;
      totalRequests: number;
      totalPromptTokens: number;
      totalResponseTokens: number;
      totalThinkingTokens: number;
      spentMicroUsd: number;
      reservedMicroUsd: number;
    }
  >();

  async getStatus(userId: number | null, now: Date = new Date()): Promise<MentorStatusPayload> {
    const win = getUtcWindowKeys(now);
    const l = this.ledger.get(win.monthKey);
    const overrideActive = this.config.overrideMonthKey === win.monthKey;
    const spent = l?.spentMicroUsd ?? 0;
    const reserved = l?.reservedMicroUsd ?? 0;
    const halted =
      !overrideActive &&
      ((this.config.budgetHalted && this.config.haltedMonthKey === win.monthKey) ||
        spent + reserved >= this.config.monthlyBudgetMicroUsd);

    let usage: MentorStatusPayload['usage'] = null;
    if (userId !== null) {
      const c = this.counters.get(userId);
      const dailyUsed = c && c.dayKey === win.dayKey ? c.dailyCount : 0;
      const monthlyUsed = c && c.monthKey === win.monthKey ? c.monthlyCount : 0;
      let cooldownRemainingSeconds = 0;
      if (this.config.cooldownSeconds > 0 && c?.lastRequestAt) {
        const elapsed = now.getTime() - c.lastRequestAt.getTime();
        if (elapsed >= 0 && elapsed < this.config.cooldownSeconds * 1000) {
          cooldownRemainingSeconds = Math.ceil((this.config.cooldownSeconds * 1000 - elapsed) / 1000);
        }
      }
      usage = {
        dailyUsed,
        dailyRemaining: Math.max(0, this.config.dailyUserLimit - dailyUsed),
        monthlyUsed,
        monthlyRemaining: Math.max(0, this.config.monthlyUserLimit - monthlyUsed),
        cooldownRemainingSeconds,
        activeRequest: Boolean(c?.activeRequestId),
      };
    }

    return {
      enabled: this.config.enabled,
      budgetHalted: halted,
      budgetMessage: halted ? 'Monthly spending limit reached.' : null,
      limits: {
        dailyUserLimit: this.config.dailyUserLimit,
        monthlyUserLimit: this.config.monthlyUserLimit,
        maxPromptTokens: this.config.maxPromptTokens,
        maxResponseTokens: this.config.maxResponseTokens,
        cooldownSeconds: this.config.cooldownSeconds,
      },
      usage,
      resets: win,
    };
  }

  async reserveRequest(params: { userId: number; prompt: string; now?: Date }) {
    const now = params.now ?? new Date();
    const win = getUtcWindowKeys(now);
    const c = this.counters.get(params.userId) ?? {
      dayKey: win.dayKey,
      dailyCount: 0,
      monthKey: win.monthKey,
      monthlyCount: 0,
      dailyTokens: 0,
      monthlyTokens: 0,
      monthlyEstimatedCostMicroUsd: 0,
      lastRequestAt: null,
      activeRequestId: null,
      activeStartedAt: null,
    };
    const l = this.ledger.get(win.monthKey) ?? {
      monthKey: win.monthKey,
      totalRequests: 0,
      totalPromptTokens: 0,
      totalResponseTokens: 0,
      totalThinkingTokens: 0,
      spentMicroUsd: 0,
      reservedMicroUsd: 0,
    };
    this.ledger.set(win.monthKey, l);

    const preflight = evaluateMentorPreflight({
      config: this.config,
      prompt: params.prompt,
      userCounter: c,
      monthlyLedger: l,
      now,
      model: 'gemini-4-hydrogen',
    });

    if (!preflight.allowed) {
      if (preflight.shouldHaltBudget) {
        this.config.budgetHalted = true;
        this.config.haltedReason = 'Monthly spending limit reached.';
        this.config.haltedMonthKey = win.monthKey;
      }
      return { allowed: false as const, preflight };
    }

    const requestId = crypto.randomUUID();
    if (c.dayKey !== win.dayKey) {
      c.dayKey = win.dayKey;
      c.dailyCount = 0;
      c.dailyTokens = 0;
    }
    if (c.monthKey !== win.monthKey) {
      c.monthKey = win.monthKey;
      c.monthlyCount = 0;
      c.monthlyTokens = 0;
      c.monthlyEstimatedCostMicroUsd = 0;
    }
    c.activeRequestId = requestId;
    c.activeStartedAt = now;
    this.counters.set(params.userId, c);
    l.reservedMicroUsd += preflight.reservationMicroUsd;

    return {
      allowed: true as const,
      session: { requestId, config: { ...this.config }, preflight },
    };
  }

  async finalizeRequest(params: {
    userId: number;
    requestId: string;
    reservationMicroUsd: number;
    monthKey: string;
    dayKey: string;
    mode: MentorMode;
    language: 'en' | 'hi';
    promptSummary: string;
    result: MentorResponse | null;
    now?: Date;
  }) {
    const now = params.now ?? new Date();
    const l = this.ledger.get(params.monthKey)!;
    const c = this.counters.get(params.userId)!;
    l.reservedMicroUsd = Math.max(0, l.reservedMicroUsd - params.reservationMicroUsd);

    let actualCost = 0;
    if (params.result) {
      actualCost = calculateCostMicroUsd({
        promptTokens: params.result.usage.promptTokens,
        responseTokens: params.result.usage.responseTokens,
        thinkingTokens: params.result.usage.thinkingTokens,
        model: params.result.model,
      });
      l.totalRequests += 1;
      l.totalPromptTokens += params.result.usage.promptTokens;
      l.totalResponseTokens += params.result.usage.responseTokens;
      l.totalThinkingTokens += params.result.usage.thinkingTokens;
      l.spentMicroUsd += actualCost;

      if (this.config.overrideMonthKey !== params.monthKey && l.spentMicroUsd >= this.config.monthlyBudgetMicroUsd) {
        this.config.budgetHalted = true;
        this.config.haltedMonthKey = params.monthKey;
      }

      c.dailyCount += 1;
      c.monthlyCount += 1;
      c.dailyTokens += params.result.usage.totalTokens;
      c.monthlyTokens += params.result.usage.totalTokens;
      c.monthlyEstimatedCostMicroUsd += actualCost;
      c.lastRequestAt = now;
    }

    if (c.activeRequestId === params.requestId) {
      c.activeRequestId = null;
      c.activeStartedAt = null;
    }

    const status = await this.getStatus(params.userId, now);
    return { estimatedCostUsd: microUsdToUsd(actualCost), status };
  }

  async getAdminOverview(now: Date = new Date()): Promise<AdminMentorOverviewPayload> {
    const win = getUtcWindowKeys(now);
    const l = this.ledger.get(win.monthKey);
    const spent = l?.spentMicroUsd ?? 0;
    const reserved = l?.reservedMicroUsd ?? 0;
    return {
      config: {
        enabled: this.config.enabled,
        dailyUserLimit: this.config.dailyUserLimit,
        monthlyUserLimit: this.config.monthlyUserLimit,
        maxPromptTokens: this.config.maxPromptTokens,
        maxResponseTokens: this.config.maxResponseTokens,
        cooldownSeconds: this.config.cooldownSeconds,
        monthlyBudgetUsd: microUsdToUsd(this.config.monthlyBudgetMicroUsd),
        budgetHalted: this.config.budgetHalted && this.config.haltedMonthKey === win.monthKey,
        haltedReason: this.config.haltedReason,
        overrideActiveThisMonth: this.config.overrideMonthKey === win.monthKey,
      },
      ledger: {
        monthKey: win.monthKey,
        totalRequests: l?.totalRequests ?? 0,
        totalPromptTokens: l?.totalPromptTokens ?? 0,
        totalResponseTokens: l?.totalResponseTokens ?? 0,
        totalThinkingTokens: l?.totalThinkingTokens ?? 0,
        spentUsd: microUsdToUsd(spent),
        reservedUsd: microUsdToUsd(reserved),
        remainingBudgetUsd: microUsdToUsd(Math.max(0, this.config.monthlyBudgetMicroUsd - spent - reserved)),
        costIsEstimated: true,
      },
      resets: win,
      userUsage: [],
      recentRecords: [],
    };
  }

  async updateConfig(params: { actor: DbUser; patch: Partial<AiMentorConfigData> }) {
    this.config = { ...this.config, ...params.patch };
    return (await this.getAdminOverview()).config;
  }

  async resumeBudget(params: {
    actor: DbUser;
    newMonthlyBudgetUsd?: number;
    overrideSpendingLimit?: boolean;
    now?: Date;
  }) {
    const win = getUtcWindowKeys(params.now ?? new Date());
    const l = this.ledger.get(win.monthKey);
    const committed = (l?.spentMicroUsd ?? 0) + (l?.reservedMicroUsd ?? 0);
    const nextBudget =
      params.newMonthlyBudgetUsd !== undefined
        ? usdToMicroUsd(params.newMonthlyBudgetUsd)
        : this.config.monthlyBudgetMicroUsd;
    const override = Boolean(params.overrideSpendingLimit);
    if (!override && nextBudget <= committed) {
      return { ok: false as const, status: 400, error: 'Increase budget or enable override.' };
    }
    this.config.monthlyBudgetMicroUsd = nextBudget;
    this.config.budgetHalted = false;
    this.config.haltedReason = null;
    this.config.haltedMonthKey = null;
    this.config.overrideMonthKey = override ? win.monthKey : null;
    return { ok: true as const, overview: await this.getAdminOverview(params.now) };
  }

  async resetCounters(params: {
    actor: DbUser;
    scope: 'daily' | 'monthly' | 'all' | 'active_lock';
    targetUserId?: number;
  }) {
    let affected = 0;
    for (const [uid, c] of this.counters.entries()) {
      if (params.targetUserId && uid !== params.targetUserId) continue;
      affected++;
      if (params.scope === 'daily' || params.scope === 'all') c.dailyCount = 0;
      if (params.scope === 'monthly' || params.scope === 'all') c.monthlyCount = 0;
      if (params.scope === 'active_lock' || params.scope === 'all') {
        c.activeRequestId = null;
        c.activeStartedAt = null;
      }
      if (params.scope === 'all') c.lastRequestAt = null;
    }
    return { affectedUsers: affected };
  }
}

async function withServer(
  setup: (app: express.Express) => void,
  fn: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  app.use((req: AuthRequest, _res, next) => {
    const role = req.headers['x-test-role'] as string | undefined;
    const uid = Number(req.headers['x-test-uid'] || 10);
    if (role) {
      req.dbUser = makeFakeUser({
        id: uid,
        role: role as DbUser['role'],
        email: `${role}-${uid}@kali3977.test`,
      });
    }
    next();
  });
  setup(app);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to bind test server');
  }
  try {
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('AI Cyber Mentor routes enforce single-flight lock, cooldown, error rollback, concurrent budget cap, and Owner-only budget override', async () => {
  const store = new MemoryAiMentorStore();
  let failNextCall = false;
  let artificialDelayMs = 60;

  const router = createAiMentorRouter({
    store,
    authMiddleware: (req, res, next) => {
      if (!req.dbUser) {
        return res.status(401).json({ error: 'Authentication required.' });
      }
      return next();
    },
    optionalAuthMiddleware: (_req, _res, next) => next(),
    askMentor: async (input) => {
      assert.equal(input.maxResponseTokens, store.config.maxResponseTokens);
      if (artificialDelayMs > 0) {
        await new Promise((r) => setTimeout(r, artificialDelayMs));
      }
      if (failNextCall) {
        failNextCall = false;
        throw new Error('Simulated upstream Gemini timeout');
      }
      return {
        reply: 'Use parameterized queries with bound placeholders.',
        model: 'gemini-4-hydrogen',
        usage: {
          promptTokens: 40,
          responseTokens: 100,
          thinkingTokens: 10,
          totalTokens: 150,
          fromProviderMetadata: true,
        },
      };
    },
  });

  await withServer(
    (app) => {
      app.use('/api', router);
    },
    async (baseUrl) => {
      // 1. Status endpoint returns remaining daily/monthly & reset times
      const statusRes = await fetch(`${baseUrl}/api/ai/mentor/status`, {
        headers: { 'x-test-role': 'player', 'x-test-uid': '10' },
      });
      assert.equal(statusRes.status, 200);
      const statusJson = (await statusRes.json()) as MentorStatusPayload;
      assert.equal(statusJson.limits.dailyUserLimit, 20);
      assert.equal(statusJson.limits.monthlyUserLimit, 300);
      assert.equal(statusJson.usage?.dailyRemaining, 20);
      assert.ok(statusJson.resets.dailyResetsAt.endsWith('Z'));

      // 2. Same user sending 2 concurrent requests: 1st succeeds, 2nd gets 409 CONCURRENT_REQUEST
      const [r1, r2] = await Promise.all([
        fetch(`${baseUrl}/api/ai/mentor`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-test-role': 'player', 'x-test-uid': '10' },
          body: JSON.stringify({ prompt: 'What is SQL injection?', mode: 'concept' }),
        }),
        fetch(`${baseUrl}/api/ai/mentor`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-test-role': 'player', 'x-test-uid': '10' },
          body: JSON.stringify({ prompt: 'What is XSS?', mode: 'concept' }),
        }),
      ]);
      const statuses = [r1.status, r2.status].sort();
      assert.deepEqual(statuses, [200, 409]);

      // 3. Immediate follow-up hits 3s cooldown -> 429 with Retry-After
      const cooldownRes = await fetch(`${baseUrl}/api/ai/mentor`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-test-role': 'player', 'x-test-uid': '10' },
        body: JSON.stringify({ prompt: 'What is CSRF?', mode: 'concept' }),
      });
      assert.equal(cooldownRes.status, 429);
      assert.ok(Number(cooldownRes.headers.get('retry-after')) >= 1);

      // 4. Upstream Gemini error releases active lock & reserved budget without charging user quota
      artificialDelayMs = 10;
      failNextCall = true;
      const beforeUsage = store.counters.get(10)!.dailyCount;
      const win = getUtcWindowKeys();
      const beforeSpent = store.ledger.get(win.monthKey)!.spentMicroUsd;

      const errRes = await fetch(`${baseUrl}/api/ai/mentor`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-test-role': 'player', 'x-test-uid': '20' },
        body: JSON.stringify({ prompt: 'Explain AES-GCM', mode: 'concept' }),
      });
      assert.equal(errRes.status, 502);
      assert.equal(store.counters.get(20)!.activeRequestId, null);
      assert.equal(store.counters.get(20)!.dailyCount, 0);
      assert.equal(store.counters.get(10)!.dailyCount, beforeUsage);
      assert.equal(store.ledger.get(win.monthKey)!.reservedMicroUsd, 0);
      assert.equal(store.ledger.get(win.monthKey)!.spentMicroUsd, beforeSpent);

      // 5. Concurrent multi-user budget cap: set budget tight enough for ONLY 1 reservation
      // One reservation (~320+5+1500 tokens) = ~3,850 microUSD. Set budget to currentSpent + 5,000 microUSD.
      store.config.monthlyBudgetMicroUsd = beforeSpent + 5000;
      artificialDelayMs = 50;
      const [u21Res, u22Res] = await Promise.all([
        fetch(`${baseUrl}/api/ai/mentor`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-test-role': 'player', 'x-test-uid': '21' },
          body: JSON.stringify({ prompt: 'Explain RBAC', mode: 'concept' }),
        }),
        fetch(`${baseUrl}/api/ai/mentor`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-test-role': 'player', 'x-test-uid': '22' },
          body: JSON.stringify({ prompt: 'Explain ABAC', mode: 'concept' }),
        }),
      ]);
      const budgetStatuses = [u21Res.status, u22Res.status].sort();
      assert.deepEqual(budgetStatuses, [200, 503]);
      assert.ok(store.ledger.get(win.monthKey)!.spentMicroUsd <= store.config.monthlyBudgetMicroUsd);
      assert.equal(store.config.budgetHalted, true);

      // 6. RBAC: event_admin CANNOT change budget or resume spending halt; Owner CAN
      const adminBudgetTry = await fetch(`${baseUrl}/api/admin/ai-mentor/config`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-test-role': 'event_admin', 'x-test-uid': '5' },
        body: JSON.stringify({ monthlyBudgetUsd: 100 }),
      });
      assert.equal(adminBudgetTry.status, 403);

      const adminResumeTry = await fetch(`${baseUrl}/api/admin/ai-mentor/budget-resume`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-test-role': 'event_admin', 'x-test-uid': '5' },
        body: JSON.stringify({ monthlyBudgetUsd: 100 }),
      });
      assert.equal(adminResumeTry.status, 403);

      // event_admin CAN update dailyUserLimit and reset counters
      const adminLimitsOk = await fetch(`${baseUrl}/api/admin/ai-mentor/config`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-test-role': 'event_admin', 'x-test-uid': '5' },
        body: JSON.stringify({ dailyUserLimit: 25 }),
      });
      assert.equal(adminLimitsOk.status, 200);

      const adminResetOk = await fetch(`${baseUrl}/api/admin/ai-mentor/reset`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-test-role': 'event_admin', 'x-test-uid': '5' },
        body: JSON.stringify({ scope: 'daily', targetUserId: 10 }),
      });
      assert.equal(adminResetOk.status, 200);
      assert.equal(store.counters.get(10)!.dailyCount, 0);

      // Player CANNOT access admin routes
      const playerAdminTry = await fetch(`${baseUrl}/api/admin/ai-mentor/overview`, {
        headers: { 'x-test-role': 'player', 'x-test-uid': '10' },
      });
      assert.equal(playerAdminTry.status, 403);

      // Owner resumes service with raised budget -> service works again
      const ownerResume = await fetch(`${baseUrl}/api/admin/ai-mentor/budget-resume`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-test-role': 'owner', 'x-test-uid': '1' },
        body: JSON.stringify({ monthlyBudgetUsd: 25, overrideSpendingLimit: false }),
      });
      assert.equal(ownerResume.status, 200);
      assert.equal(store.config.budgetHalted, false);

      const afterResumeRes = await fetch(`${baseUrl}/api/ai/mentor`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-test-role': 'player', 'x-test-uid': '30' },
        body: JSON.stringify({ prompt: 'Explain zero trust architecture', mode: 'concept' }),
      });
      assert.equal(afterResumeRes.status, 200);
      const afterResumeJson = await afterResumeRes.json();
      assert.equal(afterResumeJson.costIsEstimated, true);
    },
  );
});
