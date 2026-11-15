import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const campuses = pgTable('campuses', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  country: text('country').notNull(),
  city: text('city').notNull(),
  emailDomain: text('email_domain'),
  verified: boolean('verified').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    username: text('username').notNull().unique(),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    bio: text('bio').notNull().default(''),
    country: text('country').notNull().default('Global'),
    role: text('role').notNull().default('player'),
    permissionsJson: jsonb('permissions_json').$type<{
      scopes?: string[];
      eventIds?: number[];
      expiresAt?: string | null;
    }>().notNull().default({}),
    campusId: integer('campus_id').references(() => campuses.id),
    campusVerificationStatus: text('campus_verification_status').notNull().default('unverified'),
    campusVerificationMethod: text('campus_verification_method'),
    xp: integer('xp').notNull().default(0),
    level: integer('level').notNull().default(1),
    ctfPoints: integer('ctf_points').notNull().default(0),
    dailyStreak: integer('daily_streak').notNull().default(0),
    lastActiveDate: text('last_active_date'),
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    mfaSecret: text('mfa_secret'),
    isSuspended: boolean('is_suspended').notNull().default(false),
    isBanned: boolean('is_banned').notNull().default(false),
    suspensionReason: text('suspension_reason'),
    profileVisibility: text('profile_visibility').notNull().default('public'),
    preferredLang: text('preferred_lang').notNull().default('en'),
    policyAcknowledgedAt: timestamp('policy_acknowledged_at'),
    notificationPrefsJson: jsonb('notification_prefs_json')
      .$type<{
        competitions: boolean;
        teamChat: boolean;
        securityAlerts: boolean;
        achievements: boolean;
      }>()
      .notNull()
      .default({
        competitions: true,
        teamChat: true,
        securityAlerts: true,
        achievements: true,
      }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('users_role_idx').on(table.role), index('users_xp_idx').on(table.xp)],
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull().unique(),
    userAgent: text('user_agent').notNull().default('Unknown'),
    ipAddress: text('ip_address').notNull().default('0.0.0.0'),
    mfaVerified: boolean('mfa_verified').notNull().default(false),
    revoked: boolean('revoked').notNull().default(false),
    expiresAt: timestamp('expires_at').notNull(),
    lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('user_sessions_user_idx').on(table.userId)],
);

export const loginHistory = pgTable(
  'login_history',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ipAddress: text('ip_address').notNull().default('0.0.0.0'),
    userAgent: text('user_agent').notNull().default('Unknown'),
    status: text('status').notNull().default('success'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('login_history_user_idx').on(table.userId)],
);

export const competitions = pgTable(
  'competitions',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    gameMode: text('game_mode').notNull().default('ctf_battle'),
    status: text('status').notNull().default('registration_open'),
    visibility: text('visibility').notNull().default('public'),
    difficulty: text('difficulty').notNull().default('Medium'),
    scoringSystem: text('scoring_system').notNull().default('dynamic'),
    enrollmentPolicy: text('enrollment_policy').notNull().default('shared_team_code'),
    totalCapacity: integer('total_capacity').notNull().default(150),
    perTeamCapacity: integer('per_team_capacity').notNull().default(30),
    maxTeams: integer('max_teams').notNull().default(5),
    penaltyPerWrongFlag: integer('penalty_per_wrong_flag').notNull().default(0),
    hintsEnabled: boolean('hints_enabled').notNull().default(true),
    allowLateJoin: boolean('allow_late_join').notNull().default(true),
    allowReconnection: boolean('allow_reconnection').notNull().default(true),
    rulesLocked: boolean('rules_locked').notNull().default(false),
    rulesSnapshotJson: jsonb('rules_snapshot_json').$type<Record<string, unknown> | null>(),
    startsAt: timestamp('starts_at').notNull(),
    endsAt: timestamp('ends_at').notNull(),
    registrationDeadline: timestamp('registration_deadline'),
    durationMinutes: integer('duration_minutes').notNull().default(180),
    rulesText: text('rules_text').notNull().default(''),
    resultsPublished: boolean('results_published').notNull().default(false),
    createdById: integer('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('competitions_status_idx').on(table.status)],
);

export const rooms = pgTable(
  'rooms',
  {
    id: serial('id').primaryKey(),
    competitionId: integer('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    roomCode: text('room_code').notNull().unique(),
    isActive: boolean('is_active').notNull().default(true),
    isLocked: boolean('is_locked').notNull().default(false),
    maxParticipants: integer('max_participants').notNull().default(150),
    usageCount: integer('usage_count').notNull().default(0),
    usageLimit: integer('usage_limit'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('rooms_competition_idx').on(table.competitionId)],
);

export const teams = pgTable(
  'teams',
  {
    id: serial('id').primaryKey(),
    competitionId: integer('competition_id').references(() => competitions.id, {
      onDelete: 'set null',
    }),
    campusId: integer('campus_id').references(() => campuses.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    teamCode: text('team_code').notNull().unique(),
    logoUrl: text('logo_url'),
    captainId: integer('captain_id').references(() => users.id, { onDelete: 'set null' }),
    deputyCaptainId: integer('deputy_captain_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    maxMembers: integer('max_members').notNull().default(30),
    score: integer('score').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    isSuspended: boolean('is_suspended').notNull().default(false),
    codeExpiresAt: timestamp('code_expires_at'),
    codeUsageLimit: integer('code_usage_limit'),
    codeUsageCount: integer('code_usage_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('teams_competition_idx').on(table.competitionId)],
);

export const teamMembers = pgTable(
  'team_members',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    competitionId: integer('competition_id').references(() => competitions.id, {
      onDelete: 'cascade',
    }),
    roleInTeam: text('role_in_team').notNull().default('member'),
    isMutedInChat: boolean('is_muted_in_chat').notNull().default(false),
    removalStatus: text('removal_status').notNull().default('active'),
    removalReason: text('removal_reason'),
    removalExpiresAt: timestamp('removal_expires_at'),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('team_members_team_user_idx').on(table.teamId, table.userId),
    index('team_members_user_idx').on(table.userId),
  ],
);

export const roomParticipations = pgTable(
  'room_participations',
  {
    id: serial('id').primaryKey(),
    roomId: integer('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    competitionId: integer('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('active'),
    removalReason: text('removal_reason'),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('room_part_comp_user_idx').on(table.competitionId, table.userId),
    index('room_part_room_idx').on(table.roomId),
  ],
);

export const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  stage: integer('stage').notNull(),
  stageTitle: text('stage_title').notNull(),
  subjectArea: text('subject_area').notNull().default('Cybersecurity'),
  adaptiveLevel: text('adaptive_level').notNull().default('Beginner'),
  titleEn: text('title_en').notNull(),
  titleHi: text('title_hi').notNull(),
  summaryEn: text('summary_en').notNull(),
  summaryHi: text('summary_hi').notNull(),
  difficulty: text('difficulty').notNull().default('Beginner'),
  prerequisiteSlug: text('prerequisite_slug'),
  prerequisitesJson: jsonb('prerequisites_json').$type<string[]>().notNull().default([]),
  learningObjectivesJson: jsonb('learning_objectives_json').$type<string[]>().notNull().default([]),
  referencesJson: jsonb('references_json')
    .$type<Array<{ title: string; url: string; source: string }>>()
    .notNull()
    .default([]),
  caseStudyText: text('case_study_text').notNull().default(''),
  projectBrief: text('project_brief').notNull().default(''),
  estimatedMinutes: integer('estimated_minutes').notNull().default(45),
  published: boolean('published').notNull().default(true),
  orderIndex: integer('order_index').notNull().default(1),
  licenseType: text('license_type').notNull().default('© 2026 KALI3977 — All Rights Reserved (Personal Educational Use)'),
  contentVersion: text('content_version').notNull().default('v1.0.0'),
  provenanceAuthor: text('provenance_author').notNull().default('KALI3977 Curriculum Team'),
  attributionText: text('attribution_text').notNull().default('Original curriculum by KALI3977; third-party standards and documentation credited separately.'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const lessons = pgTable(
  'lessons',
  {
    id: serial('id').primaryKey(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    moduleTitle: text('module_title').notNull().default('Core Concepts'),
    titleEn: text('title_en').notNull(),
    titleHi: text('title_hi').notNull(),
    contentEn: text('content_en').notNull(),
    contentHi: text('content_hi').notNull(),
    practicalExample: text('practical_example').notNull().default(''),
    diagramSpec: text('diagram_spec').notNull().default(''),
    exercisesText: text('exercises_text').notNull().default(''),
    revisionSummary: text('revision_summary').notNull().default(''),
    quizJson: jsonb('quiz_json')
      .$type<{
        question: string;
        options: string[];
        correctIndex: number;
        explanation: string;
      }>()
      .notNull(),
    orderIndex: integer('order_index').notNull().default(1),
    published: boolean('published').notNull().default(true),
  },
  (table) => [index('lessons_course_idx').on(table.courseId)],
);

export const userLessonProgress = pgTable(
  'user_lesson_progress',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lessonId: integer('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    completed: boolean('completed').notNull().default(false),
    quizScore: integer('quiz_score').notNull().default(0),
    bookmarked: boolean('bookmarked').notNull().default(false),
    notes: text('notes').notNull().default(''),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('user_lesson_unique_idx').on(table.userId, table.lessonId)],
);

export const labs = pgTable('labs', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  category: text('category').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  difficulty: text('difficulty').notNull(),
  objectivesJson: jsonb('objectives_json').$type<string[]>().notNull().default([]),
  hintsJson: jsonb('hints_json').$type<string[]>().notNull().default([]),
  walkthroughJson: jsonb('walkthrough_json')
    .$type<
      Array<{
        step: number;
        title: string;
        commandExample: string;
        instruction: string;
        expectedObservation: string;
      }>
    >()
    .notNull()
    .default([]),
  assessmentJson: jsonb('assessment_json').$type<{
    prompt: string;
    artifactLabel: string;
    artifactContent: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  } | null>(),
  timeLimitMinutes: integer('time_limit_minutes').notNull().default(45),
  cpuLimitMilli: integer('cpu_limit_milli').notNull().default(500),
  ramLimitMb: integer('ram_limit_mb').notNull().default(512),
  storageLimitMb: integer('storage_limit_mb').notNull().default(1024),
  networkPolicy: text('network_policy').notNull().default('isolated_no_egress'),
  imageRef: text('image_ref').notNull().default('kali3977/sandbox-base:1.0'),
  isolationBackend: text('isolation_backend').notNull().default('microvm_required'),
  runnerRequired: boolean('runner_required').notNull().default(false),
  verificationRequired: boolean('verification_required').notNull().default(true),
  verificationMode: text('verification_mode').notNull().default('proof_token'),
  verificationTokenHash: text('verification_token_hash').notNull(),
  xpReward: integer('xp_reward').notNull().default(150),
  enabled: boolean('enabled').notNull().default(true),
  published: boolean('published').notNull().default(true),
});

export const labSessions = pgTable(
  'lab_sessions',
  {
    id: serial('id').primaryKey(),
    sessionUuid: text('session_uuid').notNull().default(''),
    labId: integer('lab_id')
      .notNull()
      .references(() => labs.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('provision_required'),
    verified: boolean('verified').notNull().default(false),
    xpAwarded: boolean('xp_awarded').notNull().default(false),
    xpAwardedAt: timestamp('xp_awarded_at'),
    runnerInstanceId: text('runner_instance_id'),
    failureReason: text('failure_reason'),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'),
    completedAt: timestamp('completed_at'),
    terminatedAt: timestamp('terminated_at'),
    resetCount: integer('reset_count').notNull().default(0),
  },
  (table) => [
    index('lab_sessions_user_idx').on(table.userId),
    index('lab_sessions_user_lab_idx').on(table.userId, table.labId),
  ],
);

export const ctfChallenges = pgTable(
  'ctf_challenges',
  {
    id: serial('id').primaryKey(),
    competitionId: integer('competition_id').references(() => competitions.id, {
      onDelete: 'set null',
    }),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    category: text('category').notNull(),
    difficulty: text('difficulty').notNull(),
    description: text('description').notNull(),
    basePoints: integer('base_points').notNull().default(200),
    currentPoints: integer('current_points').notNull().default(200),
    scoringMode: text('scoring_mode').notNull().default('dynamic'),
    flagHash: text('flag_hash').notNull(),
    hintsJson: jsonb('hints_json').$type<string[]>().notNull().default([]),
    learningObjectivesJson: jsonb('learning_objectives_json').$type<string[]>().notNull().default([]),
    relatedCourseSlug: text('related_course_slug'),
    relatedBookTitle: text('related_book_title'),
    referenceUrl: text('reference_url'),
    flagFormat: text('flag_format').notNull().default('KALI3977{...}'),
    unlockAfterSlug: text('unlock_after_slug'),
    explanationAfterSolve: text('explanation_after_solve').notNull().default(''),
    attachmentName: text('attachment_name'),
    attachmentContent: text('attachment_content'),
    solveCount: integer('solve_count').notNull().default(0),
    published: boolean('published').notNull().default(true),
    licenseType: text('license_type').notNull().default('© 2026 KALI3977 — Original Challenge Material (Educational Use Only)'),
    contentVersion: text('content_version').notNull().default('v1.0.0'),
    provenanceAuthor: text('provenance_author').notNull().default('KALI3977 Security Engineering'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('ctf_category_idx').on(table.category)],
);

export const ctfBookmarks = pgTable(
  'ctf_bookmarks',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    challengeId: integer('challenge_id')
      .notNull()
      .references(() => ctfChallenges.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('ctf_bookmark_unique_idx').on(table.userId, table.challengeId)],
);

export const ctfSubmissions = pgTable(
  'ctf_submissions',
  {
    id: serial('id').primaryKey(),
    challengeId: integer('challenge_id')
      .notNull()
      .references(() => ctfChallenges.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    teamId: integer('team_id').references(() => teams.id, { onDelete: 'set null' }),
    competitionId: integer('competition_id').references(() => competitions.id, {
      onDelete: 'set null',
    }),
    submittedFlagMasked: text('submitted_flag_masked').notNull(),
    isCorrect: boolean('is_correct').notNull().default(false),
    pointsAwarded: integer('points_awarded').notNull().default(0),
    ipAddress: text('ip_address'),
    suspicionScore: integer('suspicion_score').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('ctf_sub_user_idx').on(table.userId),
    index('ctf_sub_challenge_idx').on(table.challengeId),
  ],
);

export const chatChannels = pgTable(
  'chat_channels',
  {
    id: serial('id').primaryKey(),
    competitionId: integer('competition_id').references(() => competitions.id, {
      onDelete: 'cascade',
    }),
    teamId: integer('team_id').references(() => teams.id, { onDelete: 'cascade' }),
    channelType: text('channel_type').notNull(),
    name: text('name').notNull(),
    isEnabled: boolean('is_enabled').notNull().default(true),
    fileSharingEnabled: boolean('file_sharing_enabled').notNull().default(false),
    voiceEnabled: boolean('voice_enabled').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('chat_channels_comp_idx').on(table.competitionId)],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: serial('id').primaryKey(),
    channelId: integer('channel_id')
      .notNull()
      .references(() => chatChannels.id, { onDelete: 'cascade' }),
    senderId: integer('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    replyToId: integer('reply_to_id'),
    reactionsJson: jsonb('reactions_json').$type<Record<string, number>>().notNull().default({}),
    isPinned: boolean('is_pinned').notNull().default(false),
    isReported: boolean('is_reported').notNull().default(false),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('chat_messages_channel_idx').on(table.channelId)],
);

export const tournaments = pgTable('tournaments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  format: text('format').notNull().default('knockout'),
  recurrence: text('recurrence').notNull().default('seasonal'),
  status: text('status').notNull().default('registration_open'),
  maxTeams: integer('max_teams').notNull().default(16),
  teamSize: integer('team_size').notNull().default(5),
  registrationDeadline: timestamp('registration_deadline'),
  startsAt: timestamp('starts_at').notNull(),
  bracketsJson: jsonb('brackets_json').$type<Record<string, unknown>>().notNull().default({}),
  moderatorIdsJson: jsonb('moderator_ids_json').$type<number[]>().notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const tournamentRegistrations = pgTable(
  'tournament_registrations',
  {
    id: serial('id').primaryKey(),
    tournamentId: integer('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    campusId: integer('campus_id').references(() => campuses.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('confirmed'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('tournament_reg_unique_idx').on(table.tournamentId, table.teamId),
  ],
);

export const communityPosts = pgTable('community_posts', {
  id: serial('id').primaryKey(),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  topic: text('topic').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  upvotes: integer('upvotes').notNull().default(0),
  isAnnouncement: boolean('is_announcement').notNull().default(false),
  isReported: boolean('is_reported').notNull().default(false),
  isDeleted: boolean('is_deleted').notNull().default(false),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const communityReplies = pgTable(
  'community_replies',
  {
    id: serial('id').primaryKey(),
    postId: integer('post_id')
      .notNull()
      .references(() => communityPosts.id, { onDelete: 'cascade' }),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('community_replies_post_idx').on(table.postId)],
);

export const campusVerificationRequests = pgTable(
  'campus_verification_requests',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    campusId: integer('campus_id')
      .notNull()
      .references(() => campuses.id, { onDelete: 'cascade' }),
    method: text('method').notNull().default('organizer_approval'),
    evidenceText: text('evidence_text').notNull().default(''),
    status: text('status').notNull().default('pending'),
    reviewedById: integer('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),
    reviewNote: text('review_note'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at'),
  },
  (table) => [index('campus_verif_user_idx').on(table.userId)],
);

export const achievements = pgTable('achievements', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  xpBonus: integer('xp_bonus').notNull().default(100),
});

export const userAchievements = pgTable(
  'user_achievements',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    achievementId: integer('achievement_id')
      .notNull()
      .references(() => achievements.id, { onDelete: 'cascade' }),
    earnedAt: timestamp('earned_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('user_achievement_unique_idx').on(table.userId, table.achievementId)],
);

export const certificates = pgTable('certificates', {
  id: serial('id').primaryKey(),
  verificationId: text('verification_id').notNull().unique(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  category: text('category').notNull(),
  issuer: text('issuer').notNull().default('KALI3977 Academy'),
  sourceType: text('source_type').notNull(),
  sourceId: integer('source_id').notNull(),
  isRevoked: boolean('is_revoked').notNull().default(false),
  revokedReason: text('revoked_reason'),
  issuedAt: timestamp('issued_at').notNull().defaultNow(),
});

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('notifications_user_idx').on(table.userId)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    previousStateJson: jsonb('previous_state_json').$type<Record<string, unknown> | null>(),
    newStateJson: jsonb('new_state_json').$type<Record<string, unknown> | null>(),
    roomId: integer('room_id'),
    competitionId: integer('competition_id'),
    success: boolean('success').notNull().default(true),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('audit_logs_created_idx').on(table.createdAt)],
);

export const securityReports = pgTable('security_reports', {
  id: serial('id').primaryKey(),
  reporterId: integer('reporter_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  targetType: text('target_type').notNull(),
  targetId: integer('target_id').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull().default('open'),
  reviewedById: integer('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),
  resolutionNote: text('resolution_note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const aiUsageRecords = pgTable(
  'ai_usage_records',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mode: text('mode').notNull(),
    language: text('language').notNull().default('en'),
    promptSummary: text('prompt_summary').notNull(),
    tokensEstimated: integer('tokens_estimated').notNull().default(0),
    model: text('model').notNull().default('gemini-4-hydrogen'),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    responseTokens: integer('response_tokens').notNull().default(0),
    thinkingTokens: integer('thinking_tokens').notNull().default(0),
    estimatedCostMicroUsd: integer('estimated_cost_micro_usd').notNull().default(0),
    costIsEstimated: boolean('cost_is_estimated').notNull().default(true),
    status: text('status').notNull().default('completed'),
    dayKey: text('day_key').notNull().default(''),
    monthKey: text('month_key').notNull().default(''),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('ai_usage_user_idx').on(table.userId),
    index('ai_usage_month_idx').on(table.monthKey),
  ],
);

export const aiMentorConfig = pgTable('ai_mentor_config', {
  id: integer('id').primaryKey().default(1),
  enabled: boolean('enabled').notNull().default(true),
  dailyUserLimit: integer('daily_user_limit').notNull().default(20),
  monthlyUserLimit: integer('monthly_user_limit').notNull().default(300),
  maxPromptTokens: integer('max_prompt_tokens').notNull().default(4000),
  maxResponseTokens: integer('max_response_tokens').notNull().default(1500),
  cooldownSeconds: integer('cooldown_seconds').notNull().default(3),
  monthlyBudgetMicroUsd: integer('monthly_budget_micro_usd').notNull().default(20000000),
  budgetHalted: boolean('budget_halted').notNull().default(false),
  haltedReason: text('halted_reason'),
  haltedMonthKey: text('halted_month_key'),
  overrideMonthKey: text('override_month_key'),
  updatedById: integer('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const aiMentorUserCounters = pgTable('ai_mentor_user_counters', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  dayKey: text('day_key').notNull().default(''),
  dailyCount: integer('daily_count').notNull().default(0),
  monthKey: text('month_key').notNull().default(''),
  monthlyCount: integer('monthly_count').notNull().default(0),
  dailyTokens: integer('daily_tokens').notNull().default(0),
  monthlyTokens: integer('monthly_tokens').notNull().default(0),
  monthlyEstimatedCostMicroUsd: integer('monthly_estimated_cost_micro_usd').notNull().default(0),
  lastRequestAt: timestamp('last_request_at'),
  activeRequestId: text('active_request_id'),
  activeStartedAt: timestamp('active_started_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const aiMentorMonthlyLedger = pgTable('ai_mentor_monthly_ledger', {
  monthKey: text('month_key').primaryKey(),
  totalRequests: integer('total_requests').notNull().default(0),
  totalPromptTokens: integer('total_prompt_tokens').notNull().default(0),
  totalResponseTokens: integer('total_response_tokens').notNull().default(0),
  totalThinkingTokens: integer('total_thinking_tokens').notNull().default(0),
  spentMicroUsd: integer('spent_micro_usd').notNull().default(0),
  reservedMicroUsd: integer('reserved_micro_usd').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const platformSettings = pgTable('platform_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  valueJson: jsonb('value_json').$type<Record<string, unknown>>().notNull(),
  updatedById: integer('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const books = pgTable(
  'books',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    author: text('author').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    difficulty: text('difficulty').notNull().default('Beginner'),
    language: text('language').notNull().default('English'),
    publisher: text('publisher').notNull().default('Open Educational Resource'),
    publicationYear: integer('publication_year').notNull().default(2024),
    isbnOrId: text('isbn_or_id').notNull().default('OPEN-ACCESS'),
    licenseType: text('license_type').notNull().default('Open Access'),
    isFree: boolean('is_free').notNull().default(true),
    canReadOnline: boolean('can_read_online').notNull().default(true),
    canDownload: boolean('can_download').notNull().default(false),
    officialUrl: text('official_url').notNull(),
    coverAccent: text('cover_accent').notNull().default('emerald'),
    readableChaptersJson: jsonb('readable_chapters_json')
      .$type<Array<{ title: string; summary: string; content: string }>>()
      .notNull()
      .default([]),
    status: text('status').notNull().default('published'),
    createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('books_category_idx').on(table.category)],
);

export const userBookProgress = pgTable(
  'user_book_progress',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookId: integer('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    bookmarked: boolean('bookmarked').notNull().default(false),
    inReadingList: boolean('in_reading_list').notNull().default(false),
    progressPct: integer('progress_pct').notNull().default(0),
    lastChapterIndex: integer('last_chapter_index').notNull().default(0),
    notes: text('notes').notNull().default(''),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('user_book_unique_idx').on(table.userId, table.bookId)],
);

export const diagnosticAssessments = pgTable('diagnostic_assessments', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  subjectArea: text('subject_area').notNull(),
  description: text('description').notNull(),
  questionsJson: jsonb('questions_json')
    .$type<
      Array<{
        id: string;
        prompt: string;
        options: string[];
        correctIndex: number;
        weight: number;
        explanation: string;
      }>
    >()
    .notNull()
    .default([]),
  published: boolean('published').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const userSkillAssessments = pgTable(
  'user_skill_assessments',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectArea: text('subject_area').notNull(),
    verifiedLevel: text('verified_level').notNull(),
    scorePct: integer('score_pct').notNull().default(0),
    skippedCourseSlugsJson: jsonb('skipped_course_slugs_json').$type<string[]>().notNull().default([]),
    completedAt: timestamp('completed_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('user_skill_subject_idx').on(table.userId, table.subjectArea)],
);

export const teamInvitations = pgTable(
  'team_invitations',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    invitedUserId: integer('invited_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    invitedByUserId: integer('invited_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('team_inv_user_idx').on(table.invitedUserId)],
);

export const disciplinaryAppeals = pgTable(
  'disciplinary_appeals',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    targetId: integer('target_id'),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('open'),
    adminNote: text('admin_note'),
    reviewedById: integer('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at'),
  },
  (table) => [index('appeals_user_idx').on(table.userId)],
);

export const ipViolationReports = pgTable(
  'ip_violation_reports',
  {
    id: serial('id').primaryKey(),
    referenceCode: text('reference_code').notNull().unique(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    reportType: text('report_type').notNull(),
    targetType: text('target_type').notNull(),
    targetRef: text('target_ref').notNull(),
    reporterName: text('reporter_name').notNull(),
    reporterEmail: text('reporter_email').notNull(),
    organization: text('organization').notNull().default(''),
    description: text('description').notNull(),
    evidenceUrl: text('evidence_url'),
    counterNoticeText: text('counter_notice_text'),
    status: text('status').notNull().default('open'),
    adminResolutionNote: text('admin_resolution_note'),
    reviewedById: integer('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('ip_reports_status_idx').on(table.status)],
);

// =========================================================================
// GAMES ARENA SCHEMA (Modular Real-Time Gaming & Progression System)
// =========================================================================

export const gameCategories = pgTable('game_categories', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  accentColor: text('accent_color').notNull().default('emerald'),
  orderIndex: integer('order_index').notNull().default(1),
});

export const games = pgTable(
  'games',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => gameCategories.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    tagline: text('tagline').notNull(),
    description: text('description').notNull(),
    instructions: text('instructions').notNull(),
    engineType: text('engine_type').notNull(),
    difficulty: text('difficulty').notNull().default('Medium'),
    minPlayers: integer('min_players').notNull().default(1),
    maxPlayers: integer('max_players').notNull().default(8),
    supportedModesJson: jsonb('supported_modes_json').$type<string[]>().notNull().default(['solo', 'free_for_all']),
    scoringConfigJson: jsonb('scoring_config_json')
      .$type<{
        baseXp: number;
        winXpBonus: number;
        baseCoins: number;
        winCoinsBonus: number;
        timeBonusMax: number;
      }>()
      .notNull(),
    durationSeconds: integer('duration_seconds').notNull().default(300),
    isFeatured: boolean('is_featured').notNull().default(false),
    isEnabled: boolean('is_enabled').notNull().default(true),
    isPublished: boolean('is_published').notNull().default(true),
    playCount: integer('play_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('games_category_idx').on(table.categoryId)],
);

export const gamePlayerProfiles = pgTable('game_player_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  gameXp: integer('game_xp').notNull().default(0),
  gameLevel: integer('game_level').notNull().default(1),
  gameCoins: integer('game_coins').notNull().default(100),
  matchesPlayed: integer('matches_played').notNull().default(0),
  matchesWon: integer('matches_won').notNull().default(0),
  winStreak: integer('win_streak').notNull().default(0),
  bestWinStreak: integer('best_win_streak').notNull().default(0),
  equippedBadge: text('equipped_badge').notNull().default('Rookie Operator'),
  equippedCosmetic: text('equipped_cosmetic').notNull().default('emerald-grid'),
  unlockedCosmeticsJson: jsonb('unlocked_cosmetics_json').$type<string[]>().notNull().default(['emerald-grid']),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const gameFriendships = pgTable(
  'game_friendships',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    friendUserId: integer('friend_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('accepted'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('game_friendship_pair_idx').on(table.userId, table.friendUserId)],
);

export const gameRooms = pgTable(
  'game_rooms',
  {
    id: serial('id').primaryKey(),
    roomCode: text('room_code').notNull().unique(),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    competitionId: integer('competition_id').references(() => competitions.id, { onDelete: 'set null' }),
    hostUserId: integer('host_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    mode: text('mode').notNull().default('free_for_all'),
    visibility: text('visibility').notNull().default('public'),
    requiresTeamCode: boolean('requires_team_code').notNull().default(false),
    isLocked: boolean('is_locked').notNull().default(false),
    status: text('status').notNull().default('waiting'),
    registrationOpen: boolean('registration_open').notNull().default(true),
    maxPlayers: integer('max_players').notNull().default(8),
    usageCount: integer('usage_count').notNull().default(0),
    usageLimit: integer('usage_limit'),
    durationSeconds: integer('duration_seconds').notNull().default(300),
    rulesSnapshotJson: jsonb('rules_snapshot_json').$type<Record<string, unknown>>().notNull().default({}),
    expiresAt: timestamp('expires_at'),
    startedAt: timestamp('started_at'),
    endedAt: timestamp('ended_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('game_rooms_game_idx').on(table.gameId),
    index('game_rooms_status_idx').on(table.status),
  ],
);

export const gameTeams = pgTable(
  'game_teams',
  {
    id: serial('id').primaryKey(),
    roomId: integer('room_id').references(() => gameRooms.id, { onDelete: 'cascade' }),
    linkedTeamId: integer('linked_team_id').references(() => teams.id, { onDelete: 'set null' }),
    campusId: integer('campus_id').references(() => campuses.id, { onDelete: 'set null' }),
    teamCode: text('team_code').notNull().unique(),
    name: text('name').notNull(),
    side: text('side').notNull().default('alpha'),
    score: integer('score').notNull().default(0),
    maxMembers: integer('max_members').notNull().default(10),
    isActive: boolean('is_active').notNull().default(true),
    isSuspended: boolean('is_suspended').notNull().default(false),
    codeUsageCount: integer('code_usage_count').notNull().default(0),
    codeUsageLimit: integer('code_usage_limit'),
    codeExpiresAt: timestamp('code_expires_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('game_teams_room_idx').on(table.roomId)],
);

export const gamePlayers = pgTable(
  'game_players',
  {
    id: serial('id').primaryKey(),
    roomId: integer('room_id')
      .notNull()
      .references(() => gameRooms.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameTeamId: integer('game_team_id').references(() => gameTeams.id, { onDelete: 'set null' }),
    side: text('side').notNull().default('solo'),
    roleInGame: text('role_in_game').notNull().default('player'),
    ready: boolean('ready').notNull().default(false),
    connected: boolean('connected').notNull().default(true),
    status: text('status').notNull().default('active'),
    score: integer('score').notNull().default(0),
    accuracyPct: integer('accuracy_pct').notNull().default(100),
    actionsCount: integer('actions_count').notNull().default(0),
    reconnectToken: text('reconnect_token').notNull(),
    lastHeartbeatAt: timestamp('last_heartbeat_at').notNull().defaultNow(),
    disconnectedAt: timestamp('disconnected_at'),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('game_players_room_user_idx').on(table.roomId, table.userId),
    index('game_players_user_idx').on(table.userId),
  ],
);

export const gameInvitations = pgTable(
  'game_invitations',
  {
    id: serial('id').primaryKey(),
    roomId: integer('room_id')
      .notNull()
      .references(() => gameRooms.id, { onDelete: 'cascade' }),
    invitedUserId: integer('invited_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    invitedByUserId: integer('invited_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('game_invites_user_idx').on(table.invitedUserId)],
);

export const gameSessions = pgTable(
  'game_sessions',
  {
    id: serial('id').primaryKey(),
    roomId: integer('room_id')
      .notNull()
      .references(() => gameRooms.id, { onDelete: 'cascade' }),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('active'),
    phase: text('phase').notNull().default('play'),
    roundNumber: integer('round_number').notNull().default(1),
    maxRounds: integer('max_rounds').notNull().default(3),
    phaseEndsAt: timestamp('phase_ends_at'),
    seed: text('seed').notNull(),
    stateJson: jsonb('state_json').$type<Record<string, unknown>>().notNull().default({}),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    endedAt: timestamp('ended_at'),
  },
  (table) => [index('game_sessions_room_idx').on(table.roomId)],
);

export const gameEvents = pgTable(
  'game_events',
  {
    id: serial('id').primaryKey(),
    roomId: integer('room_id')
      .notNull()
      .references(() => gameRooms.id, { onDelete: 'cascade' }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => gameSessions.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientEventId: text('client_event_id').notNull(),
    eventType: text('event_type').notNull(),
    payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().notNull().default({}),
    pointsAwarded: integer('points_awarded').notNull().default(0),
    isValid: boolean('is_valid').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('game_events_idempotency_idx').on(table.roomId, table.clientEventId),
    index('game_events_session_idx').on(table.sessionId),
  ],
);

export const gameResults = pgTable(
  'game_results',
  {
    id: serial('id').primaryKey(),
    roomId: integer('room_id')
      .notNull()
      .references(() => gameRooms.id, { onDelete: 'cascade' }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => gameSessions.id, { onDelete: 'cascade' }),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gameTeamId: integer('game_team_id').references(() => gameTeams.id, { onDelete: 'set null' }),
    placement: integer('placement').notNull().default(1),
    finalScore: integer('final_score').notNull().default(0),
    accuracyPct: integer('accuracy_pct').notNull().default(100),
    xpAwarded: integer('xp_awarded').notNull().default(0),
    coinsAwarded: integer('coins_awarded').notNull().default(0),
    won: boolean('won').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('game_results_session_user_idx').on(table.sessionId, table.userId),
    index('game_results_game_idx').on(table.gameId),
    index('game_results_user_idx').on(table.userId),
  ],
);

export const gameRewards = pgTable(
  'game_rewards',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    xpDelta: integer('xp_delta').notNull().default(0),
    coinsDelta: integer('coins_delta').notNull().default(0),
    cosmeticUnlocked: text('cosmetic_unlocked'),
    description: text('description').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('game_rewards_user_idx').on(table.userId)],
);

export const gameAchievements = pgTable('game_achievements', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  xpBonus: integer('xp_bonus').notNull().default(75),
  coinsBonus: integer('coins_bonus').notNull().default(50),
  badgeTier: text('badge_tier').notNull().default('bronze'),
});

export const userGameAchievements = pgTable(
  'user_game_achievements',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    achievementId: integer('achievement_id')
      .notNull()
      .references(() => gameAchievements.id, { onDelete: 'cascade' }),
    earnedAt: timestamp('earned_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('user_game_ach_unique_idx').on(table.userId, table.achievementId)],
);

export const gameMissions = pgTable('game_missions', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  cadence: text('cadence').notNull().default('daily'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  targetMetric: text('target_metric').notNull(),
  targetValue: integer('target_value').notNull().default(1),
  xpReward: integer('xp_reward').notNull().default(100),
  coinsReward: integer('coins_reward').notNull().default(60),
  isActive: boolean('is_active').notNull().default(true),
});

export const userGameMissions = pgTable(
  'user_game_missions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    missionId: integer('mission_id')
      .notNull()
      .references(() => gameMissions.id, { onDelete: 'cascade' }),
    periodKey: text('period_key').notNull(),
    progress: integer('progress').notNull().default(0),
    completed: boolean('completed').notNull().default(false),
    claimed: boolean('claimed').notNull().default(false),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_game_mission_period_idx').on(table.userId, table.missionId, table.periodKey),
  ],
);

export const gameTournaments = pgTable('game_tournaments', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  format: text('format').notNull().default('single_elimination'),
  mode: text('mode').notNull().default('1v1'),
  status: text('status').notNull().default('registration_open'),
  maxParticipants: integer('max_participants').notNull().default(16),
  entryMinLevel: integer('entry_min_level').notNull().default(1),
  rewardCoinsPool: integer('reward_coins_pool').notNull().default(1000),
  bracketsJson: jsonb('brackets_json').$type<Record<string, unknown>>().notNull().default({}),
  startsAt: timestamp('starts_at').notNull(),
  createdById: integer('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const gameTournamentParticipants = pgTable(
  'game_tournament_participants',
  {
    id: serial('id').primaryKey(),
    tournamentId: integer('tournament_id')
      .notNull()
      .references(() => gameTournaments.id, { onDelete: 'cascade' }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    gameTeamId: integer('game_team_id').references(() => gameTeams.id, { onDelete: 'cascade' }),
    campusId: integer('campus_id').references(() => campuses.id, { onDelete: 'set null' }),
    displayName: text('display_name').notNull(),
    seedNumber: integer('seed_number').notNull().default(1),
    eliminated: boolean('eliminated').notNull().default(false),
    points: integer('points').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('game_tourn_part_idx').on(table.tournamentId)],
);

export const gameAdminLogs = pgTable(
  'game_admin_logs',
  {
    id: serial('id').primaryKey(),
    actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    detailsJson: jsonb('details_json').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('game_admin_logs_created_idx').on(table.createdAt)],
);

// =========================================================================
// GLOBAL SECTION MANAGEMENT (Persistent Feature/Section Lifecycle Controls)
// =========================================================================
export const platformSections = pgTable('platform_sections', {
  id: serial('id').primaryKey(),
  sectionKey: text('section_key').notNull().unique(),
  sectionName: text('section_name').notNull(),
  description: text('description').notNull().default(''),
  category: text('category').notNull().default('Core'),
  isLockable: boolean('is_lockable').notNull().default(true),
  enabledStatus: boolean('enabled_status').notNull().default(true),
  displayStatus: text('display_status').notNull().default('enabled'), // 'enabled' | 'disabled' | 'coming_soon' | 'maintenance'
  maintenanceStatus: boolean('maintenance_status').notNull().default(false),
  statusMessage: text('status_message').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedById: integer('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
  updatedByEmail: text('updated_by_email'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// =========================================================================
// LEARN KALI (Gamified Tool Ecosystem, Skill Tree, Simulator & Missions)
// =========================================================================
export interface KaliCommandExample {
  command: string;
  explanation: string;
  flagBreakdown: Array<{ flag: string; meaning: string }>;
  sampleOutput?: string;
}

export interface KaliCommonErrorItem {
  error: string;
  cause: string;
  fix: string;
}

export const kaliLevels = pgTable('kali_levels', {
  id: serial('id').primaryKey(),
  levelNumber: integer('level_number').notNull().unique(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  subtitle: text('subtitle').notNull().default(''),
  description: text('description').notNull(),
  xpRequired: integer('xp_required').notNull().default(0),
  badgeTitle: text('badge_title').notNull().default(''),
  topicsJson: jsonb('topics_json').$type<string[]>().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(1),
  published: boolean('published').notNull().default(true),
});

export const kaliCategories = pgTable('kali_categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  officialOrder: integer('official_order').notNull().default(1),
  iconKey: text('icon_key').notNull().default('terminal'),
  enabled: boolean('enabled').notNull().default(true),
  published: boolean('published').notNull().default(true),
});

export const kaliTools = pgTable(
  'kali_tools',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => kaliCategories.id, { onDelete: 'cascade' }),
    categorySlug: text('category_slug').notNull(),
    name: text('name').notNull(),
    summary: text('summary').notNull(),
    purpose: text('purpose').notNull(),
    installCommand: text('install_command').notNull(),
    supportedOs: text('supported_os').notNull().default('Kali Linux / Debian / Ubuntu'),
    versionNote: text('version_note').notNull().default('Kali Rolling Package'),
    difficulty: text('difficulty').notNull().default('Beginner'),
    minLevelNumber: integer('min_level_number').notNull().default(1),
    xpReward: integer('xp_reward').notNull().default(80),
    status: text('status').notNull().default('active'), // 'active' | 'deprecated' | 'optional'
    prerequisitesJson: jsonb('prerequisites_json').$type<string[]>().notNull().default([]),
    basicCommandsJson: jsonb('basic_commands_json').$type<KaliCommandExample[]>().notNull().default([]),
    intermediateCommandsJson: jsonb('intermediate_commands_json')
      .$type<KaliCommandExample[]>()
      .notNull()
      .default([]),
    advancedCommandsJson: jsonb('advanced_commands_json')
      .$type<KaliCommandExample[]>()
      .notNull()
      .default([]),
    commonErrorsJson: jsonb('common_errors_json').$type<KaliCommonErrorItem[]>().notNull().default([]),
    relatedToolSlugsJson: jsonb('related_tool_slugs_json').$type<string[]>().notNull().default([]),
    officialDocsUrl: text('official_docs_url').notNull(),
    githubUrl: text('github_url'),
    interactiveSupported: boolean('interactive_supported').notNull().default(true),
    enabled: boolean('enabled').notNull().default(true),
    published: boolean('published').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('kali_tools_cat_idx').on(table.categoryId),
    index('kali_tools_level_idx').on(table.minLevelNumber),
  ],
);

export const kaliToolLessons = pgTable(
  'kali_tool_lessons',
  {
    id: serial('id').primaryKey(),
    toolId: integer('tool_id')
      .notNull()
      .references(() => kaliTools.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    stepOrder: integer('step_order').notNull().default(1),
    contentMarkdown: text('content_markdown').notNull(),
    commandPractice: text('command_practice').notNull().default(''),
    expectedGoal: text('expected_goal').notNull().default(''),
    quizQuestion: text('quiz_question').notNull(),
    quizOptionsJson: jsonb('quiz_options_json').$type<string[]>().notNull().default([]),
    quizCorrectIndex: integer('quiz_correct_index').notNull().default(0),
    quizExplanation: text('quiz_explanation').notNull().default(''),
    xpReward: integer('xp_reward').notNull().default(60),
    published: boolean('published').notNull().default(true),
  },
  (table) => [index('kali_tool_lessons_tool_idx').on(table.toolId)],
);

export const kaliMissions = pgTable('kali_missions', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  missionType: text('mission_type').notNull().default('mission'), // 'mission' | 'quest' | 'daily' | 'boss' | 'capstone' | 'hidden'
  categorySlug: text('category_slug').notNull(),
  levelNumber: integer('level_number').notNull().default(1),
  difficulty: text('difficulty').notNull().default('Beginner'),
  description: text('description').notNull(),
  scenarioBrief: text('scenario_brief').notNull(),
  objectivesJson: jsonb('objectives_json').$type<string[]>().notNull().default([]),
  requiredToolSlugsJson: jsonb('required_tool_slugs_json').$type<string[]>().notNull().default([]),
  terminalChallengeJson: jsonb('terminal_challenge_json').$type<{
    startingDir: string;
    simulatedPrompt: string;
    steps: Array<{
      id: string;
      instruction: string;
      expectedPattern: string;
      hint: string;
      explanation: string;
    }>;
  } | null>(),
  assessmentJson: jsonb('assessment_json').$type<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  } | null>(),
  relatedLabSlug: text('related_lab_slug'),
  xpReward: integer('xp_reward').notNull().default(180),
  achievementCode: text('achievement_code'),
  enabled: boolean('enabled').notNull().default(true),
  published: boolean('published').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const kaliUserToolProgress = pgTable(
  'kali_user_tool_progress',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toolId: integer('tool_id')
      .notNull()
      .references(() => kaliTools.id, { onDelete: 'cascade' }),
    masteryScore: integer('mastery_score').notNull().default(0),
    lessonsCompletedJson: jsonb('lessons_completed_json').$type<number[]>().notNull().default([]),
    terminalExercisesPassedJson: jsonb('terminal_exercises_passed_json')
      .$type<string[]>()
      .notNull()
      .default([]),
    xpAwardedTotal: integer('xp_awarded_total').notNull().default(0),
    lastPracticedAt: timestamp('last_practiced_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('kali_user_tool_unique_idx').on(table.userId, table.toolId)],
);

export const kaliUserMissionProgress = pgTable(
  'kali_user_mission_progress',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    missionId: integer('mission_id')
      .notNull()
      .references(() => kaliMissions.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('in_progress'), // 'in_progress' | 'completed'
    stepsPassedJson: jsonb('steps_passed_json').$type<string[]>().notNull().default([]),
    xpAwarded: boolean('xp_awarded').notNull().default(false),
    completedAt: timestamp('completed_at'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('kali_user_mission_unique_idx').on(table.userId, table.missionId)],
);

