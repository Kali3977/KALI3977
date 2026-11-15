import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_REQUEST_STALE_MS,
  DEFAULT_AI_MENTOR_CONFIG,
  MICRO_USD_PER_USD,
  calculateCostMicroUsd,
  calculateMaxReservationMicroUsd,
  estimateTokens,
  evaluateMentorPreflight,
  getUtcWindowKeys,
  sanitizeAdminConfigPatch,
  type AiMentorConfigData,
} from './mentor-limits.ts';

test('DEFAULT_AI_MENTOR_CONFIG matches required initial defaults', () => {
  assert.equal(DEFAULT_AI_MENTOR_CONFIG.enabled, true);
  assert.equal(DEFAULT_AI_MENTOR_CONFIG.dailyUserLimit, 20);
  assert.equal(DEFAULT_AI_MENTOR_CONFIG.monthlyUserLimit, 300);
  assert.equal(DEFAULT_AI_MENTOR_CONFIG.maxPromptTokens, 4000);
  assert.equal(DEFAULT_AI_MENTOR_CONFIG.maxResponseTokens, 1500);
  assert.equal(DEFAULT_AI_MENTOR_CONFIG.cooldownSeconds, 3);
  assert.ok(DEFAULT_AI_MENTOR_CONFIG.monthlyBudgetMicroUsd > 0);
});

test('getUtcWindowKeys computes exact UTC daily and monthly rollover timestamps', () => {
  const sample = new Date('2026-11-15T14:35:00.000Z');
  const win = getUtcWindowKeys(sample);
  assert.equal(win.dayKey, '2026-11-15');
  assert.equal(win.monthKey, '2026-11');
  assert.equal(win.dailyResetsAt, '2026-11-16T00:00:00.000Z');
  assert.equal(win.monthlyResetsAt, '2026-12-01T00:00:00.000Z');
});

test('estimateTokens scales reasonably for English and Hindi prompts', () => {
  assert.equal(estimateTokens('   '), 0);
  assert.ok(estimateTokens('Explain TLS 1.3 handshake') >= 5);
  assert.ok(estimateTokens('साइबर सुरक्षा क्या है') >= 8);
  const longPrompt = 'a'.repeat(16004);
  assert.ok(estimateTokens(longPrompt) > 4000);
});

test('evaluateMentorPreflight enforces all per-user limits and window rollovers', () => {
  const now = new Date('2026-11-15T10:00:10.000Z');
  const baseCfg: AiMentorConfigData = { ...DEFAULT_AI_MENTOR_CONFIG };

  // 1. Disabled
  const disabled = evaluateMentorPreflight({
    config: { ...baseCfg, enabled: false },
    prompt: 'Explain DNSSEC',
    userCounter: null,
    monthlyLedger: null,
    now,
  });
  assert.equal(disabled.allowed, false);
  assert.equal(disabled.code, 'DISABLED');
  assert.equal(disabled.httpStatus, 503);

  // 2. Prompt > 4000 tokens
  const tooLong = evaluateMentorPreflight({
    config: baseCfg,
    prompt: 'x'.repeat(16005),
    userCounter: null,
    monthlyLedger: null,
    now,
  });
  assert.equal(tooLong.allowed, false);
  assert.equal(tooLong.code, 'PROMPT_TOO_LONG');
  assert.equal(tooLong.httpStatus, 400);

  // 3. Active concurrent request (< 120s)
  const concurrent = evaluateMentorPreflight({
    config: baseCfg,
    prompt: 'Explain firewall rules',
    userCounter: {
      dayKey: '2026-11-15',
      dailyCount: 1,
      monthKey: '2026-11',
      monthlyCount: 1,
      lastRequestAt: new Date(now.getTime() - 10_000),
      activeRequestId: 'req-123',
      activeStartedAt: new Date(now.getTime() - 2_000),
    },
    monthlyLedger: null,
    now,
  });
  assert.equal(concurrent.allowed, false);
  assert.equal(concurrent.code, 'CONCURRENT_REQUEST');
  assert.equal(concurrent.httpStatus, 409);

  // 3b. Stale active lock (> 120s) auto-recovers
  const staleRecovered = evaluateMentorPreflight({
    config: baseCfg,
    prompt: 'Explain firewall rules',
    userCounter: {
      dayKey: '2026-11-15',
      dailyCount: 1,
      monthKey: '2026-11',
      monthlyCount: 1,
      lastRequestAt: new Date(now.getTime() - ACTIVE_REQUEST_STALE_MS - 5000),
      activeRequestId: 'req-stale',
      activeStartedAt: new Date(now.getTime() - ACTIVE_REQUEST_STALE_MS - 1000),
    },
    monthlyLedger: null,
    now,
  });
  assert.equal(staleRecovered.allowed, true);

  // 4. Cooldown (3s)
  const cooldown = evaluateMentorPreflight({
    config: baseCfg,
    prompt: 'Explain SSH keys',
    userCounter: {
      dayKey: '2026-11-15',
      dailyCount: 1,
      monthKey: '2026-11',
      monthlyCount: 1,
      lastRequestAt: new Date(now.getTime() - 1500),
      activeRequestId: null,
      activeStartedAt: null,
    },
    monthlyLedger: null,
    now,
  });
  assert.equal(cooldown.allowed, false);
  assert.equal(cooldown.code, 'COOLDOWN');
  assert.equal(cooldown.httpStatus, 429);
  assert.equal(cooldown.retryAfterSeconds, 2);

  // 5. Daily limit reached on same day, resets on next UTC day
  const dailyHit = evaluateMentorPreflight({
    config: baseCfg,
    prompt: 'Explain SSH keys',
    userCounter: {
      dayKey: '2026-11-15',
      dailyCount: 20,
      monthKey: '2026-11',
      monthlyCount: 20,
      lastRequestAt: new Date(now.getTime() - 60_000),
      activeRequestId: null,
      activeStartedAt: null,
    },
    monthlyLedger: null,
    now,
  });
  assert.equal(dailyHit.allowed, false);
  assert.equal(dailyHit.code, 'DAILY_LIMIT');

  const nextDayAllowed = evaluateMentorPreflight({
    config: baseCfg,
    prompt: 'Explain SSH keys',
    userCounter: {
      dayKey: '2026-11-15',
      dailyCount: 20,
      monthKey: '2026-11',
      monthlyCount: 20,
      lastRequestAt: new Date(now.getTime() - 60_000),
      activeRequestId: null,
      activeStartedAt: null,
    },
    monthlyLedger: null,
    now: new Date('2026-11-16T00:01:00.000Z'),
  });
  assert.equal(nextDayAllowed.allowed, true);
  assert.equal(nextDayAllowed.effectiveDailyCount, 0);
  assert.equal(nextDayAllowed.effectiveMonthlyCount, 20);

  // 6. Monthly limit reached
  const monthlyHit = evaluateMentorPreflight({
    config: baseCfg,
    prompt: 'Explain SSH keys',
    userCounter: {
      dayKey: '2026-11-15',
      dailyCount: 5,
      monthKey: '2026-11',
      monthlyCount: 300,
      lastRequestAt: new Date(now.getTime() - 60_000),
      activeRequestId: null,
      activeStartedAt: null,
    },
    monthlyLedger: null,
    now,
  });
  assert.equal(monthlyHit.allowed, false);
  assert.equal(monthlyHit.code, 'MONTHLY_LIMIT');
});

test('evaluateMentorPreflight blocks when budget + reserved would exceed monthly cap unless Owner override active', () => {
  const now = new Date('2026-11-15T10:00:00.000Z');
  const maxRes = calculateMaxReservationMicroUsd({ promptTokens: 50, maxResponseTokens: 1500 });
  assert.ok(maxRes > 0);
  const actualCost = calculateCostMicroUsd({ promptTokens: 50, responseTokens: 200, thinkingTokens: 50 });
  assert.ok(actualCost > 0 && actualCost < maxRes);

  const cfg: AiMentorConfigData = {
    ...DEFAULT_AI_MENTOR_CONFIG,
    monthlyBudgetMicroUsd: 1 * MICRO_USD_PER_USD, // $1.00
  };

  const blocked = evaluateMentorPreflight({
    config: cfg,
    prompt: 'Explain Kerberos authentication',
    userCounter: null,
    monthlyLedger: {
      monthKey: '2026-11',
      spentMicroUsd: 999_000,
      reservedMicroUsd: 500,
    },
    now,
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, 'BUDGET_EXHAUSTED');
  assert.equal(blocked.shouldHaltBudget, true);

  const overridden = evaluateMentorPreflight({
    config: { ...cfg, budgetHalted: true, haltedMonthKey: '2026-11', overrideMonthKey: '2026-11' },
    prompt: 'Explain Kerberos authentication',
    userCounter: null,
    monthlyLedger: {
      monthKey: '2026-11',
      spentMicroUsd: 999_000,
      reservedMicroUsd: 500,
    },
    now,
  });
  assert.equal(overridden.allowed, true);
});

test('sanitizeAdminConfigPatch restricts global budget edits to Owner only', () => {
  const adminValid = sanitizeAdminConfigPatch(
    { enabled: true, dailyUserLimit: 15, monthlyUserLimit: 200, cooldownSeconds: 5 },
    false,
  );
  assert.equal(adminValid.valid, true);
  assert.equal(adminValid.patch?.dailyUserLimit, 15);

  const adminBudgetRejected = sanitizeAdminConfigPatch(
    { dailyUserLimit: 15, monthlyBudgetUsd: 50 },
    false,
  );
  assert.equal(adminBudgetRejected.valid, false);
  assert.equal(adminBudgetRejected.ownerFieldRejected, true);

  const ownerBudgetAllowed = sanitizeAdminConfigPatch({ monthlyBudgetUsd: 50 }, true);
  assert.equal(ownerBudgetAllowed.valid, true);
  assert.equal(ownerBudgetAllowed.patch?.monthlyBudgetMicroUsd, 50 * MICRO_USD_PER_USD);
});
