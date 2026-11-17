import type {
  AppearanceTheme,
  LearningExperience,
  LearningExperienceConfig,
  NavSection,
  PrimaryHub,
  ProgressionMode,
} from '../../types/kali';

export const DEFAULT_LEARNING_EXPERIENCE_CONFIG: LearningExperienceConfig = {
  defaultLearningExperience: 'beginner',
  autoProgressionEnabled: true,
  beginnerMaxXp: 999,
  intermediateMaxXp: 4999,
  minLessonsForIntermediate: 2,
  minPracticeForIntermediate: 1,
  minLessonsForExpert: 6,
  minPracticeForExpert: 3,
};

export function normalizeAppearanceTheme(
  value: unknown,
  fallback: AppearanceTheme = 'dark',
): AppearanceTheme {
  if (value === 'light' || value === 'dark') return value;
  return fallback;
}

export function normalizeLearningExperience(
  value: unknown,
  fallback: LearningExperience = 'beginner',
): LearningExperience {
  if (value === 'beginner' || value === 'intermediate' || value === 'expert') {
    return value;
  }
  if (value === 'advanced') return 'expert';
  return fallback;
}

export function normalizeProgressionMode(
  value: unknown,
  fallback: ProgressionMode = 'automatic',
): ProgressionMode {
  if (value === 'automatic' || value === 'manual') return value;
  return fallback;
}

export function mergeLearningExperienceConfig(
  raw: Record<string, unknown> | null | undefined,
): LearningExperienceConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_LEARNING_EXPERIENCE_CONFIG };
  const beginnerMaxXp = Math.max(
    100,
    Math.min(50000, Number(raw.beginnerMaxXp ?? DEFAULT_LEARNING_EXPERIENCE_CONFIG.beginnerMaxXp) || 999),
  );
  const intermediateMaxXp = Math.max(
    beginnerMaxXp + 500,
    Math.min(200000, Number(raw.intermediateMaxXp ?? DEFAULT_LEARNING_EXPERIENCE_CONFIG.intermediateMaxXp) || 4999),
  );
  return {
    defaultLearningExperience: normalizeLearningExperience(
      raw.defaultLearningExperience,
      DEFAULT_LEARNING_EXPERIENCE_CONFIG.defaultLearningExperience,
    ),
    autoProgressionEnabled:
      typeof raw.autoProgressionEnabled === 'boolean'
        ? raw.autoProgressionEnabled
        : DEFAULT_LEARNING_EXPERIENCE_CONFIG.autoProgressionEnabled,
    beginnerMaxXp,
    intermediateMaxXp,
    minLessonsForIntermediate: Math.max(
      0,
      Math.min(50, Number(raw.minLessonsForIntermediate ?? DEFAULT_LEARNING_EXPERIENCE_CONFIG.minLessonsForIntermediate)),
    ),
    minPracticeForIntermediate: Math.max(
      0,
      Math.min(50, Number(raw.minPracticeForIntermediate ?? DEFAULT_LEARNING_EXPERIENCE_CONFIG.minPracticeForIntermediate)),
    ),
    minLessonsForExpert: Math.max(
      1,
      Math.min(100, Number(raw.minLessonsForExpert ?? DEFAULT_LEARNING_EXPERIENCE_CONFIG.minLessonsForExpert)),
    ),
    minPracticeForExpert: Math.max(
      1,
      Math.min(100, Number(raw.minPracticeForExpert ?? DEFAULT_LEARNING_EXPERIENCE_CONFIG.minPracticeForExpert)),
    ),
  };
}

export interface ProgressionMetricsInput {
  xp: number;
  completedLessonsCount: number;
  completedLabsCount: number;
  solvedChallengesCount: number;
  completedMissionsCount?: number;
  currentExperience: LearningExperience;
  progressionMode: ProgressionMode;
  dismissedThemeUpgrade?: LearningExperience | null;
}

export interface ProgressionEvaluation {
  eligibleTier: LearningExperience;
  recommendedUpgrade: LearningExperience | null;
  reason: string | null;
  nextTier: LearningExperience | null;
  nextXpThreshold: number | null;
  xpProgressPct: number;
  practiceCount: number;
  requiredLessonsForNext: number | null;
  requiredPracticeForNext: number | null;
}

const TIER_RANK: Record<LearningExperience, number> = {
  beginner: 1,
  intermediate: 2,
  expert: 3,
};

export function evaluateLearningProgression(
  input: ProgressionMetricsInput,
  config: LearningExperienceConfig = DEFAULT_LEARNING_EXPERIENCE_CONFIG,
): ProgressionEvaluation {
  const practiceCount =
    Math.max(0, input.completedLabsCount) +
    Math.max(0, input.solvedChallengesCount) +
    Math.max(0, input.completedMissionsCount ?? 0);
  const xp = Math.max(0, input.xp);
  const lessons = Math.max(0, input.completedLessonsCount);

  const meetsExpert =
    xp > config.intermediateMaxXp &&
    lessons >= config.minLessonsForExpert &&
    practiceCount >= config.minPracticeForExpert;

  const meetsIntermediate =
    xp > config.beginnerMaxXp &&
    lessons >= config.minLessonsForIntermediate &&
    practiceCount >= config.minPracticeForIntermediate;

  const eligibleTier: LearningExperience = meetsExpert
    ? 'expert'
    : meetsIntermediate
      ? 'intermediate'
      : 'beginner';

  let recommendedUpgrade: LearningExperience | null = null;
  let reason: string | null = null;

  if (
    config.autoProgressionEnabled &&
    input.progressionMode === 'automatic' &&
    TIER_RANK[eligibleTier] > TIER_RANK[input.currentExperience] &&
    input.dismissedThemeUpgrade !== eligibleTier
  ) {
    recommendedUpgrade = eligibleTier;
    if (eligibleTier === 'intermediate') {
      reason = `You reached ${xp.toLocaleString()} XP, completed ${lessons} lessons, and finished ${practiceCount} practical lab/CTF/mission exercises. Ready for Intermediate Experience?`;
    } else {
      reason = `You reached ${xp.toLocaleString()} XP, completed ${lessons} lessons, and solved ${practiceCount} practical exercises. Ready for Expert Experience?`;
    }
  }

  let nextTier: LearningExperience | null = null;
  let nextXpThreshold: number | null = null;
  let xpProgressPct = 100;
  let requiredLessonsForNext: number | null = null;
  let requiredPracticeForNext: number | null = null;

  if (input.currentExperience === 'beginner') {
    nextTier = 'intermediate';
    nextXpThreshold = config.beginnerMaxXp + 1;
    xpProgressPct = Math.min(100, Math.round((xp / Math.max(1, nextXpThreshold)) * 100));
    requiredLessonsForNext = config.minLessonsForIntermediate;
    requiredPracticeForNext = config.minPracticeForIntermediate;
  } else if (input.currentExperience === 'intermediate') {
    nextTier = 'expert';
    nextXpThreshold = config.intermediateMaxXp + 1;
    const base = config.beginnerMaxXp + 1;
    const span = Math.max(1, nextXpThreshold - base);
    xpProgressPct = Math.min(100, Math.max(0, Math.round(((xp - base) / span) * 100)));
    requiredLessonsForNext = config.minLessonsForExpert;
    requiredPracticeForNext = config.minPracticeForExpert;
  }

  return {
    eligibleTier,
    recommendedUpgrade,
    reason,
    nextTier,
    nextXpThreshold,
    xpProgressPct,
    practiceCount,
    requiredLessonsForNext,
    requiredPracticeForNext,
  };
}

export function getHubForSection(section: NavSection): PrimaryHub {
  switch (section) {
    case 'home':
      return 'home';
    case 'academy':
    case 'learn-kali':
    case 'books':
    case 'mentor':
      return 'learn';
    case 'labs':
    case 'ctf':
      return 'practice';
    case 'games':
    case 'arena':
    case 'tournaments':
      return 'play';
    case 'community':
      return 'community';
    case 'career':
      return 'career';
    case 'profile':
    case 'notifications':
    case 'settings':
    case 'legal':
      return 'profile';
    case 'admin':
      return 'admin';
  }
}

export function getExperienceBadgeLabel(exp: LearningExperience): string {
  switch (exp) {
    case 'beginner':
      return 'Beginner Experience · Default';
    case 'intermediate':
      return 'Intermediate Experience';
    case 'expert':
      return 'Expert Experience';
  }
}
