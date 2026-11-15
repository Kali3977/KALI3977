import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  achievements,
  aiMentorConfig,
  books,
  campuses,
  campusVerificationRequests,
  chatChannels,
  competitions,
  courses,
  ctfChallenges,
  diagnosticAssessments,
  labs,
  lessons,
  platformSettings,
  rooms,
  teams,
  tournamentRegistrations,
  tournaments,
  users,
} from './schema.ts';
import { hashFlag } from '../lib/domain/security.ts';
import { DEFAULT_AI_MENTOR_CONFIG } from '../lib/ai/mentor-limits.ts';
import { CURRICULUM_COURSES, DIAGNOSTIC_ASSESSMENTS } from './seed-curriculum.ts';
import { SEEDED_BOOKS, SEEDED_CTF_CHALLENGES } from './seed-ctf-books.ts';
import { syncGamesArenaSeed } from './seed-games.ts';
import { syncLearnKaliSeed } from './seed-learn-kali.ts';
import { ensurePlatformSectionsSeeded } from '../middleware/section-guard.ts';

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      console.error('Database seed failed:', err);
    });
  }
  return seedPromise;
}

export const INITIAL_NFSU_CAMPUSES = [
  {
    code: 'NFSU-GNR',
    name: 'NFSU Gandhinagar',
    country: 'India',
    city: 'Gandhinagar',
    emailDomain: 'nfsu.ac.in',
    teamName: 'NFSU Gandhinagar Sentinels',
    teamCode: 'NFSU-TEAM-01',
  },
  {
    code: 'NFSU-DEL',
    name: 'NFSU Delhi',
    country: 'India',
    city: 'New Delhi',
    emailDomain: 'nfsu.ac.in',
    teamName: 'NFSU Delhi Cyber Guard',
    teamCode: 'NFSU-TEAM-02',
  },
  {
    code: 'NFSU-TRP',
    name: 'NFSU Tripura',
    country: 'India',
    city: 'Agartala',
    emailDomain: 'nfsu.ac.in',
    teamName: 'NFSU Tripura Forensics',
    teamCode: 'NFSU-TEAM-03',
  },
  {
    code: 'NFSU-DHW',
    name: 'NFSU Dharwad',
    country: 'India',
    city: 'Dharwad',
    emailDomain: 'nfsu.ac.in',
    teamName: 'NFSU Dharwad Redline',
    teamCode: 'NFSU-TEAM-04',
  },
  {
    code: 'NFSU-GHY',
    name: 'NFSU Guwahati',
    country: 'India',
    city: 'Guwahati',
    emailDomain: 'nfsu.ac.in',
    teamName: 'NFSU Guwahati Cipher Squad',
    teamCode: 'NFSU-TEAM-05',
  },
] as const;

const LEGACY_REMOVED_CAMPUS_CODES = ['IITD', 'NUS', 'ETHZ', 'MIT', 'OXFD'];
const LEGACY_REMOVED_TEAM_CODES = ['CAMPUS-001', 'CAMPUS-002', 'CAMPUS-003', 'CAMPUS-004', 'CAMPUS-005'];

async function ensureNfsuCampusesAndTeams(mainCompId: number | null) {
  const campusMap = new Map<string, number>();

  for (const c of INITIAL_NFSU_CAMPUSES) {
    const [existing] = await db
      .select()
      .from(campuses)
      .where(eq(campuses.code, c.code))
      .limit(1);
    if (!existing) {
      const [inserted] = await db
        .insert(campuses)
        .values({
          code: c.code,
          name: c.name,
          country: c.country,
          city: c.city,
          emailDomain: c.emailDomain,
          verified: true,
        })
        .returning();
      campusMap.set(c.code, inserted.id);
    } else {
      await db
        .update(campuses)
        .set({ name: c.name, country: c.country, city: c.city, emailDomain: c.emailDomain, verified: true })
        .where(eq(campuses.id, existing.id));
      campusMap.set(c.code, existing.id);
    }
  }

  // Remove legacy fictional pre-NFSU initial campuses/teams if still present
  const oldCampuses = await db
    .select()
    .from(campuses)
    .where(inArray(campuses.code, LEGACY_REMOVED_CAMPUS_CODES));
  if (oldCampuses.length > 0) {
    const oldCampusIds = oldCampuses.map((c) => c.id);
    await db.update(users).set({ campusId: null }).where(inArray(users.campusId, oldCampusIds));
    await db
      .update(tournamentRegistrations)
      .set({ campusId: null })
      .where(inArray(tournamentRegistrations.campusId, oldCampusIds));
    await db
      .delete(campusVerificationRequests)
      .where(inArray(campusVerificationRequests.campusId, oldCampusIds));
    await db
      .update(teams)
      .set({ campusId: null })
      .where(inArray(teams.campusId, oldCampusIds));
    await db.delete(campuses).where(inArray(campuses.id, oldCampusIds));
  }

  await db.delete(teams).where(inArray(teams.teamCode, LEGACY_REMOVED_TEAM_CODES));

  // Ensure initial 5 NFSU teams & their private/captain chat channels
  for (const c of INITIAL_NFSU_CAMPUSES) {
    const campusId = campusMap.get(c.code) ?? null;
    const [existingTeam] = await db
      .select()
      .from(teams)
      .where(eq(teams.teamCode, c.teamCode))
      .limit(1);

    let teamId: number;
    if (!existingTeam) {
      const [created] = await db
        .insert(teams)
        .values({
          competitionId: mainCompId,
          campusId,
          name: c.teamName,
          teamCode: c.teamCode,
          maxMembers: 30,
          codeUsageLimit: 30,
        })
        .returning();
      teamId = created.id;
    } else {
      teamId = existingTeam.id;
      if (existingTeam.campusId !== campusId) {
        await db.update(teams).set({ campusId }).where(eq(teams.id, teamId));
      }
    }

    const existingChannels = await db
      .select({ channelType: chatChannels.channelType })
      .from(chatChannels)
      .where(eq(chatChannels.teamId, teamId));
    const types = new Set(existingChannels.map((ch) => ch.channelType));
    if (!types.has('team')) {
      await db.insert(chatChannels).values({
        competitionId: mainCompId,
        teamId,
        channelType: 'team',
        name: `${c.teamName} — Private Chat`,
        isEnabled: true,
      });
    }
    if (!types.has('captain')) {
      await db.insert(chatChannels).values({
        competitionId: mainCompId,
        teamId,
        channelType: 'captain',
        name: `${c.teamName} — Captain Brief`,
        isEnabled: true,
      });
    }
  }
}

async function syncCurriculumAndDiagnostics(): Promise<void> {
  for (const c of CURRICULUM_COURSES) {
    const [existingCourse] = await db
      .select()
      .from(courses)
      .where(eq(courses.slug, c.slug))
      .limit(1);

    let courseId: number;
    if (!existingCourse) {
      const [inserted] = await db
        .insert(courses)
        .values({
          slug: c.slug,
          stage: c.stage,
          stageTitle: c.stageTitle,
          subjectArea: c.subjectArea,
          adaptiveLevel: c.adaptiveLevel,
          titleEn: c.titleEn,
          titleHi: c.titleHi,
          summaryEn: c.summaryEn,
          summaryHi: c.summaryHi,
          difficulty: c.difficulty,
          prerequisiteSlug: c.prerequisiteSlug,
          prerequisitesJson: c.prerequisitesJson,
          learningObjectivesJson: c.learningObjectivesJson,
          referencesJson: c.referencesJson,
          caseStudyText: c.caseStudyText,
          projectBrief: c.projectBrief,
          estimatedMinutes: c.estimatedMinutes,
          orderIndex: c.orderIndex,
          published: true,
        })
        .returning();
      courseId = inserted.id;
    } else {
      courseId = existingCourse.id;
      await db
        .update(courses)
        .set({
          stage: c.stage,
          stageTitle: c.stageTitle,
          subjectArea: c.subjectArea,
          adaptiveLevel: c.adaptiveLevel,
          titleEn: c.titleEn,
          titleHi: c.titleHi,
          summaryEn: c.summaryEn,
          summaryHi: c.summaryHi,
          difficulty: c.difficulty,
          prerequisiteSlug: c.prerequisiteSlug,
          prerequisitesJson: c.prerequisitesJson,
          learningObjectivesJson: c.learningObjectivesJson,
          referencesJson: c.referencesJson,
          caseStudyText: c.caseStudyText,
          projectBrief: c.projectBrief,
          estimatedMinutes: c.estimatedMinutes,
          orderIndex: c.orderIndex,
        })
        .where(eq(courses.id, existingCourse.id));
    }

    const existingLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.courseId, courseId));

    for (let i = 0; i < c.lessons.length; i++) {
      const l = c.lessons[i];
      const match = existingLessons.find((el) => el.titleEn === l.titleEn);
      if (!match) {
        await db.insert(lessons).values({
          courseId,
          moduleTitle: l.moduleTitle,
          titleEn: l.titleEn,
          titleHi: l.titleHi,
          contentEn: l.contentEn,
          contentHi: l.contentHi,
          practicalExample: l.practicalExample,
          diagramSpec: l.diagramSpec,
          exercisesText: l.exercisesText,
          revisionSummary: l.revisionSummary,
          quizJson: l.quizJson,
          orderIndex: i + 1,
          published: true,
        });
      } else {
        await db
          .update(lessons)
          .set({
            moduleTitle: l.moduleTitle,
            exercisesText: l.exercisesText,
            revisionSummary: l.revisionSummary,
            orderIndex: i + 1,
          })
          .where(eq(lessons.id, match.id));
      }
    }
  }

  for (const diag of DIAGNOSTIC_ASSESSMENTS) {
    const [existing] = await db
      .select()
      .from(diagnosticAssessments)
      .where(eq(diagnosticAssessments.slug, diag.slug))
      .limit(1);
    if (!existing) {
      await db.insert(diagnosticAssessments).values({
        slug: diag.slug,
        title: diag.title,
        subjectArea: diag.subjectArea,
        description: diag.description,
        questionsJson: diag.questionsJson,
        published: true,
      });
    } else {
      await db
        .update(diagnosticAssessments)
        .set({
          title: diag.title,
          subjectArea: diag.subjectArea,
          description: diag.description,
          questionsJson: diag.questionsJson,
        })
        .where(eq(diagnosticAssessments.id, existing.id));
    }
  }
}

async function syncBooksLibrary(): Promise<void> {
  for (const book of SEEDED_BOOKS) {
    const [existing] = await db
      .select()
      .from(books)
      .where(eq(books.slug, book.slug))
      .limit(1);
    if (!existing) {
      await db.insert(books).values({
        slug: book.slug,
        title: book.title,
        author: book.author,
        description: book.description,
        category: book.category,
        difficulty: book.difficulty,
        language: book.language,
        publisher: book.publisher,
        publicationYear: book.publicationYear,
        isbnOrId: book.isbnOrId,
        licenseType: book.licenseType,
        isFree: book.isFree,
        canReadOnline: book.canReadOnline,
        canDownload: book.canDownload,
        officialUrl: book.officialUrl,
        coverAccent: book.coverAccent,
        readableChaptersJson: book.readableChaptersJson,
        status: 'published',
      });
    } else {
      await db
        .update(books)
        .set({
          title: book.title,
          author: book.author,
          description: book.description,
          category: book.category,
          difficulty: book.difficulty,
          publisher: book.publisher,
          licenseType: book.licenseType,
          isFree: book.isFree,
          canReadOnline: book.canReadOnline,
          canDownload: book.canDownload,
          officialUrl: book.officialUrl,
          readableChaptersJson: book.readableChaptersJson,
        })
        .where(eq(books.id, existing.id));
    }
  }
}

async function syncCtfChallenges(mainCompId: number | null): Promise<void> {
  for (const ch of SEEDED_CTF_CHALLENGES) {
    const [existing] = await db
      .select()
      .from(ctfChallenges)
      .where(eq(ctfChallenges.slug, ch.slug))
      .limit(1);
    if (!existing) {
      await db.insert(ctfChallenges).values({
        competitionId: mainCompId,
        slug: ch.slug,
        title: ch.title,
        category: ch.category,
        difficulty: ch.difficulty,
        description: ch.description,
        basePoints: ch.basePoints,
        currentPoints: ch.basePoints,
        scoringMode: 'dynamic',
        flagHash: hashFlag(ch.flag),
        hintsJson: ch.hintsJson,
        learningObjectivesJson: ch.learningObjectivesJson,
        relatedCourseSlug: ch.relatedCourseSlug,
        relatedBookTitle: ch.relatedBookTitle,
        referenceUrl: ch.referenceUrl,
        flagFormat: 'KALI3977{...}',
        unlockAfterSlug: ch.unlockAfterSlug ?? null,
        explanationAfterSolve: ch.explanationAfterSolve,
        attachmentName: ch.attachmentName,
        attachmentContent: ch.attachmentContent,
        published: true,
      });
    } else {
      await db
        .update(ctfChallenges)
        .set({
          title: ch.title,
          category: ch.category,
          difficulty: ch.difficulty,
          description: ch.description,
          flagHash: hashFlag(ch.flag),
          hintsJson: ch.hintsJson,
          learningObjectivesJson: ch.learningObjectivesJson,
          relatedCourseSlug: ch.relatedCourseSlug,
          relatedBookTitle: ch.relatedBookTitle,
          referenceUrl: ch.referenceUrl,
          attachmentName: ch.attachmentName,
          attachmentContent: ch.attachmentContent,
          explanationAfterSolve: ch.explanationAfterSolve,
        })
        .where(eq(ctfChallenges.id, existing.id));
    }
  }
}

async function ensurePlatformSettings(): Promise<void> {
  const [controls] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'platform_controls'))
    .limit(1);
  if (!controls) {
    await db.insert(platformSettings).values({
      key: 'platform_controls',
      valueJson: {
        registrationOpen: true,
        maintenanceMode: false,
        disableAiMentor: false,
        disableCommunity: false,
        aiDailyQuotaPerUser: DEFAULT_AI_MENTOR_CONFIG.dailyUserLimit,
        labMaxMinutes: 60,
        requireMfaForAdmins: true,
        globalAnnouncement: 'Welcome to KALI3977 Worldwide Cybersecurity Season 2026.',
      },
    });
  }

  const [existingMentorCfg] = await db
    .select()
    .from(aiMentorConfig)
    .where(eq(aiMentorConfig.id, 1))
    .limit(1);
  if (!existingMentorCfg) {
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

  const [perms] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, 'platform_permissions'))
    .limit(1);
  if (!perms) {
    await db.insert(platformSettings).values({
      key: 'platform_permissions',
      valueJson: {
        whoCanCreateTeams: ['owner', 'event_admin'],
        whoCanCreateRooms: ['owner', 'event_admin'],
        whoCanJoinPrivateRooms: ['verified_campus_or_code', 'invite_only'],
        whoCanInviteMembers: ['owner', 'event_admin', 'team_captain'],
        whoCanAccessTeamChat: ['verified_team_member', 'owner'],
        whoCanViewScores: ['authenticated_and_public'],
        whoCanManageMemberships: ['owner', 'event_admin'],
        whoCanChangeRules: ['owner', 'event_admin'],
      },
    });
  }

  await ensurePlatformSectionsSeeded();
}

async function repairSeededData(): Promise<void> {
  const [mainComp] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, 'global-inter-university-2026'))
    .limit(1);
  const mainCompId = mainComp?.id ?? null;

  await ensureNfsuCampusesAndTeams(mainCompId);
  await syncCurriculumAndDiagnostics();
  await syncBooksLibrary();
  await syncCtfChallenges(mainCompId);
  await syncCyberLabs();
  await ensurePlatformSettings();
  await syncGamesArenaSeed();
  await syncLearnKaliSeed();

  // Ensure tournament brackets aren't fabricated
  const [seededTournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.name, 'Inter-University Autumn Cyber League 2026'))
    .limit(1);
  if (seededTournament) {
    const regCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tournamentRegistrations)
      .where(eq(tournamentRegistrations.tournamentId, seededTournament.id));
    const jsonStr = JSON.stringify(seededTournament.bracketsJson || {});
    if ((regCount[0]?.count ?? 0) === 0 && jsonStr.includes('QF-1') && jsonStr.includes('"live"')) {
      await db
        .update(tournaments)
        .set({
          status: 'registration_open',
          description:
            'Seasonal inter-university knockout bracket. Brackets generate strictly from confirmed campus team registrations.',
          bracketsJson: { format: 'knockout', rounds: [] },
        })
        .where(eq(tournaments.id, seededTournament.id));
    }
  }

  await db
    .update(competitions)
    .set({
      rulesText:
        '1. Standard campus fair-play rules apply. 2. Do not share flags across opposing teams. 3. Attacks against competition infrastructure are strictly prohibited.',
    })
    .where(sql`${competitions.rulesText} = ''`);
}

async function runSeed(): Promise<void> {
  const existingComps = await db.select({ count: sql<number>`count(*)::int` }).from(competitions);
  if ((existingComps[0]?.count ?? 0) > 0) {
    await repairSeededData();
    return;
  }

  // 1. Seed Multiplayer Competitions first
  const startsAt = new Date(Date.now() - 30 * 60 * 1000);
  const endsAt = new Date(Date.now() + 150 * 60 * 1000);

  const [mainComp] = await db
    .insert(competitions)
    .values({
      slug: 'global-inter-university-2026',
      name: 'Global Inter-University Cyber Championship 2026',
      description:
        'Flagship worldwide campus competition featuring dynamic CTF challenges, real-time campus leaderboards, and isolated team communication.',
      gameMode: 'ctf_battle',
      status: 'active',
      visibility: 'public',
      difficulty: 'Medium',
      scoringSystem: 'dynamic',
      enrollmentPolicy: 'shared_team_code',
      totalCapacity: 150,
      perTeamCapacity: 30,
      maxTeams: 5,
      penaltyPerWrongFlag: 0,
      hintsEnabled: true,
      allowLateJoin: true,
      allowReconnection: true,
      rulesLocked: true,
      rulesText:
        '1. Standard campus fair-play rules apply. 2. Do not share flags across opposing teams. 3. Attacks against competition infrastructure are strictly prohibited.',
      rulesSnapshotJson: {
        gameMode: 'ctf_battle',
        scoringSystem: 'dynamic',
        totalCapacity: 150,
        perTeamCapacity: 30,
        maxTeams: 5,
        enrollmentPolicy: 'shared_team_code',
      },
      startsAt,
      endsAt,
      registrationDeadline: endsAt,
      durationMinutes: 180,
    })
    .returning();

  const [rushComp] = await db
    .insert(competitions)
    .values({
      slug: 'weekly-cyber-rush-09',
      name: 'Weekly Cyber Rush — Sprint Division',
      description: 'Fast-paced 90-minute solo and small-squad defensive triage & cryptography sprint.',
      gameMode: 'cyber_rush',
      status: 'registration_open',
      visibility: 'public',
      difficulty: 'Easy',
      scoringSystem: 'static',
      enrollmentPolicy: 'shared_team_code',
      totalCapacity: 300,
      perTeamCapacity: 10,
      maxTeams: 30,
      rulesText: '1. Complete all defensive triage challenges within 90 minutes. 2. Static points per solve.',
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 25.5 * 60 * 60 * 1000),
      registrationDeadline: new Date(Date.now() + 23.5 * 60 * 60 * 1000),
      durationMinutes: 90,
    })
    .returning();

  await db.insert(rooms).values([
    {
      competitionId: mainComp.id,
      name: 'Championship Arena Alpha',
      roomCode: '3977-CTF-82A',
      isActive: true,
      isLocked: false,
      maxParticipants: 150,
      usageLimit: 150,
    },
    {
      competitionId: rushComp.id,
      name: 'Cyber Rush Lobby 01',
      roomCode: '3977-RUSH-09B',
      isActive: true,
      isLocked: false,
      maxParticipants: 300,
      usageLimit: 300,
    },
  ]);

  await db.insert(chatChannels).values([
    {
      competitionId: mainComp.id,
      teamId: null,
      channelType: 'announcements',
      name: 'Championship Announcements',
      isEnabled: true,
    },
    {
      competitionId: mainComp.id,
      teamId: null,
      channelType: 'organizer',
      name: 'Organizer Command Channel',
      isEnabled: true,
    },
  ]);

  // 2. Seed Exact 5 NFSU Campuses & Teams
  await ensureNfsuCampusesAndTeams(mainComp.id);

  // 3. Seed Curriculum & Diagnostics
  await syncCurriculumAndDiagnostics();

  // 4. Seed Cyber Labs (MicroVM + Interactive Non-Runner Walkthrough Labs)
  await syncCyberLabs();

  // 5. Seed Books Library & 55+ CTF Challenges
  await syncBooksLibrary();
  await syncCtfChallenges(mainComp.id);

  // 6. Seed Tournaments
  await db.insert(tournaments).values([
    {
      name: 'Inter-University Autumn Cyber League 2026',
      description:
        'Seasonal inter-university knockout bracket. Brackets generate strictly from confirmed campus team registrations.',
      format: 'knockout',
      recurrence: 'seasonal',
      status: 'registration_open',
      maxTeams: 16,
      teamSize: 5,
      registrationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      startsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      bracketsJson: { format: 'knockout', rounds: [] },
    },
    {
      name: 'Weekly SOC & Incident Triage Cup',
      description: 'Weekly round-robin defensive triage and incident containment tournament.',
      format: 'round_robin',
      recurrence: 'weekly',
      status: 'registration_open',
      maxTeams: 12,
      teamSize: 4,
      registrationDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      bracketsJson: { format: 'round_robin', rounds: [] },
    },
  ]);

  // 7. Seed Achievements
  await db.insert(achievements).values([
    { code: 'FIRST_BLOOD_CTF', title: 'First Flag Verified', description: 'Solved your first server-verified CTF challenge.', category: 'CTF', xpBonus: 100 },
    { code: 'ACADEMY_SCHOLAR', title: 'Foundations Complete', description: 'Completed Stage 1 through Stage 3 lessons.', category: 'Academy', xpBonus: 200 },
    { code: 'CAMPUS_ENVOY', title: 'Campus Competitor', description: 'Joined an official multiplayer competition room with a verified team code.', category: 'Multiplayer', xpBonus: 150 },
    { code: 'MFA_GUARDIAN', title: 'Hardware-Ready MFA', description: 'Enabled TOTP multi-factor authentication on your account.', category: 'Security', xpBonus: 100 },
    { code: 'SCHOLAR_READER', title: 'Technical Library Scholar', description: 'Completed reading modules in the KALI3977 Books Library.', category: 'Books', xpBonus: 120 },
  ]);

  // 8. Seed Platform Controls & Permissions
  await ensurePlatformSettings();

  // 9. Seed Games Arena Categories, 30 Games, Achievements & Missions
  await syncGamesArenaSeed();

  // 10. Seed Learn KALI Levels, Official Tool Categories, Verified Tools, Lessons & Missions
  await syncLearnKaliSeed();
}

const CANONICAL_LABS = [
  {
    slug: 'lab-interactive-http-header-hardening',
    category: 'Web Security',
    title: 'HTTP Security Headers & Session Cookie Audit (Interactive)',
    description:
      'Analyze an intercepted production HTTP response trace in your browser, identify missing clickjacking and cookie protections, and complete the remediation check.',
    difficulty: 'Beginner',
    objectivesJson: [
      'Inspect Content-Security-Policy, Strict-Transport-Security, and Set-Cookie flags',
      'Spot insecure framing and missing HttpOnly/SameSite attributes',
      'Select the hardened HTTP policy directive to remediate the exposure',
    ],
    hintsJson: [
      'X-Frame-Options is legacy; modern CSP uses frame-ancestors.',
      'Session cookies storing auth tokens should declare HttpOnly; Secure; SameSite=Lax or Strict.',
    ],
    walkthroughJson: [
      {
        step: 1,
        title: 'Capture & Inspect Raw Response Headers',
        commandExample: 'curl -sI https://app.example.internal/dashboard',
        instruction: 'Review the returned HTTP status line and header keys before any body payload is rendered.',
        expectedObservation: 'Observe missing CSP frame-ancestors, missing HSTS, and exposed Server version.',
      },
      {
        step: 2,
        title: 'Audit Cookie Transport Flags',
        commandExample: 'grep -i "set-cookie" response_headers.txt',
        instruction: 'Check whether the session identifier can be read by client-side JavaScript or sent over plaintext HTTP.',
        expectedObservation: 'Missing HttpOnly allows document.cookie exfiltration during XSS.',
      },
      {
        step: 3,
        title: 'Validate Hardened Policy',
        commandExample: "Content-Security-Policy: default-src 'self'; frame-ancestors 'none'",
        instruction: 'Confirm the directive set that mitigates both clickjacking and unsafe third-party script execution.',
        expectedObservation: 'Browsers enforce framing block and disallow inline script injection.',
      },
    ],
    assessmentJson: {
      prompt:
        'Which response header configuration properly blocks clickjacking AND protects the session cookie from client-side JavaScript theft?',
      artifactLabel: 'Captured HTTP/1.1 Response Headers',
      artifactContent: `HTTP/1.1 200 OK
Date: Sun, 15 Nov 2026 12:15:00 GMT
Server: nginx/1.24.0
Set-Cookie: kali_sid=9f81c2b4a0; Path=/
X-Content-Type-Options: nosniff
Content-Type: text/html; charset=utf-8`,
      options: [
        'Add Access-Control-Allow-Origin: * and keep Set-Cookie unchanged',
        "Add Content-Security-Policy: frame-ancestors 'none' and append HttpOnly; Secure; SameSite=Strict to Set-Cookie",
        'Remove X-Content-Type-Options: nosniff and set Server: hidden',
        'Set Cache-Control: public, max-age=31536000 on Set-Cookie responses',
      ],
      correctIndex: 1,
      explanation:
        "Content-Security-Policy: frame-ancestors 'none' prevents iframe clickjacking across modern browsers, while HttpOnly; Secure; SameSite=Strict stops JS access and cross-site cookie transmission.",
    },
    timeLimitMinutes: 25,
    cpuLimitMilli: 250,
    ramLimitMb: 256,
    storageLimitMb: 256,
    networkPolicy: 'browser_guided_only',
    imageRef: 'kali3977/walkthrough-web:1.0',
    isolationBackend: 'interactive_walkthrough',
    runnerRequired: false,
    verificationRequired: true,
    verificationMode: 'task_assessment',
    verificationTokenHash: hashFlag('LAB-INTERACTIVE-HTTP-101'),
    xpReward: 120,
    enabled: true,
    published: true,
  },
  {
    slug: 'lab-interactive-auth-log-triage',
    category: 'Digital Forensics',
    title: 'SSH Intrusion & Persistence Triage in /var/log/auth.log (Interactive)',
    description:
      'Examine an authentic Linux authentication log snippet to distinguish brute-force noise from the successful attacker compromise and post-exploitation user creation.',
    difficulty: 'Beginner',
    objectivesJson: [
      'Separate failed sshd authentication attempts from Accepted publickey/password events',
      'Identify the exact source IP that gained privileged access',
      'Spot the suspicious persistence user added immediately after compromise',
    ],
    hintsJson: [
      'Look for "Accepted password" rather than "Failed password" lines.',
      'Check useradd / usermod lines sharing timestamps right after login.',
    ],
    walkthroughJson: [
      {
        step: 1,
        title: 'Filter Failed Brute-Force Attempts',
        commandExample: 'grep "Failed password" /var/log/auth.log | awk \'{print $(NF-3)}\' | sort | uniq -c',
        instruction: 'Measure noise volume from scanner IPs to avoid tunnel vision.',
        expectedObservation: '198.51.100.44 generated multiple failed root attempts.',
      },
      {
        step: 2,
        title: 'Locate Successful Authentication Event',
        commandExample: 'grep "Accepted " /var/log/auth.log',
        instruction: 'Find the IP and account that actually succeeded.',
        expectedObservation: '203.0.113.77 authenticated successfully as opsadmin.',
      },
      {
        step: 3,
        title: 'Trace Post-Exploitation Persistence',
        commandExample: 'grep -E "useradd|usermod|sudo" /var/log/auth.log',
        instruction: 'Look for privileged account creation seconds after login.',
        expectedObservation: 'opsadmin invoked sudo useradd svc_backup_adm and added it to sudo group.',
      },
    ],
    assessmentJson: {
      prompt:
        'Based on the /var/log/auth.log evidence, which source IP compromised the host and what persistence account did it add?',
      artifactLabel: '/var/log/auth.log (Excerpt)',
      artifactContent: `Nov 15 04:11:02 bast01 sshd[4102]: Failed password for root from 198.51.100.44 port 55210 ssh2
Nov 15 04:11:04 bast01 sshd[4102]: Failed password for root from 198.51.100.44 port 55210 ssh2
Nov 15 04:12:19 bast01 sshd[4188]: Accepted password for opsadmin from 203.0.113.77 port 49122 ssh2
Nov 15 04:12:41 bast01 sudo[4205]: opsadmin : TTY=pts/1 ; PWD=/home/opsadmin ; USER=root ; COMMAND=/usr/sbin/useradd -m -s /bin/bash svc_backup_adm
Nov 15 04:12:46 bast01 sudo[4211]: opsadmin : TTY=pts/1 ; PWD=/home/opsadmin ; USER=root ; COMMAND=/usr/sbin/usermod -aG sudo svc_backup_adm`,
      options: [
        '198.51.100.44 compromised root and modified /etc/hosts',
        '203.0.113.77 brute-forced root and failed login',
        '203.0.113.77 logged in as opsadmin and added sudo account svc_backup_adm',
        '198.51.100.44 logged in as svc_backup_adm via public key',
      ],
      correctIndex: 2,
      explanation:
        '198.51.100.44 only triggered Failed password events. The real breach came from 203.0.113.77 as opsadmin, which immediately escalated via sudo to create sudo-enabled svc_backup_adm.',
    },
    timeLimitMinutes: 30,
    cpuLimitMilli: 250,
    ramLimitMb: 256,
    storageLimitMb: 256,
    networkPolicy: 'browser_guided_only',
    imageRef: 'kali3977/walkthrough-dfir:1.0',
    isolationBackend: 'interactive_walkthrough',
    runnerRequired: false,
    verificationRequired: true,
    verificationMode: 'task_assessment',
    verificationTokenHash: hashFlag('LAB-INTERACTIVE-AUTH-102'),
    xpReward: 140,
    enabled: true,
    published: true,
  },
  {
    slug: 'lab-interactive-linux-permissions-walkthrough',
    category: 'Linux',
    title: 'Linux File Permissions, Umask & SUID Walkthrough (Guided)',
    description:
      'Master POSIX rwx permission masks, octal mode bits, directory sticky bits, and defensive SUID auditing through a guided step-by-step walkthrough.',
    difficulty: 'Beginner',
    objectivesJson: [
      'Interpret symbolic (rwxr-x---) and octal (0750) permission masks',
      'Lock down sensitive key files with chmod 0600',
      'Audit unnecessary SUID bits using find / -perm -4000',
    ],
    hintsJson: [
      'Octal 4 = read, 2 = write, 1 = execute. Owner/Group/Other map to 3 octal digits.',
    ],
    walkthroughJson: [
      {
        step: 1,
        title: 'Inspect File Mode Bits',
        commandExample: 'ls -la /etc/ssh/ssh_host_*_key',
        instruction: 'Verify that private host keys are readable only by root (0600).',
        expectedObservation: '-rw------- 1 root root ... confirms zero group/world access.',
      },
      {
        step: 2,
        title: 'Restrict Over-Permissive Credential File',
        commandExample: 'chmod 0600 ~/.ssh/id_ed25519 && chmod 0700 ~/.ssh',
        instruction: 'OpenSSH refuses private keys accessible by group or others.',
        expectedObservation: 'Permissions tighten to owner read/write only.',
      },
      {
        step: 3,
        title: 'Audit Setuid Binaries',
        commandExample: 'find /usr/bin -perm -4000 -ls 2>/dev/null',
        instruction: 'Review executables bearing the 4000 (s) special bit that run with owner EUID.',
        expectedObservation: 'Only expected system helpers like sudo/passwd should appear.',
      },
    ],
    assessmentJson: null,
    timeLimitMinutes: 20,
    cpuLimitMilli: 250,
    ramLimitMb: 256,
    storageLimitMb: 256,
    networkPolicy: 'browser_guided_only',
    imageRef: 'kali3977/walkthrough-linux:1.0',
    isolationBackend: 'interactive_walkthrough',
    runnerRequired: false,
    verificationRequired: false,
    verificationMode: 'none',
    verificationTokenHash: hashFlag('LAB-WALKTHROUGH-POSIX-103'),
    xpReward: 100,
    enabled: true,
    published: true,
  },
  {
    slug: 'lab-linux-suid-audit',
    category: 'Linux',
    title: 'POSIX SUID & Privilege Boundary Audit',
    description:
      'Inspect an isolated Debian container for misconfigured SUID binaries and verify least-privilege remediation.',
    difficulty: 'Beginner',
    objectivesJson: [
      'Enumerate SUID executables inside the isolated microVM',
      'Identify non-standard binary with elevated file capabilities',
      'Retrieve the verification token from /root/audit_proof.txt after remediation',
    ],
    hintsJson: ['Use find / -perm -4000 2>/dev/null', 'Check getcap -r /usr/bin 2>/dev/null'],
    walkthroughJson: [
      {
        step: 1,
        title: 'Locate SUID Executables',
        commandExample: 'find / -perm -4000 -type f 2>/dev/null',
        instruction: 'Scan filesystem inside the MicroVM for non-standard root-owned SUID binaries.',
        expectedObservation: 'Identify helper executable outside standard OS baseline.',
      },
      {
        step: 2,
        title: 'Inspect File Capabilities',
        commandExample: 'getcap -r /usr/bin 2>/dev/null',
        instruction: 'Verify Linux capabilities such as cap_setuid or cap_dac_read_search.',
        expectedObservation: 'Confirm capability mismatch enabling privilege boundary bypass.',
      },
    ],
    assessmentJson: null,
    timeLimitMinutes: 45,
    cpuLimitMilli: 500,
    ramLimitMb: 512,
    storageLimitMb: 1024,
    networkPolicy: 'isolated_no_egress',
    imageRef: 'kali3977/lab-linux-suid:1.0',
    isolationBackend: 'microvm_required',
    runnerRequired: true,
    verificationRequired: true,
    verificationMode: 'runner_proof',
    verificationTokenHash: hashFlag('LAB-PROOF-SUID-9941'),
    xpReward: 150,
    enabled: true,
    published: true,
  },
  {
    slug: 'lab-network-pcap-triage',
    category: 'Networking',
    title: 'DNS Tunneling Packet Capture Triage',
    description: 'Analyze captured DNS TXT queries to isolate command-and-control exfiltration domains.',
    difficulty: 'Easy',
    objectivesJson: ['Filter DNS TXT records by query length', 'Decode base32 subdomain chunks'],
    hintsJson: ['Inspect queries longer than 48 characters'],
    walkthroughJson: [
      {
        step: 1,
        title: 'Filter TXT Queries with tshark',
        commandExample: 'tshark -r capture.pcapng -Y "dns.qry.type == 16" -T fields -e dns.qry.name',
        instruction: 'Extract abnormal DNS TXT hostnames.',
        expectedObservation: 'High-entropy subdomain labels exceeding 48 bytes point to tunneling.',
      },
    ],
    assessmentJson: null,
    timeLimitMinutes: 40,
    cpuLimitMilli: 500,
    ramLimitMb: 512,
    storageLimitMb: 1024,
    networkPolicy: 'isolated_no_egress',
    imageRef: 'kali3977/lab-net-pcap:1.0',
    isolationBackend: 'microvm_required',
    runnerRequired: true,
    verificationRequired: true,
    verificationMode: 'runner_proof',
    verificationTokenHash: hashFlag('LAB-PROOF-DNS-4410'),
    xpReward: 180,
    enabled: true,
    published: true,
  },
  {
    slug: 'lab-web-bola-fix',
    category: 'Web Security',
    title: 'API Broken Object Level Authorization Patch',
    description: 'Diagnose an Express route leaking cross-tenant invoices and enforce server-side ownership checks.',
    difficulty: 'Medium',
    objectivesJson: ['Reproduce unauthorized cross-tenant read in sandbox', 'Apply ownership middleware'],
    hintsJson: ['Compare req.user.id against record.ownerId'],
    walkthroughJson: [
      {
        step: 1,
        title: 'Reproduce Cross-Tenant IDOR',
        commandExample: 'curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:4000/api/invoices/1002',
        instruction: 'Check whether a different tenant ID returns another user’s invoice.',
        expectedObservation: '200 OK leaks cross-tenant invoice without ownerId verification.',
      },
    ],
    assessmentJson: null,
    timeLimitMinutes: 60,
    cpuLimitMilli: 1000,
    ramLimitMb: 1024,
    storageLimitMb: 2048,
    networkPolicy: 'isolated_no_egress',
    imageRef: 'kali3977/lab-web-bola:1.0',
    isolationBackend: 'microvm_required',
    runnerRequired: true,
    verificationRequired: true,
    verificationMode: 'runner_proof',
    verificationTokenHash: hashFlag('LAB-PROOF-BOLA-7723'),
    xpReward: 250,
    enabled: true,
    published: true,
  },
  {
    slug: 'lab-crypto-gcm-nonce',
    category: 'Cryptography',
    title: 'AES-GCM Nonce Reuse Recovery Lab',
    description: 'Demonstrate why AES-GCM IV reuse breaks confidentiality and rotate keys safely in the lab harness.',
    difficulty: 'Hard',
    objectivesJson: ['Detect repeated 96-bit nonces in ciphertext corpus', 'Migrate service to random CSPRNG nonces'],
    hintsJson: ['XOR two ciphertexts encrypted with the same key and nonce'],
    walkthroughJson: [
      {
        step: 1,
        title: 'Detect Duplicate Nonces',
        commandExample: 'python3 audit_nonces.py corpus.jsonl',
        instruction: 'Scan 12-byte IV values across captured AES-GCM messages.',
        expectedObservation: 'Repeated 96-bit IV enables keystream XOR recovery.',
      },
    ],
    assessmentJson: null,
    timeLimitMinutes: 60,
    cpuLimitMilli: 500,
    ramLimitMb: 512,
    storageLimitMb: 1024,
    networkPolicy: 'isolated_no_egress',
    imageRef: 'kali3977/lab-crypto-gcm:1.0',
    isolationBackend: 'microvm_required',
    runnerRequired: true,
    verificationRequired: true,
    verificationMode: 'runner_proof',
    verificationTokenHash: hashFlag('LAB-PROOF-GCM-8832'),
    xpReward: 320,
    enabled: true,
    published: true,
  },
  {
    slug: 'lab-dfir-memory-forensics',
    category: 'Digital Forensics',
    title: 'Volatile Memory Process Injection Analysis',
    description: 'Examine a memory snapshot inside a restricted forensics microVM to locate hollowed processes.',
    difficulty: 'Hard',
    objectivesJson: ['Run pslist vs psscan discrepancy check', 'Extract malicious command line arguments'],
    hintsJson: ['Compare parent PIDs against standard Windows services.exe hierarchy'],
    walkthroughJson: [
      {
        step: 1,
        title: 'Run Volatility Process Discrepancy Scan',
        commandExample: 'vol -f memdump.raw windows.pslist && vol -f memdump.raw windows.malfind',
        instruction: 'Detect unlinked processes or RWX private memory regions.',
        expectedObservation: 'Suspicious injected process lacks valid parent hierarchy.',
      },
    ],
    assessmentJson: null,
    timeLimitMinutes: 75,
    cpuLimitMilli: 1000,
    ramLimitMb: 1024,
    storageLimitMb: 4096,
    networkPolicy: 'isolated_no_egress',
    imageRef: 'kali3977/lab-dfir-mem:1.0',
    isolationBackend: 'microvm_required',
    runnerRequired: true,
    verificationRequired: true,
    verificationMode: 'runner_proof',
    verificationTokenHash: hashFlag('LAB-PROOF-DFIR-3109'),
    xpReward: 380,
    enabled: true,
    published: true,
  },
];

export async function syncCyberLabs(): Promise<void> {
  for (const item of CANONICAL_LABS) {
    const [existing] = await db.select().from(labs).where(eq(labs.slug, item.slug)).limit(1);
    if (!existing) {
      await db.insert(labs).values(item);
    } else if (!existing.walkthroughJson || existing.walkthroughJson.length === 0) {
      await db
        .update(labs)
        .set({
          walkthroughJson: item.walkthroughJson,
          assessmentJson: existing.assessmentJson ?? item.assessmentJson,
          runnerRequired: item.runnerRequired,
          verificationMode: existing.verificationMode || item.verificationMode,
          storageLimitMb: item.storageLimitMb,
          networkPolicy: item.networkPolicy,
          imageRef: item.imageRef,
        })
        .where(eq(labs.id, existing.id));
    }
  }

  const [labAch] = await db
    .select()
    .from(achievements)
    .where(eq(achievements.code, 'LAB_PRACTITIONER'))
    .limit(1);
  if (!labAch) {
    await db
      .insert(achievements)
      .values({
        code: 'LAB_PRACTITIONER',
        title: 'Hands-On Lab Practitioner',
        description: 'Completed your first verified cybersecurity lab in KALI3977.',
        category: 'Labs',
        xpBonus: 100,
      })
      .onConflictDoNothing();
  }
}
