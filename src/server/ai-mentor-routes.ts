import crypto from 'node:crypto';
import { Router } from 'express';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  aiMentorConfig,
  aiMentorMonthlyLedger,
  aiMentorUserCounters,
  aiUsageRecords,
  auditLogs,
  platformSettings,
  users,
} from '../db/schema.ts';
import {
  ALLOWED_MENTOR_MODES,
  DEFAULT_AI_MENTOR_CONFIG,
  calculateCostMicroUsd,
  evaluateMentorPreflight,
  getUtcWindowKeys,
  microUsdToUsd,
  sanitizeAdminConfigPatch,
  usdToMicroUsd,
  type AiMentorConfigData,
  type MentorMode,
  type PreflightResult,
} from '../lib/ai/mentor-limits.ts';
import { sanitizeText } from '../lib/domain/security.ts';
import {
  optionalAuth,
  requireAuth,
  type AuthRequest,
  type DbUser,
} from '../middleware/auth.ts';
import {
  requireSectionEnabled,
  syncSectionFromLegacyToggle,
} from '../middleware/section-guard.ts';
import { askAiCyberMentor, type MentorRequest, type MentorResponse } from './ai-mentor.ts';

export interface ReservedMentorSession {
  requestId: string;
  config: AiMentorConfigData;
  preflight: PreflightResult;
}

export interface MentorStatusPayload {
  enabled: boolean;
  budgetHalted: boolean;
  budgetMessage: string | null;
  limits: {
    dailyUserLimit: number;
    monthlyUserLimit: number;
    maxPromptTokens: number;
    maxResponseTokens: number;
    cooldownSeconds: number;
  };
  usage: {
    dailyUsed: number;
    dailyRemaining: number;
    monthlyUsed: number;
    monthlyRemaining: number;
    cooldownRemainingSeconds: number;
    activeRequest: boolean;
  } | null;
  resets: {
    dayKey: string;
    monthKey: string;
    dailyResetsAt: string;
    monthlyResetsAt: string;
  };
}

export interface AdminMentorOverviewPayload {
  config: {
    enabled: boolean;
    dailyUserLimit: number;
    monthlyUserLimit: number;
    maxPromptTokens: number;
    maxResponseTokens: number;
    cooldownSeconds: number;
    monthlyBudgetUsd: number;
    budgetHalted: boolean;
    haltedReason: string | null;
    overrideActiveThisMonth: boolean;
  };
  ledger: {
    monthKey: string;
    totalRequests: number;
    totalPromptTokens: number;
    totalResponseTokens: number;
    totalThinkingTokens: number;
    spentUsd: number;
    reservedUsd: number;
    remainingBudgetUsd: number;
    costIsEstimated: boolean;
  };
  resets: {
    dayKey: string;
    monthKey: string;
    dailyResetsAt: string;
    monthlyResetsAt: string;
  };
  userUsage: Array<{
    userId: number;
    email: string;
    username: string;
    displayName: string;
    dailyCount: number;
    monthlyCount: number;
    dailyTokens: number;
    monthlyTokens: number;
    monthlyEstimatedSpendUsd: number;
    activeRequest: boolean;
    lastRequestAt: string | null;
  }>;
  recentRecords: Array<{
    id: number;
    userId: number;
    email: string | null;
    mode: string;
    language: string;
    model: string;
    promptTokens: number;
    responseTokens: number;
    thinkingTokens: number;
    estimatedCostUsd: number;
    costIsEstimated: boolean;
    status: string;
    createdAt: string;
  }>;
}

export interface AiMentorStore {
  getStatus(userId: number | null, now?: Date): Promise<MentorStatusPayload>;
  reserveRequest(params: {
    userId: number;
    prompt: string;
    now?: Date;
  }): Promise<{ allowed: true; session: ReservedMentorSession } | { allowed: false; preflight: PreflightResult }>;
  finalizeRequest(params: {
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
  }): Promise<{
    estimatedCostUsd: number;
    status: MentorStatusPayload;
  }>;
  getAdminOverview(now?: Date): Promise<AdminMentorOverviewPayload>;
  updateConfig(params: {
    actor: DbUser;
    patch: Partial<AiMentorConfigData>;
    ipAddress?: string;
    now?: Date;
  }): Promise<AdminMentorOverviewPayload['config']>;
  resumeBudget(params: {
    actor: DbUser;
    newMonthlyBudgetUsd?: number;
    overrideSpendingLimit?: boolean;
    ipAddress?: string;
    now?: Date;
  }): Promise<
    | { ok: true; overview: AdminMentorOverviewPayload }
    | { ok: false; status: number; error: string }
  >;
  resetCounters(params: {
    actor: DbUser;
    scope: 'daily' | 'monthly' | 'all' | 'active_lock';
    targetUserId?: number;
    ipAddress?: string;
    now?: Date;
  }): Promise<{ affectedUsers: number }>;
}

function mapConfigRow(row?: typeof aiMentorConfig.$inferSelect): AiMentorConfigData {
  if (!row) return { ...DEFAULT_AI_MENTOR_CONFIG };
  return {
    enabled: row.enabled,
    dailyUserLimit: row.dailyUserLimit,
    monthlyUserLimit: row.monthlyUserLimit,
    maxPromptTokens: row.maxPromptTokens,
    maxResponseTokens: row.maxResponseTokens,
    cooldownSeconds: row.cooldownSeconds,
    monthlyBudgetMicroUsd: row.monthlyBudgetMicroUsd,
    budgetHalted: row.budgetHalted,
    haltedReason: row.haltedReason,
    haltedMonthKey: row.haltedMonthKey,
    overrideMonthKey: row.overrideMonthKey,
  };
}

async function syncPlatformControlsFromMentorConfig(
  cfg: AiMentorConfigData,
  actorId: number,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db,
) {
  const [existing] = await tx
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'platform_controls'))
    .limit(1);

  const currentJson = (existing?.valueJson as Record<string, unknown>) || {};
  const nextJson = {
    ...currentJson,
    disableAiMentor: !cfg.enabled,
    aiDailyQuotaPerUser: cfg.dailyUserLimit,
  };

  await tx
    .insert(platformSettings)
    .values({ key: 'platform_controls', valueJson: nextJson, updatedById: actorId })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { valueJson: nextJson, updatedById: actorId, updatedAt: new Date() },
    });
}

export class PgAiMentorStore implements AiMentorStore {
  private async ensureConfigRow() {
    await db
      .insert(aiMentorConfig)
      .values({
        id: 1,
        enabled: DEFAULT_AI_MENTOR_CONFIG.enabled,
        dailyUserLimit: DEFAULT_AI_MENTOR_CONFIG.dailyUserLimit,
        monthlyUserLimit: DEFAULT_AI_MENTOR_CONFIG.monthlyUserLimit,
        maxPromptTokens: DEFAULT_AI_MENTOR_CONFIG.maxPromptTokens,
        maxResponseTokens: DEFAULT_AI_MENTOR_CONFIG.maxResponseTokens,
        cooldownSeconds: DEFAULT_AI_MENTOR_CONFIG.cooldownSeconds,
        monthlyBudgetMicroUsd: DEFAULT_AI_MENTOR_CONFIG.monthlyBudgetMicroUsd,
        budgetHalted: false,
      })
      .onConflictDoNothing();
  }

  async getStatus(userId: number | null, now: Date = new Date()): Promise<MentorStatusPayload> {
    await this.ensureConfigRow();
    const window = getUtcWindowKeys(now);
    const [cfgRow] = await db.select().from(aiMentorConfig).where(eq(aiMentorConfig.id, 1)).limit(1);
    const config = mapConfigRow(cfgRow);

    const [ledgerRow] = await db
      .select()
      .from(aiMentorMonthlyLedger)
      .where(eq(aiMentorMonthlyLedger.monthKey, window.monthKey))
      .limit(1);

    const overrideActive = config.overrideMonthKey === window.monthKey;
    const spent = ledgerRow?.spentMicroUsd ?? 0;
    const reserved = ledgerRow?.reservedMicroUsd ?? 0;
    const budgetHaltedForMonth =
      !overrideActive &&
      ((config.budgetHalted && config.haltedMonthKey === window.monthKey) ||
        spent + reserved >= config.monthlyBudgetMicroUsd);

    let usage: MentorStatusPayload['usage'] = null;
    if (userId !== null) {
      const [counterRow] = await db
        .select()
        .from(aiMentorUserCounters)
        .where(eq(aiMentorUserCounters.userId, userId))
        .limit(1);

      const dailyUsed = counterRow && counterRow.dayKey === window.dayKey ? counterRow.dailyCount : 0;
      const monthlyUsed =
        counterRow && counterRow.monthKey === window.monthKey ? counterRow.monthlyCount : 0;
      const dailyRemaining = Math.max(0, config.dailyUserLimit - dailyUsed);
      const monthlyRemaining = Math.max(0, config.monthlyUserLimit - monthlyUsed);

      let cooldownRemainingSeconds = 0;
      if (config.cooldownSeconds > 0 && counterRow?.lastRequestAt) {
        const elapsedMs = now.getTime() - counterRow.lastRequestAt.getTime();
        const cooldownMs = config.cooldownSeconds * 1000;
        if (elapsedMs >= 0 && elapsedMs < cooldownMs) {
          cooldownRemainingSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
        }
      }

      const activeRequest = Boolean(
        counterRow?.activeRequestId &&
          counterRow.activeStartedAt &&
          now.getTime() - counterRow.activeStartedAt.getTime() < 120_000,
      );

      usage = {
        dailyUsed,
        dailyRemaining,
        monthlyUsed,
        monthlyRemaining,
        cooldownRemainingSeconds,
        activeRequest,
      };
    }

    return {
      enabled: config.enabled,
      budgetHalted: budgetHaltedForMonth,
      budgetMessage: budgetHaltedForMonth
        ? `AI Cyber Mentor has reached its global monthly spending limit and is paused until ${window.monthlyResetsAt} or Platform Owner review.`
        : null,
      limits: {
        dailyUserLimit: config.dailyUserLimit,
        monthlyUserLimit: config.monthlyUserLimit,
        maxPromptTokens: config.maxPromptTokens,
        maxResponseTokens: config.maxResponseTokens,
        cooldownSeconds: config.cooldownSeconds,
      },
      usage,
      resets: window,
    };
  }

  async reserveRequest(params: {
    userId: number;
    prompt: string;
    now?: Date;
  }): Promise<
    { allowed: true; session: ReservedMentorSession } | { allowed: false; preflight: PreflightResult }
  > {
    const now = params.now ?? new Date();
    const window = getUtcWindowKeys(now);
    await this.ensureConfigRow();

    return db.transaction(async (tx) => {
      await tx
        .insert(aiMentorUserCounters)
        .values({
          userId: params.userId,
          dayKey: window.dayKey,
          dailyCount: 0,
          monthKey: window.monthKey,
          monthlyCount: 0,
        })
        .onConflictDoNothing();

      await tx
        .insert(aiMentorMonthlyLedger)
        .values({ monthKey: window.monthKey })
        .onConflictDoNothing();

      const cfgRes = await tx.execute(
        sql`SELECT * FROM ai_mentor_config WHERE id = 1 FOR UPDATE`,
      );
      const cfgRaw = cfgRes.rows[0] as Record<string, unknown> | undefined;
      const config: AiMentorConfigData = cfgRaw
        ? {
            enabled: Boolean(cfgRaw.enabled),
            dailyUserLimit: Number(cfgRaw.daily_user_limit),
            monthlyUserLimit: Number(cfgRaw.monthly_user_limit),
            maxPromptTokens: Number(cfgRaw.max_prompt_tokens),
            maxResponseTokens: Number(cfgRaw.max_response_tokens),
            cooldownSeconds: Number(cfgRaw.cooldown_seconds),
            monthlyBudgetMicroUsd: Number(cfgRaw.monthly_budget_micro_usd),
            budgetHalted: Boolean(cfgRaw.budget_halted),
            haltedReason: (cfgRaw.halted_reason as string | null) ?? null,
            haltedMonthKey: (cfgRaw.halted_month_key as string | null) ?? null,
            overrideMonthKey: (cfgRaw.override_month_key as string | null) ?? null,
          }
        : { ...DEFAULT_AI_MENTOR_CONFIG };

      const counterRes = await tx.execute(
        sql`SELECT * FROM ai_mentor_user_counters WHERE user_id = ${params.userId} FOR UPDATE`,
      );
      const counterRaw = counterRes.rows[0] as Record<string, unknown>;

      const ledgerRes = await tx.execute(
        sql`SELECT * FROM ai_mentor_monthly_ledger WHERE month_key = ${window.monthKey} FOR UPDATE`,
      );
      const ledgerRaw = ledgerRes.rows[0] as Record<string, unknown>;

      const userCounter = {
        dayKey: String(counterRaw.day_key || ''),
        dailyCount: Number(counterRaw.daily_count || 0),
        monthKey: String(counterRaw.month_key || ''),
        monthlyCount: Number(counterRaw.monthly_count || 0),
        lastRequestAt: counterRaw.last_request_at
          ? new Date(String(counterRaw.last_request_at))
          : null,
        activeRequestId: (counterRaw.active_request_id as string | null) ?? null,
        activeStartedAt: counterRaw.active_started_at
          ? new Date(String(counterRaw.active_started_at))
          : null,
      };

      const monthlyLedger = {
        monthKey: String(ledgerRaw.month_key || window.monthKey),
        spentMicroUsd: Number(ledgerRaw.spent_micro_usd || 0),
        reservedMicroUsd: Number(ledgerRaw.reserved_micro_usd || 0),
      };

      const preflight = evaluateMentorPreflight({
        config,
        prompt: params.prompt,
        userCounter,
        monthlyLedger,
        now,
        model: 'gemini-4-hydrogen',
      });

      if (!preflight.allowed) {
        if (preflight.shouldHaltBudget && (!config.budgetHalted || config.haltedMonthKey !== window.monthKey)) {
          await tx
            .update(aiMentorConfig)
            .set({
              budgetHalted: true,
              haltedReason: 'Global monthly spending limit reached.',
              haltedMonthKey: window.monthKey,
              updatedAt: now,
            })
            .where(eq(aiMentorConfig.id, 1));
        }
        return { allowed: false, preflight };
      }

      const requestId = crypto.randomUUID();
      const resetDay = userCounter.dayKey !== window.dayKey;
      const resetMonth = userCounter.monthKey !== window.monthKey;

      await tx
        .update(aiMentorUserCounters)
        .set({
          dayKey: window.dayKey,
          dailyCount: resetDay ? 0 : userCounter.dailyCount,
          dailyTokens: resetDay ? 0 : Number(counterRaw.daily_tokens || 0),
          monthKey: window.monthKey,
          monthlyCount: resetMonth ? 0 : userCounter.monthlyCount,
          monthlyTokens: resetMonth ? 0 : Number(counterRaw.monthly_tokens || 0),
          monthlyEstimatedCostMicroUsd: resetMonth
            ? 0
            : Number(counterRaw.monthly_estimated_cost_micro_usd || 0),
          activeRequestId: requestId,
          activeStartedAt: now,
          updatedAt: now,
        })
        .where(eq(aiMentorUserCounters.userId, params.userId));

      await tx
        .update(aiMentorMonthlyLedger)
        .set({
          reservedMicroUsd: monthlyLedger.reservedMicroUsd + preflight.reservationMicroUsd,
          updatedAt: now,
        })
        .where(eq(aiMentorMonthlyLedger.monthKey, window.monthKey));

      return {
        allowed: true,
        session: { requestId, config, preflight },
      };
    });
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
  }): Promise<{ estimatedCostUsd: number; status: MentorStatusPayload }> {
    const now = params.now ?? new Date();

    const actualCostMicroUsd = params.result
      ? calculateCostMicroUsd({
          promptTokens: params.result.usage.promptTokens,
          responseTokens: params.result.usage.responseTokens,
          thinkingTokens: params.result.usage.thinkingTokens,
          model: params.result.model,
        })
      : 0;

    await db.transaction(async (tx) => {
      const cfgRes = await tx.execute(sql`SELECT * FROM ai_mentor_config WHERE id = 1 FOR UPDATE`);
      const cfgRaw = cfgRes.rows[0] as Record<string, unknown> | undefined;
      const monthlyBudgetMicroUsd = Number(
        cfgRaw?.monthly_budget_micro_usd ?? DEFAULT_AI_MENTOR_CONFIG.monthlyBudgetMicroUsd,
      );
      const overrideMonthKey = (cfgRaw?.override_month_key as string | null) ?? null;

      const counterRes = await tx.execute(
        sql`SELECT * FROM ai_mentor_user_counters WHERE user_id = ${params.userId} FOR UPDATE`,
      );
      const counterRaw = counterRes.rows[0] as Record<string, unknown> | undefined;

      const ledgerRes = await tx.execute(
        sql`SELECT * FROM ai_mentor_monthly_ledger WHERE month_key = ${params.monthKey} FOR UPDATE`,
      );
      const ledgerRaw = ledgerRes.rows[0] as Record<string, unknown> | undefined;

      const currentReserved = Number(ledgerRaw?.reserved_micro_usd || 0);
      const nextReserved = Math.max(0, currentReserved - params.reservationMicroUsd);
      const currentSpent = Number(ledgerRaw?.spent_micro_usd || 0);
      const nextSpent = currentSpent + actualCostMicroUsd;

      if (params.result) {
        await tx
          .update(aiMentorMonthlyLedger)
          .set({
            totalRequests: Number(ledgerRaw?.total_requests || 0) + 1,
            totalPromptTokens:
              Number(ledgerRaw?.total_prompt_tokens || 0) + params.result.usage.promptTokens,
            totalResponseTokens:
              Number(ledgerRaw?.total_response_tokens || 0) + params.result.usage.responseTokens,
            totalThinkingTokens:
              Number(ledgerRaw?.total_thinking_tokens || 0) + params.result.usage.thinkingTokens,
            spentMicroUsd: nextSpent,
            reservedMicroUsd: nextReserved,
            updatedAt: now,
          })
          .where(eq(aiMentorMonthlyLedger.monthKey, params.monthKey));

        if (overrideMonthKey !== params.monthKey && nextSpent >= monthlyBudgetMicroUsd) {
          await tx
            .update(aiMentorConfig)
            .set({
              budgetHalted: true,
              haltedReason: 'Global monthly spending limit reached.',
              haltedMonthKey: params.monthKey,
              updatedAt: now,
            })
            .where(eq(aiMentorConfig.id, 1));
        }

        if (counterRaw) {
          const sameDay = String(counterRaw.day_key || '') === params.dayKey;
          const sameMonth = String(counterRaw.month_key || '') === params.monthKey;
          await tx
            .update(aiMentorUserCounters)
            .set({
              dayKey: params.dayKey,
              dailyCount: (sameDay ? Number(counterRaw.daily_count || 0) : 0) + 1,
              dailyTokens:
                (sameDay ? Number(counterRaw.daily_tokens || 0) : 0) +
                params.result.usage.totalTokens,
              monthKey: params.monthKey,
              monthlyCount: (sameMonth ? Number(counterRaw.monthly_count || 0) : 0) + 1,
              monthlyTokens:
                (sameMonth ? Number(counterRaw.monthly_tokens || 0) : 0) +
                params.result.usage.totalTokens,
              monthlyEstimatedCostMicroUsd:
                (sameMonth ? Number(counterRaw.monthly_estimated_cost_micro_usd || 0) : 0) +
                actualCostMicroUsd,
              lastRequestAt: now,
              activeRequestId:
                counterRaw.active_request_id === params.requestId
                  ? null
                  : (counterRaw.active_request_id as string | null),
              activeStartedAt:
                counterRaw.active_request_id === params.requestId
                  ? null
                  : counterRaw.active_started_at
                    ? new Date(String(counterRaw.active_started_at))
                    : null,
              updatedAt: now,
            })
            .where(eq(aiMentorUserCounters.userId, params.userId));
        }

        await tx.insert(aiUsageRecords).values({
          userId: params.userId,
          mode: params.mode,
          language: params.language,
          promptSummary: params.promptSummary,
          tokensEstimated: params.result.usage.totalTokens,
          model: params.result.model,
          promptTokens: params.result.usage.promptTokens,
          responseTokens: params.result.usage.responseTokens,
          thinkingTokens: params.result.usage.thinkingTokens,
          estimatedCostMicroUsd: actualCostMicroUsd,
          costIsEstimated: true,
          status: 'completed',
          dayKey: params.dayKey,
          monthKey: params.monthKey,
        });
      } else {
        await tx
          .update(aiMentorMonthlyLedger)
          .set({
            reservedMicroUsd: nextReserved,
            updatedAt: now,
          })
          .where(eq(aiMentorMonthlyLedger.monthKey, params.monthKey));

        if (counterRaw && counterRaw.active_request_id === params.requestId) {
          await tx
            .update(aiMentorUserCounters)
            .set({
              activeRequestId: null,
              activeStartedAt: null,
              updatedAt: now,
            })
            .where(eq(aiMentorUserCounters.userId, params.userId));
        }
      }
    });

    const status = await this.getStatus(params.userId, now);
    return {
      estimatedCostUsd: microUsdToUsd(actualCostMicroUsd),
      status,
    };
  }

  async getAdminOverview(now: Date = new Date()): Promise<AdminMentorOverviewPayload> {
    await this.ensureConfigRow();
    const window = getUtcWindowKeys(now);

    const [cfgRow] = await db.select().from(aiMentorConfig).where(eq(aiMentorConfig.id, 1)).limit(1);
    const config = mapConfigRow(cfgRow);

    const [ledgerRow] = await db
      .select()
      .from(aiMentorMonthlyLedger)
      .where(eq(aiMentorMonthlyLedger.monthKey, window.monthKey))
      .limit(1);

    const spentMicroUsd = ledgerRow?.spentMicroUsd ?? 0;
    const reservedMicroUsd = ledgerRow?.reservedMicroUsd ?? 0;
    const remainingMicroUsd = Math.max(0, config.monthlyBudgetMicroUsd - spentMicroUsd - reservedMicroUsd);

    const userRows = await db
      .select({
        userId: aiMentorUserCounters.userId,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        dayKey: aiMentorUserCounters.dayKey,
        dailyCount: aiMentorUserCounters.dailyCount,
        monthKey: aiMentorUserCounters.monthKey,
        monthlyCount: aiMentorUserCounters.monthlyCount,
        dailyTokens: aiMentorUserCounters.dailyTokens,
        monthlyTokens: aiMentorUserCounters.monthlyTokens,
        monthlyEstimatedCostMicroUsd: aiMentorUserCounters.monthlyEstimatedCostMicroUsd,
        activeRequestId: aiMentorUserCounters.activeRequestId,
        activeStartedAt: aiMentorUserCounters.activeStartedAt,
        lastRequestAt: aiMentorUserCounters.lastRequestAt,
      })
      .from(aiMentorUserCounters)
      .innerJoin(users, eq(aiMentorUserCounters.userId, users.id))
      .orderBy(desc(aiMentorUserCounters.monthlyCount))
      .limit(100);

    const recentRows = await db
      .select({
        id: aiUsageRecords.id,
        userId: aiUsageRecords.userId,
        email: users.email,
        mode: aiUsageRecords.mode,
        language: aiUsageRecords.language,
        model: aiUsageRecords.model,
        promptTokens: aiUsageRecords.promptTokens,
        responseTokens: aiUsageRecords.responseTokens,
        thinkingTokens: aiUsageRecords.thinkingTokens,
        estimatedCostMicroUsd: aiUsageRecords.estimatedCostMicroUsd,
        costIsEstimated: aiUsageRecords.costIsEstimated,
        status: aiUsageRecords.status,
        createdAt: aiUsageRecords.createdAt,
      })
      .from(aiUsageRecords)
      .leftJoin(users, eq(aiUsageRecords.userId, users.id))
      .orderBy(desc(aiUsageRecords.createdAt))
      .limit(40);

    return {
      config: {
        enabled: config.enabled,
        dailyUserLimit: config.dailyUserLimit,
        monthlyUserLimit: config.monthlyUserLimit,
        maxPromptTokens: config.maxPromptTokens,
        maxResponseTokens: config.maxResponseTokens,
        cooldownSeconds: config.cooldownSeconds,
        monthlyBudgetUsd: microUsdToUsd(config.monthlyBudgetMicroUsd),
        budgetHalted: config.budgetHalted && config.haltedMonthKey === window.monthKey,
        haltedReason: config.haltedReason,
        overrideActiveThisMonth: config.overrideMonthKey === window.monthKey,
      },
      ledger: {
        monthKey: window.monthKey,
        totalRequests: ledgerRow?.totalRequests ?? 0,
        totalPromptTokens: ledgerRow?.totalPromptTokens ?? 0,
        totalResponseTokens: ledgerRow?.totalResponseTokens ?? 0,
        totalThinkingTokens: ledgerRow?.totalThinkingTokens ?? 0,
        spentUsd: microUsdToUsd(spentMicroUsd),
        reservedUsd: microUsdToUsd(reservedMicroUsd),
        remainingBudgetUsd: microUsdToUsd(remainingMicroUsd),
        costIsEstimated: true,
      },
      resets: window,
      userUsage: userRows.map((u) => {
        const sameDay = u.dayKey === window.dayKey;
        const sameMonth = u.monthKey === window.monthKey;
        return {
          userId: u.userId,
          email: u.email,
          username: u.username,
          displayName: u.displayName,
          dailyCount: sameDay ? u.dailyCount : 0,
          monthlyCount: sameMonth ? u.monthlyCount : 0,
          dailyTokens: sameDay ? u.dailyTokens : 0,
          monthlyTokens: sameMonth ? u.monthlyTokens : 0,
          monthlyEstimatedSpendUsd: sameMonth ? microUsdToUsd(u.monthlyEstimatedCostMicroUsd) : 0,
          activeRequest: Boolean(
            u.activeRequestId &&
              u.activeStartedAt &&
              now.getTime() - u.activeStartedAt.getTime() < 120_000,
          ),
          lastRequestAt: u.lastRequestAt ? u.lastRequestAt.toISOString() : null,
        };
      }),
      recentRecords: recentRows.map((r) => ({
        id: r.id,
        userId: r.userId,
        email: r.email,
        mode: r.mode,
        language: r.language,
        model: r.model,
        promptTokens: r.promptTokens,
        responseTokens: r.responseTokens,
        thinkingTokens: r.thinkingTokens,
        estimatedCostUsd: microUsdToUsd(r.estimatedCostMicroUsd),
        costIsEstimated: r.costIsEstimated,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async updateConfig(params: {
    actor: DbUser;
    patch: Partial<AiMentorConfigData>;
    ipAddress?: string;
    now?: Date;
  }): Promise<AdminMentorOverviewPayload['config']> {
    const now = params.now ?? new Date();
    const window = getUtcWindowKeys(now);
    await this.ensureConfigRow();

    const updatedConfig = await db.transaction(async (tx) => {
      const [prev] = await tx.select().from(aiMentorConfig).where(eq(aiMentorConfig.id, 1)).limit(1);
      const prevMapped = mapConfigRow(prev);
      const merged: AiMentorConfigData = {
        ...prevMapped,
        ...params.patch,
      };

      await tx
        .update(aiMentorConfig)
        .set({
          enabled: merged.enabled,
          dailyUserLimit: merged.dailyUserLimit,
          monthlyUserLimit: merged.monthlyUserLimit,
          maxPromptTokens: merged.maxPromptTokens,
          maxResponseTokens: merged.maxResponseTokens,
          cooldownSeconds: merged.cooldownSeconds,
          monthlyBudgetMicroUsd: merged.monthlyBudgetMicroUsd,
          updatedById: params.actor.id,
          updatedAt: now,
        })
        .where(eq(aiMentorConfig.id, 1));

      await syncPlatformControlsFromMentorConfig(merged, params.actor.id, tx);

      await tx.insert(auditLogs).values({
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        action: 'AI_MENTOR_CONFIG_UPDATED',
        resourceType: 'ai_mentor_config',
        resourceId: '1',
        previousStateJson: prevMapped as unknown as Record<string, unknown>,
        newStateJson: merged as unknown as Record<string, unknown>,
        ipAddress: params.ipAddress ?? '0.0.0.0',
      });

      return merged;
    });

    return {
      enabled: updatedConfig.enabled,
      dailyUserLimit: updatedConfig.dailyUserLimit,
      monthlyUserLimit: updatedConfig.monthlyUserLimit,
      maxPromptTokens: updatedConfig.maxPromptTokens,
      maxResponseTokens: updatedConfig.maxResponseTokens,
      cooldownSeconds: updatedConfig.cooldownSeconds,
      monthlyBudgetUsd: microUsdToUsd(updatedConfig.monthlyBudgetMicroUsd),
      budgetHalted: updatedConfig.budgetHalted && updatedConfig.haltedMonthKey === window.monthKey,
      haltedReason: updatedConfig.haltedReason,
      overrideActiveThisMonth: updatedConfig.overrideMonthKey === window.monthKey,
    };
  }

  async resumeBudget(params: {
    actor: DbUser;
    newMonthlyBudgetUsd?: number;
    overrideSpendingLimit?: boolean;
    ipAddress?: string;
    now?: Date;
  }): Promise<
    { ok: true; overview: AdminMentorOverviewPayload } | { ok: false; status: number; error: string }
  > {
    const now = params.now ?? new Date();
    const window = getUtcWindowKeys(now);
    await this.ensureConfigRow();

    const txResult = await db.transaction(async (tx) => {
      const cfgRes = await tx.execute(sql`SELECT * FROM ai_mentor_config WHERE id = 1 FOR UPDATE`);
      const cfgRaw = cfgRes.rows[0] as Record<string, unknown>;
      const currentBudgetMicroUsd = Number(cfgRaw.monthly_budget_micro_usd || 0);

      const [ledgerRow] = await tx
        .select()
        .from(aiMentorMonthlyLedger)
        .where(eq(aiMentorMonthlyLedger.monthKey, window.monthKey))
        .limit(1);
      const currentCommitted = (ledgerRow?.spentMicroUsd ?? 0) + (ledgerRow?.reservedMicroUsd ?? 0);

      const nextBudgetMicroUsd =
        params.newMonthlyBudgetUsd !== undefined
          ? usdToMicroUsd(params.newMonthlyBudgetUsd)
          : currentBudgetMicroUsd;

      const override = Boolean(params.overrideSpendingLimit);
      if (!override && nextBudgetMicroUsd <= currentCommitted) {
        return {
          ok: false as const,
          status: 400,
          error: `Monthly spend ($${microUsdToUsd(currentCommitted).toFixed(4)}) has reached or exceeded the configured budget ($${microUsdToUsd(nextBudgetMicroUsd).toFixed(2)}). Increase the monthly budget above current spend or explicitly enable spending override.`,
        };
      }

      await tx
        .update(aiMentorConfig)
        .set({
          monthlyBudgetMicroUsd: nextBudgetMicroUsd,
          budgetHalted: false,
          haltedReason: null,
          haltedMonthKey: null,
          overrideMonthKey: override ? window.monthKey : null,
          updatedById: params.actor.id,
          updatedAt: now,
        })
        .where(eq(aiMentorConfig.id, 1));

      await tx.insert(auditLogs).values({
        actorId: params.actor.id,
        actorEmail: params.actor.email,
        action: 'AI_MENTOR_BUDGET_RESUMED',
        resourceType: 'ai_mentor_config',
        resourceId: window.monthKey,
        previousStateJson: {
          monthlyBudgetMicroUsd: currentBudgetMicroUsd,
          budgetHalted: Boolean(cfgRaw.budget_halted),
          overrideMonthKey: cfgRaw.override_month_key ?? null,
        },
        newStateJson: {
          monthlyBudgetMicroUsd: nextBudgetMicroUsd,
          budgetHalted: false,
          overrideMonthKey: override ? window.monthKey : null,
        },
        ipAddress: params.ipAddress ?? '0.0.0.0',
      });

      return { ok: true as const };
    });

    if (!txResult.ok) return txResult;
    const overview = await this.getAdminOverview(now);
    return { ok: true, overview };
  }

  async resetCounters(params: {
    actor: DbUser;
    scope: 'daily' | 'monthly' | 'all' | 'active_lock';
    targetUserId?: number;
    ipAddress?: string;
    now?: Date;
  }): Promise<{ affectedUsers: number }> {
    const now = params.now ?? new Date();
    const updateFields: Record<string, unknown> = { updatedAt: now };

    if (params.scope === 'daily') {
      updateFields.dailyCount = 0;
      updateFields.dailyTokens = 0;
    } else if (params.scope === 'monthly') {
      updateFields.monthlyCount = 0;
      updateFields.monthlyTokens = 0;
      updateFields.monthlyEstimatedCostMicroUsd = 0;
    } else if (params.scope === 'all') {
      updateFields.dailyCount = 0;
      updateFields.dailyTokens = 0;
      updateFields.monthlyCount = 0;
      updateFields.monthlyTokens = 0;
      updateFields.monthlyEstimatedCostMicroUsd = 0;
      updateFields.lastRequestAt = null;
      updateFields.activeRequestId = null;
      updateFields.activeStartedAt = null;
    } else if (params.scope === 'active_lock') {
      updateFields.activeRequestId = null;
      updateFields.activeStartedAt = null;
    }

    const updated = params.targetUserId
      ? await db
          .update(aiMentorUserCounters)
          .set(updateFields)
          .where(eq(aiMentorUserCounters.userId, params.targetUserId))
          .returning({ userId: aiMentorUserCounters.userId })
      : await db
          .update(aiMentorUserCounters)
          .set(updateFields)
          .returning({ userId: aiMentorUserCounters.userId });

    await db.insert(auditLogs).values({
      actorId: params.actor.id,
      actorEmail: params.actor.email,
      action: 'AI_MENTOR_COUNTERS_RESET',
      resourceType: 'ai_mentor_user_counters',
      resourceId: params.targetUserId ? String(params.targetUserId) : 'all_users',
      newStateJson: {
        scope: params.scope,
        targetUserId: params.targetUserId ?? null,
        affectedUsers: updated.length,
      },
      ipAddress: params.ipAddress ?? '0.0.0.0',
    });

    return { affectedUsers: updated.length };
  }
}

export interface AiMentorRouterDeps {
  store?: AiMentorStore;
  askMentor?: (input: MentorRequest) => Promise<MentorResponse>;
  authMiddleware?: (req: AuthRequest, res: import('express').Response, next: import('express').NextFunction) => unknown;
  optionalAuthMiddleware?: (req: AuthRequest, res: import('express').Response, next: import('express').NextFunction) => unknown;
  sectionGuardMiddleware?: (req: AuthRequest, res: import('express').Response, next: import('express').NextFunction) => unknown;
}

function isAuthorizedAiAdmin(user?: DbUser): boolean {
  if (!user || user.isBanned || user.isSuspended) return false;
  return user.role === 'owner' || user.role === 'event_admin';
}

export function createAiMentorRouter(deps: AiMentorRouterDeps = {}) {
  const router = Router();
  const store = deps.store ?? new PgAiMentorStore();
  const askMentor = deps.askMentor ?? askAiCyberMentor;
  const authMw = deps.authMiddleware ?? requireAuth;
  const optAuthMw = deps.optionalAuthMiddleware ?? optionalAuth;
  const mentorSectionGuard = deps.sectionGuardMiddleware ?? (deps.store ? (_req, _res, next) => next() : requireSectionEnabled('mentor'));

  // Public/User status endpoint (returns limits, reset timestamps, and user's remaining quota if logged in)
  router.get('/ai/mentor/status', optAuthMw, mentorSectionGuard, async (req: AuthRequest, res) => {
    try {
      const status = await store.getStatus(req.dbUser?.id ?? null);
      res.json(status);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to fetch AI Cyber Mentor status.';
      res.status(500).json({ error: msg });
    }
  });

  // Main authenticated AI Cyber Mentor endpoint with atomic per-user & budget enforcement
  router.post('/ai/mentor', authMw, mentorSectionGuard, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    if (u.isBanned || u.isSuspended) {
      return res.status(403).json({ error: 'Account is suspended or banned.' });
    }

    const rawPrompt = typeof req.body?.prompt === 'string' ? req.body.prompt : '';
    const prompt = rawPrompt.replace(/\u0000/g, '').trim();

    const reservation = await store.reserveRequest({ userId: u.id, prompt });
    if (!reservation.allowed) {
      const { preflight } = reservation;
      if (preflight.retryAfterSeconds) {
        res.setHeader('Retry-After', String(preflight.retryAfterSeconds));
      }
      const status = await store.getStatus(u.id);
      return res.status(preflight.httpStatus ?? 429).json({
        error: preflight.message,
        code: preflight.code,
        retryAfterSeconds: preflight.retryAfterSeconds,
        status,
      });
    }

    const { session } = reservation;
    const requestedMode = String(req.body?.mode || 'concept') as MentorMode;
    const mode: MentorMode = ALLOWED_MENTOR_MODES.includes(requestedMode)
      ? requestedMode
      : 'concept';
    const language = req.body?.language === 'hi' ? 'hi' : 'en';
    const level = (['beginner', 'intermediate', 'advanced'].includes(String(req.body?.level))
      ? String(req.body?.level)
      : 'beginner') as 'beginner' | 'intermediate' | 'advanced';

    let mentorResult: MentorResponse | null = null;
    try {
      mentorResult = await askMentor({
        prompt,
        mode,
        language,
        level,
        maxResponseTokens: session.config.maxResponseTokens,
      });

      const finalized = await store.finalizeRequest({
        userId: u.id,
        requestId: session.requestId,
        reservationMicroUsd: session.preflight.reservationMicroUsd,
        monthKey: session.preflight.window.monthKey,
        dayKey: session.preflight.window.dayKey,
        mode,
        language,
        promptSummary: sanitizeText(prompt, 120),
        result: mentorResult,
      });

      res.json({
        reply: mentorResult.reply,
        model: mentorResult.model,
        usage: mentorResult.usage,
        estimatedCostUsd: finalized.estimatedCostUsd,
        costIsEstimated: true,
        remainingDailyQuota: finalized.status.usage?.dailyRemaining ?? 0,
        remainingMonthlyQuota: finalized.status.usage?.monthlyRemaining ?? 0,
        status: finalized.status,
      });
    } catch (error) {
      await store.finalizeRequest({
        userId: u.id,
        requestId: session.requestId,
        reservationMicroUsd: session.preflight.reservationMicroUsd,
        monthKey: session.preflight.window.monthKey,
        dayKey: session.preflight.window.dayKey,
        mode,
        language,
        promptSummary: sanitizeText(prompt, 120),
        result: null,
      });

      const msg = error instanceof Error ? error.message : 'AI Cyber Mentor request failed.';
      res.status(502).json({ error: msg });
    }
  });

  // Admin Panel: View AI Cyber Mentor config, total usage, estimated spending, remaining budget, and per-user usage
  router.get('/admin/ai-mentor/overview', authMw, async (req: AuthRequest, res) => {
    const actor = req.dbUser!;
    if (!isAuthorizedAiAdmin(actor)) {
      return res.status(403).json({
        error: '403 Forbidden: Authorized Admin or Owner privileges required.',
      });
    }
    const overview = await store.getAdminOverview();
    res.json({
      ...overview,
      canManageBudget: actor.role === 'owner',
    });
  });

  // Admin Panel: Update limits / enable-disable (Owner only can change monthlyBudgetUsd)
  router.patch('/admin/ai-mentor/config', authMw, async (req: AuthRequest, res) => {
    const actor = req.dbUser!;
    if (!isAuthorizedAiAdmin(actor)) {
      return res.status(403).json({
        error: '403 Forbidden: Authorized Admin or Owner privileges required.',
      });
    }

    const isOwner = actor.role === 'owner';
    const check = sanitizeAdminConfigPatch(
      req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {},
      isOwner,
    );

    if (!check.valid || !check.patch) {
      return res.status(check.ownerFieldRejected ? 403 : 400).json({ error: check.error });
    }

    const config = await store.updateConfig({
      actor,
      patch: check.patch,
      ipAddress: req.ip,
    });
    if (!deps.store && typeof check.patch.enabled === 'boolean') {
      try {
        await syncSectionFromLegacyToggle({
          sectionKey: 'mentor',
          enabled: config.enabled,
          actorId: actor.id,
          actorEmail: actor.email,
        });
      } catch (err) {
        console.error('Failed to sync mentor section state:', err);
      }
    }
    res.json({ config });
  });

  // Owner ONLY: Change monthly budget and/or manually override spending halt & resume service
  router.post('/admin/ai-mentor/budget-resume', authMw, async (req: AuthRequest, res) => {
    const actor = req.dbUser!;
    if (actor.isBanned || actor.isSuspended || actor.role !== 'owner') {
      return res.status(403).json({
        error: '403 Forbidden: Only the Platform Owner can change the global budget or override spending restrictions.',
      });
    }

    const newMonthlyBudgetUsd =
      req.body?.monthlyBudgetUsd !== undefined ? Number(req.body.monthlyBudgetUsd) : undefined;
    if (
      newMonthlyBudgetUsd !== undefined &&
      (!Number.isFinite(newMonthlyBudgetUsd) || newMonthlyBudgetUsd < 0 || newMonthlyBudgetUsd > 100000)
    ) {
      return res.status(400).json({ error: 'Monthly budget (USD) must be between $0 and $100,000.' });
    }

    const overrideSpendingLimit = Boolean(req.body?.overrideSpendingLimit);
    const result = await store.resumeBudget({
      actor,
      newMonthlyBudgetUsd,
      overrideSpendingLimit,
      ipAddress: req.ip,
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json({
      ...result.overview,
      canManageBudget: true,
    });
  });

  // Admin Panel: Reset per-user or all-user usage counters (daily, monthly, all, or active_lock)
  router.post('/admin/ai-mentor/reset', authMw, async (req: AuthRequest, res) => {
    const actor = req.dbUser!;
    if (!isAuthorizedAiAdmin(actor)) {
      return res.status(403).json({
        error: '403 Forbidden: Authorized Admin or Owner privileges required.',
      });
    }

    const rawScope = String(req.body?.scope || 'daily');
    const allowedScopes = ['daily', 'monthly', 'all', 'active_lock'] as const;
    if (!allowedScopes.includes(rawScope as (typeof allowedScopes)[number])) {
      return res.status(400).json({ error: 'Invalid reset scope. Use daily, monthly, all, or active_lock.' });
    }

    const targetUserId =
      req.body?.targetUserId !== undefined && req.body?.targetUserId !== null
        ? Number(req.body.targetUserId)
        : undefined;
    if (targetUserId !== undefined && (!Number.isInteger(targetUserId) || targetUserId <= 0)) {
      return res.status(400).json({ error: 'Invalid targetUserId.' });
    }

    const result = await store.resetCounters({
      actor,
      scope: rawScope as 'daily' | 'monthly' | 'all' | 'active_lock',
      targetUserId,
      ipAddress: req.ip,
    });

    res.json({ ok: true, ...result });
  });

  return router;
}
