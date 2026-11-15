import express, { Router } from 'express';
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  achievements,
  aiMentorConfig,
  auditLogs,
  books,
  campusVerificationRequests,
  campuses,
  certificates,
  chatChannels,
  chatMessages,
  communityPosts,
  communityReplies,
  competitions,
  courses,
  ctfBookmarks,
  ctfChallenges,
  ctfSubmissions,
  diagnosticAssessments,
  disciplinaryAppeals,
  ipViolationReports,
  labSessions,
  labs,
  lessons,
  loginHistory,
  notifications,
  platformSections,
  platformSettings,
  roomParticipations,
  rooms,
  securityReports,
  teamInvitations,
  teamMembers,
  teams,
  tournamentRegistrations,
  tournaments,
  userAchievements,
  userBookProgress,
  userLessonProgress,
  userSessions,
  userSkillAssessments,
  users,
} from '../db/schema.ts';
import { ensureSeeded } from '../db/seed.ts';
import { EXTERNAL_CTF_PLATFORMS } from '../db/seed-ctf-books.ts';
import {
  AuthRequest,
  optionalAuth,
  requireAuth,
  requirePermission,
} from '../middleware/auth.ts';
import {
  ensurePlatformSectionsSeeded,
  getPlatformSections,
  invalidateSectionCache,
  requireSectionEnabled,
  syncLegacyControlsFromSection,
  syncSectionFromLegacyToggle,
} from '../middleware/section-guard.ts';
import {
  deriveSectionFlags,
  getSectionDefinition,
  normalizeSectionDisplayStatus,
} from '../lib/domain/sections.ts';
import {
  evaluateLabCompletionRequest,
  evaluateLabLaunchDecision,
  sanitizeLabAssessmentForStudent,
} from '../lib/domain/labs.ts';
import {
  SlidingWindowRateLimiter,
  analyzeWeakSkills,
  calculateDynamicCtfPoints,
  calculateLevelFromXp,
  createCompetitionRulesSnapshot,
  doesEmailMatchCampusDomain,
  evaluateChatAccess,
  evaluateDiagnosticPlacement,
  generateTournamentBrackets,
  isBookDownloadPermitted,
  validateRoomAndTeamJoin,
  type BracketMatch,
} from '../lib/domain/arena.ts';
import { canAssignRole, hasPermission, type UserRole } from '../lib/domain/rbac.ts';
import {
  buildTotpOtpAuthUri,
  detectSuspiciousInput,
  generateSecureCode,
  generateTotpSecret,
  hashFlag,
  maskFlag,
  sanitizeText,
  verifyFlagConstantTime,
  verifyTotpCode,
} from '../lib/domain/security.ts';
import { createAiMentorRouter } from './ai-mentor-routes.ts';
import {
  broadcastChannelMessage,
  broadcastPublicEvent,
  broadcastUserNotification,
  getOnlineUserIds,
} from './realtime.ts';
import {
  AntiScrapingMonitor,
  KALI3977_BRAND_NOTICE,
  KALI3977_COPYRIGHT_NOTICE,
  clampPaginationLimit,
  validateIpReportInput,
} from '../lib/domain/anti-abuse.ts';
import { createGamesRouter } from './games-routes.ts';
import { createLearnKaliAdminRouter, createLearnKaliRouter } from './learn-kali-routes.ts';
import {
  getExternalRunnerConfigStatus,
  getFutureRunnerArchitecturePlan,
} from './lab-runner-client.ts';
import crypto from 'node:crypto';

const flagRateLimiter = new SlidingWindowRateLimiter();
const arenaJoinRateLimiter = new SlidingWindowRateLimiter();
const chatRateLimiter = new SlidingWindowRateLimiter();
const antiScrapingMonitor = new AntiScrapingMonitor();
const abuseAuditCooldown = new Map<string, number>();

async function getPlatformControls(): Promise<Record<string, unknown>> {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'platform_controls'))
    .limit(1);
  return (row?.valueJson as Record<string, unknown>) || {};
}

async function recordAuditLog(params: {
  actorId: number | null;
  actorEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  previousStateJson?: Record<string, unknown> | null;
  newStateJson?: Record<string, unknown> | null;
  roomId?: number | null;
  competitionId?: number | null;
  success?: boolean;
  ipAddress?: string;
}) {
  await db.insert(auditLogs).values({
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    previousStateJson: params.previousStateJson ?? null,
    newStateJson: params.newStateJson ?? null,
    roomId: params.roomId ?? null,
    competitionId: params.competitionId ?? null,
    success: params.success ?? true,
    ipAddress: params.ipAddress ?? '0.0.0.0',
  });
}

async function grantAchievementIfMissing(userId: number, code: string) {
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

  const [notif] = await db
    .insert(notifications)
    .values({
      userId,
      type: 'achievement',
      title: `Achievement Unlocked: ${ach.title}`,
      body: `${ach.description} (+${ach.xpBonus} XP)`,
    })
    .returning();
  if (notif) {
    broadcastUserNotification(userId, notif);
  }
}

export function createApiRouter(): Router {
  const router = Router();
  router.use(express.json({ limit: '512kb' }));

  // Ensure initial reference curriculum/rooms are lazily seeded/repaired on first API hit
  router.use(async (_req, _res, next) => {
    await ensureSeeded();
    next();
  });

  router.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'kali3977-api' });
  });

  // Public section availability state (non-sensitive visibility flags)
  router.get('/sections', async (_req, res) => {
    const sections = await getPlatformSections();
    res.json({
      sections: sections.map((s) => ({
        sectionKey: s.sectionKey,
        sectionName: s.sectionName,
        description: s.description,
        category: s.category,
        isLockable: s.isLockable,
        enabledStatus: s.enabledStatus,
        displayStatus: s.displayStatus,
        maintenanceStatus: s.maintenanceStatus,
        statusMessage: s.statusMessage,
        sortOrder: s.sortOrder,
      })),
    });
  });

  // Guarded Career foundation endpoint
  router.get('/career', optionalAuth, requireSectionEnabled('career'), (_req, res) => {
    res.json({ ok: true, section: 'career', status: 'enabled' });
  });

  // Anti-scraping, bulk-extraction detection & adaptive rate-limit protection
  router.use((req, res, next) => {
    const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = String(req.headers['user-agent'] || '');
    const abuse = antiScrapingMonitor.checkRequest({
      clientKey,
      path: req.path,
      userAgent,
    });
    res.setHeader('X-RateLimit-Remaining', String(abuse.remaining));
    res.setHeader('X-RateLimit-Tier', abuse.tier);

    if (!abuse.allowed || abuse.suspicious) {
      const now = Date.now();
      const cooldownKey = `${clientKey}:${abuse.allowed ? 'burst' : 'blocked'}`;
      const lastLogged = abuseAuditCooldown.get(cooldownKey) || 0;
      if (now - lastLogged > 60_000) {
        abuseAuditCooldown.set(cooldownKey, now);
        recordAuditLog({
          actorId: null,
          actorEmail: null,
          action: abuse.allowed ? 'SCRAPING_BURST_DETECTED' : 'ABUSE_RATE_LIMIT_EXCEEDED',
          resourceType: 'api_endpoint',
          resourceId: req.path.slice(0, 120),
          newStateJson: { tier: abuse.tier, userAgent: userAgent.slice(0, 160), reason: abuse.reason },
          success: false,
          ipAddress: clientKey,
        }).catch(() => {});
      }
    }

    if (!abuse.allowed) {
      res.setHeader('Retry-After', String(abuse.retryAfterSeconds));
      return res.status(429).json({ error: abuse.reason || 'Too many requests.' });
    }
    next();
  });

  // =========================================================================
  // 1. AUTHENTICATION, PROFILE, CAMPUS VERIFICATION, MFA, SESSIONS
  // =========================================================================
  router.get('/auth/me', optionalAuth, async (req: AuthRequest, res) => {
    if (!req.dbUser) {
      return res.json({ authenticated: false, user: null, role: 'guest' });
    }
    const u = req.dbUser;
    const levelInfo = calculateLevelFromXp(u.xp);

    const [sessions, logins, memberships, unreadNotifs, campusRow] = await Promise.all([
      db
        .select({
          id: userSessions.id,
          sessionId: userSessions.sessionId,
          userAgent: userSessions.userAgent,
          ipAddress: userSessions.ipAddress,
          revoked: userSessions.revoked,
          expiresAt: userSessions.expiresAt,
          createdAt: userSessions.createdAt,
        })
        .from(userSessions)
        .where(eq(userSessions.userId, u.id))
        .orderBy(desc(userSessions.createdAt))
        .limit(10),
      db
        .select()
        .from(loginHistory)
        .where(eq(loginHistory.userId, u.id))
        .orderBy(desc(loginHistory.createdAt))
        .limit(10),
      db
        .select({
          teamId: teamMembers.teamId,
          teamName: teams.name,
          teamCode: teams.teamCode,
          roleInTeam: teamMembers.roleInTeam,
          removalStatus: teamMembers.removalStatus,
          removalReason: teamMembers.removalReason,
          removalExpiresAt: teamMembers.removalExpiresAt,
          competitionId: teamMembers.competitionId,
          campusId: teams.campusId,
        })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(eq(teamMembers.userId, u.id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.userId, u.id), eq(notifications.isRead, false))),
      u.campusId
        ? db.select({ name: campuses.name, code: campuses.code }).from(campuses).where(eq(campuses.id, u.campusId)).limit(1)
        : Promise.resolve([]),
    ]);

    return res.json({
      authenticated: true,
      user: {
        id: u.id,
        uid: u.uid,
        email: u.email,
        emailVerified: u.emailVerified,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        bio: u.bio,
        country: u.country,
        role: u.role,
        campusId: u.campusId,
        campusName: campusRow[0]?.name || null,
        campusVerificationStatus: u.campusVerificationStatus,
        campusVerificationMethod: u.campusVerificationMethod,
        xp: u.xp,
        level: levelInfo.level,
        levelProgress: levelInfo,
        ctfPoints: u.ctfPoints,
        dailyStreak: u.dailyStreak,
        mfaEnabled: u.mfaEnabled,
        policyAcknowledgedAt: u.policyAcknowledgedAt ? u.policyAcknowledgedAt.toISOString() : null,
        profileVisibility: u.profileVisibility,
        preferredLang: u.preferredLang,
        notificationPrefs: u.notificationPrefsJson,
      },
      sessions,
      loginHistory: logins,
      memberships: memberships.filter((m) => m.removalStatus === 'active'),
      removedMemberships: memberships.filter((m) => m.removalStatus !== 'active'),
      unreadNotifications: unreadNotifs[0]?.count ?? 0,
    });
  });

  router.post('/policies/acknowledge', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const now = new Date();
    await db
      .update(users)
      .set({ policyAcknowledgedAt: now, updatedAt: now })
      .where(eq(users.id, u.id));
    await recordAuditLog({
      actorId: u.id,
      actorEmail: u.email,
      action: 'SECURITY_NOTICE_ACKNOWLEDGED',
      resourceType: 'user',
      resourceId: String(u.id),
      ipAddress: req.ip,
    });
    res.json({ ok: true, policyAcknowledgedAt: now.toISOString() });
  });

  router.patch('/profile', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const displayName = sanitizeText(req.body.displayName ?? u.displayName, 60);
    const bio = sanitizeText(req.body.bio ?? u.bio, 400);
    const country = sanitizeText(req.body.country ?? u.country, 60);
    const preferredLang = req.body.preferredLang === 'hi' ? 'hi' : 'en';
    const profileVisibility = req.body.profileVisibility === 'private' ? 'private' : 'public';

    const notifPrefs =
      req.body.notificationPrefs && typeof req.body.notificationPrefs === 'object'
        ? {
            competitions: Boolean(req.body.notificationPrefs.competitions),
            teamChat: Boolean(req.body.notificationPrefs.teamChat),
            securityAlerts: Boolean(req.body.notificationPrefs.securityAlerts),
            achievements: Boolean(req.body.notificationPrefs.achievements),
          }
        : u.notificationPrefsJson;

    // Never allow client-side role or campusId escalation via /api/profile
    const [updated] = await db
      .update(users)
      .set({
        displayName: displayName || u.displayName,
        bio,
        country: country || u.country,
        preferredLang,
        profileVisibility,
        notificationPrefsJson: notifPrefs,
        updatedAt: new Date(),
      })
      .where(eq(users.id, u.id))
      .returning();

    res.json({ ok: true, user: updated });
  });

  router.get('/campus/verify-requests', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const rows = await db
      .select({
        id: campusVerificationRequests.id,
        campusId: campusVerificationRequests.campusId,
        campusName: campuses.name,
        method: campusVerificationRequests.method,
        evidenceText: campusVerificationRequests.evidenceText,
        status: campusVerificationRequests.status,
        reviewNote: campusVerificationRequests.reviewNote,
        createdAt: campusVerificationRequests.createdAt,
      })
      .from(campusVerificationRequests)
      .innerJoin(campuses, eq(campusVerificationRequests.campusId, campuses.id))
      .where(eq(campusVerificationRequests.userId, u.id))
      .orderBy(desc(campusVerificationRequests.createdAt))
      .limit(10);
    res.json({ requests: rows });
  });

  router.post('/campus/verify-request', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const campusId = Number(req.body.campusId);
    const method = ['institutional_email', 'organizer_approval', 'invite_code', 'roster'].includes(
      String(req.body.method),
    )
      ? String(req.body.method)
      : 'organizer_approval';
    const evidenceText = sanitizeText(String(req.body.evidenceText || ''), 300);

    const [campus] = await db.select().from(campuses).where(eq(campuses.id, campusId)).limit(1);
    if (!campus) {
      return res.status(404).json({ error: 'Selected campus record not found.' });
    }

    if (method === 'institutional_email') {
      if (doesEmailMatchCampusDomain(u.email, u.emailVerified, campus.emailDomain)) {
        const [approvedReq] = await db
          .insert(campusVerificationRequests)
          .values({
            userId: u.id,
            campusId: campus.id,
            method,
            evidenceText: `Verified email domain match (${u.email})`,
            status: 'approved',
            reviewNote: 'Automatic institutional domain verification',
            reviewedAt: new Date(),
          })
          .returning();

        await db
          .update(users)
          .set({
            campusId: campus.id,
            campusVerificationStatus: 'verified',
            campusVerificationMethod: 'institutional_email',
            updatedAt: new Date(),
          })
          .where(eq(users.id, u.id));

        return res.json({
          ok: true,
          verified: true,
          request: approvedReq,
          message: `Verified institutional email for ${campus.name}.`,
        });
      }
      return res.status(400).json({
        error: campus.emailDomain
          ? `Your verified account email (${u.email}) does not match @${campus.emailDomain}. Submit via Organizer Approval instead.`
          : 'This campus does not have automatic domain verification enabled. Choose Organizer Approval.',
      });
    }

    const [created] = await db
      .insert(campusVerificationRequests)
      .values({
        userId: u.id,
        campusId: campus.id,
        method,
        evidenceText: evidenceText || 'Requested verification review',
        status: 'pending',
      })
      .returning();

    await db
      .update(users)
      .set({
        campusVerificationStatus: 'pending',
        campusVerificationMethod: method,
        updatedAt: new Date(),
      })
      .where(eq(users.id, u.id));

    res.status(201).json({
      ok: true,
      verified: false,
      request: created,
      message: `Campus verification request submitted for ${campus.name}. Pending organizer approval.`,
    });
  });

  router.post('/auth/mfa/enroll', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const secret = generateTotpSecret();
    await db.update(users).set({ mfaSecret: secret }).where(eq(users.id, u.id));
    const otpauthUri = buildTotpOtpAuthUri(u.email, secret);
    res.json({ secret, otpauthUri });
  });

  router.post('/auth/mfa/verify', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const token = String(req.body.token || '');
    if (!u.mfaSecret) {
      return res.status(400).json({ error: 'MFA enrollment has not been initiated.' });
    }
    if (!verifyTotpCode(u.mfaSecret, token)) {
      return res.status(400).json({ error: 'Invalid 6-digit TOTP verification code.' });
    }
    await db.update(users).set({ mfaEnabled: true, updatedAt: new Date() }).where(eq(users.id, u.id));
    await grantAchievementIfMissing(u.id, 'MFA_GUARDIAN');
    await recordAuditLog({
      actorId: u.id,
      actorEmail: u.email,
      action: 'MFA_ENABLED',
      resourceType: 'user',
      resourceId: String(u.id),
      ipAddress: req.ip,
    });
    res.json({ ok: true, mfaEnabled: true });
  });

  router.post('/auth/sessions/:sessionId/revoke', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const sessionId = String(req.params.sessionId || '');
    await db
      .update(userSessions)
      .set({ revoked: true })
      .where(and(eq(userSessions.sessionId, sessionId), eq(userSessions.userId, u.id)));
    res.json({ ok: true });
  });

  // =========================================================================
  // 2. DASHBOARD & OVERVIEW (Real PostgreSQL Records Only)
  // =========================================================================
  router.get('/overview', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const [
        userCount,
        courseCount,
        bookCount,
        labCount,
        challengeCount,
        compCount,
        campusList,
        upcomingComps,
        settingsRow,
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(users),
        db.select({ count: sql<number>`count(*)::int` }).from(courses).where(eq(courses.published, true)),
        db.select({ count: sql<number>`count(*)::int` }).from(books).where(eq(books.status, 'published')),
        db.select({ count: sql<number>`count(*)::int` }).from(labs).where(eq(labs.published, true)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(ctfChallenges)
          .where(eq(ctfChallenges.published, true)),
        db.select({ count: sql<number>`count(*)::int` }).from(competitions),
        db.select().from(campuses).orderBy(campuses.name),
        db.select().from(competitions).orderBy(desc(competitions.startsAt)).limit(5),
        db.select().from(platformSettings).where(eq(platformSettings.key, 'platform_controls')).limit(1),
      ]);

      let playerDashboard = null;
      if (req.dbUser) {
        const u = req.dbUser;
        const [
          completedLessons,
          completedLabs,
          solvedSubmissions,
          allUserSubmissions,
          earnedAchievements,
          userCerts,
          recommendedChallenges,
          rankRow,
          competitionHistory,
          bookProgressRows,
          ctfBookmarkCountRow,
          skillAssessments,
        ] = await Promise.all([
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(userLessonProgress)
            .where(and(eq(userLessonProgress.userId, u.id), eq(userLessonProgress.completed, true))),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(labSessions)
            .where(and(eq(labSessions.userId, u.id), eq(labSessions.status, 'completed'))),
          db
            .select({ challengeId: ctfSubmissions.challengeId })
            .from(ctfSubmissions)
            .where(and(eq(ctfSubmissions.userId, u.id), eq(ctfSubmissions.isCorrect, true))),
          db
            .select({
              category: ctfChallenges.category,
              isCorrect: ctfSubmissions.isCorrect,
            })
            .from(ctfSubmissions)
            .innerJoin(ctfChallenges, eq(ctfSubmissions.challengeId, ctfChallenges.id))
            .where(eq(ctfSubmissions.userId, u.id)),
          db
            .select({
              id: achievements.id,
              code: achievements.code,
              title: achievements.title,
              description: achievements.description,
              category: achievements.category,
              earnedAt: userAchievements.earnedAt,
            })
            .from(userAchievements)
            .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
            .where(eq(userAchievements.userId, u.id)),
          db
            .select()
            .from(certificates)
            .where(eq(certificates.userId, u.id))
            .orderBy(desc(certificates.issuedAt)),
          db
            .select({
              id: ctfChallenges.id,
              slug: ctfChallenges.slug,
              title: ctfChallenges.title,
              category: ctfChallenges.category,
              difficulty: ctfChallenges.difficulty,
              currentPoints: ctfChallenges.currentPoints,
            })
            .from(ctfChallenges)
            .where(eq(ctfChallenges.published, true))
            .limit(4),
          db
            .select({ rank: sql<number>`count(*)::int + 1` })
            .from(users)
            .where(sql`${users.xp} > ${u.xp}`),
          db
            .select({
              competitionId: competitions.id,
              competitionName: competitions.name,
              roomName: rooms.name,
              teamName: teams.name,
              teamScore: teams.score,
              status: roomParticipations.status,
              joinedAt: roomParticipations.joinedAt,
            })
            .from(roomParticipations)
            .innerJoin(competitions, eq(roomParticipations.competitionId, competitions.id))
            .innerJoin(rooms, eq(roomParticipations.roomId, rooms.id))
            .innerJoin(teams, eq(roomParticipations.teamId, teams.id))
            .where(eq(roomParticipations.userId, u.id))
            .orderBy(desc(roomParticipations.joinedAt)),
          db
            .select({
              bookId: userBookProgress.bookId,
              title: books.title,
              progressPct: userBookProgress.progressPct,
              inReadingList: userBookProgress.inReadingList,
              bookmarked: userBookProgress.bookmarked,
            })
            .from(userBookProgress)
            .innerJoin(books, eq(userBookProgress.bookId, books.id))
            .where(eq(userBookProgress.userId, u.id)),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(ctfBookmarks)
            .where(eq(ctfBookmarks.userId, u.id)),
          db
            .select({
              subjectArea: userSkillAssessments.subjectArea,
              verifiedLevel: userSkillAssessments.verifiedLevel,
              scorePct: userSkillAssessments.scorePct,
            })
            .from(userSkillAssessments)
            .where(eq(userSkillAssessments.userId, u.id)),
        ]);

        const catMap = new Map<string, { solved: number; attempts: number }>();
        for (const s of allUserSubmissions) {
          const cur = catMap.get(s.category) || { solved: 0, attempts: 0 };
          cur.attempts += 1;
          if (s.isCorrect) cur.solved += 1;
          catMap.set(s.category, cur);
        }
        const weakSkills = analyzeWeakSkills(
          Array.from(catMap.entries()).map(([category, v]) => ({ category, ...v })),
        );

        playerDashboard = {
          xp: u.xp,
          level: calculateLevelFromXp(u.xp),
          globalRank: rankRow[0]?.rank ?? 1,
          completedLessonsCount: completedLessons[0]?.count ?? 0,
          completedLabsCount: completedLabs[0]?.count ?? 0,
          solvedChallengesCount: new Set(solvedSubmissions.map((s) => s.challengeId)).size,
          ctfPoints: u.ctfPoints,
          dailyStreak: u.dailyStreak,
          achievements: earnedAchievements,
          certificates: userCerts,
          recommendedChallenges,
          weakSkills,
          competitionHistory,
          bookStats: {
            inReadingListCount: bookProgressRows.filter((b) => b.inReadingList).length,
            bookmarkedCount: bookProgressRows.filter((b) => b.bookmarked).length,
            activeBooksCount: bookProgressRows.filter((b) => b.progressPct > 0).length,
            readingItems: bookProgressRows.slice(0, 5),
          },
          ctfBookmarksCount: ctfBookmarkCountRow[0]?.count ?? 0,
          verifiedSkills: skillAssessments,
        };
      }

      const sectionList = await getPlatformSections();

      res.json({
        platformStats: {
          totalUsers: userCount[0]?.count ?? 0,
          totalCourses: courseCount[0]?.count ?? 0,
          totalBooks: bookCount[0]?.count ?? 0,
          totalLabs: labCount[0]?.count ?? 0,
          totalChallenges: challengeCount[0]?.count ?? 0,
          totalCompetitions: compCount[0]?.count ?? 0,
          totalCampuses: campusList.length,
        },
        campuses: campusList,
        upcomingEvents: upcomingComps,
        globalAnnouncement:
          (settingsRow[0]?.valueJson?.globalAnnouncement as string) ||
          'Welcome to KALI3977 Worldwide Cybersecurity Platform.',
        platformControls: settingsRow[0]?.valueJson || {},
        sections: sectionList.map((s) => ({
          sectionKey: s.sectionKey,
          sectionName: s.sectionName,
          isLockable: s.isLockable,
          enabledStatus: s.enabledStatus,
          displayStatus: s.displayStatus,
          maintenanceStatus: s.maintenanceStatus,
          statusMessage: s.statusMessage,
          sortOrder: s.sortOrder,
        })),
        playerDashboard,
      });
    } catch (err) {
      console.error('Overview query error:', err);
      res.status(500).json({ error: 'Unable to load platform overview.' });
    }
  });

  // =========================================================================
  // 3. LEARNING ACADEMY (Stages 1-8, EN/HI, Quizzes, Notes, Certificates)
  // =========================================================================
  router.get('/academy', optionalAuth, requireSectionEnabled('academy'), async (req: AuthRequest, res) => {
    const [courseList, lessonList, diagList] = await Promise.all([
      db.select().from(courses).where(eq(courses.published, true)).orderBy(courses.stage, courses.orderIndex),
      db.select().from(lessons).where(eq(lessons.published, true)).orderBy(lessons.orderIndex),
      db.select().from(diagnosticAssessments).where(eq(diagnosticAssessments.published, true)),
    ]);

    let progressByLesson = new Map<number, typeof userLessonProgress.$inferSelect>();
    let skillAssessments: Array<typeof userSkillAssessments.$inferSelect> = [];
    if (req.dbUser) {
      const [progressRows, skillRows] = await Promise.all([
        db
          .select()
          .from(userLessonProgress)
          .where(eq(userLessonProgress.userId, req.dbUser.id)),
        db
          .select()
          .from(userSkillAssessments)
          .where(eq(userSkillAssessments.userId, req.dbUser.id)),
      ]);
      progressByLesson = new Map(progressRows.map((p) => [p.lessonId, p]));
      skillAssessments = skillRows;
    }

    const enriched = courseList.map((course) => ({
      ...course,
      lessons: lessonList
        .filter((l) => l.courseId === course.id)
        .map((l) => ({
          ...l,
          progress: progressByLesson.get(l.id) || null,
        })),
    }));

    const safeDiagnostics = diagList.map((d) => ({
      id: d.id,
      slug: d.slug,
      title: d.title,
      subjectArea: d.subjectArea,
      description: d.description,
      questions: d.questionsJson.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        weight: q.weight,
      })),
    }));

    res.setHeader('X-Content-License', KALI3977_COPYRIGHT_NOTICE);
    res.json({ courses: enriched, diagnostics: safeDiagnostics, userSkills: skillAssessments });
  });

  router.post('/academy/diagnostics/:slug/submit', requireAuth, requireSectionEnabled('academy'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const slug = sanitizeText(String(req.params.slug || ''), 80);
    const [diag] = await db
      .select()
      .from(diagnosticAssessments)
      .where(and(eq(diagnosticAssessments.slug, slug), eq(diagnosticAssessments.published, true)))
      .limit(1);
    if (!diag) return res.status(404).json({ error: 'Diagnostic assessment not found.' });

    const answers = (req.body.answers && typeof req.body.answers === 'object' ? req.body.answers : {}) as Record<
      string,
      number
    >;

    let correctCount = 0;
    const review = diag.questionsJson.map((q) => {
      const chosen = typeof answers[q.id] === 'number' ? answers[q.id] : -1;
      const isCorrect = chosen === q.correctIndex;
      if (isCorrect) correctCount += 1;
      return {
        id: q.id,
        isCorrect,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      };
    });

    const skipCandidates =
      slug === 'initial-placement'
        ? ['stage-1-computer-fundamentals', 'stage-1-discrete-math-data-structures', 'stage-2-os-foundations']
        : slug === 'linux-networking-diagnostic'
          ? ['stage-2-os-foundations', 'stage-3-networking-fundamentals']
          : ['stage-4-programming-python-bash', 'stage-5-cybersecurity-fundamentals'];

    const placement = evaluateDiagnosticPlacement(correctCount, diag.questionsJson.length, skipCandidates);

    const [saved] = await db
      .insert(userSkillAssessments)
      .values({
        userId: u.id,
        subjectArea: diag.subjectArea,
        verifiedLevel: placement.verifiedLevel,
        scorePct: placement.scorePct,
        skippedCourseSlugsJson: placement.skippedCourseSlugs,
        completedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userSkillAssessments.userId, userSkillAssessments.subjectArea],
        set: {
          verifiedLevel: placement.verifiedLevel,
          scorePct: placement.scorePct,
          skippedCourseSlugsJson: placement.skippedCourseSlugs,
          completedAt: new Date(),
        },
      })
      .returning();

    await db
      .update(users)
      .set({ xp: sql`${users.xp} + 75`, updatedAt: new Date() })
      .where(eq(users.id, u.id));

    res.json({ ok: true, assessment: saved, placement, review });
  });

  // =========================================================================
  // 3B. BOOKS & KNOWLEDGE LIBRARY (Open Access + Legal Publisher Links)
  // =========================================================================
  router.get('/books', optionalAuth, requireSectionEnabled('books'), async (req: AuthRequest, res) => {
    const bookList = await db
      .select()
      .from(books)
      .where(eq(books.status, 'published'))
      .orderBy(books.category, books.title);

    let progressMap = new Map<number, typeof userBookProgress.$inferSelect>();
    if (req.dbUser) {
      const progressRows = await db
        .select()
        .from(userBookProgress)
        .where(eq(userBookProgress.userId, req.dbUser.id));
      progressMap = new Map(progressRows.map((p) => [p.bookId, p]));
    }

    res.json({
      books: bookList.map((b) => ({
        ...b,
        downloadPermitted: isBookDownloadPermitted({ canDownload: b.canDownload, licenseType: b.licenseType }),
        progress: progressMap.get(b.id) || null,
      })),
    });
  });

  router.post('/books/:bookId/progress', requireAuth, requireSectionEnabled('books'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const bookId = Number(req.params.bookId);
    const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
    if (!book) return res.status(404).json({ error: 'Book record not found.' });

    const [existing] = await db
      .select()
      .from(userBookProgress)
      .where(and(eq(userBookProgress.userId, u.id), eq(userBookProgress.bookId, bookId)))
      .limit(1);

    const bookmarked = typeof req.body.bookmarked === 'boolean' ? req.body.bookmarked : existing?.bookmarked ?? false;
    const inReadingList =
      typeof req.body.inReadingList === 'boolean' ? req.body.inReadingList : existing?.inReadingList ?? false;
    const progressPct =
      typeof req.body.progressPct === 'number'
        ? Math.max(0, Math.min(100, Math.round(req.body.progressPct)))
        : existing?.progressPct ?? 0;
    const lastChapterIndex =
      typeof req.body.lastChapterIndex === 'number'
        ? Math.max(0, Math.round(req.body.lastChapterIndex))
        : existing?.lastChapterIndex ?? 0;
    const notes = typeof req.body.notes === 'string' ? sanitizeText(req.body.notes, 3000) : existing?.notes ?? '';

    const [saved] = await db
      .insert(userBookProgress)
      .values({
        userId: u.id,
        bookId,
        bookmarked,
        inReadingList,
        progressPct,
        lastChapterIndex,
        notes,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userBookProgress.userId, userBookProgress.bookId],
        set: { bookmarked, inReadingList, progressPct, lastChapterIndex, notes, updatedAt: new Date() },
      })
      .returning();

    if (progressPct >= 100 && (!existing || existing.progressPct < 100)) {
      await grantAchievementIfMissing(u.id, 'SCHOLAR_READER');
    }

    res.json({ ok: true, progress: saved });
  });

  router.post('/academy/lessons/:lessonId/progress', requireAuth, requireSectionEnabled('academy'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const lessonId = Number(req.params.lessonId);
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found.' });
    }

    const selectedOption = typeof req.body.selectedOption === 'number' ? req.body.selectedOption : null;
    const bookmarked = typeof req.body.bookmarked === 'boolean' ? req.body.bookmarked : undefined;
    const notes = typeof req.body.notes === 'string' ? sanitizeText(req.body.notes, 3000) : undefined;

    let quizPassed = false;
    let quizScore = 0;
    if (selectedOption !== null) {
      quizPassed = selectedOption === lesson.quizJson.correctIndex;
      quizScore = quizPassed ? 100 : 0;
    }

    const existing = await db
      .select()
      .from(userLessonProgress)
      .where(and(eq(userLessonProgress.userId, u.id), eq(userLessonProgress.lessonId, lessonId)))
      .limit(1);

    const prevCompleted = existing[0]?.completed ?? false;
    const nowCompleted = prevCompleted || quizPassed || Boolean(req.body.markCompleted);

    const [saved] = await db
      .insert(userLessonProgress)
      .values({
        userId: u.id,
        lessonId,
        completed: nowCompleted,
        quizScore: Math.max(existing[0]?.quizScore ?? 0, quizScore),
        bookmarked: bookmarked ?? existing[0]?.bookmarked ?? false,
        notes: notes ?? existing[0]?.notes ?? '',
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userLessonProgress.userId, userLessonProgress.lessonId],
        set: {
          completed: nowCompleted,
          quizScore: Math.max(existing[0]?.quizScore ?? 0, quizScore),
          bookmarked: bookmarked ?? existing[0]?.bookmarked ?? false,
          notes: notes ?? existing[0]?.notes ?? '',
          updatedAt: new Date(),
        },
      })
      .returning();

    const today = new Date().toISOString().slice(0, 10);
    if (!prevCompleted && nowCompleted) {
      const newStreak = u.lastActiveDate === today ? u.dailyStreak : u.dailyStreak + 1;
      await db
        .update(users)
        .set({
          xp: sql`${users.xp} + 50`,
          dailyStreak: newStreak,
          lastActiveDate: today,
          updatedAt: new Date(),
        })
        .where(eq(users.id, u.id));

      // Issue verified completion certificate when a Stage >= 3 course lesson is completed
      const [course] = await db.select().from(courses).where(eq(courses.id, lesson.courseId)).limit(1);
      if (course) {
        const existingCert = await db
          .select()
          .from(certificates)
          .where(
            and(
              eq(certificates.userId, u.id),
              eq(certificates.sourceType, 'course'),
              eq(certificates.sourceId, course.id),
            ),
          )
          .limit(1);

        if (existingCert.length === 0) {
          const verificationId = `KALI3977-ACAD-${course.stage}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
          await db.insert(certificates).values({
            verificationId,
            userId: u.id,
            title: `${course.stageTitle} — ${course.titleEn}`,
            category: 'Learning Academy',
            sourceType: 'course',
            sourceId: course.id,
          });
        }
      }
    }

    res.json({
      progress: saved,
      quizPassed,
      explanation: selectedOption !== null ? lesson.quizJson.explanation : null,
    });
  });

  // =========================================================================
  // 4. CYBER LABS (Interactive Walkthroughs + External MicroVM Architecture)
  // =========================================================================
  const isExternalRunnerConfigured = () => getExternalRunnerConfigStatus().configured;

  router.get('/labs', optionalAuth, requireSectionEnabled('labs'), async (req: AuthRequest, res) => {
    const isAdminViewer = Boolean(
      req.dbUser && ['owner', 'event_admin', 'moderator'].includes(req.dbUser.role),
    );
    const labRows = await db
      .select({
        id: labs.id,
        slug: labs.slug,
        category: labs.category,
        title: labs.title,
        description: labs.description,
        difficulty: labs.difficulty,
        objectivesJson: labs.objectivesJson,
        hintsJson: labs.hintsJson,
        walkthroughJson: labs.walkthroughJson,
        assessmentJson: labs.assessmentJson,
        timeLimitMinutes: labs.timeLimitMinutes,
        cpuLimitMilli: labs.cpuLimitMilli,
        ramLimitMb: labs.ramLimitMb,
        storageLimitMb: labs.storageLimitMb,
        networkPolicy: labs.networkPolicy,
        imageRef: labs.imageRef,
        isolationBackend: labs.isolationBackend,
        runnerRequired: labs.runnerRequired,
        verificationRequired: labs.verificationRequired,
        verificationMode: labs.verificationMode,
        xpReward: labs.xpReward,
        enabled: labs.enabled,
      })
      .from(labs)
      .where(
        isAdminViewer
          ? eq(labs.published, true)
          : and(eq(labs.published, true), eq(labs.enabled, true)),
      )
      .orderBy(labs.runnerRequired, labs.xpReward, labs.id);

    const sanitizedLabs = labRows.map((row) => ({
      ...row,
      assessmentJson: sanitizeLabAssessmentForStudent(row.assessmentJson),
    }));

    let sessions: Array<typeof labSessions.$inferSelect> = [];
    if (req.dbUser) {
      sessions = await db
        .select()
        .from(labSessions)
        .where(eq(labSessions.userId, req.dbUser.id))
        .orderBy(desc(labSessions.startedAt));
    }

    res.json({
      labs: sanitizedLabs,
      sessions,
      runnerConnected: isExternalRunnerConfigured(),
    });
  });

  router.post('/labs/:labId/launch', requireAuth, requireSectionEnabled('labs'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const labId = Number(req.params.labId);
    if (!Number.isInteger(labId) || labId <= 0) {
      return res.status(400).json({ error: 'Invalid lab identifier.' });
    }
    const [lab] = await db.select().from(labs).where(eq(labs.id, labId)).limit(1);
    if (!lab) return res.status(404).json({ error: 'Lab not found.' });

    const runnerConnected = isExternalRunnerConfigured();
    const decision = evaluateLabLaunchDecision(lab, runnerConnected);
    if (!decision.allowed) {
      return res.status(decision.httpStatus).json({ error: decision.message });
    }

    const expiresAt = new Date(Date.now() + lab.timeLimitMinutes * 60 * 1000);
    const [session] = await db
      .insert(labSessions)
      .values({
        sessionUuid: crypto.randomUUID(),
        labId,
        userId: u.id,
        status: decision.sessionStatus,
        expiresAt,
      })
      .returning();

    res.json({
      session,
      infrastructureRequired: decision.infrastructureRequired,
      runnerConnected: decision.runnerConnected,
      message: decision.message,
    });
  });

  router.post('/labs/:labId/reset', requireAuth, requireSectionEnabled('labs'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const labId = Number(req.params.labId);
    if (!Number.isInteger(labId) || labId <= 0) {
      return res.status(400).json({ error: 'Invalid lab identifier.' });
    }
    const [lab] = await db.select().from(labs).where(eq(labs.id, labId)).limit(1);
    if (!lab || !lab.published || !lab.enabled) {
      return res.status(403).json({ error: 'This cyber lab is currently disabled or unavailable.' });
    }

    const [latest] = await db
      .select()
      .from(labSessions)
      .where(and(eq(labSessions.labId, labId), eq(labSessions.userId, u.id)))
      .orderBy(desc(labSessions.startedAt))
      .limit(1);
    if (!latest) return res.status(404).json({ error: 'No lab session found to reset.' });

    const decision = evaluateLabLaunchDecision(lab, isExternalRunnerConfigured());
    const expiresAt = new Date(Date.now() + lab.timeLimitMinutes * 60 * 1000);

    // Preserve completed/xpAwarded history by starting a fresh practice session row if already completed
    if (latest.status === 'completed' || latest.xpAwarded) {
      const [freshPractice] = await db
        .insert(labSessions)
        .values({
          sessionUuid: crypto.randomUUID(),
          labId,
          userId: u.id,
          status: decision.sessionStatus,
          expiresAt,
          resetCount: latest.resetCount + 1,
        })
        .returning();
      return res.json({ session: freshPractice });
    }

    const [updated] = await db
      .update(labSessions)
      .set({
        sessionUuid: crypto.randomUUID(),
        status: decision.sessionStatus,
        resetCount: latest.resetCount + 1,
        startedAt: new Date(),
        expiresAt,
        terminatedAt: null,
        failureReason: null,
      })
      .where(eq(labSessions.id, latest.id))
      .returning();
    res.json({ session: updated });
  });

  router.post('/labs/:labId/verify', requireAuth, requireSectionEnabled('labs'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const labId = Number(req.params.labId);
    if (!Number.isInteger(labId) || labId <= 0) {
      return res.status(400).json({ error: 'Invalid lab identifier.' });
    }
    const token = sanitizeText(String(req.body.token || ''), 120);
    const rawSelected = req.body.selectedOption;
    const selectedOption =
      typeof rawSelected === 'number' && Number.isInteger(rawSelected) ? rawSelected : null;

    const txResult = await db.transaction(async (tx) => {
      // Lock the user row to serialize concurrent verification requests and eliminate XP double-award races
      await tx.execute(sql`SELECT id FROM users WHERE id = ${u.id} FOR UPDATE`);

      const [lab] = await tx.select().from(labs).where(eq(labs.id, labId)).limit(1);
      if (!lab) {
        return { errorStatus: 404, error: 'Lab not found.' as const };
      }

      const userSessions = await tx
        .select()
        .from(labSessions)
        .where(and(eq(labSessions.labId, labId), eq(labSessions.userId, u.id)))
        .orderBy(desc(labSessions.startedAt));

      const latestSession = userSessions[0] ?? null;
      const alreadyAwardedForLab = userSessions.some(
        (s) => s.xpAwarded || s.status === 'completed',
      );

      const decision = evaluateLabCompletionRequest({
        lab,
        latestSession,
        alreadyAwardedForLab,
        submittedToken: token,
        selectedOption,
        verifyTokenFn: verifyFlagConstantTime,
      });

      if (!decision.allowed || !latestSession) {
        return {
          errorStatus: decision.httpStatus,
          error: decision.error || 'Verification failed.',
        };
      }

      const now = new Date();
      let savedSession = latestSession;
      if (latestSession.status !== 'completed') {
        const [updated] = await tx
          .update(labSessions)
          .set({
            status: 'completed',
            verified: true,
            completedAt: now,
            xpAwarded: decision.xpToAward > 0,
            xpAwardedAt: decision.xpToAward > 0 ? now : null,
          })
          .where(eq(labSessions.id, latestSession.id))
          .returning();
        savedSession = updated;
      }

      if (decision.xpToAward > 0) {
        const today = now.toISOString().slice(0, 10);
        const [currentUser] = await tx
          .select({ lastActiveDate: users.lastActiveDate, dailyStreak: users.dailyStreak })
          .from(users)
          .where(eq(users.id, u.id))
          .limit(1);
        const newStreak =
          currentUser?.lastActiveDate === today
            ? currentUser.dailyStreak
            : (currentUser?.dailyStreak ?? 0) + 1;
        await tx
          .update(users)
          .set({
            xp: sql`${users.xp} + ${decision.xpToAward}`,
            dailyStreak: newStreak,
            lastActiveDate: today,
            updatedAt: now,
          })
          .where(eq(users.id, u.id));
      }

      return {
        errorStatus: 0,
        session: savedSession,
        xpAwarded: decision.xpToAward,
        alreadyCompleted: decision.alreadyCompleted,
        explanation: decision.explanation ?? null,
      };
    });

    if ('error' in txResult) {
      return res.status(txResult.errorStatus).json({ ok: false, error: txResult.error });
    }

    if (txResult.xpAwarded > 0) {
      await grantAchievementIfMissing(u.id, 'LAB_PRACTITIONER');
    }

    res.json({
      ok: true,
      session: txResult.session,
      xpAwarded: txResult.xpAwarded,
      alreadyCompleted: txResult.alreadyCompleted,
      explanation: txResult.explanation,
    });
  });

  // =========================================================================
  // 5. CTF ARENA (Server-Side Flag Verification, Dynamic Scoring, Anti-Cheat)
  // =========================================================================
  router.get('/ctf', optionalAuth, requireSectionEnabled('ctf'), async (req: AuthRequest, res) => {
    const rows = await db
      .select({
        id: ctfChallenges.id,
        competitionId: ctfChallenges.competitionId,
        slug: ctfChallenges.slug,
        title: ctfChallenges.title,
        category: ctfChallenges.category,
        difficulty: ctfChallenges.difficulty,
        description: ctfChallenges.description,
        basePoints: ctfChallenges.basePoints,
        currentPoints: ctfChallenges.currentPoints,
        scoringMode: ctfChallenges.scoringMode,
        hintsJson: ctfChallenges.hintsJson,
        learningObjectivesJson: ctfChallenges.learningObjectivesJson,
        relatedCourseSlug: ctfChallenges.relatedCourseSlug,
        relatedBookTitle: ctfChallenges.relatedBookTitle,
        referenceUrl: ctfChallenges.referenceUrl,
        flagFormat: ctfChallenges.flagFormat,
        unlockAfterSlug: ctfChallenges.unlockAfterSlug,
        explanationAfterSolve: ctfChallenges.explanationAfterSolve,
        attachmentName: ctfChallenges.attachmentName,
        solveCount: ctfChallenges.solveCount,
        licenseType: ctfChallenges.licenseType,
        contentVersion: ctfChallenges.contentVersion,
        provenanceAuthor: ctfChallenges.provenanceAuthor,
        createdAt: ctfChallenges.createdAt,
        updatedAt: ctfChallenges.updatedAt,
      })
      .from(ctfChallenges)
      .where(eq(ctfChallenges.published, true))
      .orderBy(ctfChallenges.basePoints);

    let solvedChallengeIds = new Set<number>();
    let bookmarkedIds = new Set<number>();
    let submissions: Array<typeof ctfSubmissions.$inferSelect> = [];
    if (req.dbUser) {
      const [subRows, bmkRows] = await Promise.all([
        db
          .select()
          .from(ctfSubmissions)
          .where(eq(ctfSubmissions.userId, req.dbUser.id))
          .orderBy(desc(ctfSubmissions.createdAt))
          .limit(50),
        db
          .select({ challengeId: ctfBookmarks.challengeId })
          .from(ctfBookmarks)
          .where(eq(ctfBookmarks.userId, req.dbUser.id)),
      ]);
      submissions = subRows;
      for (const s of submissions) {
        if (s.isCorrect) solvedChallengeIds.add(s.challengeId);
      }
      bookmarkedIds = new Set(bmkRows.map((b) => b.challengeId));
    }

    const solvedSlugs = new Set(rows.filter((r) => solvedChallengeIds.has(r.id)).map((r) => r.slug));

    const challenges = rows.map((c) => {
      const solved = solvedChallengeIds.has(c.id);
      const unlocked = !c.unlockAfterSlug || solvedSlugs.has(c.unlockAfterSlug);
      return {
        id: c.id,
        competitionId: c.competitionId,
        slug: c.slug,
        title: c.title,
        category: c.category,
        difficulty: c.difficulty,
        description: unlocked ? c.description : `Locked: solve "${c.unlockAfterSlug}" first to unlock.`,
        basePoints: c.basePoints,
        currentPoints: c.currentPoints,
        scoringMode: c.scoringMode,
        hints: c.hintsJson,
        learningObjectives: c.learningObjectivesJson,
        relatedCourseSlug: c.relatedCourseSlug,
        relatedBookTitle: c.relatedBookTitle,
        referenceUrl: c.referenceUrl,
        flagFormat: c.flagFormat,
        unlockAfterSlug: c.unlockAfterSlug,
        attachmentName: unlocked ? c.attachmentName : null,
        solveCount: c.solveCount,
        solved,
        bookmarked: bookmarkedIds.has(c.id),
        unlocked,
        explanationAfterSolve: solved ? c.explanationAfterSolve : null,
        licenseType: c.licenseType,
        contentVersion: c.contentVersion,
        provenanceAuthor: c.provenanceAuthor,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });

    res.setHeader('X-Content-License', KALI3977_COPYRIGHT_NOTICE);
    res.json({ challenges, submissions, externalPlatforms: EXTERNAL_CTF_PLATFORMS });
  });

  router.post('/ctf/:challengeId/bookmark', requireAuth, requireSectionEnabled('ctf'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const challengeId = Number(req.params.challengeId);
    const [existing] = await db
      .select()
      .from(ctfBookmarks)
      .where(and(eq(ctfBookmarks.userId, u.id), eq(ctfBookmarks.challengeId, challengeId)))
      .limit(1);
    if (existing) {
      await db.delete(ctfBookmarks).where(eq(ctfBookmarks.id, existing.id));
      return res.json({ bookmarked: false });
    }
    await db.insert(ctfBookmarks).values({ userId: u.id, challengeId }).onConflictDoNothing();
    res.json({ bookmarked: true });
  });

  router.post('/ctf/:challengeId/report', requireAuth, requireSectionEnabled('ctf'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const challengeId = Number(req.params.challengeId);
    const reason = sanitizeText(String(req.body.reason || 'Challenge issue reported by player'), 300);
    const [report] = await db
      .insert(securityReports)
      .values({
        reporterId: u.id,
        targetType: 'ctf_challenge',
        targetId: challengeId,
        reason,
      })
      .returning();
    res.json({ ok: true, report });
  });

  router.get('/ctf/:challengeId/artifact', optionalAuth, requireSectionEnabled('ctf'), async (req: AuthRequest, res) => {
    const challengeId = Number(req.params.challengeId);
    const [ch] = await db
      .select()
      .from(ctfChallenges)
      .where(and(eq(ctfChallenges.id, challengeId), eq(ctfChallenges.published, true)))
      .limit(1);
    if (!ch || !ch.attachmentName || !ch.attachmentContent) {
      return res.status(404).json({ error: 'Challenge artifact not found.' });
    }
    if (ch.unlockAfterSlug) {
      if (!req.dbUser) {
        return res.status(403).json({ error: 'Sign in and solve prerequisite challenge to download artifact.' });
      }
      const [prereq] = await db
        .select()
        .from(ctfChallenges)
        .where(eq(ctfChallenges.slug, ch.unlockAfterSlug))
        .limit(1);
      if (prereq) {
        const solved = await db
          .select({ id: ctfSubmissions.id })
          .from(ctfSubmissions)
          .where(
            and(
              eq(ctfSubmissions.userId, req.dbUser.id),
              eq(ctfSubmissions.challengeId, prereq.id),
              eq(ctfSubmissions.isCorrect, true),
            ),
          )
          .limit(1);
        if (solved.length === 0) {
          return res.status(403).json({ error: `Solve "${prereq.title}" first to unlock this artifact.` });
        }
      }
    }
    const safeFilename = ch.attachmentName.replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('X-Content-License', ch.licenseType || KALI3977_COPYRIGHT_NOTICE);
    res.send(ch.attachmentContent);
  });

  router.post('/ctf/:challengeId/submit', requireAuth, requireSectionEnabled('ctf'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const challengeId = Number(req.params.challengeId);
    const rawFlag = sanitizeText(String(req.body.flag || ''), 160);
    if (!rawFlag) {
      return res.status(400).json({ error: 'Flag submission cannot be empty.' });
    }

    const rate = flagRateLimiter.check(`ctf:${u.id}:${challengeId}`, 8, 60_000);
    if (!rate.allowed) {
      return res.status(429).json({
        error: `Rate limit reached. Wait ${rate.retryAfterSeconds}s before submitting again.`,
      });
    }

    const [challenge] = await db
      .select()
      .from(ctfChallenges)
      .where(and(eq(ctfChallenges.id, challengeId), eq(ctfChallenges.published, true)))
      .limit(1);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found.' });
    }

    if (challenge.unlockAfterSlug) {
      const [prereq] = await db
        .select()
        .from(ctfChallenges)
        .where(eq(ctfChallenges.slug, challenge.unlockAfterSlug))
        .limit(1);
      if (prereq) {
        const prereqSolve = await db
          .select()
          .from(ctfSubmissions)
          .where(
            and(
              eq(ctfSubmissions.userId, u.id),
              eq(ctfSubmissions.challengeId, prereq.id),
              eq(ctfSubmissions.isCorrect, true),
            ),
          )
          .limit(1);
        if (prereqSolve.length === 0) {
          return res.status(403).json({ error: `Unlock condition not met: solve ${prereq.title} first.` });
        }
      }
    }

    const alreadySolved = await db
      .select()
      .from(ctfSubmissions)
      .where(
        and(
          eq(ctfSubmissions.userId, u.id),
          eq(ctfSubmissions.challengeId, challengeId),
          eq(ctfSubmissions.isCorrect, true),
        ),
      )
      .limit(1);
    if (alreadySolved.length > 0) {
      return res.status(409).json({ error: 'You have already solved this challenge.' });
    }

    const isCorrect = verifyFlagConstantTime(rawFlag, challenge.flagHash);
    const suspicion = detectSuspiciousInput(rawFlag);
    const suspicionScore = suspicion.isSuspicious ? 65 : rate.remaining <= 1 ? 30 : 0;

    // Look up active team for this competition if applicable
    let teamId: number | null = null;
    if (challenge.competitionId) {
      const [part] = await db
        .select()
        .from(roomParticipations)
        .where(
          and(
            eq(roomParticipations.competitionId, challenge.competitionId),
            eq(roomParticipations.userId, u.id),
          ),
        )
        .limit(1);
      teamId = part?.teamId ?? null;
    }

    const pointsAwarded = isCorrect ? challenge.currentPoints : 0;

    await db.insert(ctfSubmissions).values({
      challengeId,
      userId: u.id,
      teamId,
      competitionId: challenge.competitionId,
      submittedFlagMasked: maskFlag(rawFlag),
      isCorrect,
      pointsAwarded,
      ipAddress: req.ip || '0.0.0.0',
      suspicionScore,
    });

    if (!isCorrect) {
      return res.status(400).json({
        correct: false,
        error: 'Incorrect flag. Check your analysis and try again.',
        remainingAttemptsThisMinute: rate.remaining,
      });
    }

    const newSolveCount = challenge.solveCount + 1;
    const nextPoints =
      challenge.scoringMode === 'dynamic'
        ? calculateDynamicCtfPoints(challenge.basePoints, newSolveCount)
        : challenge.basePoints;

    await db
      .update(ctfChallenges)
      .set({ solveCount: newSolveCount, currentPoints: nextPoints })
      .where(eq(ctfChallenges.id, challengeId));

    await db
      .update(users)
      .set({
        xp: sql`${users.xp} + ${pointsAwarded}`,
        ctfPoints: sql`${users.ctfPoints} + ${pointsAwarded}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, u.id));

    if (teamId) {
      await db
        .update(teams)
        .set({ score: sql`${teams.score} + ${pointsAwarded}` })
        .where(eq(teams.id, teamId));
    }

    await grantAchievementIfMissing(u.id, 'FIRST_BLOOD_CTF');

    broadcastPublicEvent('leaderboard:updated', {
      challengeId,
      solver: u.username,
      pointsAwarded,
    });

    res.json({
      correct: true,
      pointsAwarded,
      explanation: challenge.explanationAfterSolve,
    });
  });

  // =========================================================================
  // 6. MULTIPLAYER ARENA (Distinct Room Code + Team Code System)
  // =========================================================================
  router.get('/arena', optionalAuth, requireSectionEnabled('arena'), async (req: AuthRequest, res) => {
    const [compList, roomList, teamList, partCounts] = await Promise.all([
      db.select().from(competitions).where(eq(competitions.visibility, 'public')).orderBy(desc(competitions.startsAt)),
      db.select().from(rooms),
      db
        .select({
          id: teams.id,
          competitionId: teams.competitionId,
          campusId: teams.campusId,
          campusName: campuses.name,
          name: teams.name,
          maxMembers: teams.maxMembers,
          score: teams.score,
          isActive: teams.isActive,
          isSuspended: teams.isSuspended,
        })
        .from(teams)
        .leftJoin(campuses, eq(teams.campusId, campuses.id)),
      db
        .select({
          roomId: roomParticipations.roomId,
          teamId: roomParticipations.teamId,
          count: sql<number>`count(*)::int`,
        })
        .from(roomParticipations)
        .where(eq(roomParticipations.status, 'active'))
        .groupBy(roomParticipations.roomId, roomParticipations.teamId),
    ]);

    const compById = new Map(compList.map((c) => [c.id, c]));
    const publicRooms = roomList.filter((r) => compById.has(r.competitionId));
    const publicTeams = teamList.filter((t) => t.competitionId !== null && compById.has(t.competitionId));

    const roomCountMap = new Map<number, number>();
    const teamCountMap = new Map<number, number>();
    for (const pc of partCounts) {
      roomCountMap.set(pc.roomId, (roomCountMap.get(pc.roomId) ?? 0) + pc.count);
      teamCountMap.set(pc.teamId, (teamCountMap.get(pc.teamId) ?? 0) + pc.count);
    }

    let userParticipations: Array<{
      competitionId: number;
      roomId: number;
      teamId: number;
      teamName: string;
      roomName: string;
    }> = [];
    if (req.dbUser) {
      userParticipations = await db
        .select({
          competitionId: roomParticipations.competitionId,
          roomId: roomParticipations.roomId,
          teamId: roomParticipations.teamId,
          teamName: teams.name,
          roomName: rooms.name,
        })
        .from(roomParticipations)
        .innerJoin(teams, eq(roomParticipations.teamId, teams.id))
        .innerJoin(rooms, eq(roomParticipations.roomId, rooms.id))
        .where(and(eq(roomParticipations.userId, req.dbUser.id), eq(roomParticipations.status, 'active')));
    }

    res.json({
      competitions: compList,
      rooms: publicRooms.map((r) => ({
        id: r.id,
        competitionId: r.competitionId,
        name: r.name,
        isActive: r.isActive,
        isLocked: r.isLocked,
        maxParticipants: r.maxParticipants,
        currentParticipants: roomCountMap.get(r.id) ?? 0,
      })),
      teams: publicTeams.map((t) => ({
        id: t.id,
        competitionId: t.competitionId,
        campusId: t.campusId,
        campusName: t.campusName,
        name: t.name,
        maxMembers: t.maxMembers,
        score: t.score,
        isActive: t.isActive,
        isSuspended: t.isSuspended,
        currentMembers: teamCountMap.get(t.id) ?? 0,
      })),
      userParticipations,
    });
  });

  router.get('/arena/lobby/:competitionId', requireAuth, requireSectionEnabled('arena'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const competitionId = Number(req.params.competitionId);

    const [comp] = await db.select().from(competitions).where(eq(competitions.id, competitionId)).limit(1);
    if (!comp) return res.status(404).json({ error: 'Competition not found.' });

    const [participation] = await db
      .select()
      .from(roomParticipations)
      .where(
        and(
          eq(roomParticipations.competitionId, competitionId),
          eq(roomParticipations.userId, u.id),
          eq(roomParticipations.status, 'active'),
        ),
      )
      .limit(1);

    const isStaff = ['owner', 'event_admin', 'moderator'].includes(u.role);
    if (!participation && !isStaff) {
      return res.status(403).json({ error: 'Join this competition with a Room Code and Team Code to enter the lobby.' });
    }

    const [roomRows, allTeams, memberRows] = await Promise.all([
      participation
        ? db.select().from(rooms).where(eq(rooms.id, participation.roomId)).limit(1)
        : db.select().from(rooms).where(eq(rooms.competitionId, competitionId)).limit(1),
      db
        .select({
          id: teams.id,
          name: teams.name,
          score: teams.score,
          maxMembers: teams.maxMembers,
          campusName: campuses.name,
        })
        .from(teams)
        .leftJoin(campuses, eq(teams.campusId, campuses.id))
        .where(eq(teams.competitionId, competitionId))
        .orderBy(desc(teams.score)),
      participation
        ? db
            .select({
              userId: users.id,
              username: users.username,
              displayName: users.displayName,
              roleInTeam: teamMembers.roleInTeam,
              isMutedInChat: teamMembers.isMutedInChat,
            })
            .from(teamMembers)
            .innerJoin(users, eq(teamMembers.userId, users.id))
            .where(and(eq(teamMembers.teamId, participation.teamId), eq(teamMembers.removalStatus, 'active')))
        : Promise.resolve([]),
    ]);

    const onlineIds = getOnlineUserIds();
    const myTeam = participation
      ? allTeams.find((t) => t.id === participation.teamId) || null
      : null;

    res.json({
      competition: comp,
      room: roomRows[0]
        ? {
            id: roomRows[0].id,
            name: roomRows[0].name,
            isActive: roomRows[0].isActive,
            isLocked: roomRows[0].isLocked,
            maxParticipants: roomRows[0].maxParticipants,
          }
        : null,
      team: myTeam,
      members: memberRows.map((m) => ({
        ...m,
        isOnline: onlineIds.includes(m.userId),
      })),
      scoreboard: allTeams,
    });
  });

  router.post('/arena/join', requireAuth, requireSectionEnabled('arena'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    if (!u.policyAcknowledgedAt && !req.body.acknowledgePolicy) {
      return res.status(400).json({
        error: 'You must acknowledge the KALI3977 Administration and Security Notice before joining competitions.',
        code: 'POLICY_ACK_REQUIRED',
      });
    }
    if (!u.policyAcknowledgedAt && req.body.acknowledgePolicy) {
      await db
        .update(users)
        .set({ policyAcknowledgedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, u.id));
    }

    const joinRate = arenaJoinRateLimiter.check(`join:${u.id}`, 10, 60_000);
    if (!joinRate.allowed) {
      return res.status(429).json({
        error: `Too many join attempts. Wait ${joinRate.retryAfterSeconds}s before trying again.`,
      });
    }

    const roomCode = sanitizeText(String(req.body.roomCode || '').toUpperCase(), 40);
    const teamCode = sanitizeText(String(req.body.teamCode || '').toUpperCase(), 40);

    if (!roomCode || !teamCode) {
      return res.status(400).json({ error: 'Both a Room Code and a Team Code are required.' });
    }

    const [room] = await db.select().from(rooms).where(eq(rooms.roomCode, roomCode)).limit(1);
    const [team] = await db.select().from(teams).where(eq(teams.teamCode, teamCode)).limit(1);

    let comp = null;
    if (room) {
      const [c] = await db.select().from(competitions).where(eq(competitions.id, room.competitionId)).limit(1);
      comp = c ?? null;
    }

    let currentRoomParticipants = 0;
    if (room) {
      const [cnt] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(roomParticipations)
        .where(and(eq(roomParticipations.roomId, room.id), eq(roomParticipations.status, 'active')));
      currentRoomParticipants = cnt?.count ?? 0;
    }

    let currentTeamMembers = 0;
    let teamRemovalState: { status: string; expiresAt: Date | null } | null = null;
    if (team) {
      const [cnt, memRow] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(teamMembers)
          .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.removalStatus, 'active'))),
        db
          .select({ removalStatus: teamMembers.removalStatus, removalExpiresAt: teamMembers.removalExpiresAt })
          .from(teamMembers)
          .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, u.id)))
          .limit(1),
      ]);
      currentTeamMembers = cnt[0]?.count ?? 0;
      if (memRow[0] && memRow[0].removalStatus !== 'active') {
        teamRemovalState = { status: memRow[0].removalStatus, expiresAt: memRow[0].removalExpiresAt };
      }
    }

    let existingParticipation: { teamId: number; status: string } | null = null;
    if (comp) {
      const [part] = await db
        .select({ teamId: roomParticipations.teamId, status: roomParticipations.status })
        .from(roomParticipations)
        .where(and(eq(roomParticipations.competitionId, comp.id), eq(roomParticipations.userId, u.id)))
        .limit(1);
      existingParticipation = part ?? null;
    }

    const validation = validateRoomAndTeamJoin({
      room: room
        ? {
            id: room.id,
            competitionId: room.competitionId,
            roomCode: room.roomCode,
            isActive: room.isActive,
            isLocked: room.isLocked,
            maxParticipants: room.maxParticipants,
            currentParticipants: currentRoomParticipants,
            usageCount: room.usageCount,
            usageLimit: room.usageLimit,
            expiresAt: room.expiresAt,
          }
        : null,
      team: team
        ? {
            id: team.id,
            competitionId: team.competitionId,
            campusId: team.campusId,
            name: team.name,
            teamCode: team.teamCode,
            isActive: team.isActive,
            isSuspended: team.isSuspended,
            maxMembers: team.maxMembers,
            currentMembers: currentTeamMembers,
            codeUsageCount: team.codeUsageCount,
            codeUsageLimit: team.codeUsageLimit,
            codeExpiresAt: team.codeExpiresAt,
          }
        : null,
      competition: comp
        ? {
            id: comp.id,
            status: comp.status,
            enrollmentPolicy: comp.enrollmentPolicy,
            allowLateJoin: comp.allowLateJoin,
            totalCapacity: comp.totalCapacity,
            perTeamCapacity: comp.perTeamCapacity,
            registrationDeadline: comp.registrationDeadline ?? null,
          }
        : null,
      userCampusId: u.campusId,
      existingParticipationInCompetition: existingParticipation,
      teamRemovalState,
    });

    if (!validation.allowed) {
      return res.status(400).json({ error: validation.message, code: validation.code });
    }

    await db
      .insert(teamMembers)
      .values({
        teamId: team!.id,
        userId: u.id,
        competitionId: comp!.id,
        roleInTeam: currentTeamMembers === 0 ? 'captain' : 'member',
      })
      .onConflictDoNothing();

    if (currentTeamMembers === 0 && !team!.captainId) {
      await db.update(teams).set({ captainId: u.id }).where(eq(teams.id, team!.id));
    }

    const [participation] = await db
      .insert(roomParticipations)
      .values({
        roomId: room!.id,
        competitionId: comp!.id,
        userId: u.id,
        teamId: team!.id,
      })
      .returning();

    await db
      .update(rooms)
      .set({ usageCount: sql`${rooms.usageCount} + 1` })
      .where(eq(rooms.id, room!.id));
    await db
      .update(teams)
      .set({ codeUsageCount: sql`${teams.codeUsageCount} + 1` })
      .where(eq(teams.id, team!.id));

    await grantAchievementIfMissing(u.id, 'CAMPUS_ENVOY');

    const [notif] = await db
      .insert(notifications)
      .values({
        userId: u.id,
        type: 'competition',
        title: `Joined ${comp!.name}`,
        body: `Entered room ${room!.name} representing ${team!.name}.`,
      })
      .returning();
    if (notif) broadcastUserNotification(u.id, notif);

    broadcastPublicEvent('arena:participant_joined', {
      competitionId: comp!.id,
      roomId: room!.id,
      teamId: team!.id,
      username: u.username,
    });

    res.json({
      ok: true,
      participation,
      roomName: room!.name,
      teamName: team!.name,
      competitionName: comp!.name,
    });
  });

  // =========================================================================
  // 7. TEAM COMMUNICATION SYSTEM (Server-Enforced Channel Isolation)
  // =========================================================================
  router.get('/chat/channels', requireAuth, requireSectionEnabled('arena'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const memberships = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, u.id), eq(teamMembers.removalStatus, 'active')));
    const userTeamIds = memberships.map((m) => m.teamId);

    const allChannels = await db.select().from(chatChannels);
    const accessible = allChannels.filter((ch) => {
      const isCaptainOfChannelTeam =
        ch.teamId !== null &&
        memberships.some((m) => m.teamId === ch.teamId && (m.roleInTeam === 'captain' || m.roleInTeam === 'deputy'));
      return evaluateChatAccess({
        channelType: ch.channelType,
        channelTeamId: ch.teamId,
        channelEnabled: ch.isEnabled,
        userRole: u.role as UserRole,
        userTeamIds,
        isCaptainOfChannelTeam,
      }).allowed;
    });

    res.json({ channels: accessible });
  });

  router.get('/chat/channels/:channelId/messages', requireAuth, requireSectionEnabled('arena'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const channelId = Number(req.params.channelId);
    const [ch] = await db.select().from(chatChannels).where(eq(chatChannels.id, channelId)).limit(1);
    if (!ch) return res.status(404).json({ error: 'Channel not found.' });

    const memberships = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, u.id), eq(teamMembers.removalStatus, 'active')));
    const userTeamIds = memberships.map((m) => m.teamId);
    const isCaptain =
      ch.teamId !== null &&
      memberships.some((m) => m.teamId === ch.teamId && (m.roleInTeam === 'captain' || m.roleInTeam === 'deputy'));

    const access = evaluateChatAccess({
      channelType: ch.channelType,
      channelTeamId: ch.teamId,
      channelEnabled: ch.isEnabled,
      userRole: u.role as UserRole,
      userTeamIds,
      isCaptainOfChannelTeam: isCaptain,
    });
    if (!access.allowed) {
      return res.status(403).json({ error: access.reason });
    }

    const [msgs, teamRoles] = await Promise.all([
      db
        .select({
          id: chatMessages.id,
          channelId: chatMessages.channelId,
          senderId: chatMessages.senderId,
          senderName: users.displayName,
          senderUsername: users.username,
          senderRole: users.role,
          content: chatMessages.content,
          replyToId: chatMessages.replyToId,
          reactionsJson: chatMessages.reactionsJson,
          isPinned: chatMessages.isPinned,
          isReported: chatMessages.isReported,
          createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .innerJoin(users, eq(chatMessages.senderId, users.id))
        .where(and(eq(chatMessages.channelId, channelId), eq(chatMessages.isDeleted, false)))
        .orderBy(desc(chatMessages.createdAt))
        .limit(80),
      ch.teamId
        ? db
            .select({ userId: teamMembers.userId, roleInTeam: teamMembers.roleInTeam })
            .from(teamMembers)
            .where(eq(teamMembers.teamId, ch.teamId))
        : Promise.resolve([]),
    ]);

    const roleByUser = new Map(teamRoles.map((r) => [r.userId, r.roleInTeam]));
    res.json({
      messages: msgs.reverse().map((m) => ({
        ...m,
        senderTeamRole: roleByUser.get(m.senderId) || null,
      })),
    });
  });

  router.post('/chat/channels/:channelId/messages', requireAuth, requireSectionEnabled('arena'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const chatRate = chatRateLimiter.check(`chat:${u.id}`, 20, 60_000);
    if (!chatRate.allowed) {
      return res.status(429).json({
        error: `Message rate limit reached. Wait ${chatRate.retryAfterSeconds}s.`,
      });
    }

    const channelId = Number(req.params.channelId);
    const content = sanitizeText(String(req.body.content || ''), 1200);
    if (!content) return res.status(400).json({ error: 'Message content cannot be empty.' });

    const [ch] = await db.select().from(chatChannels).where(eq(chatChannels.id, channelId)).limit(1);
    if (!ch) return res.status(404).json({ error: 'Channel not found.' });

    const memberships = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, u.id), eq(teamMembers.removalStatus, 'active')));
    const userTeamIds = memberships.map((m) => m.teamId);
    const teamMem = ch.teamId ? memberships.find((m) => m.teamId === ch.teamId) : undefined;
    const isCaptain = Boolean(
      teamMem && (teamMem.roleInTeam === 'captain' || teamMem.roleInTeam === 'deputy'),
    );

    const access = evaluateChatAccess({
      channelType: ch.channelType,
      channelTeamId: ch.teamId,
      channelEnabled: ch.isEnabled,
      userRole: u.role as UserRole,
      userTeamIds,
      isCaptainOfChannelTeam: isCaptain,
      isMutedInChat: Boolean(teamMem?.isMutedInChat),
      isWrite: true,
    });
    if (!access.allowed) {
      return res.status(403).json({ error: access.reason });
    }

    if (ch.channelType === 'announcements' && u.role !== 'owner' && u.role !== 'event_admin') {
      return res.status(403).json({ error: 'Only competition organizers can post announcements.' });
    }

    const [inserted] = await db
      .insert(chatMessages)
      .values({
        channelId,
        senderId: u.id,
        content,
        replyToId: typeof req.body.replyToId === 'number' ? req.body.replyToId : null,
      })
      .returning();

    const fullMessage = {
      ...inserted,
      senderName: u.displayName,
      senderUsername: u.username,
      senderRole: u.role,
      senderTeamRole: teamMem?.roleInTeam || null,
    };

    broadcastChannelMessage({
      channelType: ch.channelType,
      teamId: ch.teamId,
      message: fullMessage,
    });

    res.status(201).json({ message: fullMessage });
  });

  router.delete('/chat/messages/:messageId', requireAuth, requireSectionEnabled('arena'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const messageId = Number(req.params.messageId);
    const [msg] = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId)).limit(1);
    if (!msg) return res.status(404).json({ error: 'Message not found.' });

    const [ch] = await db.select().from(chatChannels).where(eq(chatChannels.id, msg.channelId)).limit(1);
    let isCaptain = false;
    if (ch?.teamId) {
      const [tm] = await db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, ch.teamId), eq(teamMembers.userId, u.id)))
        .limit(1);
      isCaptain = Boolean(tm && (tm.roleInTeam === 'captain' || tm.roleInTeam === 'deputy'));
    }

    const isModerator = hasPermission({ ...u, role: u.role as UserRole }, 'admin:manage_comms');
    if (msg.senderId !== u.id && !isCaptain && !isModerator) {
      return res.status(403).json({ error: 'You are not authorized to delete this message.' });
    }

    await db.update(chatMessages).set({ isDeleted: true }).where(eq(chatMessages.id, messageId));
    if (ch) {
      broadcastChannelMessage({
        channelType: ch.channelType,
        teamId: ch.teamId,
        eventType: 'chat:message_deleted',
        message: { id: messageId, channelId: ch.id },
      });
    }
    if (isModerator && msg.senderId !== u.id) {
      await recordAuditLog({
        actorId: u.id,
        actorEmail: u.email,
        action: 'CHAT_MESSAGE_DELETED',
        resourceType: 'chat_message',
        resourceId: String(messageId),
        ipAddress: req.ip,
      });
    }
    res.json({ ok: true });
  });

  router.post('/chat/channels/:channelId/mute', requireAuth, requireSectionEnabled('arena'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const channelId = Number(req.params.channelId);
    const targetUserId = Number(req.body.userId);
    const muted = Boolean(req.body.muted ?? true);

    const [ch] = await db.select().from(chatChannels).where(eq(chatChannels.id, channelId)).limit(1);
    if (!ch || !ch.teamId) return res.status(404).json({ error: 'Team channel not found.' });

    const [actorMem] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, ch.teamId), eq(teamMembers.userId, u.id)))
      .limit(1);
    const isCaptain = Boolean(actorMem && actorMem.roleInTeam === 'captain');
    const canMute =
      hasPermission({ ...u, role: u.role as UserRole }, 'mod:mute_users') ||
      hasPermission({ ...u, role: u.role as UserRole }, 'admin:manage_comms') ||
      isCaptain;
    if (!canMute) {
      return res.status(403).json({ error: 'Moderator or team captain privileges required to mute users.' });
    }

    const [updated] = await db
      .update(teamMembers)
      .set({ isMutedInChat: muted })
      .where(and(eq(teamMembers.teamId, ch.teamId), eq(teamMembers.userId, targetUserId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Team member not found.' });

    await recordAuditLog({
      actorId: u.id,
      actorEmail: u.email,
      action: muted ? 'CHAT_USER_MUTED' : 'CHAT_USER_UNMUTED',
      resourceType: 'team_member',
      resourceId: `${ch.teamId}:${targetUserId}`,
      newStateJson: { isMutedInChat: muted, channelId },
      ipAddress: req.ip,
    });

    res.json({ ok: true, member: updated });
  });

  router.post('/chat/messages/:messageId/pin', requireAuth, requireSectionEnabled('arena'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const messageId = Number(req.params.messageId);
    const [msg] = await db.select().from(chatMessages).where(eq(chatMessages.id, messageId)).limit(1);
    if (!msg) return res.status(404).json({ error: 'Message not found.' });

    const [ch] = await db.select().from(chatChannels).where(eq(chatChannels.id, msg.channelId)).limit(1);
    let isCaptain = false;
    if (ch?.teamId) {
      const [tm] = await db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, ch.teamId), eq(teamMembers.userId, u.id)))
        .limit(1);
      isCaptain = Boolean(tm && (tm.roleInTeam === 'captain' || tm.roleInTeam === 'deputy'));
    }
    const isStaff = ['owner', 'event_admin', 'moderator'].includes(u.role);
    if (!isCaptain && !isStaff) {
      return res.status(403).json({ error: 'Only team captains or moderators can pin messages.' });
    }

    const nextPinned = typeof req.body.isPinned === 'boolean' ? req.body.isPinned : !msg.isPinned;
    const [updated] = await db
      .update(chatMessages)
      .set({ isPinned: nextPinned })
      .where(eq(chatMessages.id, messageId))
      .returning();

    if (ch) {
      broadcastChannelMessage({
        channelType: ch.channelType,
        teamId: ch.teamId,
        eventType: 'chat:message_pinned',
        message: { id: messageId, channelId: ch.id, isPinned: nextPinned },
      });
    }
    res.json({ ok: true, message: updated });
  });

  router.post('/chat/messages/:messageId/report', requireAuth, requireSectionEnabled('arena'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const messageId = Number(req.params.messageId);
    const reason = sanitizeText(String(req.body.reason || 'Inappropriate behavior'), 300);

    await db.update(chatMessages).set({ isReported: true }).where(eq(chatMessages.id, messageId));
    const [report] = await db
      .insert(securityReports)
      .values({
        reporterId: u.id,
        targetType: 'message',
        targetId: messageId,
        reason,
      })
      .returning();
    res.json({ ok: true, report });
  });

  // =========================================================================
  // 8. TOURNAMENTS & EVENTS
  // =========================================================================
  router.get('/tournaments', optionalAuth, requireSectionEnabled('tournaments'), async (_req, res) => {
    const [tList, regs] = await Promise.all([
      db.select().from(tournaments).orderBy(desc(tournaments.startsAt)),
      db
        .select({
          id: tournamentRegistrations.id,
          tournamentId: tournamentRegistrations.tournamentId,
          teamId: tournamentRegistrations.teamId,
          teamName: teams.name,
          status: tournamentRegistrations.status,
        })
        .from(tournamentRegistrations)
        .innerJoin(teams, eq(tournamentRegistrations.teamId, teams.id)),
    ]);
    res.json({ tournaments: tList, registrations: regs });
  });

  router.post('/tournaments/:id/register', requireAuth, requireSectionEnabled('tournaments'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const tournamentId = Number(req.params.id);
    const teamId = Number(req.body.teamId);

    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
    if (!t) return res.status(404).json({ error: 'Tournament not found.' });

    const [membership] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, u.id), eq(teamMembers.teamId, teamId)))
      .limit(1);
    if (!membership && u.role !== 'owner') {
      return res.status(403).json({ error: 'You must belong to a team to register it for a tournament.' });
    }

    const currentRegs = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tournamentRegistrations)
      .where(eq(tournamentRegistrations.tournamentId, tournamentId));

    const status = (currentRegs[0]?.count ?? 0) >= t.maxTeams ? 'waitlist' : 'confirmed';

    const [reg] = await db
      .insert(tournamentRegistrations)
      .values({ tournamentId, teamId, status })
      .onConflictDoNothing()
      .returning();

    res.json({ ok: true, registration: reg, status });
  });

  // =========================================================================
  // 9. AI CYBER MENTOR (Database-Enforced Quotas, Budget & Admin Controls)
  // =========================================================================
  router.use(createAiMentorRouter());

  // =========================================================================
  // 10. COMMUNITY, NOTIFICATIONS, LEADERBOARDS, CERTIFICATE VERIFICATION
  // =========================================================================
  router.get('/community', optionalAuth, requireSectionEnabled('community'), async (req, res) => {
    const topic = sanitizeText(String(req.query.topic || ''), 40);
    const q = sanitizeText(String(req.query.q || ''), 80);

    const conditions = [eq(communityPosts.isDeleted, false)];
    if (topic && topic !== 'All') {
      conditions.push(eq(communityPosts.topic, topic));
    }
    if (q) {
      conditions.push(
        or(ilike(communityPosts.title, `%${q}%`), ilike(communityPosts.body, `%${q}%`))!,
      );
    }

    const posts = await db
      .select({
        id: communityPosts.id,
        authorId: communityPosts.authorId,
        topic: communityPosts.topic,
        title: communityPosts.title,
        body: communityPosts.body,
        upvotes: communityPosts.upvotes,
        isAnnouncement: communityPosts.isAnnouncement,
        isReported: communityPosts.isReported,
        createdAt: communityPosts.createdAt,
        updatedAt: communityPosts.updatedAt,
        authorUsername: users.username,
        authorName: users.displayName,
      })
      .from(communityPosts)
      .innerJoin(users, eq(communityPosts.authorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(communityPosts.createdAt))
      .limit(50);

    const postIds = posts.map((p) => p.id);
    const replyRows =
      postIds.length > 0
        ? await db
            .select({
              id: communityReplies.id,
              postId: communityReplies.postId,
              authorId: communityReplies.authorId,
              body: communityReplies.body,
              createdAt: communityReplies.createdAt,
              authorUsername: users.username,
              authorName: users.displayName,
            })
            .from(communityReplies)
            .innerJoin(users, eq(communityReplies.authorId, users.id))
            .where(and(inArray(communityReplies.postId, postIds), eq(communityReplies.isDeleted, false)))
            .orderBy(communityReplies.createdAt)
        : [];

    const repliesByPost = new Map<number, typeof replyRows>();
    for (const r of replyRows) {
      const arr = repliesByPost.get(r.postId) || [];
      arr.push(r);
      repliesByPost.set(r.postId, arr);
    }

    res.json({
      posts: posts.map((p) => ({
        ...p,
        replies: repliesByPost.get(p.id) || [],
      })),
    });
  });

  router.post('/community', requireAuth, requireSectionEnabled('community'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const controls = await getPlatformControls();
    if (controls.disableCommunity && u.role !== 'owner') {
      return res.status(503).json({ error: 'Community posting is temporarily paused by administration.' });
    }
    const topic = sanitizeText(String(req.body.topic || 'General'), 40);
    const title = sanitizeText(String(req.body.title || ''), 140);
    const body = sanitizeText(String(req.body.body || ''), 2000);
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and discussion body are required.' });
    }
    const [post] = await db
      .insert(communityPosts)
      .values({ authorId: u.id, topic, title, body })
      .returning();
    res.status(201).json({ post });
  });

  router.post('/community/:id/replies', requireAuth, requireSectionEnabled('community'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const controls = await getPlatformControls();
    if (controls.disableCommunity && u.role !== 'owner') {
      return res.status(503).json({ error: 'Community replies are temporarily paused by administration.' });
    }
    const postId = Number(req.params.id);
    const body = sanitizeText(String(req.body.body || ''), 1200);
    if (!body) return res.status(400).json({ error: 'Reply cannot be empty.' });

    const [post] = await db
      .select()
      .from(communityPosts)
      .where(and(eq(communityPosts.id, postId), eq(communityPosts.isDeleted, false)))
      .limit(1);
    if (!post) return res.status(404).json({ error: 'Discussion not found.' });

    const [reply] = await db
      .insert(communityReplies)
      .values({ postId, authorId: u.id, body })
      .returning();
    res.status(201).json({ reply });
  });

  router.patch('/community/:id', requireAuth, requireSectionEnabled('community'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const id = Number(req.params.id);
    const [existing] = await db.select().from(communityPosts).where(eq(communityPosts.id, id)).limit(1);
    if (!existing || existing.isDeleted) return res.status(404).json({ error: 'Post not found.' });
    if (existing.authorId !== u.id && u.role !== 'owner') {
      return res.status(403).json({ error: 'Only the author can edit this post.' });
    }
    const title = sanitizeText(String(req.body.title || existing.title), 140);
    const body = sanitizeText(String(req.body.body || existing.body), 2000);
    const [updated] = await db
      .update(communityPosts)
      .set({ title, body, updatedAt: new Date() })
      .where(eq(communityPosts.id, id))
      .returning();
    res.json({ post: updated });
  });

  router.delete('/community/:id', requireAuth, requireSectionEnabled('community'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const id = Number(req.params.id);
    const [existing] = await db.select().from(communityPosts).where(eq(communityPosts.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Post not found.' });
    const isMod = hasPermission({ ...u, role: u.role as UserRole }, 'admin:manage_comms');
    if (existing.authorId !== u.id && !isMod) {
      return res.status(403).json({ error: 'Not authorized to delete this post.' });
    }
    await db
      .update(communityPosts)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(communityPosts.id, id));
    res.json({ ok: true });
  });

  router.post('/community/:id/report', requireAuth, requireSectionEnabled('community'), async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const id = Number(req.params.id);
    const reason = sanitizeText(String(req.body.reason || 'Reported community post'), 300);
    await db.update(communityPosts).set({ isReported: true }).where(eq(communityPosts.id, id));
    const [report] = await db
      .insert(securityReports)
      .values({ reporterId: u.id, targetType: 'community_post', targetId: id, reason })
      .returning();
    res.json({ ok: true, report });
  });

  router.post('/community/:id/upvote', requireAuth, requireSectionEnabled('community'), async (req, res) => {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(communityPosts)
      .set({ upvotes: sql`${communityPosts.upvotes} + 1` })
      .where(eq(communityPosts.id, id))
      .returning();
    res.json({ post: updated });
  });

  router.get('/leaderboards', async (req, res) => {
    const limit = clampPaginationLimit(req.query.limit, 25, 25);
    const [individual, teamBoard, campusBoard] = await Promise.all([
      db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          country: users.country,
          xp: users.xp,
          ctfPoints: users.ctfPoints,
          level: users.level,
        })
        .from(users)
        .where(and(eq(users.isBanned, false), eq(users.profileVisibility, 'public')))
        .orderBy(desc(users.xp))
        .limit(limit),
      db
        .select({
          id: teams.id,
          name: teams.name,
          score: teams.score,
          campusName: campuses.name,
          campusCountry: campuses.country,
        })
        .from(teams)
        .leftJoin(campuses, eq(teams.campusId, campuses.id))
        .where(eq(teams.isSuspended, false))
        .orderBy(desc(teams.score))
        .limit(limit),
      db
        .select({
          id: campuses.id,
          code: campuses.code,
          name: campuses.name,
          country: campuses.country,
          totalScore: sql<number>`coalesce(sum(${teams.score}), 0)::int`,
        })
        .from(campuses)
        .leftJoin(teams, eq(teams.campusId, campuses.id))
        .groupBy(campuses.id)
        .orderBy(desc(sql`coalesce(sum(${teams.score}), 0)`)),
    ]);
    res.json({ individual, teams: teamBoard, campuses: campusBoard });
  });

  router.get('/certificates/verify/:verificationId', async (req, res) => {
    const verificationId = sanitizeText(String(req.params.verificationId || ''), 80);
    const [row] = await db
      .select({
        verificationId: certificates.verificationId,
        title: certificates.title,
        category: certificates.category,
        issuer: certificates.issuer,
        issuedAt: certificates.issuedAt,
        isRevoked: certificates.isRevoked,
        revokedReason: certificates.revokedReason,
        recipientName: users.displayName,
        recipientUsername: users.username,
      })
      .from(certificates)
      .innerJoin(users, eq(certificates.userId, users.id))
      .where(eq(certificates.verificationId, verificationId))
      .limit(1);

    if (!row) {
      return res.status(404).json({ valid: false, error: 'Certificate ID not found.' });
    }
    res.json({ valid: !row.isRevoked, certificate: row });
  });

  router.get('/appeals', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const rows = await db
      .select()
      .from(disciplinaryAppeals)
      .where(eq(disciplinaryAppeals.userId, u.id))
      .orderBy(desc(disciplinaryAppeals.createdAt))
      .limit(20);
    res.json({ appeals: rows });
  });

  router.post('/appeals', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const scope = ['platform_suspension', 'platform_ban', 'team_removal', 'competition_removal'].includes(
      String(req.body.scope),
    )
      ? String(req.body.scope)
      : 'team_removal';
    const targetId = typeof req.body.targetId === 'number' ? req.body.targetId : null;
    const reason = sanitizeText(String(req.body.reason || ''), 600);
    if (!reason) return res.status(400).json({ error: 'Appeal explanation is required.' });

    const [created] = await db
      .insert(disciplinaryAppeals)
      .values({ userId: u.id, scope, targetId, reason, status: 'open' })
      .returning();
    res.status(201).json({ appeal: created });
  });

  router.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, u.id))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
    res.json({ notifications: rows });
  });

  router.post('/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const id = Number(req.params.id);
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, u.id)));
    res.json({ ok: true });
  });

  // =========================================================================
  // 10B. INTELLECTUAL PROPERTY VIOLATION, TAKEDOWN & DISPUTE ENDPOINTS
  // =========================================================================
  router.post('/ip-reports', optionalAuth, async (req: AuthRequest, res) => {
    const check = validateIpReportInput((req.body || {}) as Record<string, unknown>);
    if (!check.valid || !check.data) {
      return res.status(400).json({ error: check.error || 'Invalid IP report submission.' });
    }
    const referenceCode = `KALI-IP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const [created] = await db
      .insert(ipViolationReports)
      .values({
        referenceCode,
        userId: req.dbUser?.id ?? null,
        reportType: check.data.reportType,
        targetType: check.data.targetType,
        targetRef: check.data.targetRef,
        reporterName: check.data.reporterName,
        reporterEmail: check.data.reporterEmail,
        organization: check.data.organization,
        description: check.data.description,
        evidenceUrl: check.data.evidenceUrl,
        counterNoticeText: check.data.counterNoticeText,
        status: 'open',
      })
      .returning();

    await recordAuditLog({
      actorId: req.dbUser?.id ?? null,
      actorEmail: check.data.reporterEmail,
      action: 'IP_REPORT_SUBMITTED',
      resourceType: 'ip_violation_report',
      resourceId: referenceCode,
      newStateJson: { reportType: check.data.reportType, targetType: check.data.targetType },
      ipAddress: req.ip,
    });

    res.status(201).json({
      message: 'Intellectual property notice submitted and queued for administrative review.',
      report: {
        referenceCode: created.referenceCode,
        reportType: created.reportType,
        targetType: created.targetType,
        targetRef: created.targetRef,
        status: created.status,
        adminResolutionNote: created.adminResolutionNote,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    });
  });

  router.get('/ip-reports/status/:referenceCode', async (req, res) => {
    const referenceCode = sanitizeText(String(req.params.referenceCode || ''), 30).toUpperCase();
    const email = sanitizeText(String(req.query.email || ''), 160).toLowerCase();
    if (!referenceCode || !email) {
      return res.status(400).json({ error: 'Both referenceCode and contact email are required.' });
    }
    const [row] = await db
      .select()
      .from(ipViolationReports)
      .where(eq(ipViolationReports.referenceCode, referenceCode))
      .limit(1);
    if (!row || row.reporterEmail.toLowerCase() !== email) {
      return res.status(404).json({ error: 'No matching IP report case found for that reference and email.' });
    }
    res.json({
      report: {
        referenceCode: row.referenceCode,
        reportType: row.reportType,
        targetType: row.targetType,
        targetRef: row.targetRef,
        status: row.status,
        adminResolutionNote: row.adminResolutionNote,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  });

  router.get('/ip-reports/mine', requireAuth, async (req: AuthRequest, res) => {
    const u = req.dbUser!;
    const rows = await db
      .select({
        referenceCode: ipViolationReports.referenceCode,
        reportType: ipViolationReports.reportType,
        targetType: ipViolationReports.targetType,
        targetRef: ipViolationReports.targetRef,
        status: ipViolationReports.status,
        adminResolutionNote: ipViolationReports.adminResolutionNote,
        createdAt: ipViolationReports.createdAt,
        updatedAt: ipViolationReports.updatedAt,
      })
      .from(ipViolationReports)
      .where(
        or(
          eq(ipViolationReports.userId, u.id),
          eq(ipViolationReports.reporterEmail, u.email.toLowerCase()),
        ),
      )
      .orderBy(desc(ipViolationReports.createdAt))
      .limit(25);
    res.json({ reports: rows });
  });

  // =========================================================================
  // 11. OWNER & ADMIN PANEL (Sections A-G, Strict RBAC + Immutable Audit Logs)
  // =========================================================================
  router.get(
    '/admin/overview',
    requireAuth,
    requirePermission('admin:view_analytics'),
    async (req: AuthRequest, res) => {
      const search = sanitizeText(String(req.query.q || ''), 80);
      const today = new Date().toISOString().slice(0, 10);
      const [
        allUsers,
        userCountRow,
        activeTodayRow,
        completedLessonRow,
        labSessionRow,
        allComps,
        allRooms,
        allTeams,
        allCampuses,
        campusVerifRows,
        allCourses,
        allLessons,
        allCtf,
        recentSubmissions,
        allTournaments,
        allChannels,
        reportedMessages,
        recentLogins,
        logs,
        reports,
        settings,
      ] = await Promise.all([
        db
          .select({
            id: users.id,
            email: users.email,
            username: users.username,
            displayName: users.displayName,
            role: users.role,
            campusId: users.campusId,
            campusName: campuses.name,
            campusVerificationStatus: users.campusVerificationStatus,
            xp: users.xp,
            mfaEnabled: users.mfaEnabled,
            isSuspended: users.isSuspended,
            isBanned: users.isBanned,
            lastActiveDate: users.lastActiveDate,
            createdAt: users.createdAt,
          })
          .from(users)
          .leftJoin(campuses, eq(users.campusId, campuses.id))
          .where(
            search
              ? or(ilike(users.email, `%${search}%`), ilike(users.username, `%${search}%`))
              : undefined,
          )
          .orderBy(desc(users.createdAt))
          .limit(80),
        db.select({ count: sql<number>`count(*)::int` }).from(users),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(eq(users.lastActiveDate, today)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(userLessonProgress)
          .where(eq(userLessonProgress.completed, true)),
        db.select({ count: sql<number>`count(*)::int` }).from(labSessions),
        db.select().from(competitions).orderBy(desc(competitions.createdAt)),
        db.select().from(rooms).orderBy(desc(rooms.createdAt)),
        db
          .select({
            id: teams.id,
            competitionId: teams.competitionId,
            campusId: teams.campusId,
            name: teams.name,
            teamCode: teams.teamCode,
            captainId: teams.captainId,
            maxMembers: teams.maxMembers,
            score: teams.score,
            isActive: teams.isActive,
            isSuspended: teams.isSuspended,
          })
          .from(teams)
          .orderBy(desc(teams.createdAt)),
        db.select().from(campuses).orderBy(campuses.name),
        db
          .select({
            id: campusVerificationRequests.id,
            userId: campusVerificationRequests.userId,
            userEmail: users.email,
            userName: users.displayName,
            campusId: campusVerificationRequests.campusId,
            campusName: campuses.name,
            method: campusVerificationRequests.method,
            evidenceText: campusVerificationRequests.evidenceText,
            status: campusVerificationRequests.status,
            reviewNote: campusVerificationRequests.reviewNote,
            createdAt: campusVerificationRequests.createdAt,
          })
          .from(campusVerificationRequests)
          .innerJoin(users, eq(campusVerificationRequests.userId, users.id))
          .innerJoin(campuses, eq(campusVerificationRequests.campusId, campuses.id))
          .orderBy(desc(campusVerificationRequests.createdAt))
          .limit(50),
        db.select().from(courses).orderBy(courses.stage, courses.orderIndex),
        db.select().from(lessons).orderBy(lessons.orderIndex),
        db
          .select({
            id: ctfChallenges.id,
            slug: ctfChallenges.slug,
            title: ctfChallenges.title,
            category: ctfChallenges.category,
            difficulty: ctfChallenges.difficulty,
            basePoints: ctfChallenges.basePoints,
            currentPoints: ctfChallenges.currentPoints,
            scoringMode: ctfChallenges.scoringMode,
            solveCount: ctfChallenges.solveCount,
            published: ctfChallenges.published,
            attachmentName: ctfChallenges.attachmentName,
          })
          .from(ctfChallenges)
          .orderBy(desc(ctfChallenges.createdAt)),
        db
          .select({
            id: ctfSubmissions.id,
            challengeId: ctfSubmissions.challengeId,
            challengeTitle: ctfChallenges.title,
            username: users.username,
            submittedFlagMasked: ctfSubmissions.submittedFlagMasked,
            isCorrect: ctfSubmissions.isCorrect,
            pointsAwarded: ctfSubmissions.pointsAwarded,
            suspicionScore: ctfSubmissions.suspicionScore,
            createdAt: ctfSubmissions.createdAt,
          })
          .from(ctfSubmissions)
          .innerJoin(users, eq(ctfSubmissions.userId, users.id))
          .innerJoin(ctfChallenges, eq(ctfSubmissions.challengeId, ctfChallenges.id))
          .orderBy(desc(ctfSubmissions.createdAt))
          .limit(50),
        db.select().from(tournaments).orderBy(desc(tournaments.startsAt)),
        db.select().from(chatChannels).orderBy(chatChannels.id),
        db
          .select({
            id: chatMessages.id,
            channelId: chatMessages.channelId,
            senderId: chatMessages.senderId,
            senderUsername: users.username,
            content: chatMessages.content,
            isReported: chatMessages.isReported,
            isDeleted: chatMessages.isDeleted,
            createdAt: chatMessages.createdAt,
          })
          .from(chatMessages)
          .innerJoin(users, eq(chatMessages.senderId, users.id))
          .where(and(eq(chatMessages.isReported, true), eq(chatMessages.isDeleted, false)))
          .orderBy(desc(chatMessages.createdAt))
          .limit(30),
        db
          .select({
            id: loginHistory.id,
            userId: loginHistory.userId,
            userEmail: users.email,
            ipAddress: loginHistory.ipAddress,
            userAgent: loginHistory.userAgent,
            status: loginHistory.status,
            createdAt: loginHistory.createdAt,
          })
          .from(loginHistory)
          .innerJoin(users, eq(loginHistory.userId, users.id))
          .orderBy(desc(loginHistory.createdAt))
          .limit(40),
        db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(80),
        db.select().from(securityReports).orderBy(desc(securityReports.createdAt)).limit(40),
        db.select().from(platformSettings).where(eq(platformSettings.key, 'platform_controls')).limit(1),
      ]);

      const [
        teamMembersCounts,
        activeSessionCounts,
        participantsList,
        allBooks,
        allAppeals,
        allCerts,
        permRow,
        allIpReports,
      ] = await Promise.all([
        db
          .select({ teamId: teamMembers.teamId, count: sql<number>`count(*)::int` })
          .from(teamMembers)
          .where(eq(teamMembers.removalStatus, 'active'))
          .groupBy(teamMembers.teamId),
        db
          .select({ userId: userSessions.userId, count: sql<number>`count(*)::int` })
          .from(userSessions)
          .where(eq(userSessions.revoked, false))
          .groupBy(userSessions.userId),
        db
          .select({
            id: roomParticipations.id,
            competitionId: roomParticipations.competitionId,
            roomId: roomParticipations.roomId,
            teamId: roomParticipations.teamId,
            userId: roomParticipations.userId,
            status: roomParticipations.status,
            username: users.username,
            email: users.email,
            teamName: teams.name,
          })
          .from(roomParticipations)
          .innerJoin(users, eq(roomParticipations.userId, users.id))
          .innerJoin(teams, eq(roomParticipations.teamId, teams.id))
          .limit(120),
        db.select().from(books).orderBy(books.category, books.title),
        db
          .select({
            id: disciplinaryAppeals.id,
            userId: disciplinaryAppeals.userId,
            userEmail: users.email,
            username: users.username,
            scope: disciplinaryAppeals.scope,
            targetId: disciplinaryAppeals.targetId,
            reason: disciplinaryAppeals.reason,
            status: disciplinaryAppeals.status,
            adminNote: disciplinaryAppeals.adminNote,
            createdAt: disciplinaryAppeals.createdAt,
          })
          .from(disciplinaryAppeals)
          .innerJoin(users, eq(disciplinaryAppeals.userId, users.id))
          .orderBy(desc(disciplinaryAppeals.createdAt))
          .limit(50),
        db
          .select({
            id: certificates.id,
            verificationId: certificates.verificationId,
            title: certificates.title,
            category: certificates.category,
            recipientEmail: users.email,
            recipientName: users.displayName,
            isRevoked: certificates.isRevoked,
            revokedReason: certificates.revokedReason,
            issuedAt: certificates.issuedAt,
          })
          .from(certificates)
          .innerJoin(users, eq(certificates.userId, users.id))
          .orderBy(desc(certificates.issuedAt))
          .limit(40),
        db.select().from(platformSettings).where(eq(platformSettings.key, 'platform_permissions')).limit(1),
        db.select().from(ipViolationReports).orderBy(desc(ipViolationReports.createdAt)).limit(40),
      ]);

      const tmCountMap = new Map(teamMembersCounts.map((t) => [t.teamId, t.count]));
      const sessCountMap = new Map(activeSessionCounts.map((s) => [s.userId, s.count]));
      const abuseEventsRecent = logs.filter(
        (l) => l.action === 'ABUSE_RATE_LIMIT_EXCEEDED' || l.action === 'SCRAPING_BURST_DETECTED',
      ).length;

      res.json({
        metrics: {
          totalUsers: userCountRow[0]?.count ?? 0,
          activeUsersToday: activeTodayRow[0]?.count ?? 0,
          totalCampuses: allCampuses.length,
          activeRooms: allRooms.filter((r) => r.isActive && !r.isLocked).length,
          activeTeams: allTeams.filter((t) => t.isActive && !t.isSuspended).length,
          totalCourses: allCourses.length,
          totalBooks: allBooks.length,
          completedLessons: completedLessonRow[0]?.count ?? 0,
          totalChallenges: allCtf.length,
          totalSubmissions: recentSubmissions.length,
          totalLabSessions: labSessionRow[0]?.count ?? 0,
          openSecurityReports: reports.filter((r) => r.status === 'open').length,
          openAppeals: allAppeals.filter((a) => a.status === 'open').length,
          openIpReports: allIpReports.filter((r) => r.status === 'open' || r.status === 'under_review' || r.status === 'disputed').length,
        },
        users: allUsers.map((u) => ({
          ...u,
          activeSessionsCount: sessCountMap.get(u.id) ?? 0,
        })),
        competitions: allComps,
        rooms: allRooms,
        teams: allTeams.map((t) => ({
          ...t,
          memberCount: tmCountMap.get(t.id) ?? 0,
        })),
        participants: participantsList,
        campuses: allCampuses,
        campusVerificationRequests: campusVerifRows,
        courses: allCourses.map((c) => ({
          ...c,
          lessons: allLessons.filter((l) => l.courseId === c.id),
        })),
        books: allBooks,
        ctfChallenges: allCtf,
        ctfSubmissions: recentSubmissions,
        tournaments: allTournaments,
        chatChannels: allChannels,
        reportedMessages,
        loginHistory: recentLogins,
        auditLogs: logs,
        securityReports: reports,
        ipViolationReports: allIpReports,
        appeals: allAppeals,
        certificates: allCerts,
        settings: settings[0]?.valueJson ?? {},
        permissionsMatrix: permRow[0]?.valueJson ?? {},
        securityPosture: {
          sourcemapDisabledInBuild: true,
          xPoweredByDisabled: true,
          cacheNoStoreSensitiveRoutes: true,
          flagHmacSecretConfigured: Boolean(process.env.FLAG_HMAC_SECRET),
          ownerEmailConfiguredServerSide: true,
          antiScrapingActive: true,
          abuseEventsRecent,
          brandNotice: KALI3977_BRAND_NOTICE,
          copyrightNotice: KALI3977_COPYRIGHT_NOTICE,
        },
      });
    },
  );

  router.post(
    '/admin/users/:userId/role',
    requireAuth,
    requirePermission('admin:appoint_admins'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const targetId = Number(req.params.userId);
      const targetRole = String(req.body.role || '') as UserRole;

      if (!canAssignRole(actor.role as UserRole, targetRole)) {
        return res.status(403).json({ error: 'Only the Owner can appoint or revoke administrators and moderators.' });
      }

      const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
      if (!target) return res.status(404).json({ error: 'User not found.' });
      if (target.role === 'owner') {
        return res.status(403).json({ error: 'Owner role cannot be reassigned via this endpoint.' });
      }

      const eventIds = Array.isArray(req.body.eventIds)
        ? req.body.eventIds.filter((n: unknown) => typeof n === 'number')
        : [];
      const expiresAt = typeof req.body.expiresAt === 'string' ? req.body.expiresAt : null;

      const [updated] = await db
        .update(users)
        .set({
          role: targetRole,
          permissionsJson: { eventIds, expiresAt },
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetId))
        .returning();

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'ROLE_UPDATED',
        resourceType: 'user',
        resourceId: String(targetId),
        previousStateJson: { role: target.role },
        newStateJson: { role: targetRole, eventIds, expiresAt },
        ipAddress: req.ip,
      });

      res.json({ ok: true, user: updated });
    },
  );

  router.post(
    '/admin/users/:userId/status',
    requireAuth,
    requirePermission('admin:manage_users'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const targetId = Number(req.params.userId);
      const action = String(req.body.action || '');
      const reason = sanitizeText(String(req.body.reason || 'Administrative moderation'), 300);

      const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
      if (!target) return res.status(404).json({ error: 'User not found.' });
      if (target.role === 'owner') {
        return res.status(403).json({ error: 'Cannot suspend or ban the platform Owner.' });
      }

      const patch =
        action === 'ban'
          ? { isBanned: true, isSuspended: true, suspensionReason: reason }
          : action === 'suspend'
            ? { isSuspended: true, suspensionReason: reason }
            : { isSuspended: false, isBanned: false, suspensionReason: null };

      const [updated] = await db.update(users).set(patch).where(eq(users.id, targetId)).returning();
      if (action === 'ban' || action === 'suspend' || action === 'revoke_sessions') {
        await db.update(userSessions).set({ revoked: true }).where(eq(userSessions.userId, targetId));
      }

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: `USER_${action.toUpperCase()}`,
        resourceType: 'user',
        resourceId: String(targetId),
        previousStateJson: { isSuspended: target.isSuspended, isBanned: target.isBanned },
        newStateJson: patch,
        ipAddress: req.ip,
      });

      res.json({ ok: true, user: updated });
    },
  );

  router.post(
    '/admin/users/:userId/revoke-sessions',
    requireAuth,
    requirePermission('admin:manage_users'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const targetId = Number(req.params.userId);
      await db.update(userSessions).set({ revoked: true }).where(eq(userSessions.userId, targetId));
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'USER_SESSIONS_REVOKED',
        resourceType: 'user',
        resourceId: String(targetId),
        ipAddress: req.ip,
      });
      res.json({ ok: true });
    },
  );

  router.post(
    '/admin/competitions',
    requireAuth,
    requirePermission('admin:manage_rules'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const name = sanitizeText(String(req.body.name || ''), 120);
      const description = sanitizeText(String(req.body.description || ''), 1000);
      if (!name || !description) {
        return res.status(400).json({ error: 'Competition name and description are required.' });
      }
      const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}-${crypto.randomBytes(2).toString('hex')}`;
      const durationMinutes = Math.max(15, Math.min(43200, Number(req.body.durationMinutes || 180)));
      const startsAt = req.body.startsAt ? new Date(String(req.body.startsAt)) : new Date();
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
      const registrationDeadline = req.body.registrationDeadline ? new Date(String(req.body.registrationDeadline)) : null;

      const [comp] = await db
        .insert(competitions)
        .values({
          slug,
          name,
          description,
          gameMode: sanitizeText(String(req.body.gameMode || 'ctf_battle'), 40),
          status: 'registration_open',
          visibility: req.body.visibility === 'private' ? 'private' : 'public',
          difficulty: sanitizeText(String(req.body.difficulty || 'Medium'), 30),
          scoringSystem: req.body.scoringSystem === 'static' ? 'static' : 'dynamic',
          enrollmentPolicy: ['shared_team_code', 'campus_verified', 'invite_only'].includes(String(req.body.enrollmentPolicy))
            ? String(req.body.enrollmentPolicy)
            : 'shared_team_code',
          totalCapacity: Math.max(2, Math.min(5000, Number(req.body.totalCapacity || 150))),
          perTeamCapacity: Math.max(1, Math.min(200, Number(req.body.perTeamCapacity || 30))),
          maxTeams: Math.max(2, Math.min(200, Number(req.body.maxTeams || 10))),
          durationMinutes,
          startsAt,
          endsAt,
          registrationDeadline,
          rulesText: sanitizeText(String(req.body.rulesText || ''), 2000),
          createdById: actor.id,
        })
        .returning();

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'COMPETITION_CREATED',
        resourceType: 'competition',
        resourceId: String(comp.id),
        newStateJson: { name, gameMode: comp.gameMode, totalCapacity: comp.totalCapacity },
        competitionId: comp.id,
        ipAddress: req.ip,
      });

      res.status(201).json({ competition: comp });
    },
  );

  router.patch(
    '/admin/competitions/:id',
    requireAuth,
    requirePermission('admin:manage_rules', (r) => Number(r.params.id)),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const compId = Number(req.params.id);
      const [existing] = await db.select().from(competitions).where(eq(competitions.id, compId)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Competition not found.' });

      if (existing.rulesLocked && actor.role !== 'owner') {
        return res.status(403).json({ error: 'Competition rules are locked; Owner override is required.' });
      }

      const patch: Record<string, unknown> = {};
      if (typeof req.body.name === 'string') patch.name = sanitizeText(req.body.name, 120);
      if (typeof req.body.description === 'string') patch.description = sanitizeText(req.body.description, 1000);
      if (typeof req.body.rulesText === 'string') patch.rulesText = sanitizeText(req.body.rulesText, 2000);
      if (typeof req.body.visibility === 'string') patch.visibility = req.body.visibility === 'private' ? 'private' : 'public';
      if (typeof req.body.scoringSystem === 'string') patch.scoringSystem = req.body.scoringSystem === 'static' ? 'static' : 'dynamic';
      if (typeof req.body.gameMode === 'string') patch.gameMode = sanitizeText(req.body.gameMode, 40);
      if (typeof req.body.enrollmentPolicy === 'string') patch.enrollmentPolicy = sanitizeText(req.body.enrollmentPolicy, 40);
      if (typeof req.body.totalCapacity === 'number') patch.totalCapacity = Math.max(2, Math.min(5000, req.body.totalCapacity));
      if (typeof req.body.perTeamCapacity === 'number') patch.perTeamCapacity = Math.max(1, Math.min(200, req.body.perTeamCapacity));
      if (typeof req.body.durationMinutes === 'number') patch.durationMinutes = Math.max(15, Math.min(43200, req.body.durationMinutes));
      if (typeof req.body.registrationDeadline === 'string') {
        patch.registrationDeadline = req.body.registrationDeadline ? new Date(req.body.registrationDeadline) : null;
      }

      const [updated] = await db
        .update(competitions)
        .set(patch)
        .where(eq(competitions.id, compId))
        .returning();

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'COMPETITION_UPDATED',
        resourceType: 'competition',
        resourceId: String(compId),
        newStateJson: patch,
        competitionId: compId,
        ipAddress: req.ip,
      });

      res.json({ competition: updated });
    },
  );

  router.delete(
    '/admin/competitions/:id/participants/:userId',
    requireAuth,
    requirePermission('admin:manage_rooms'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const compId = Number(req.params.id);
      const userId = Number(req.params.userId);
      const reason = sanitizeText(String(req.body?.reason || 'Removed from competition room by administrator'), 300);

      await db
        .update(roomParticipations)
        .set({ status: 'removed', removalReason: reason })
        .where(and(eq(roomParticipations.competitionId, compId), eq(roomParticipations.userId, userId)));
      await db
        .update(teamMembers)
        .set({ removalStatus: 'perm_removed', removalReason: reason })
        .where(and(eq(teamMembers.competitionId, compId), eq(teamMembers.userId, userId)));

      await db.insert(notifications).values({
        userId,
        type: 'security',
        title: 'Competition Room Removal Notice',
        body: `You were removed from competition #${compId}. Reason: ${reason}. You may submit an appeal under My Profile.`,
      });

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'PARTICIPANT_REMOVED',
        resourceType: 'competition',
        resourceId: `${compId}:${userId}`,
        newStateJson: { reason, status: 'removed' },
        competitionId: compId,
        ipAddress: req.ip,
      });
      res.json({ ok: true });
    },
  );

  router.post(
    '/admin/campuses',
    requireAuth,
    requirePermission('admin:manage_teams'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const code = sanitizeText(String(req.body.code || '').toUpperCase(), 24);
      const name = sanitizeText(String(req.body.name || ''), 120);
      const country = sanitizeText(String(req.body.country || 'Global'), 60);
      const city = sanitizeText(String(req.body.city || ''), 60);
      const emailDomain = sanitizeText(String(req.body.emailDomain || '').toLowerCase(), 120) || null;
      if (!code || !name || !city) {
        return res.status(400).json({ error: 'Campus code, name, and city are required.' });
      }
      const [created] = await db
        .insert(campuses)
        .values({ code, name, country, city, emailDomain, verified: true })
        .returning();
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'CAMPUS_CREATED',
        resourceType: 'campus',
        resourceId: String(created.id),
        newStateJson: { code, name, country, emailDomain },
        ipAddress: req.ip,
      });
      res.status(201).json({ campus: created });
    },
  );

  router.patch(
    '/admin/campuses/:id',
    requireAuth,
    requirePermission('admin:manage_teams'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      const patch: Record<string, unknown> = {};
      if (typeof req.body.name === 'string') patch.name = sanitizeText(req.body.name, 120);
      if (typeof req.body.country === 'string') patch.country = sanitizeText(req.body.country, 60);
      if (typeof req.body.city === 'string') patch.city = sanitizeText(req.body.city, 60);
      if (typeof req.body.emailDomain === 'string') patch.emailDomain = sanitizeText(req.body.emailDomain.toLowerCase(), 120) || null;
      if (typeof req.body.verified === 'boolean') patch.verified = req.body.verified;
      const [updated] = await db.update(campuses).set(patch).where(eq(campuses.id, id)).returning();
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'CAMPUS_UPDATED',
        resourceType: 'campus',
        resourceId: String(id),
        newStateJson: patch,
        ipAddress: req.ip,
      });
      res.json({ campus: updated });
    },
  );

  router.delete(
    '/admin/campuses/:id',
    requireAuth,
    requirePermission('admin:manage_teams'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      await db.update(users).set({ campusId: null, campusVerificationStatus: 'unverified' }).where(eq(users.campusId, id));
      await db.delete(campuses).where(eq(campuses.id, id));
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'CAMPUS_REMOVED',
        resourceType: 'campus',
        resourceId: String(id),
        ipAddress: req.ip,
      });
      res.json({ ok: true });
    },
  );

  router.post(
    '/admin/campus-verifications/:id/review',
    requireAuth,
    requirePermission('admin:manage_teams'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      const decision = req.body.decision === 'approved' ? 'approved' : 'rejected';
      const reviewNote = sanitizeText(String(req.body.reviewNote || ''), 300);

      const [vr] = await db
        .select()
        .from(campusVerificationRequests)
        .where(eq(campusVerificationRequests.id, id))
        .limit(1);
      if (!vr) return res.status(404).json({ error: 'Verification request not found.' });

      const [updated] = await db
        .update(campusVerificationRequests)
        .set({ status: decision, reviewedById: actor.id, reviewNote, reviewedAt: new Date() })
        .where(eq(campusVerificationRequests.id, id))
        .returning();

      if (decision === 'approved') {
        await db
          .update(users)
          .set({
            campusId: vr.campusId,
            campusVerificationStatus: 'verified',
            campusVerificationMethod: vr.method,
            updatedAt: new Date(),
          })
          .where(eq(users.id, vr.userId));
      } else {
        await db
          .update(users)
          .set({ campusVerificationStatus: 'rejected', updatedAt: new Date() })
          .where(eq(users.id, vr.userId));
      }

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: `CAMPUS_VERIFICATION_${decision.toUpperCase()}`,
        resourceType: 'campus_verification',
        resourceId: String(id),
        newStateJson: { userId: vr.userId, campusId: vr.campusId, decision },
        ipAddress: req.ip,
      });

      res.json({ request: updated });
    },
  );

  router.post(
    '/admin/rooms',
    requireAuth,
    requirePermission('admin:manage_rooms'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const competitionId = Number(req.body.competitionId);
      const name = sanitizeText(String(req.body.name || 'Competition Room'), 80);
      const maxParticipants = Math.max(2, Math.min(5000, Number(req.body.maxParticipants || 150)));
      const roomCode = generateSecureCode('3977-CTF');

      const [room] = await db
        .insert(rooms)
        .values({
          competitionId,
          name,
          roomCode,
          maxParticipants,
          usageLimit: maxParticipants,
        })
        .returning();

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'ROOM_CREATED',
        resourceType: 'room',
        resourceId: String(room.id),
        newStateJson: { name, roomCode, maxParticipants },
        roomId: room.id,
        competitionId,
        ipAddress: req.ip,
      });

      res.status(201).json({ room });
    },
  );

  router.post(
    '/admin/rooms/:id/regenerate',
    requireAuth,
    requirePermission('admin:manage_rooms'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const roomId = Number(req.params.id);
      const [existing] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Room not found.' });

      const nextCode = generateSecureCode('3977-CTF');
      const [updated] = await db
        .update(rooms)
        .set({ roomCode: nextCode })
        .where(eq(rooms.id, roomId))
        .returning();

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'ROOM_CODE_REGENERATED',
        resourceType: 'room',
        resourceId: String(roomId),
        previousStateJson: { roomCode: existing.roomCode },
        newStateJson: { roomCode: nextCode },
        roomId,
        competitionId: existing.competitionId,
        ipAddress: req.ip,
      });

      res.json({ room: updated });
    },
  );

  router.post(
    '/admin/rooms/:id/toggle',
    requireAuth,
    requirePermission('admin:manage_rooms'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const roomId = Number(req.params.id);
      const [existing] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Room not found.' });

      const isActive = typeof req.body.isActive === 'boolean' ? req.body.isActive : existing.isActive;
      const isLocked = typeof req.body.isLocked === 'boolean' ? req.body.isLocked : existing.isLocked;
      const maxParticipants =
        typeof req.body.maxParticipants === 'number'
          ? Math.max(2, Math.min(5000, req.body.maxParticipants))
          : existing.maxParticipants;

      const [updated] = await db
        .update(rooms)
        .set({ isActive, isLocked, maxParticipants })
        .where(eq(rooms.id, roomId))
        .returning();

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'ROOM_STATUS_UPDATED',
        resourceType: 'room',
        resourceId: String(roomId),
        previousStateJson: { isActive: existing.isActive, isLocked: existing.isLocked },
        newStateJson: { isActive, isLocked, maxParticipants },
        roomId,
        ipAddress: req.ip,
      });

      res.json({ room: updated });
    },
  );

  router.post(
    '/admin/rooms/:id/details',
    requireAuth,
    requirePermission('admin:manage_rooms'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const roomId = Number(req.params.id);
      const [existing] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Room not found.' });

      const patch: Record<string, unknown> = {};
      if (typeof req.body.name === 'string' && req.body.name.trim()) {
        patch.name = sanitizeText(req.body.name, 80);
      }
      if (typeof req.body.maxParticipants === 'number') {
        patch.maxParticipants = Math.max(2, Math.min(5000, req.body.maxParticipants));
      }
      if (typeof req.body.usageLimit === 'number') {
        patch.usageLimit = Math.max(1, Math.min(5000, req.body.usageLimit));
      }
      if (req.body.expiresAt === null) {
        patch.expiresAt = null;
      } else if (typeof req.body.expiresAt === 'string' && req.body.expiresAt.trim()) {
        patch.expiresAt = new Date(req.body.expiresAt);
      }
      if (typeof req.body.revoke === 'boolean' && req.body.revoke) {
        patch.isActive = false;
        patch.isLocked = true;
      }

      const [updated] = await db.update(rooms).set(patch).where(eq(rooms.id, roomId)).returning();
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: req.body.revoke ? 'ROOM_CODE_REVOKED' : 'ROOM_DETAILS_UPDATED',
        resourceType: 'room',
        resourceId: String(roomId),
        newStateJson: patch,
        roomId,
        competitionId: existing.competitionId,
        ipAddress: req.ip,
      });
      res.json({ room: updated });
    },
  );

  router.post(
    '/admin/teams',
    requireAuth,
    requirePermission('admin:manage_teams'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const competitionId = Number(req.body.competitionId) || null;
      const campusId = Number(req.body.campusId) || null;
      const name = sanitizeText(String(req.body.name || 'Campus Squad'), 80);
      const maxMembers = Math.max(1, Math.min(500, Number(req.body.maxMembers || 30)));
      const teamCode = generateSecureCode('CAMPUS', 1);

      const [team] = await db
        .insert(teams)
        .values({
          competitionId,
          campusId,
          name,
          teamCode,
          maxMembers,
          codeUsageLimit: maxMembers,
        })
        .returning();

      if (competitionId) {
        await db.insert(chatChannels).values([
          { competitionId, teamId: team.id, channelType: 'team', name: `${name} — Private Chat` },
          { competitionId, teamId: team.id, channelType: 'captain', name: `${name} — Captain Brief` },
        ]);
      }

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'TEAM_CREATED',
        resourceType: 'team',
        resourceId: String(team.id),
        newStateJson: { name, teamCode, maxMembers },
        competitionId,
        ipAddress: req.ip,
      });

      res.status(201).json({ team });
    },
  );

  router.patch(
    '/admin/teams/:id',
    requireAuth,
    requirePermission('admin:manage_teams'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const teamId = Number(req.params.id);
      const [existing] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Team not found.' });

      const patch: Record<string, unknown> = {};
      if (typeof req.body.name === 'string') patch.name = sanitizeText(req.body.name, 80);
      if (typeof req.body.maxMembers === 'number') patch.maxMembers = Math.max(1, Math.min(500, req.body.maxMembers));
      if (typeof req.body.isActive === 'boolean') patch.isActive = req.body.isActive;
      if (typeof req.body.isSuspended === 'boolean') patch.isSuspended = req.body.isSuspended;
      if (typeof req.body.captainId === 'number') patch.captainId = req.body.captainId;

      const [updated] = await db.update(teams).set(patch).where(eq(teams.id, teamId)).returning();

      if (typeof req.body.captainId === 'number') {
        await db
          .update(teamMembers)
          .set({ roleInTeam: 'captain' })
          .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, req.body.captainId)));
      }

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'TEAM_UPDATED',
        resourceType: 'team',
        resourceId: String(teamId),
        newStateJson: patch,
        competitionId: existing.competitionId,
        ipAddress: req.ip,
      });

      res.json({ team: updated });
    },
  );

  router.post(
    '/admin/teams/:id/regenerate',
    requireAuth,
    requirePermission('admin:manage_teams'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const teamId = Number(req.params.id);
      const [existing] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Team not found.' });

      const nextCode = generateSecureCode('CAMPUS', 1);
      const [updated] = await db
        .update(teams)
        .set({ teamCode: nextCode })
        .where(eq(teams.id, teamId))
        .returning();

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'TEAM_CODE_REGENERATED',
        resourceType: 'team',
        resourceId: String(teamId),
        previousStateJson: { teamCode: existing.teamCode },
        newStateJson: { teamCode: nextCode },
        competitionId: existing.competitionId,
        ipAddress: req.ip,
      });

      res.json({ team: updated });
    },
  );

  router.get(
    '/admin/teams/:id',
    requireAuth,
    requirePermission('admin:manage_teams'),
    async (req: AuthRequest, res) => {
      const teamId = Number(req.params.id);
      const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      if (!team) return res.status(404).json({ error: 'Team not found.' });

      const members = await db
        .select({
          userId: users.id,
          username: users.username,
          displayName: users.displayName,
          email: users.email,
          roleInTeam: teamMembers.roleInTeam,
          removalStatus: teamMembers.removalStatus,
          removalReason: teamMembers.removalReason,
          removalExpiresAt: teamMembers.removalExpiresAt,
          isMutedInChat: teamMembers.isMutedInChat,
          ctfPoints: users.ctfPoints,
          joinedAt: teamMembers.joinedAt,
        })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.userId, users.id))
        .where(eq(teamMembers.teamId, teamId));

      res.json({ team, members });
    },
  );

  router.delete(
    '/admin/teams/:id',
    requireAuth,
    requirePermission('admin:manage_teams'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const teamId = Number(req.params.id);
      const [existing] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Team not found.' });
      await db.delete(teams).where(eq(teams.id, teamId));
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'TEAM_DELETED',
        resourceType: 'team',
        resourceId: String(teamId),
        previousStateJson: { name: existing.name, teamCode: existing.teamCode },
        ipAddress: req.ip,
      });
      res.json({ ok: true });
    },
  );

  router.post(
    '/admin/teams/:id/members/:userId/remove',
    requireAuth,
    requirePermission('admin:manage_teams'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const teamId = Number(req.params.id);
      const targetUserId = Number(req.params.userId);
      const mode = ['temp_removed', 'perm_removed', 'restore'].includes(String(req.body.mode))
        ? String(req.body.mode)
        : 'temp_removed';
      const reason = sanitizeText(String(req.body.reason || 'Administrative team disciplinary decision'), 300);
      const hours = Math.max(1, Math.min(720, Number(req.body.durationHours || 24)));
      const expiresAt = mode === 'temp_removed' ? new Date(Date.now() + hours * 3600_000) : null;

      const patch =
        mode === 'restore'
          ? { removalStatus: 'active', removalReason: null, removalExpiresAt: null }
          : { removalStatus: mode, removalReason: reason, removalExpiresAt: expiresAt };

      const [updated] = await db
        .update(teamMembers)
        .set(patch)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUserId)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Team member record not found.' });

      await db.insert(notifications).values({
        userId: targetUserId,
        type: 'security',
        title: mode === 'restore' ? 'Team Membership Restored' : 'Team Removal Notice',
        body:
          mode === 'restore'
            ? 'Your team membership was restored by platform administration.'
            : `Removal status: ${mode.replace('_', ' ')}. Reason: ${reason}. You may submit an appeal under Profile & Security.`,
      });

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: `TEAM_MEMBER_${mode.toUpperCase()}`,
        resourceType: 'team_member',
        resourceId: `${teamId}:${targetUserId}`,
        newStateJson: { mode, reason, expiresAt: expiresAt?.toISOString() || null },
        ipAddress: req.ip,
      });

      res.json({ ok: true, member: updated });
    },
  );

  router.post(
    '/admin/teams/transfer',
    requireAuth,
    requirePermission('admin:manage_teams'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const userId = Number(req.body.userId);
      const competitionId = Number(req.body.competitionId);
      const toTeamId = Number(req.body.toTeamId);
      const reason = sanitizeText(String(req.body.reason || ''), 240);
      if (!reason) return res.status(400).json({ error: 'Audit reason is required for participant transfer.' });

      const [toTeam] = await db.select().from(teams).where(eq(teams.id, toTeamId)).limit(1);
      if (!toTeam || toTeam.competitionId !== competitionId) {
        return res.status(404).json({ error: 'Destination team not found in this competition.' });
      }

      await db
        .update(roomParticipations)
        .set({ teamId: toTeamId })
        .where(and(eq(roomParticipations.competitionId, competitionId), eq(roomParticipations.userId, userId)));

      await db
        .delete(teamMembers)
        .where(and(eq(teamMembers.competitionId, competitionId), eq(teamMembers.userId, userId)));
      await db
        .insert(teamMembers)
        .values({ teamId: toTeamId, userId, competitionId, roleInTeam: 'member' })
        .onConflictDoNothing();

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'PARTICIPANT_TEAM_TRANSFERRED',
        resourceType: 'team_member',
        resourceId: `${competitionId}:${userId}`,
        newStateJson: { toTeamId, reason },
        competitionId,
        ipAddress: req.ip,
      });
      res.json({ ok: true });
    },
  );

  router.post(
    '/admin/competitions/:id/control',
    requireAuth,
    requirePermission('admin:manage_rules'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const compId = Number(req.params.id);
      const action = String(req.body.action || '');
      const reason = sanitizeText(String(req.body.reason || ''), 300);

      const [comp] = await db.select().from(competitions).where(eq(competitions.id, compId)).limit(1);
      if (!comp) return res.status(404).json({ error: 'Competition not found.' });

      let nextStatus = comp.status;
      let rulesLocked = comp.rulesLocked;
      let snapshot = comp.rulesSnapshotJson;

      if (action === 'start') {
        nextStatus = 'active';
        rulesLocked = true;
        snapshot = createCompetitionRulesSnapshot(comp);
      } else if (action === 'pause') {
        nextStatus = 'paused';
      } else if (action === 'resume') {
        nextStatus = 'active';
      } else if (action === 'end') {
        nextStatus = 'ended';
      } else if (action === 'cancel') {
        nextStatus = 'cancelled';
      } else if (action === 'publish_results') {
        await db.update(competitions).set({ resultsPublished: true }).where(eq(competitions.id, compId));
      } else if (action === 'emergency_override') {
        if (actor.role !== 'owner') {
          return res.status(403).json({ error: 'Emergency rule overrides require Owner authorization.' });
        }
        if (!reason) {
          return res.status(400).json({ error: 'Emergency overrides require an explicit audit reason.' });
        }
        snapshot = {
          ...(comp.rulesSnapshotJson || {}),
          emergencyOverrideReason: reason,
          overriddenAt: new Date().toISOString(),
        };
      }

      const [updated] = await db
        .update(competitions)
        .set({ status: nextStatus, rulesLocked, rulesSnapshotJson: snapshot })
        .where(eq(competitions.id, compId))
        .returning();

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: `COMPETITION_${action.toUpperCase()}`,
        resourceType: 'competition',
        resourceId: String(compId),
        previousStateJson: { status: comp.status, rulesLocked: comp.rulesLocked },
        newStateJson: { status: nextStatus, rulesLocked, reason },
        competitionId: compId,
        ipAddress: req.ip,
      });

      broadcastPublicEvent('competition:status', { competitionId: compId, status: nextStatus });

      res.json({ competition: updated });
    },
  );

  router.post(
    '/admin/courses',
    requireAuth,
    requirePermission('admin:manage_content'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const titleEn = sanitizeText(String(req.body.titleEn || ''), 120);
      const summaryEn = sanitizeText(String(req.body.summaryEn || ''), 400);
      const stage = Math.max(1, Math.min(8, Number(req.body.stage || 1)));
      if (!titleEn || !summaryEn) {
        return res.status(400).json({ error: 'Course title and summary are required.' });
      }
      const slug = `${titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28)}-${crypto.randomBytes(2).toString('hex')}`;
      const [created] = await db
        .insert(courses)
        .values({
          slug,
          stage,
          stageTitle: sanitizeText(String(req.body.stageTitle || `Stage ${stage}`), 80),
          titleEn,
          titleHi: sanitizeText(String(req.body.titleHi || titleEn), 120),
          summaryEn,
          summaryHi: sanitizeText(String(req.body.summaryHi || summaryEn), 400),
          difficulty: sanitizeText(String(req.body.difficulty || 'Beginner'), 30),
          prerequisiteSlug: req.body.prerequisiteSlug ? sanitizeText(String(req.body.prerequisiteSlug), 60) : null,
          published: Boolean(req.body.published ?? true),
        })
        .returning();
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'COURSE_CREATED',
        resourceType: 'course',
        resourceId: String(created.id),
        newStateJson: { titleEn, stage },
        ipAddress: req.ip,
      });
      res.status(201).json({ course: created });
    },
  );

  router.patch(
    '/admin/courses/:id',
    requireAuth,
    requirePermission('admin:manage_content'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof req.body.published === 'boolean') patch.published = req.body.published;
      if (typeof req.body.titleEn === 'string') patch.titleEn = sanitizeText(req.body.titleEn, 120);
      if (typeof req.body.contentVersion === 'string') patch.contentVersion = sanitizeText(req.body.contentVersion, 30);
      if (typeof req.body.prerequisiteSlug === 'string' || req.body.prerequisiteSlug === null) {
        patch.prerequisiteSlug = req.body.prerequisiteSlug ? sanitizeText(req.body.prerequisiteSlug, 60) : null;
      }
      const [updated] = await db.update(courses).set(patch).where(eq(courses.id, id)).returning();
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'COURSE_UPDATED',
        resourceType: 'course',
        resourceId: String(id),
        newStateJson: patch,
        ipAddress: req.ip,
      });
      res.json({ course: updated });
    },
  );

  router.post(
    '/admin/courses/:id/lessons',
    requireAuth,
    requirePermission('admin:manage_content'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const courseId = Number(req.params.id);
      const titleEn = sanitizeText(String(req.body.titleEn || ''), 120);
      const contentEn = sanitizeText(String(req.body.contentEn || ''), 3000);
      if (!titleEn || !contentEn) {
        return res.status(400).json({ error: 'Lesson title and content are required.' });
      }
      const quizJson = {
        question: sanitizeText(String(req.body.quizQuestion || `Key takeaway from ${titleEn}?`), 240),
        options: Array.isArray(req.body.quizOptions) && req.body.quizOptions.length >= 2
          ? req.body.quizOptions.map((o: unknown) => sanitizeText(String(o), 140))
          : ['Least privilege & input validation', 'Hardcode credentials in client code'],
        correctIndex: Number(req.body.correctIndex ?? 0),
        explanation: sanitizeText(String(req.body.quizExplanation || 'Reviewed in lesson material.'), 400),
      };
      const [created] = await db
        .insert(lessons)
        .values({
          courseId,
          titleEn,
          titleHi: sanitizeText(String(req.body.titleHi || titleEn), 120),
          contentEn,
          contentHi: sanitizeText(String(req.body.contentHi || contentEn), 3000),
          practicalExample: sanitizeText(String(req.body.practicalExample || ''), 1000),
          diagramSpec: sanitizeText(String(req.body.diagramSpec || ''), 400),
          quizJson,
          published: true,
        })
        .returning();
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'LESSON_CREATED',
        resourceType: 'lesson',
        resourceId: String(created.id),
        newStateJson: { courseId, titleEn },
        ipAddress: req.ip,
      });
      res.status(201).json({ lesson: created });
    },
  );

  router.post(
    '/admin/tournaments',
    requireAuth,
    requirePermission('admin:manage_rules'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const name = sanitizeText(String(req.body.name || ''), 120);
      if (!name) return res.status(400).json({ error: 'Tournament name is required.' });
      const format = ['knockout', 'round_robin', 'group_stage'].includes(String(req.body.format))
        ? String(req.body.format)
        : 'knockout';
      const startsAt = req.body.startsAt ? new Date(String(req.body.startsAt)) : new Date(Date.now() + 7 * 86400_000);
      const [created] = await db
        .insert(tournaments)
        .values({
          name,
          description: sanitizeText(String(req.body.description || ''), 600),
          format,
          recurrence: sanitizeText(String(req.body.recurrence || 'seasonal'), 30),
          status: 'registration_open',
          maxTeams: Math.max(2, Math.min(128, Number(req.body.maxTeams || 16))),
          teamSize: Math.max(1, Math.min(20, Number(req.body.teamSize || 5))),
          startsAt,
          registrationDeadline: req.body.registrationDeadline ? new Date(String(req.body.registrationDeadline)) : null,
          bracketsJson: { format, rounds: [] },
        })
        .returning();
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'TOURNAMENT_CREATED',
        resourceType: 'tournament',
        resourceId: String(created.id),
        newStateJson: { name, format },
        ipAddress: req.ip,
      });
      res.status(201).json({ tournament: created });
    },
  );

  router.post(
    '/admin/ctf',
    requireAuth,
    requirePermission('admin:manage_content'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const title = sanitizeText(String(req.body.title || ''), 120);
      const category = sanitizeText(String(req.body.category || 'Web Exploitation'), 60);
      const difficulty = sanitizeText(String(req.body.difficulty || 'Medium'), 30);
      const description = sanitizeText(String(req.body.description || ''), 2000);
      const flag = sanitizeText(String(req.body.flag || ''), 160);
      const basePoints = Math.max(50, Math.min(2000, Number(req.body.basePoints || 200)));

      if (!title || !description || !flag) {
        return res.status(400).json({ error: 'Title, description, and secret flag are required.' });
      }

      const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}-${crypto.randomBytes(2).toString('hex')}`;
      const [created] = await db
        .insert(ctfChallenges)
        .values({
          slug,
          title,
          category,
          difficulty,
          description,
          basePoints,
          currentPoints: basePoints,
          flagHash: hashFlag(flag),
          explanationAfterSolve: sanitizeText(String(req.body.explanation || ''), 1000),
          attachmentName: req.body.attachmentName ? sanitizeText(String(req.body.attachmentName), 80) : null,
          attachmentContent: req.body.attachmentContent ? String(req.body.attachmentContent).slice(0, 12000) : null,
          published: true,
        })
        .returning();

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'CTF_CHALLENGE_CREATED',
        resourceType: 'ctf_challenge',
        resourceId: String(created.id),
        newStateJson: { title, category, difficulty, basePoints },
        ipAddress: req.ip,
      });

      res.status(201).json({
        challenge: {
          id: created.id,
          slug: created.slug,
          title: created.title,
          category: created.category,
          difficulty: created.difficulty,
          basePoints: created.basePoints,
        },
      });
    },
  );

  router.patch(
    '/admin/ctf/:id',
    requireAuth,
    requirePermission('admin:manage_content'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof req.body.published === 'boolean') patch.published = req.body.published;
      if (typeof req.body.difficulty === 'string') patch.difficulty = sanitizeText(req.body.difficulty, 30);
      if (typeof req.body.basePoints === 'number') patch.basePoints = Math.max(50, Math.min(2000, req.body.basePoints));
      if (typeof req.body.contentVersion === 'string') patch.contentVersion = sanitizeText(req.body.contentVersion, 30);
      if (typeof req.body.flag === 'string' && req.body.flag.trim()) {
        patch.flagHash = hashFlag(sanitizeText(req.body.flag, 160));
      }
      const [updated] = await db
        .update(ctfChallenges)
        .set(patch)
        .where(eq(ctfChallenges.id, id))
        .returning();
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'CTF_CHALLENGE_UPDATED',
        resourceType: 'ctf_challenge',
        resourceId: String(id),
        newStateJson: { published: updated?.published, difficulty: updated?.difficulty },
        ipAddress: req.ip,
      });
      res.json({ challenge: updated });
    },
  );

  router.post(
    '/admin/tournaments/:id/generate-brackets',
    requireAuth,
    requirePermission('admin:manage_rules'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
      if (!t) return res.status(404).json({ error: 'Tournament not found.' });

      const regs = await db
        .select({ id: teams.id, name: teams.name })
        .from(tournamentRegistrations)
        .innerJoin(teams, eq(tournamentRegistrations.teamId, teams.id))
        .where(eq(tournamentRegistrations.tournamentId, id));

      const brackets = generateTournamentBrackets(regs, t.format);
      const [updated] = await db
        .update(tournaments)
        .set({ bracketsJson: brackets })
        .where(eq(tournaments.id, id))
        .returning();

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'TOURNAMENT_BRACKETS_GENERATED',
        resourceType: 'tournament',
        resourceId: String(id),
        newStateJson: { teamCount: regs.length },
        ipAddress: req.ip,
      });

      res.json({ tournament: updated });
    },
  );

  router.post(
    '/admin/tournaments/:id/matches/:matchId',
    requireAuth,
    requirePermission('admin:manage_rules'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      const matchId = sanitizeText(String(req.params.matchId || ''), 30);
      const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
      if (!t) return res.status(404).json({ error: 'Tournament not found.' });

      const brackets = (t.bracketsJson || { rounds: [] }) as {
        format?: string;
        rounds?: Array<{ round: number; label: string; matches: BracketMatch[] }>;
      };
      const rounds = (brackets.rounds || []).map((r) => ({
        ...r,
        matches: r.matches.map((m) =>
          m.matchId === matchId
            ? {
                ...m,
                status: sanitizeText(String(req.body.status || m.status), 30),
                winnerTeamId: typeof req.body.winnerTeamId === 'number' ? req.body.winnerTeamId : m.winnerTeamId ?? null,
                scoreSummary: req.body.scoreSummary ? sanitizeText(String(req.body.scoreSummary), 40) : m.scoreSummary ?? null,
              }
            : m,
        ),
      }));

      const [updated] = await db
        .update(tournaments)
        .set({ bracketsJson: { ...brackets, rounds } })
        .where(eq(tournaments.id, id))
        .returning();

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'TOURNAMENT_MATCH_UPDATED',
        resourceType: 'tournament',
        resourceId: `${id}:${matchId}`,
        newStateJson: { status: req.body.status, winnerTeamId: req.body.winnerTeamId },
        ipAddress: req.ip,
      });

      res.json({ tournament: updated });
    },
  );

  router.post(
    '/admin/chat/channels/:id/toggle',
    requireAuth,
    requirePermission('admin:manage_comms'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      const [ch] = await db.select().from(chatChannels).where(eq(chatChannels.id, id)).limit(1);
      if (!ch) return res.status(404).json({ error: 'Channel not found.' });
      const isEnabled = typeof req.body.isEnabled === 'boolean' ? req.body.isEnabled : !ch.isEnabled;
      const [updated] = await db
        .update(chatChannels)
        .set({ isEnabled })
        .where(eq(chatChannels.id, id))
        .returning();
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'CHAT_CHANNEL_TOGGLED',
        resourceType: 'chat_channel',
        resourceId: String(id),
        newStateJson: { isEnabled },
        ipAddress: req.ip,
      });
      res.json({ channel: updated });
    },
  );

  router.post(
    '/admin/reports/:id/resolve',
    requireAuth,
    requirePermission('mod:review_reports'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      const status = req.body.status === 'dismissed' ? 'dismissed' : 'resolved';
      const note = sanitizeText(String(req.body.resolutionNote || 'Reviewed by moderator'), 400);

      const [updated] = await db
        .update(securityReports)
        .set({ status, reviewedById: actor.id, resolutionNote: note })
        .where(eq(securityReports.id, id))
        .returning();

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'SECURITY_REPORT_RESOLVED',
        resourceType: 'security_report',
        resourceId: String(id),
        newStateJson: { status, note },
        ipAddress: req.ip,
      });

      res.json({ report: updated });
    },
  );

  router.post(
    '/admin/settings',
    requireAuth,
    requirePermission('admin:platform_settings'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const valueJson = {
        registrationOpen: Boolean(req.body.registrationOpen ?? true),
        maintenanceMode: Boolean(req.body.maintenanceMode ?? false),
        disableAiMentor: Boolean(req.body.disableAiMentor ?? false),
        disableCommunity: Boolean(req.body.disableCommunity ?? false),
        aiDailyQuotaPerUser: Math.max(1, Math.min(5000, Number(req.body.aiDailyQuotaPerUser || 20))),
        labMaxMinutes: Math.max(10, Math.min(180, Number(req.body.labMaxMinutes || 60))),
        requireMfaForAdmins: Boolean(req.body.requireMfaForAdmins ?? true),
        globalAnnouncement: sanitizeText(String(req.body.globalAnnouncement || ''), 240),
      };

      const [saved] = await db
        .insert(platformSettings)
        .values({ key: 'platform_controls', valueJson, updatedById: actor.id })
        .onConflictDoUpdate({
          target: platformSettings.key,
          set: { valueJson, updatedById: actor.id, updatedAt: new Date() },
        })
        .returning();

      await db
        .insert(aiMentorConfig)
        .values({
          id: 1,
          enabled: !valueJson.disableAiMentor,
          dailyUserLimit: valueJson.aiDailyQuotaPerUser,
          updatedById: actor.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: aiMentorConfig.id,
          set: {
            enabled: !valueJson.disableAiMentor,
            dailyUserLimit: valueJson.aiDailyQuotaPerUser,
            updatedById: actor.id,
            updatedAt: new Date(),
          },
        });

      await Promise.all([
        syncSectionFromLegacyToggle({
          sectionKey: 'mentor',
          enabled: !valueJson.disableAiMentor,
          actorId: actor.id,
          actorEmail: actor.email,
        }),
        syncSectionFromLegacyToggle({
          sectionKey: 'community',
          enabled: !valueJson.disableCommunity,
          actorId: actor.id,
          actorEmail: actor.email,
        }),
      ]);

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'PLATFORM_SETTINGS_UPDATED',
        resourceType: 'platform_settings',
        resourceId: 'platform_controls',
        newStateJson: valueJson,
        ipAddress: req.ip,
      });

      res.json({ settings: saved.valueJson });
    },
  );

  // =========================================================================
  // GLOBAL SECTION MANAGEMENT ADMIN ROUTES (Persistent & Audited)
  // =========================================================================
  router.get(
    '/admin/sections',
    requireAuth,
    requirePermission('admin:view_analytics'),
    async (_req, res) => {
      await ensurePlatformSectionsSeeded();
      const [sections, sectionAuditLogs] = await Promise.all([
        getPlatformSections(true),
        db
          .select({
            id: auditLogs.id,
            actorEmail: auditLogs.actorEmail,
            action: auditLogs.action,
            resourceId: auditLogs.resourceId,
            previousStateJson: auditLogs.previousStateJson,
            newStateJson: auditLogs.newStateJson,
            createdAt: auditLogs.createdAt,
          })
          .from(auditLogs)
          .where(eq(auditLogs.resourceType, 'platform_section'))
          .orderBy(desc(auditLogs.createdAt))
          .limit(30),
      ]);

      res.json({
        sections,
        auditLogs: sectionAuditLogs,
      });
    },
  );

  router.post(
    '/admin/sections/bulk',
    requireAuth,
    requirePermission('admin:platform_settings'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const action = req.body?.action === 'disable_all' ? 'disable_all' : req.body?.action === 'enable_all' ? 'enable_all' : null;
      if (!action) {
        return res.status(400).json({ error: 'Invalid bulk action. Use enable_all or disable_all.' });
      }

      await ensurePlatformSectionsSeeded();
      const targetDisplayStatus = action === 'enable_all' ? 'enabled' : 'disabled';
      const flags = deriveSectionFlags({ displayStatus: targetDisplayStatus, isLockable: true });
      const statusMessage =
        typeof req.body?.statusMessage === 'string'
          ? sanitizeText(req.body.statusMessage, 240)
          : '';

      await db
        .update(platformSections)
        .set({
          enabledStatus: flags.enabledStatus,
          displayStatus: flags.displayStatus,
          maintenanceStatus: flags.maintenanceStatus,
          ...(req.body?.statusMessage !== undefined ? { statusMessage } : {}),
          updatedById: actor.id,
          updatedByEmail: actor.email,
          updatedAt: new Date(),
        })
        .where(eq(platformSections.isLockable, true));

      await syncLegacyControlsFromSection({ sectionKey: 'mentor', enabled: flags.enabledStatus, actorId: actor.id });
      await syncLegacyControlsFromSection({ sectionKey: 'community', enabled: flags.enabledStatus, actorId: actor.id });
      invalidateSectionCache();

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: action === 'enable_all' ? 'SECTIONS_BULK_ENABLE_ALL' : 'SECTIONS_BULK_DISABLE_ALL',
        resourceType: 'platform_section',
        resourceId: 'bulk',
        newStateJson: { action, displayStatus: flags.displayStatus, statusMessage },
        ipAddress: req.ip,
      });

      const sections = await getPlatformSections(true);
      res.json({ ok: true, sections });
    },
  );

  router.post(
    '/admin/sections/:key',
    requireAuth,
    requirePermission('admin:platform_settings'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const sectionKey = sanitizeText(String(req.params.key || ''), 40);
      const def = getSectionDefinition(sectionKey);
      if (!def) {
        return res.status(404).json({ error: `Unknown platform section "${sectionKey}".` });
      }
      if (!def.isLockable) {
        return res.status(400).json({
          error: `Section "${def.sectionName}" is a core protected section and cannot be disabled.`,
        });
      }

      await ensurePlatformSectionsSeeded();
      const [existing] = await db
        .select()
        .from(platformSections)
        .where(eq(platformSections.sectionKey, sectionKey))
        .limit(1);

      const requestedDisplayStatus =
        req.body?.displayStatus !== undefined
          ? normalizeSectionDisplayStatus(req.body.displayStatus)
          : req.body?.maintenanceStatus === true
            ? 'maintenance'
            : req.body?.enabledStatus === false
              ? 'disabled'
              : 'enabled';

      const flags = deriveSectionFlags({
        displayStatus: requestedDisplayStatus,
        isLockable: def.isLockable,
      });

      const statusMessage =
        typeof req.body?.statusMessage === 'string'
          ? sanitizeText(req.body.statusMessage, 240)
          : existing?.statusMessage ?? '';

      const [updated] = await db
        .update(platformSections)
        .set({
          enabledStatus: flags.enabledStatus,
          displayStatus: flags.displayStatus,
          maintenanceStatus: flags.maintenanceStatus,
          statusMessage,
          updatedById: actor.id,
          updatedByEmail: actor.email,
          updatedAt: new Date(),
        })
        .where(eq(platformSections.sectionKey, sectionKey))
        .returning();

      await syncLegacyControlsFromSection({
        sectionKey,
        enabled: flags.enabledStatus,
        actorId: actor.id,
      });
      invalidateSectionCache();

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'SECTION_STATUS_UPDATED',
        resourceType: 'platform_section',
        resourceId: sectionKey,
        previousStateJson: existing
          ? {
              enabledStatus: existing.enabledStatus,
              displayStatus: existing.displayStatus,
              maintenanceStatus: existing.maintenanceStatus,
              statusMessage: existing.statusMessage,
            }
          : null,
        newStateJson: {
          enabledStatus: flags.enabledStatus,
          displayStatus: flags.displayStatus,
          maintenanceStatus: flags.maintenanceStatus,
          statusMessage,
        },
        ipAddress: req.ip,
      });

      const sections = await getPlatformSections(true);
      res.json({ ok: true, section: updated, sections });
    },
  );

  router.post(
    '/admin/permissions',
    requireAuth,
    requirePermission('admin:platform_settings'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const valueJson = req.body && typeof req.body === 'object' ? req.body : {};
      const [saved] = await db
        .insert(platformSettings)
        .values({ key: 'platform_permissions', valueJson, updatedById: actor.id })
        .onConflictDoUpdate({
          target: platformSettings.key,
          set: { valueJson, updatedById: actor.id, updatedAt: new Date() },
        })
        .returning();
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'PERMISSIONS_MATRIX_UPDATED',
        resourceType: 'platform_settings',
        resourceId: 'platform_permissions',
        newStateJson: valueJson,
        ipAddress: req.ip,
      });
      res.json({ permissionsMatrix: saved.valueJson });
    },
  );

  router.post(
    '/admin/books',
    requireAuth,
    requirePermission('admin:manage_books'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const title = sanitizeText(String(req.body.title || ''), 140);
      const author = sanitizeText(String(req.body.author || ''), 120);
      const description = sanitizeText(String(req.body.description || ''), 800);
      const officialUrl = sanitizeText(String(req.body.officialUrl || ''), 300);
      if (!title || !author || !officialUrl.startsWith('https://')) {
        return res.status(400).json({ error: 'Book title, author, and HTTPS official publisher URL are required.' });
      }
      const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}-${crypto.randomBytes(2).toString('hex')}`;
      const [created] = await db
        .insert(books)
        .values({
          slug,
          title,
          author,
          description: description || `${title} by ${author}`,
          category: sanitizeText(String(req.body.category || 'Cybersecurity Fundamentals'), 60),
          difficulty: sanitizeText(String(req.body.difficulty || 'Beginner'), 30),
          language: sanitizeText(String(req.body.language || 'English'), 30),
          publisher: sanitizeText(String(req.body.publisher || 'Publisher'), 100),
          publicationYear: Number(req.body.publicationYear || 2024),
          isbnOrId: sanitizeText(String(req.body.isbnOrId || 'OPEN-ACCESS'), 40),
          licenseType: sanitizeText(String(req.body.licenseType || 'Copyrighted — External Publisher'), 80),
          isFree: Boolean(req.body.isFree ?? false),
          canReadOnline: Boolean(req.body.canReadOnline ?? false),
          canDownload: Boolean(req.body.canDownload ?? false),
          officialUrl,
          createdById: actor.id,
        })
        .returning();
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'BOOK_CREATED',
        resourceType: 'book',
        resourceId: String(created.id),
        newStateJson: { title, author, licenseType: created.licenseType },
        ipAddress: req.ip,
      });
      res.status(201).json({ book: created });
    },
  );

  router.patch(
    '/admin/books/:id',
    requireAuth,
    requirePermission('admin:manage_books'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      const patch: Record<string, unknown> = {};
      if (typeof req.body.status === 'string') patch.status = ['published', 'pending', 'archived'].includes(req.body.status) ? req.body.status : 'published';
      if (typeof req.body.title === 'string') patch.title = sanitizeText(req.body.title, 140);
      if (typeof req.body.difficulty === 'string') patch.difficulty = sanitizeText(req.body.difficulty, 30);
      const [updated] = await db.update(books).set(patch).where(eq(books.id, id)).returning();
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'BOOK_UPDATED',
        resourceType: 'book',
        resourceId: String(id),
        newStateJson: patch,
        ipAddress: req.ip,
      });
      res.json({ book: updated });
    },
  );

  router.delete(
    '/admin/books/:id',
    requireAuth,
    requirePermission('admin:manage_books'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      await db.delete(books).where(eq(books.id, id));
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'BOOK_DELETED',
        resourceType: 'book',
        resourceId: String(id),
        ipAddress: req.ip,
      });
      res.json({ ok: true });
    },
  );

  router.post(
    '/admin/appeals/:id/review',
    requireAuth,
    requirePermission('admin:manage_appeals'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      const decision = req.body.decision === 'approved' ? 'approved' : 'rejected';
      const adminNote = sanitizeText(String(req.body.adminNote || ''), 400);

      const [appeal] = await db.select().from(disciplinaryAppeals).where(eq(disciplinaryAppeals.id, id)).limit(1);
      if (!appeal) return res.status(404).json({ error: 'Appeal not found.' });

      const [updated] = await db
        .update(disciplinaryAppeals)
        .set({ status: decision, adminNote, reviewedById: actor.id, reviewedAt: new Date() })
        .where(eq(disciplinaryAppeals.id, id))
        .returning();

      if (decision === 'approved') {
        if (appeal.scope === 'platform_suspension' || appeal.scope === 'platform_ban') {
          await db.update(users).set({ isSuspended: false, isBanned: false, suspensionReason: null }).where(eq(users.id, appeal.userId));
        } else if (appeal.scope === 'team_removal' && appeal.targetId) {
          await db
            .update(teamMembers)
            .set({ removalStatus: 'active', removalReason: null, removalExpiresAt: null })
            .where(and(eq(teamMembers.userId, appeal.userId), eq(teamMembers.teamId, appeal.targetId)));
        } else if (appeal.scope === 'competition_removal' && appeal.targetId) {
          await db
            .update(roomParticipations)
            .set({ status: 'active', removalReason: null })
            .where(and(eq(roomParticipations.userId, appeal.userId), eq(roomParticipations.competitionId, appeal.targetId)));
        }
      }

      await db.insert(notifications).values({
        userId: appeal.userId,
        type: 'security',
        title: `Appeal ${decision === 'approved' ? 'Approved' : 'Reviewed'}`,
        body: adminNote || `Your ${appeal.scope.replace(/_/g, ' ')} appeal was marked ${decision}.`,
      });

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: `APPEAL_${decision.toUpperCase()}`,
        resourceType: 'disciplinary_appeal',
        resourceId: String(id),
        newStateJson: { scope: appeal.scope, decision, adminNote },
        ipAddress: req.ip,
      });

      res.json({ appeal: updated });
    },
  );

  router.post(
    '/admin/certificates/:id/revoke',
    requireAuth,
    requirePermission('admin:manage_certificates'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      const isRevoked = typeof req.body.isRevoked === 'boolean' ? req.body.isRevoked : true;
      const reason = sanitizeText(String(req.body.reason || 'Administrative certificate action'), 240);
      const [updated] = await db
        .update(certificates)
        .set({ isRevoked, revokedReason: isRevoked ? reason : null })
        .where(eq(certificates.id, id))
        .returning();
      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: isRevoked ? 'CERTIFICATE_REVOKED' : 'CERTIFICATE_REINSTATED',
        resourceType: 'certificate',
        resourceId: String(id),
        newStateJson: { isRevoked, reason },
        ipAddress: req.ip,
      });
      res.json({ certificate: updated });
    },
  );

  router.get(
    '/admin/export/csv',
    requireAuth,
    requirePermission('admin:export_reports'),
    async (_req, res) => {
      const board = await db
        .select({
          username: users.username,
          displayName: users.displayName,
          role: users.role,
          country: users.country,
          xp: users.xp,
          ctfPoints: users.ctfPoints,
        })
        .from(users)
        .orderBy(desc(users.xp));

      const header = 'username,display_name,role,country,xp,ctf_points\n';
      const rows = board
        .map((r) =>
          [r.username, r.displayName, r.role, r.country, r.xp, r.ctfPoints]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(','),
        )
        .join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="kali3977-analytics.csv"');
      res.send(header + rows);
    },
  );

  router.get(
    '/admin/security-posture',
    requireAuth,
    requirePermission('admin:view_security'),
    async (_req, res) => {
      const [abuseRows, openIpRows] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(auditLogs)
          .where(
            or(
              eq(auditLogs.action, 'ABUSE_RATE_LIMIT_EXCEEDED'),
              eq(auditLogs.action, 'SCRAPING_BURST_DETECTED'),
            ),
          ),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(ipViolationReports)
          .where(inArray(ipViolationReports.status, ['open', 'under_review', 'disputed'])),
      ]);
      res.json({
        posture: {
          sourcemapDisabledInBuild: true,
          xPoweredByDisabled: true,
          cacheNoStoreSensitiveRoutes: true,
          flagHmacSecretConfigured: Boolean(process.env.FLAG_HMAC_SECRET),
          ownerEmailConfiguredServerSide: true,
          antiScrapingActive: true,
          abuseEventsTotal: abuseRows[0]?.count ?? 0,
          openIpReportsCount: openIpRows[0]?.count ?? 0,
          brandNotice: KALI3977_BRAND_NOTICE,
          copyrightNotice: KALI3977_COPYRIGHT_NOTICE,
        },
      });
    },
  );

  router.post(
    '/admin/ip-reports/:id/review',
    requireAuth,
    requirePermission('admin:view_security'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const id = Number(req.params.id);
      const allowedStatuses = [
        'open',
        'under_review',
        'takedown_executed',
        'disputed',
        'resolved',
        'rejected',
      ];
      const status = allowedStatuses.includes(String(req.body.status))
        ? String(req.body.status)
        : 'under_review';
      const note = sanitizeText(String(req.body.adminResolutionNote || ''), 600);
      const unpublishTarget = Boolean(req.body.unpublishTarget);

      const [existing] = await db
        .select()
        .from(ipViolationReports)
        .where(eq(ipViolationReports.id, id))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ error: 'IP violation report not found.' });
      }

      const [updated] = await db
        .update(ipViolationReports)
        .set({
          status,
          adminResolutionNote: note || existing.adminResolutionNote,
          reviewedById: actor.id,
          updatedAt: new Date(),
        })
        .where(eq(ipViolationReports.id, id))
        .returning();

      if (status === 'takedown_executed' && unpublishTarget) {
        const slugCandidate = existing.targetRef.split('/').pop()?.trim() || existing.targetRef.trim();
        if (existing.targetType === 'course') {
          await db
            .update(courses)
            .set({ published: false, updatedAt: new Date() })
            .where(eq(courses.slug, slugCandidate));
        } else if (existing.targetType === 'ctf_challenge') {
          await db
            .update(ctfChallenges)
            .set({ published: false, updatedAt: new Date() })
            .where(eq(ctfChallenges.slug, slugCandidate));
        }
      }

      if (existing.userId) {
        await db.insert(notifications).values({
          userId: existing.userId,
          type: 'security',
          title: `IP Case ${existing.referenceCode}: ${status.replace(/_/g, ' ')}`,
          body: note || `Administrative status updated to ${status}.`,
        });
      }

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: `IP_REPORT_${status.toUpperCase()}`,
        resourceType: 'ip_violation_report',
        resourceId: existing.referenceCode,
        newStateJson: { status, note, unpublishTarget },
        ipAddress: req.ip,
      });

      res.json({ report: updated });
    },
  );

  // Admin Cyber Labs Operations & Verification Control
  router.get(
    '/admin/labs',
    requireAuth,
    requirePermission('admin:view_analytics'),
    async (_req, res) => {
      const [allLabs, recentSessions] = await Promise.all([
        db
          .select({
            id: labs.id,
            slug: labs.slug,
            category: labs.category,
            title: labs.title,
            difficulty: labs.difficulty,
            timeLimitMinutes: labs.timeLimitMinutes,
            cpuLimitMilli: labs.cpuLimitMilli,
            ramLimitMb: labs.ramLimitMb,
            storageLimitMb: labs.storageLimitMb,
            networkPolicy: labs.networkPolicy,
            imageRef: labs.imageRef,
            isolationBackend: labs.isolationBackend,
            runnerRequired: labs.runnerRequired,
            verificationRequired: labs.verificationRequired,
            verificationMode: labs.verificationMode,
            xpReward: labs.xpReward,
            enabled: labs.enabled,
            published: labs.published,
          })
          .from(labs)
          .orderBy(labs.runnerRequired, labs.id),
        db
          .select({
            id: labSessions.id,
            sessionUuid: labSessions.sessionUuid,
            labId: labSessions.labId,
            labTitle: labs.title,
            labSlug: labs.slug,
            userId: labSessions.userId,
            username: users.username,
            userEmail: users.email,
            status: labSessions.status,
            verified: labSessions.verified,
            xpAwarded: labSessions.xpAwarded,
            startedAt: labSessions.startedAt,
            expiresAt: labSessions.expiresAt,
            completedAt: labSessions.completedAt,
            terminatedAt: labSessions.terminatedAt,
            resetCount: labSessions.resetCount,
            failureReason: labSessions.failureReason,
          })
          .from(labSessions)
          .innerJoin(labs, eq(labSessions.labId, labs.id))
          .innerJoin(users, eq(labSessions.userId, users.id))
          .orderBy(desc(labSessions.startedAt))
          .limit(60),
      ]);

      res.json({
        runnerConnected: isExternalRunnerConfigured(),
        runnerStatus: getExternalRunnerConfigStatus(),
        architecturePlan: getFutureRunnerArchitecturePlan(),
        labs: allLabs,
        sessions: recentSessions,
      });
    },
  );

  router.patch(
    '/admin/labs/:labId',
    requireAuth,
    requirePermission('admin:manage_content'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const labId = Number(req.params.labId);
      if (!Number.isInteger(labId) || labId <= 0) {
        return res.status(400).json({ error: 'Invalid lab identifier.' });
      }
      const [existing] = await db.select().from(labs).where(eq(labs.id, labId)).limit(1);
      if (!existing) {
        return res.status(404).json({ error: 'Lab not found.' });
      }

      const nextEnabled =
        typeof req.body.enabled === 'boolean' ? req.body.enabled : existing.enabled;
      const nextVerificationRequired =
        typeof req.body.verificationRequired === 'boolean'
          ? req.body.verificationRequired
          : existing.verificationRequired;
      const nextPublished =
        typeof req.body.published === 'boolean' ? req.body.published : existing.published;

      const [updated] = await db
        .update(labs)
        .set({
          enabled: nextEnabled,
          verificationRequired: nextVerificationRequired,
          published: nextPublished,
        })
        .where(eq(labs.id, labId))
        .returning({
          id: labs.id,
          slug: labs.slug,
          title: labs.title,
          enabled: labs.enabled,
          verificationRequired: labs.verificationRequired,
          published: labs.published,
          runnerRequired: labs.runnerRequired,
          verificationMode: labs.verificationMode,
        });

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'LAB_CONFIG_UPDATED',
        resourceType: 'lab',
        resourceId: existing.slug,
        previousStateJson: {
          enabled: existing.enabled,
          verificationRequired: existing.verificationRequired,
          published: existing.published,
        },
        newStateJson: {
          enabled: updated.enabled,
          verificationRequired: updated.verificationRequired,
          published: updated.published,
        },
        ipAddress: req.ip,
      });

      res.json({ lab: updated });
    },
  );

  router.post(
    '/admin/labs/sessions/:sessionId/terminate',
    requireAuth,
    requirePermission('admin:manage_content'),
    async (req: AuthRequest, res) => {
      const actor = req.dbUser!;
      const sessionId = Number(req.params.sessionId);
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ error: 'Invalid session identifier.' });
      }
      const reason = sanitizeText(
        String(req.body.reason || 'Terminated by platform administrator'),
        300,
      );
      const [existing] = await db
        .select()
        .from(labSessions)
        .where(eq(labSessions.id, sessionId))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ error: 'Lab session not found.' });
      }

      const [updated] = await db
        .update(labSessions)
        .set({
          status: 'terminated',
          terminatedAt: new Date(),
          failureReason: reason,
        })
        .where(eq(labSessions.id, sessionId))
        .returning();

      await recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'LAB_SESSION_TERMINATED',
        resourceType: 'lab_session',
        resourceId: String(sessionId),
        previousStateJson: { status: existing.status },
        newStateJson: { status: 'terminated', reason },
        ipAddress: req.ip,
      });

      res.json({ session: updated });
    },
  );

  // Mount Games Arena Sub-Router (/api/games/*)
  router.use('/games', createGamesRouter());

  // Mount Learn KALI Sub-Routers (/api/learn-kali/* and /api/admin/learn-kali/*)
  router.use('/learn-kali', createLearnKaliRouter());
  router.use('/admin/learn-kali', createLearnKaliAdminRouter());

  return router;
}
