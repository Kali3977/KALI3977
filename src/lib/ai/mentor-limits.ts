export type MentorMode =
  | 'concept'
  | 'teach_me'
  | 'practice_questions'
  | 'error_help'
  | 'linux_cli'
  | 'code_review'
  | 'roadmap'
  | 'ctf_hint'
  | 'research_assistant'
  | 'career_guidance';

export const ALLOWED_MENTOR_MODES: MentorMode[] = [
  'concept',
  'teach_me',
  'practice_questions',
  'error_help',
  'linux_cli',
  'code_review',
  'roadmap',
  'ctf_hint',
  'research_assistant',
  'career_guidance',
];

export const ACTIVE_REQUEST_STALE_MS = 120_000;
export const SYSTEM_INSTRUCTION_OVERHEAD_TOKENS = 320;
export const MICRO_USD_PER_USD = 1_000_000;

export interface AiMentorConfigData {
  enabled: boolean;
  dailyUserLimit: number;
  monthlyUserLimit: number;
  maxPromptTokens: number;
  maxResponseTokens: number;
  cooldownSeconds: number;
  monthlyBudgetMicroUsd: number;
  budgetHalted: boolean;
  haltedReason: string | null;
  haltedMonthKey: string | null;
  overrideMonthKey: string | null;
}

export const DEFAULT_AI_MENTOR_CONFIG: AiMentorConfigData = {
  enabled: true,
  dailyUserLimit: 20,
  monthlyUserLimit: 300,
  maxPromptTokens: 4000,
  maxResponseTokens: 1500,
  cooldownSeconds: 3,
  monthlyBudgetMicroUsd: 20 * MICRO_USD_PER_USD, // $20.00 default configurable budget
  budgetHalted: false,
  haltedReason: null,
  haltedMonthKey: null,
  overrideMonthKey: null,
};

/**
 * Published Gemini token pricing estimates in USD per 1,000,000 tokens.
 * Exact provider invoice telemetry is not exposed by generateContent(), so all
 * computed USD values are marked `costIsEstimated: true` and use conservative
 * pricing derived from actual provider `usageMetadata` token counts.
 */
export const GEMINI_ESTIMATED_PRICING_USD_PER_1M = {
  'gemini-4-hydrogen': {
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    thinkingUsdPer1M: 2.5,
  },
  default: {
    inputUsdPer1M: 0.3,
    outputUsdPer1M: 2.5,
    thinkingUsdPer1M: 2.5,
  },
} as const;

export interface UtcWindowInfo {
  dayKey: string;
  monthKey: string;
  dailyResetsAt: string;
  monthlyResetsAt: string;
}

export function getUtcWindowKeys(now: Date = new Date()): UtcWindowInfo {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed
  const day = now.getUTCDate();

  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');

  const nextDayUtc = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0));
  const nextMonthUtc = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));

  return {
    dayKey: `${year}-${mm}-${dd}`,
    monthKey: `${year}-${mm}`,
    dailyResetsAt: nextDayUtc.toISOString(),
    monthlyResetsAt: nextMonthUtc.toISOString(),
  };
}

/**
 * Deterministic server-side token estimator supporting English, code punctuation,
 * and Hindi/Devanagari UTF-8 characters without extra network latency.
 */
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  let asciiCount = 0;
  let nonAsciiCount = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code <= 0x7f) {
      asciiCount++;
    } else {
      nonAsciiCount++;
    }
  }

  // Standard English/code averages ~4 chars/token; Devanagari/Unicode scripts average ~1.8 chars/token.
  const estimated = Math.ceil(asciiCount / 4 + nonAsciiCount / 1.8);
  return Math.max(1, estimated);
}

export function getPricingForModel(model?: string) {
  if (model && model in GEMINI_ESTIMATED_PRICING_USD_PER_1M) {
    return GEMINI_ESTIMATED_PRICING_USD_PER_1M[
      model as keyof typeof GEMINI_ESTIMATED_PRICING_USD_PER_1M
    ];
  }
  return GEMINI_ESTIMATED_PRICING_USD_PER_1M.default;
}

export function calculateCostMicroUsd(params: {
  promptTokens: number;
  responseTokens: number;
  thinkingTokens?: number;
  model?: string;
}): number {
  const pricing = getPricingForModel(params.model);
  const prompt = Math.max(0, params.promptTokens);
  const output = Math.max(0, params.responseTokens);
  const thinking = Math.max(0, params.thinkingTokens ?? 0);

  // 1M tokens * (USD / 1M) * 1,000,000 microUSD/USD => exact microUSD = tokens * usdPer1M
  const microUsd =
    prompt * pricing.inputUsdPer1M +
    output * pricing.outputUsdPer1M +
    thinking * pricing.thinkingUsdPer1M;

  return Math.max(0, Math.ceil(microUsd));
}

export function calculateMaxReservationMicroUsd(params: {
  promptTokens: number;
  maxResponseTokens: number;
  systemOverheadTokens?: number;
  model?: string;
}): number {
  const inputTokens = Math.max(0, params.promptTokens) + (params.systemOverheadTokens ?? SYSTEM_INSTRUCTION_OVERHEAD_TOKENS);
  const worstCaseOutputTokens = Math.max(0, params.maxResponseTokens);
  return calculateCostMicroUsd({
    promptTokens: inputTokens,
    responseTokens: worstCaseOutputTokens,
    thinkingTokens: 0,
    model: params.model,
  });
}

export function microUsdToUsd(microUsd: number): number {
  return Math.round((microUsd / MICRO_USD_PER_USD) * 1_000_000) / 1_000_000;
}

export function usdToMicroUsd(usd: number): number {
  if (!Number.isFinite(usd) || usd < 0) return 0;
  return Math.round(usd * MICRO_USD_PER_USD);
}

export interface UserCounterSnapshot {
  dayKey: string;
  dailyCount: number;
  monthKey: string;
  monthlyCount: number;
  lastRequestAt: Date | null;
  activeRequestId: string | null;
  activeStartedAt: Date | null;
}

export interface MonthlyLedgerSnapshot {
  monthKey: string;
  spentMicroUsd: number;
  reservedMicroUsd: number;
}

export type PreflightRejectCode =
  | 'DISABLED'
  | 'EMPTY_PROMPT'
  | 'PROMPT_TOO_LONG'
  | 'CONCURRENT_REQUEST'
  | 'COOLDOWN'
  | 'DAILY_LIMIT'
  | 'MONTHLY_LIMIT'
  | 'BUDGET_EXHAUSTED';

export interface PreflightResult {
  allowed: boolean;
  code?: PreflightRejectCode;
  httpStatus?: number;
  message?: string;
  shouldHaltBudget?: boolean;
  retryAfterSeconds?: number;
  effectiveDailyCount: number;
  effectiveMonthlyCount: number;
  promptTokens: number;
  reservationMicroUsd: number;
  window: UtcWindowInfo;
}

export function evaluateMentorPreflight(params: {
  config: AiMentorConfigData;
  prompt: string;
  userCounter: UserCounterSnapshot | null;
  monthlyLedger: MonthlyLedgerSnapshot | null;
  now?: Date;
  model?: string;
}): PreflightResult {
  const now = params.now ?? new Date();
  const nowMs = now.getTime();
  const window = getUtcWindowKeys(now);
  const { config, userCounter, monthlyLedger } = params;

  const effectiveDailyCount =
    userCounter && userCounter.dayKey === window.dayKey ? userCounter.dailyCount : 0;
  const effectiveMonthlyCount =
    userCounter && userCounter.monthKey === window.monthKey ? userCounter.monthlyCount : 0;

  const promptTokens = estimateTokens(params.prompt);
  const reservationMicroUsd = calculateMaxReservationMicroUsd({
    promptTokens,
    maxResponseTokens: config.maxResponseTokens,
    model: params.model,
  });

  if (!config.enabled) {
    return {
      allowed: false,
      code: 'DISABLED',
      httpStatus: 503,
      message: 'AI Cyber Mentor is currently disabled by platform administration.',
      effectiveDailyCount,
      effectiveMonthlyCount,
      promptTokens,
      reservationMicroUsd,
      window,
    };
  }

  if (!params.prompt.trim() || promptTokens === 0) {
    return {
      allowed: false,
      code: 'EMPTY_PROMPT',
      httpStatus: 400,
      message: 'Please enter a cybersecurity question.',
      effectiveDailyCount,
      effectiveMonthlyCount,
      promptTokens,
      reservationMicroUsd,
      window,
    };
  }

  if (promptTokens > config.maxPromptTokens) {
    return {
      allowed: false,
      code: 'PROMPT_TOO_LONG',
      httpStatus: 400,
      message: `Prompt exceeds the maximum allowed length of ${config.maxPromptTokens.toLocaleString()} tokens (estimated ${promptTokens.toLocaleString()} tokens). Please shorten your question.`,
      effectiveDailyCount,
      effectiveMonthlyCount,
      promptTokens,
      reservationMicroUsd,
      window,
    };
  }

  if (userCounter?.activeRequestId && userCounter.activeStartedAt) {
    const activeAgeMs = nowMs - userCounter.activeStartedAt.getTime();
    if (activeAgeMs >= 0 && activeAgeMs < ACTIVE_REQUEST_STALE_MS) {
      return {
        allowed: false,
        code: 'CONCURRENT_REQUEST',
        httpStatus: 409,
        message: 'You already have an active AI Cyber Mentor request in progress. Please wait for it to complete.',
        effectiveDailyCount,
        effectiveMonthlyCount,
        promptTokens,
        reservationMicroUsd,
        window,
      };
    }
  }

  if (config.cooldownSeconds > 0 && userCounter?.lastRequestAt) {
    const elapsedMs = nowMs - userCounter.lastRequestAt.getTime();
    const cooldownMs = config.cooldownSeconds * 1000;
    if (elapsedMs >= 0 && elapsedMs < cooldownMs) {
      const retryAfterSeconds = Math.max(1, Math.ceil((cooldownMs - elapsedMs) / 1000));
      return {
        allowed: false,
        code: 'COOLDOWN',
        httpStatus: 429,
        retryAfterSeconds,
        message: `Please wait ${retryAfterSeconds}s before sending another AI Cyber Mentor request (${config.cooldownSeconds}s cooldown).`,
        effectiveDailyCount,
        effectiveMonthlyCount,
        promptTokens,
        reservationMicroUsd,
        window,
      };
    }
  }

  if (effectiveDailyCount >= config.dailyUserLimit) {
    return {
      allowed: false,
      code: 'DAILY_LIMIT',
      httpStatus: 429,
      message: `Daily AI Cyber Mentor limit reached (${effectiveDailyCount}/${config.dailyUserLimit} messages). Resets at ${window.dailyResetsAt}.`,
      effectiveDailyCount,
      effectiveMonthlyCount,
      promptTokens,
      reservationMicroUsd,
      window,
    };
  }

  if (effectiveMonthlyCount >= config.monthlyUserLimit) {
    return {
      allowed: false,
      code: 'MONTHLY_LIMIT',
      httpStatus: 429,
      message: `Monthly AI Cyber Mentor limit reached (${effectiveMonthlyCount}/${config.monthlyUserLimit} messages). Resets at ${window.monthlyResetsAt}.`,
      effectiveDailyCount,
      effectiveMonthlyCount,
      promptTokens,
      reservationMicroUsd,
      window,
    };
  }

  const overrideActive = config.overrideMonthKey === window.monthKey;
  const haltedForThisMonth = config.budgetHalted && config.haltedMonthKey === window.monthKey;
  const spent = monthlyLedger && monthlyLedger.monthKey === window.monthKey ? monthlyLedger.spentMicroUsd : 0;
  const reserved = monthlyLedger && monthlyLedger.monthKey === window.monthKey ? monthlyLedger.reservedMicroUsd : 0;

  if (!overrideActive && (haltedForThisMonth || spent + reserved + reservationMicroUsd > config.monthlyBudgetMicroUsd)) {
    return {
      allowed: false,
      code: 'BUDGET_EXHAUSTED',
      httpStatus: 503,
      shouldHaltBudget: true,
      message: `AI Cyber Mentor has reached its global monthly spending limit and is paused until ${window.monthlyResetsAt} or Platform Owner review.`,
      effectiveDailyCount,
      effectiveMonthlyCount,
      promptTokens,
      reservationMicroUsd,
      window,
    };
  }

  return {
    allowed: true,
    effectiveDailyCount,
    effectiveMonthlyCount,
    promptTokens,
    reservationMicroUsd,
    window,
  };
}

export function sanitizeAdminConfigPatch(input: Record<string, unknown>, isOwner: boolean): {
  valid: boolean;
  error?: string;
  patch?: Partial<AiMentorConfigData>;
  ownerFieldRejected?: boolean;
} {
  const hasBudgetChange = input.monthlyBudgetUsd !== undefined || input.monthlyBudgetMicroUsd !== undefined;
  const hasOverrideChange =
    input.overrideSpendingLimit !== undefined ||
    input.overrideMonthKey !== undefined ||
    input.budgetHalted !== undefined;

  if ((hasBudgetChange || hasOverrideChange) && !isOwner) {
    return {
      valid: false,
      ownerFieldRejected: true,
      error: 'Only the Platform Owner can modify the global monthly budget or override spending restrictions.',
    };
  }

  const patch: Partial<AiMentorConfigData> = {};

  if (input.enabled !== undefined) {
    patch.enabled = Boolean(input.enabled);
  }
  if (input.dailyUserLimit !== undefined) {
    const val = Math.floor(Number(input.dailyUserLimit));
    if (!Number.isFinite(val) || val < 1 || val > 5000) {
      return { valid: false, error: 'Daily user limit must be between 1 and 5,000.' };
    }
    patch.dailyUserLimit = val;
  }
  if (input.monthlyUserLimit !== undefined) {
    const val = Math.floor(Number(input.monthlyUserLimit));
    if (!Number.isFinite(val) || val < 1 || val > 50000) {
      return { valid: false, error: 'Monthly user limit must be between 1 and 50,000.' };
    }
    patch.monthlyUserLimit = val;
  }
  if (input.maxPromptTokens !== undefined) {
    const val = Math.floor(Number(input.maxPromptTokens));
    if (!Number.isFinite(val) || val < 100 || val > 32000) {
      return { valid: false, error: 'Max prompt tokens must be between 100 and 32,000.' };
    }
    patch.maxPromptTokens = val;
  }
  if (input.maxResponseTokens !== undefined) {
    const val = Math.floor(Number(input.maxResponseTokens));
    if (!Number.isFinite(val) || val < 100 || val > 8192) {
      return { valid: false, error: 'Max response tokens must be between 100 and 8,192.' };
    }
    patch.maxResponseTokens = val;
  }
  if (input.cooldownSeconds !== undefined) {
    const val = Math.floor(Number(input.cooldownSeconds));
    if (!Number.isFinite(val) || val < 0 || val > 300) {
      return { valid: false, error: 'Cooldown must be between 0 and 300 seconds.' };
    }
    patch.cooldownSeconds = val;
  }
  if (isOwner && input.monthlyBudgetUsd !== undefined) {
    const val = Number(input.monthlyBudgetUsd);
    if (!Number.isFinite(val) || val < 0 || val > 100000) {
      return { valid: false, error: 'Monthly budget (USD) must be between $0 and $100,000.' };
    }
    patch.monthlyBudgetMicroUsd = usdToMicroUsd(val);
  } else if (isOwner && input.monthlyBudgetMicroUsd !== undefined) {
    const val = Math.floor(Number(input.monthlyBudgetMicroUsd));
    if (!Number.isFinite(val) || val < 0 || val > 100_000 * MICRO_USD_PER_USD) {
      return { valid: false, error: 'Monthly budget must be between $0 and $100,000.' };
    }
    patch.monthlyBudgetMicroUsd = val;
  }

  return { valid: true, patch };
}
