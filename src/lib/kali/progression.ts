export interface KaliLevelDef {
  levelNumber: number;
  title: string;
  xpRequired: number;
}

export function computeUserKaliLevel(
  xp: number,
  levels: KaliLevelDef[],
): {
  currentLevel: KaliLevelDef;
  nextLevel: KaliLevelDef | null;
  progressPercent: number;
} {
  const sorted = [...levels].sort((a, b) => a.levelNumber - b.levelNumber);
  if (sorted.length === 0) {
    return {
      currentLevel: { levelNumber: 1, title: 'Linux Rookie', xpRequired: 0 },
      nextLevel: null,
      progressPercent: 100,
    };
  }

  let current = sorted[0];
  let next: KaliLevelDef | null = sorted[1] ?? null;

  for (let i = 0; i < sorted.length; i++) {
    if (xp >= sorted[i].xpRequired) {
      current = sorted[i];
      next = sorted[i + 1] ?? null;
    } else {
      break;
    }
  }

  if (!next) {
    return { currentLevel: current, nextLevel: null, progressPercent: 100 };
  }

  const span = Math.max(1, next.xpRequired - current.xpRequired);
  const gained = Math.max(0, xp - current.xpRequired);
  const progressPercent = Math.min(100, Math.round((gained / span) * 100));
  return { currentLevel: current, nextLevel: next, progressPercent };
}

export function computeToolMasteryScore(params: {
  completedLessonsCount: number;
  totalLessonsCount: number;
  terminalExercisesPassedCount: number;
}): number {
  const lessonRatio =
    params.totalLessonsCount > 0
      ? Math.min(1, params.completedLessonsCount / params.totalLessonsCount)
      : 0;
  const terminalBonus = params.terminalExercisesPassedCount > 0 ? 30 : 0;
  const lessonPoints = Math.round(lessonRatio * 70);
  return Math.min(100, lessonPoints + terminalBonus);
}

export function sanitizeKaliLessonForStudent<
  T extends { quizCorrectIndex?: number; quizExplanation?: string },
>(lesson: T): Omit<T, 'quizCorrectIndex' | 'quizExplanation'> {
  const { quizCorrectIndex: _idx, quizExplanation: _exp, ...safe } = lesson;
  return safe;
}

export function sanitizeKaliMissionForStudent<
  T extends {
    assessmentJson?: {
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    } | null;
  },
>(mission: T) {
  if (!mission.assessmentJson) {
    return { ...mission, assessmentJson: null };
  }
  return {
    ...mission,
    assessmentJson: {
      question: mission.assessmentJson.question,
      options: mission.assessmentJson.options,
    },
  };
}
