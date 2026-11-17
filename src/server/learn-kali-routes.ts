import { Router } from 'express';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  achievements,
  auditLogs,
  kaliCategories,
  kaliLevels,
  kaliMissions,
  kaliToolLessons,
  kaliTools,
  kaliUserMissionProgress,
  kaliUserToolProgress,
  notifications,
  userAchievements,
  users,
} from '../db/schema.ts';
import { AuthRequest, optionalAuth, requireAuth, requirePermission } from '../middleware/auth.ts';
import { requireSectionEnabled } from '../middleware/section-guard.ts';
import { sanitizeText } from '../lib/domain/security.ts';
import {
  computeToolMasteryScore,
  computeUserKaliLevel,
  sanitizeKaliLessonForStudent,
  sanitizeKaliMissionForStudent,
} from '../lib/kali/progression.ts';
import {
  validateMissionCommandSequence,
  validateSimulatorExerciseSubmission,
} from '../lib/kali/simulator.ts';
import { getExternalRunnerConfigStatus } from './lab-runner-client.ts';

async function grantKaliAchievementIfMissing(userId: number, code: string) {
  const [ach] = await db.select().from(achievements).where(eq(achievements.code, code)).limit(1);
  if (!ach) return;
  const existing = await db
    .select()
    .from(userAchievements)
    .where(and(eq(userAchievements.userId, userId), eq(userAchievements.achievementId, ach.id)))
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(userAchievements).values({ userId, achievementId: ach.id }).onConflictDoNothing();
  await db
    .update(users)
    .set({ xp: sql`${users.xp} + ${ach.xpBonus}` })
    .where(eq(users.id, userId));
  await db.insert(notifications).values({
    userId,
    type: 'achievement',
    title: `Learn KALI Badge Unlocked: ${ach.title}`,
    body: `${ach.description} (+${ach.xpBonus} XP)`,
  });
}

function normalizeHttpUrl(raw: unknown): string | null {
  const str = String(raw || '').trim();
  if (!str) return null;
  if (!/^https:\/\/[a-zA-Z0-9.-]+/.test(str)) return null;
  return str.slice(0, 400);
}

export function createLearnKaliRouter(): Router {
  const router = Router();

  // =========================================================================
  // STUDENT / PUBLIC LEARN KALI CATALOG, SKILL TREE, MISSIONS & LEADERBOARD
  // =========================================================================
  router.get('/', optionalAuth, requireSectionEnabled('learn-kali'), async (req: AuthRequest, res) => {
    const isAdminViewer = Boolean(
      req.dbUser && ['owner', 'event_admin', 'moderator'].includes(req.dbUser.role),
    );

    const [levels, categories, tools, lessons, missions, leaderboardRows] = await Promise.all([
      db
        .select()
        .from(kaliLevels)
        .where(eq(kaliLevels.published, true))
        .orderBy(asc(kaliLevels.sortOrder)),
      db
        .select()
        .from(kaliCategories)
        .where(
          isAdminViewer
            ? eq(kaliCategories.published, true)
            : and(eq(kaliCategories.published, true), eq(kaliCategories.enabled, true)),
        )
        .orderBy(asc(kaliCategories.officialOrder)),
      db
        .select()
        .from(kaliTools)
        .where(
          isAdminViewer
            ? eq(kaliTools.published, true)
            : and(eq(kaliTools.published, true), eq(kaliTools.enabled, true)),
        )
        .orderBy(asc(kaliTools.minLevelNumber), asc(kaliTools.id)),
      db
        .select()
        .from(kaliToolLessons)
        .where(eq(kaliToolLessons.published, true))
        .orderBy(asc(kaliToolLessons.stepOrder)),
      db
        .select()
        .from(kaliMissions)
        .where(
          isAdminViewer
            ? eq(kaliMissions.published, true)
            : and(eq(kaliMissions.published, true), eq(kaliMissions.enabled, true)),
        )
        .orderBy(asc(kaliMissions.levelNumber), asc(kaliMissions.id)),
      db
        .select({
          userId: users.id,
          username: users.username,
          displayName: users.displayName,
          xp: users.xp,
          dailyStreak: users.dailyStreak,
          toolsMastered: sql<number>`coalesce(count(distinct ${kaliUserToolProgress.toolId}) filter (where ${kaliUserToolProgress.masteryScore} >= 70), 0)::int`,
          avgMastery: sql<number>`coalesce(round(avg(${kaliUserToolProgress.masteryScore})), 0)::int`,
        })
        .from(users)
        .leftJoin(kaliUserToolProgress, eq(kaliUserToolProgress.userId, users.id))
        .where(eq(users.isBanned, false))
        .groupBy(users.id)
        .orderBy(desc(users.xp))
        .limit(15),
    ]);

    const enabledCategorySlugs = new Set(categories.map((c) => c.slug));
    const visibleTools = tools.filter((t) => enabledCategorySlugs.has(t.categorySlug));

    let toolProgress: Array<typeof kaliUserToolProgress.$inferSelect> = [];
    let missionProgress: Array<typeof kaliUserMissionProgress.$inferSelect> = [];
    if (req.dbUser) {
      [toolProgress, missionProgress] = await Promise.all([
        db
          .select()
          .from(kaliUserToolProgress)
          .where(eq(kaliUserToolProgress.userId, req.dbUser.id)),
        db
          .select()
          .from(kaliUserMissionProgress)
          .where(eq(kaliUserMissionProgress.userId, req.dbUser.id)),
      ]);
    }

    const levelSummary = computeUserKaliLevel(req.dbUser?.xp ?? 0, levels);
    const runnerStatus = getExternalRunnerConfigStatus();

    res.json({
      section: 'learn-kali',
      levels,
      categories,
      tools: visibleTools,
      lessons: lessons.map((l) => sanitizeKaliLessonForStudent(l)),
      missions: missions.map((m) => sanitizeKaliMissionForStudent(m)),
      toolProgress,
      missionProgress,
      userLevelSummary: levelSummary,
      leaderboard: leaderboardRows,
      runnerStatus: {
        configured: runnerStatus.configured,
        connected: runnerStatus.configured,
        mode: runnerStatus.executionMode,
        label: runnerStatus.configured
          ? 'Dedicated MicroVM Runner Online'
          : 'Educational Browser Simulator Active (MicroVM Runner Not Connected)',
      },
    });
  });

  // =========================================================================
  // TOOL PRACTICE: LESSON QUIZ OR TERMINAL COMMAND VALIDATION (SINGLE-XP)
  // =========================================================================
  router.post(
    '/tools/:toolId/practice',
    requireAuth,
    requireSectionEnabled('learn-kali'),
    async (req: AuthRequest, res) => {
      const u = req.dbUser!;
      const toolId = Number(req.params.toolId);
      if (!Number.isInteger(toolId) || toolId <= 0) {
        return res.status(400).json({ error: 'Invalid tool identifier.' });
      }

      const mode = String(req.body.mode || 'quiz'); // 'quiz' | 'terminal'
      const lessonId = Number(req.body.lessonId || 0);
      const selectedOption =
        typeof req.body.selectedOption === 'number' && Number.isInteger(req.body.selectedOption)
          ? req.body.selectedOption
          : null;
      const submittedCommand = sanitizeText(String(req.body.command || ''), 300);

      const txResult = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT id FROM users WHERE id = ${u.id} FOR UPDATE`);

        const [tool] = await tx.select().from(kaliTools).where(eq(kaliTools.id, toolId)).limit(1);
        if (!tool || !tool.enabled || !tool.published) {
          return { status: 404, error: 'Learn KALI tool is unavailable.' };
        }

        const toolLessons = await tx
          .select()
          .from(kaliToolLessons)
          .where(and(eq(kaliToolLessons.toolId, toolId), eq(kaliToolLessons.published, true)));

        const [existingProgress] = await tx
          .select()
          .from(kaliUserToolProgress)
          .where(
            and(eq(kaliUserToolProgress.userId, u.id), eq(kaliUserToolProgress.toolId, toolId)),
          )
          .limit(1);

        const completedLessons = new Set<number>(existingProgress?.lessonsCompletedJson ?? []);
        const terminalPassed = new Set<string>(existingProgress?.terminalExercisesPassedJson ?? []);
        let xpToAward = 0;
        let explanation: string | null = null;
        let terminalOutput: string | null = null;

        if (mode === 'terminal') {
          const targetLesson = toolLessons.find((l) => l.id === lessonId) || toolLessons[0];
          const expectedToken = tool.slug.split('-')[0];
          const expectedPattern =
            expectedToken === 'linux'
              ? '(?:pwd|ls|cat|grep|find|mkdir|touch)'
              : targetLesson?.commandPractice
                ? `(?:^|\\b)${expectedToken}\\b`
                : `(?:^|\\b)${expectedToken}\\b`;
          const check = validateSimulatorExerciseSubmission(submittedCommand, expectedPattern);
          if (!check.matched) {
            return {
              status: 400,
              error:
                check.result.coachingHint ||
                `Run a valid simulated ${tool.name} command (for example: ${tool.basicCommandsJson[0]?.command || tool.slug}).`,
            };
          }
          terminalOutput = check.result.output;
          const exerciseKey = `terminal:${tool.slug}`;
          if (!terminalPassed.has(exerciseKey)) {
            terminalPassed.add(exerciseKey);
            xpToAward = Math.max(30, Math.round(tool.xpReward * 0.5));
          }
        } else {
          const lesson = toolLessons.find((l) => l.id === lessonId);
          if (!lesson) {
            return { status: 404, error: 'Tool lesson not found.' };
          }
          if (selectedOption === null) {
            return { status: 400, error: 'Select a quiz answer before submitting.' };
          }
          if (selectedOption !== lesson.quizCorrectIndex) {
            return { status: 400, error: 'Incorrect answer. Review the tool guide and retry.' };
          }
          explanation = lesson.quizExplanation;
          if (!completedLessons.has(lesson.id)) {
            completedLessons.add(lesson.id);
            xpToAward = lesson.xpReward;
          }
        }

        const lessonsArr = Array.from(completedLessons);
        const terminalArr = Array.from(terminalPassed);
        const newMastery = computeToolMasteryScore({
          completedLessonsCount: lessonsArr.length,
          totalLessonsCount: toolLessons.length,
          terminalExercisesPassedCount: terminalArr.length,
        });

        const now = new Date();
        const [savedProgress] = await tx
          .insert(kaliUserToolProgress)
          .values({
            userId: u.id,
            toolId,
            masteryScore: newMastery,
            lessonsCompletedJson: lessonsArr,
            terminalExercisesPassedJson: terminalArr,
            xpAwardedTotal: (existingProgress?.xpAwardedTotal ?? 0) + xpToAward,
            lastPracticedAt: now,
          })
          .onConflictDoUpdate({
            target: [kaliUserToolProgress.userId, kaliUserToolProgress.toolId],
            set: {
              masteryScore: Math.max(existingProgress?.masteryScore ?? 0, newMastery),
              lessonsCompletedJson: lessonsArr,
              terminalExercisesPassedJson: terminalArr,
              xpAwardedTotal: (existingProgress?.xpAwardedTotal ?? 0) + xpToAward,
              lastPracticedAt: now,
            },
          })
          .returning();

        if (xpToAward > 0) {
          const today = now.toISOString().slice(0, 10);
          const [curUser] = await tx
            .select({ lastActiveDate: users.lastActiveDate, dailyStreak: users.dailyStreak })
            .from(users)
            .where(eq(users.id, u.id))
            .limit(1);
          const newStreak =
            curUser?.lastActiveDate === today ? curUser.dailyStreak : (curUser?.dailyStreak ?? 0) + 1;
          await tx
            .update(users)
            .set({
              xp: sql`${users.xp} + ${xpToAward}`,
              dailyStreak: newStreak,
              lastActiveDate: today,
              updatedAt: now,
            })
            .where(eq(users.id, u.id));
        }

        return {
          status: 200,
          progress: savedProgress,
          xpAwarded: xpToAward,
          explanation,
          terminalOutput,
        };
      });

      if ('error' in txResult) {
        return res.status(txResult.status).json({ ok: false, error: txResult.error });
      }

      if (txResult.xpAwarded > 0) {
        await grantKaliAchievementIfMissing(u.id, 'KALI_ROOKIE');
      }

      res.json({
        ok: true,
        progress: txResult.progress,
        xpAwarded: txResult.xpAwarded,
        explanation: txResult.explanation,
        terminalOutput: txResult.terminalOutput,
      });
    },
  );

  // =========================================================================
  // MISSIONS, DAILY CHALLENGES, BOSS & CAPSTONE COMPLETION (ANTI-REPLAY XP)
  // =========================================================================
  router.post(
    '/missions/:missionId/complete',
    requireAuth,
    requireSectionEnabled('learn-kali'),
    async (req: AuthRequest, res) => {
      const u = req.dbUser!;
      const missionId = Number(req.params.missionId);
      if (!Number.isInteger(missionId) || missionId <= 0) {
        return res.status(400).json({ error: 'Invalid mission identifier.' });
      }

      const submittedCommands: string[] = Array.isArray(req.body.commandsRun)
        ? req.body.commandsRun.map((c: unknown) => sanitizeText(String(c || ''), 300))
        : [];
      const selectedOption =
        typeof req.body.selectedOption === 'number' && Number.isInteger(req.body.selectedOption)
          ? req.body.selectedOption
          : null;

      const txResult = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT id FROM users WHERE id = ${u.id} FOR UPDATE`);

        const [mission] = await tx
          .select()
          .from(kaliMissions)
          .where(eq(kaliMissions.id, missionId))
          .limit(1);
        if (!mission || !mission.enabled || !mission.published) {
          return { status: 404, error: 'Mission is unavailable or disabled.' };
        }

        const [existingProgress] = await tx
          .select()
          .from(kaliUserMissionProgress)
          .where(
            and(
              eq(kaliUserMissionProgress.userId, u.id),
              eq(kaliUserMissionProgress.missionId, missionId),
            ),
          )
          .limit(1);

        // Validate terminal steps server-side via cumulative simulator replay
        let passedStepIds = Array.from(new Set<string>(existingProgress?.stepsPassedJson ?? []));
        if (mission.terminalChallengeJson?.steps) {
          const validation = validateMissionCommandSequence(
            submittedCommands,
            mission.terminalChallengeJson.steps,
            passedStepIds,
          );
          passedStepIds = validation.passedStepIds;
          if (validation.missingSteps.length > 0) {
            return {
              status: 400,
              error: `Terminal exercise incomplete (${passedStepIds.length}/${mission.terminalChallengeJson.steps.length} step(s) verified). Run: ${validation.missingSteps[0].instruction}`,
            };
          }
        }

        // Validate server-side assessment question if configured
        let explanation: string | null = null;
        if (mission.assessmentJson) {
          if (selectedOption === null) {
            return { status: 400, error: 'Select your investigation answer before completing this mission.' };
          }
          if (selectedOption !== mission.assessmentJson.correctIndex) {
            return { status: 400, error: 'Incorrect assessment answer. Re-inspect simulated outputs.' };
          }
          explanation = mission.assessmentJson.explanation;
        }

        const alreadyAwarded = Boolean(existingProgress?.xpAwarded);
        const xpToAward = alreadyAwarded ? 0 : mission.xpReward;
        const now = new Date();
        const stepsPassedArr = passedStepIds;

        const [saved] = await tx
          .insert(kaliUserMissionProgress)
          .values({
            userId: u.id,
            missionId,
            status: 'completed',
            stepsPassedJson: stepsPassedArr,
            xpAwarded: true,
            completedAt: existingProgress?.completedAt ?? now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [kaliUserMissionProgress.userId, kaliUserMissionProgress.missionId],
            set: {
              status: 'completed',
              stepsPassedJson: stepsPassedArr,
              xpAwarded: true,
              completedAt: existingProgress?.completedAt ?? now,
              updatedAt: now,
            },
          })
          .returning();

        if (xpToAward > 0) {
          const today = now.toISOString().slice(0, 10);
          const [curUser] = await tx
            .select({ lastActiveDate: users.lastActiveDate, dailyStreak: users.dailyStreak })
            .from(users)
            .where(eq(users.id, u.id))
            .limit(1);
          const newStreak =
            curUser?.lastActiveDate === today ? curUser.dailyStreak : (curUser?.dailyStreak ?? 0) + 1;
          await tx
            .update(users)
            .set({
              xp: sql`${users.xp} + ${xpToAward}`,
              dailyStreak: newStreak,
              lastActiveDate: today,
              updatedAt: now,
            })
            .where(eq(users.id, u.id));
        }

        return {
          status: 200,
          progress: saved,
          xpAwarded: xpToAward,
          alreadyCompleted: alreadyAwarded,
          explanation,
          achievementCode: mission.achievementCode,
        };
      });

      if ('error' in txResult) {
        return res.status(txResult.status).json({ ok: false, error: txResult.error });
      }

      if (txResult.xpAwarded > 0) {
        await grantKaliAchievementIfMissing(u.id, 'KALI_ROOKIE');
        if (txResult.achievementCode) {
          await grantKaliAchievementIfMissing(u.id, txResult.achievementCode);
        }
      }

      res.json({
        ok: true,
        progress: txResult.progress,
        xpAwarded: txResult.xpAwarded,
        alreadyCompleted: txResult.alreadyCompleted,
        explanation: txResult.explanation,
      });
    },
  );

  return router;
}

export function createLearnKaliAdminRouter(): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    requirePermission('admin:view_analytics'),
    async (_req, res) => {
      const [levels, categories, tools, lessons, missions, statsRows] = await Promise.all([
        db.select().from(kaliLevels).orderBy(asc(kaliLevels.sortOrder)),
        db.select().from(kaliCategories).orderBy(asc(kaliCategories.officialOrder)),
        db.select().from(kaliTools).orderBy(asc(kaliTools.minLevelNumber), asc(kaliTools.id)),
        db.select().from(kaliToolLessons).orderBy(asc(kaliToolLessons.stepOrder)),
        db.select().from(kaliMissions).orderBy(asc(kaliMissions.levelNumber), asc(kaliMissions.id)),
        db
          .select({
            learnersActive: sql<number>`count(distinct ${kaliUserToolProgress.userId})::int`,
            avgMastery: sql<number>`coalesce(round(avg(${kaliUserToolProgress.masteryScore})), 0)::int`,
          })
          .from(kaliUserToolProgress),
      ]);

      res.json({
        levels,
        categories,
        tools,
        lessons,
        missions,
        stats: statsRows[0] ?? { learnersActive: 0, avgMastery: 0 },
      });
    },
  );

  router.patch(
    '/categories/:id',
    requireAuth,
    requirePermission('admin:manage_content'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid category id.' });
      }
      const [existing] = await db
        .select()
        .from(kaliCategories)
        .where(eq(kaliCategories.id, id))
        .limit(1);
      if (!existing) return res.status(404).json({ error: 'Category not found.' });

      const nextEnabled =
        typeof req.body.enabled === 'boolean' ? req.body.enabled : existing.enabled;
      const [updated] = await db
        .update(kaliCategories)
        .set({ enabled: nextEnabled })
        .where(eq(kaliCategories.id, id))
        .returning();

      await db.insert(auditLogs).values({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'LEARN_KALI_CATEGORY_UPDATED',
        resourceType: 'kali_category',
        resourceId: existing.slug,
        previousStateJson: { enabled: existing.enabled },
        newStateJson: { enabled: updated.enabled },
        ipAddress: req.ip ?? '0.0.0.0',
      });

      res.json({ category: updated });
    },
  );

  router.post(
    '/tools',
    requireAuth,
    requirePermission('admin:manage_content'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const name = sanitizeText(String(req.body.name || ''), 120);
      const categorySlug = sanitizeText(String(req.body.categorySlug || ''), 80);
      const summary = sanitizeText(String(req.body.summary || ''), 500);
      const purpose = sanitizeText(String(req.body.purpose || summary), 600);
      const installCommand = sanitizeText(String(req.body.installCommand || ''), 200);
      const officialDocsUrl = normalizeHttpUrl(req.body.officialDocsUrl);
      const githubUrl = normalizeHttpUrl(req.body.githubUrl);

      if (!name || !categorySlug || !summary || !installCommand || !officialDocsUrl) {
        return res.status(400).json({
          error: 'Name, category, summary, install command, and valid https:// officialDocsUrl are required.',
        });
      }

      const [cat] = await db
        .select()
        .from(kaliCategories)
        .where(eq(kaliCategories.slug, categorySlug))
        .limit(1);
      if (!cat) return res.status(400).json({ error: 'Unknown Kali tool category.' });

      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60);

      const minLevelNumber = Math.min(8, Math.max(1, Number(req.body.minLevelNumber || 1)));
      const xpReward = Math.min(500, Math.max(20, Number(req.body.xpReward || 80)));

      const [created] = await db
        .insert(kaliTools)
        .values({
          slug: `${slug}-${Date.now().toString(36).slice(-3)}`,
          categoryId: cat.id,
          categorySlug: cat.slug,
          name,
          summary,
          purpose,
          installCommand,
          difficulty: sanitizeText(String(req.body.difficulty || 'Beginner'), 40),
          minLevelNumber,
          xpReward,
          officialDocsUrl,
          githubUrl,
          interactiveSupported: Boolean(req.body.interactiveSupported),
          enabled: true,
          published: true,
        })
        .returning();

      await db.insert(auditLogs).values({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'LEARN_KALI_TOOL_CREATED',
        resourceType: 'kali_tool',
        resourceId: created.slug,
        newStateJson: { name, categorySlug, officialDocsUrl },
        ipAddress: req.ip ?? '0.0.0.0',
      });

      res.json({ tool: created });
    },
  );

  router.patch(
    '/tools/:id',
    requireAuth,
    requirePermission('admin:manage_content'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid tool id.' });
      }
      const [existing] = await db.select().from(kaliTools).where(eq(kaliTools.id, id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Tool not found.' });

      const nextOfficialDocs = req.body.officialDocsUrl
        ? normalizeHttpUrl(req.body.officialDocsUrl)
        : existing.officialDocsUrl;
      if (!nextOfficialDocs) {
        return res.status(400).json({ error: 'officialDocsUrl must start with https://' });
      }
      const nextGithub =
        req.body.githubUrl === ''
          ? null
          : req.body.githubUrl
            ? normalizeHttpUrl(req.body.githubUrl)
            : existing.githubUrl;

      const [updated] = await db
        .update(kaliTools)
        .set({
          enabled: typeof req.body.enabled === 'boolean' ? req.body.enabled : existing.enabled,
          published:
            typeof req.body.published === 'boolean' ? req.body.published : existing.published,
          status:
            typeof req.body.status === 'string' &&
            ['active', 'deprecated', 'optional'].includes(req.body.status)
              ? req.body.status
              : existing.status,
          xpReward:
            typeof req.body.xpReward === 'number'
              ? Math.min(500, Math.max(10, req.body.xpReward))
              : existing.xpReward,
          minLevelNumber:
            typeof req.body.minLevelNumber === 'number'
              ? Math.min(8, Math.max(1, req.body.minLevelNumber))
              : existing.minLevelNumber,
          officialDocsUrl: nextOfficialDocs,
          githubUrl: nextGithub,
          updatedAt: new Date(),
        })
        .where(eq(kaliTools.id, id))
        .returning();

      await db.insert(auditLogs).values({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'LEARN_KALI_TOOL_UPDATED',
        resourceType: 'kali_tool',
        resourceId: existing.slug,
        previousStateJson: { enabled: existing.enabled, status: existing.status },
        newStateJson: { enabled: updated.enabled, status: updated.status },
        ipAddress: req.ip ?? '0.0.0.0',
      });

      res.json({ tool: updated });
    },
  );

  router.patch(
    '/missions/:id',
    requireAuth,
    requirePermission('admin:manage_content'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid mission id.' });
      }
      const [existing] = await db
        .select()
        .from(kaliMissions)
        .where(eq(kaliMissions.id, id))
        .limit(1);
      if (!existing) return res.status(404).json({ error: 'Mission not found.' });

      const [updated] = await db
        .update(kaliMissions)
        .set({
          enabled: typeof req.body.enabled === 'boolean' ? req.body.enabled : existing.enabled,
          published:
            typeof req.body.published === 'boolean' ? req.body.published : existing.published,
          xpReward:
            typeof req.body.xpReward === 'number'
              ? Math.min(1000, Math.max(20, req.body.xpReward))
              : existing.xpReward,
        })
        .where(eq(kaliMissions.id, id))
        .returning();

      await db.insert(auditLogs).values({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'LEARN_KALI_MISSION_UPDATED',
        resourceType: 'kali_mission',
        resourceId: existing.slug,
        previousStateJson: { enabled: existing.enabled, xpReward: existing.xpReward },
        newStateJson: { enabled: updated.enabled, xpReward: updated.xpReward },
        ipAddress: req.ip ?? '0.0.0.0',
      });

      res.json({ mission: updated });
    },
  );

  return router;
}
