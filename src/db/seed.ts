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
  await ensurePlatformSettings();
  await syncGamesArenaSeed();

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

  // 4. Seed Cyber Labs (honest microvm_required markers)
  await db.insert(labs).values([
    {
      slug: 'lab-linux-suid-audit',
      category: 'Linux',
      title: 'POSIX SUID & Privilege Boundary Audit',
      description: 'Inspect an isolated Debian container for misconfigured SUID binaries and verify least-privilege remediation.',
      difficulty: 'Beginner',
      objectivesJson: [
        'Enumerate SUID executables inside the isolated microVM',
        'Identify non-standard binary with elevated file capabilities',
        'Retrieve the verification token from /root/audit_proof.txt after remediation',
      ],
      hintsJson: ['Use find / -perm -4000 2>/dev/null', 'Check getcap -r /usr/bin 2>/dev/null'],
      timeLimitMinutes: 45,
      cpuLimitMilli: 500,
      ramLimitMb: 512,
      isolationBackend: 'microvm_required',
      verificationTokenHash: hashFlag('LAB-PROOF-SUID-9941'),
      xpReward: 150,
    },
    {
      slug: 'lab-network-pcap-triage',
      category: 'Networking',
      title: 'DNS Tunneling Packet Capture Triage',
      description: 'Analyze captured DNS TXT queries to isolate command-and-control exfiltration domains.',
      difficulty: 'Easy',
      objectivesJson: ['Filter DNS TXT records by query length', 'Decode base32 subdomain chunks'],
      hintsJson: ['Inspect queries longer than 48 characters'],
      timeLimitMinutes: 40,
      cpuLimitMilli: 500,
      ramLimitMb: 512,
      isolationBackend: 'microvm_required',
      verificationTokenHash: hashFlag('LAB-PROOF-DNS-4410'),
      xpReward: 180,
    },
    {
      slug: 'lab-web-bola-fix',
      category: 'Web Security',
      title: 'API Broken Object Level Authorization Patch',
      description: 'Diagnose an Express route leaking cross-tenant invoices and enforce server-side ownership checks.',
      difficulty: 'Medium',
      objectivesJson: ['Reproduce unauthorized cross-tenant read in sandbox', 'Apply ownership middleware'],
      hintsJson: ['Compare req.user.id against record.ownerId'],
      timeLimitMinutes: 60,
      cpuLimitMilli: 1000,
      ramLimitMb: 1024,
      isolationBackend: 'microvm_required',
      verificationTokenHash: hashFlag('LAB-PROOF-BOLA-7723'),
      xpReward: 250,
    },
    {
      slug: 'lab-crypto-gcm-nonce',
      category: 'Cryptography',
      title: 'AES-GCM Nonce Reuse Recovery Lab',
      description: 'Demonstrate why AES-GCM IV reuse breaks confidentiality and rotate keys safely in the lab harness.',
      difficulty: 'Hard',
      objectivesJson: ['Detect repeated 96-bit nonces in ciphertext corpus', 'Migrate service to random CSPRNG nonces'],
      hintsJson: ['XOR two ciphertexts encrypted with the same key and nonce'],
      timeLimitMinutes: 60,
      cpuLimitMilli: 500,
      ramLimitMb: 512,
      isolationBackend: 'microvm_required',
      verificationTokenHash: hashFlag('LAB-PROOF-GCM-8832'),
      xpReward: 320,
    },
    {
      slug: 'lab-dfir-memory-forensics',
      category: 'Digital Forensics',
      title: 'Volatile Memory Process Injection Analysis',
      description: 'Examine a memory snapshot inside a restricted forensics microVM to locate hollowed processes.',
      difficulty: 'Hard',
      objectivesJson: ['Run pslist vs psscan discrepancy check', 'Extract malicious command line arguments'],
      hintsJson: ['Compare parent PIDs against standard Windows services.exe hierarchy'],
      timeLimitMinutes: 75,
      cpuLimitMilli: 1000,
      ramLimitMb: 1024,
      isolationBackend: 'microvm_required',
      verificationTokenHash: hashFlag('LAB-PROOF-DFIR-3109'),
      xpReward: 380,
    },
  ]);

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
}
