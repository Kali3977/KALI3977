import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LEARNING_EXPERIENCE_CONFIG,
  evaluateLearningProgression,
  getHubForSection,
  mergeLearningExperienceConfig,
  normalizeAppearanceTheme,
  normalizeLearningExperience,
  normalizeProgressionMode,
} from './learning-experience.ts';

test('Two independent theme systems normalize without cross-interference', () => {
  assert.equal(normalizeAppearanceTheme('light'), 'light');
  assert.equal(normalizeAppearanceTheme('dark'), 'dark');
  assert.equal(normalizeAppearanceTheme('unknown', 'dark'), 'dark');

  assert.equal(normalizeLearningExperience('beginner'), 'beginner');
  assert.equal(normalizeLearningExperience('intermediate'), 'intermediate');
  assert.equal(normalizeLearningExperience('expert'), 'expert');
  assert.equal(normalizeLearningExperience('advanced'), 'expert');

  assert.equal(normalizeProgressionMode('manual'), 'manual');
  assert.equal(normalizeProgressionMode('automatic'), 'automatic');
});

test('Automatic progression evaluates XP + practical mastery and never overrides Manual mode', () => {
  const beginnerNotReady = evaluateLearningProgression({
    xp: 1200,
    completedLessonsCount: 0,
    completedLabsCount: 0,
    solvedChallengesCount: 0,
    currentExperience: 'beginner',
    progressionMode: 'automatic',
  });
  assert.equal(beginnerNotReady.eligibleTier, 'beginner');
  assert.equal(beginnerNotReady.recommendedUpgrade, null);

  const readyForIntermediate = evaluateLearningProgression({
    xp: 1250,
    completedLessonsCount: 3,
    completedLabsCount: 1,
    solvedChallengesCount: 0,
    currentExperience: 'beginner',
    progressionMode: 'automatic',
  });
  assert.equal(readyForIntermediate.eligibleTier, 'intermediate');
  assert.equal(readyForIntermediate.recommendedUpgrade, 'intermediate');
  assert.match(readyForIntermediate.reason || '', /Intermediate Experience/i);

  const manualNeverAutoPrompts = evaluateLearningProgression({
    xp: 7500,
    completedLessonsCount: 12,
    completedLabsCount: 4,
    solvedChallengesCount: 4,
    currentExperience: 'beginner',
    progressionMode: 'manual',
  });
  assert.equal(manualNeverAutoPrompts.eligibleTier, 'expert');
  assert.equal(manualNeverAutoPrompts.recommendedUpgrade, null);

  const dismissedDoesNotNag = evaluateLearningProgression({
    xp: 1500,
    completedLessonsCount: 3,
    completedLabsCount: 1,
    solvedChallengesCount: 1,
    currentExperience: 'beginner',
    progressionMode: 'automatic',
    dismissedThemeUpgrade: 'intermediate',
  });
  assert.equal(dismissedDoesNotNag.recommendedUpgrade, null);
});

test('Custom admin thresholds and 7-hub navigation mappings work deterministically', () => {
  const customCfg = mergeLearningExperienceConfig({
    beginnerMaxXp: 499,
    intermediateMaxXp: 2499,
    minLessonsForIntermediate: 1,
    minPracticeForIntermediate: 1,
  });
  assert.equal(customCfg.beginnerMaxXp, 499);
  assert.equal(customCfg.intermediateMaxXp, 2499);

  const evalRes = evaluateLearningProgression(
    {
      xp: 600,
      completedLessonsCount: 1,
      completedLabsCount: 1,
      solvedChallengesCount: 0,
      currentExperience: 'beginner',
      progressionMode: 'automatic',
    },
    customCfg,
  );
  assert.equal(evalRes.recommendedUpgrade, 'intermediate');

  assert.equal(getHubForSection('home'), 'home');
  assert.equal(getHubForSection('learn-kali'), 'learn');
  assert.equal(getHubForSection('academy'), 'learn');
  assert.equal(getHubForSection('books'), 'learn');
  assert.equal(getHubForSection('labs'), 'practice');
  assert.equal(getHubForSection('ctf'), 'practice');
  assert.equal(getHubForSection('games'), 'play');
  assert.equal(getHubForSection('arena'), 'play');
  assert.equal(getHubForSection('tournaments'), 'play');
  assert.equal(getHubForSection('community'), 'community');
  assert.equal(getHubForSection('career'), 'career');
  assert.equal(getHubForSection('profile'), 'profile');
  assert.equal(getHubForSection('settings'), 'profile');
  assert.equal(getHubForSection('admin'), 'admin');
  assert.ok(DEFAULT_LEARNING_EXPERIENCE_CONFIG.beginnerMaxXp === 999);
});
