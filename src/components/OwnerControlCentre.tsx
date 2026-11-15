import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BookOpen,
  Building2,
  Download,
  Flag,
  Lock,
  MessageSquare,
  Printer,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from './ConfirmDialog';
import { GamesAdminPanel } from './games/GamesAdminPanel';
import { AiMentorAdminPanel } from './AiMentorAdminPanel';

interface AdminOverview {
  metrics: {
    totalUsers: number;
    activeUsersToday: number;
    totalCampuses: number;
    activeRooms: number;
    activeTeams: number;
    totalCourses: number;
    totalBooks?: number;
    completedLessons: number;
    totalChallenges: number;
    totalSubmissions: number;
    totalLabSessions: number;
    openSecurityReports: number;
    openAppeals?: number;
    openIpReports?: number;
  };
  users: Array<{
    id: number;
    email: string;
    username: string;
    displayName: string;
    role: string;
    campusId: number | null;
    campusName: string | null;
    campusVerificationStatus: string;
    xp: number;
    mfaEnabled: boolean;
    isSuspended: boolean;
    isBanned: boolean;
    lastActiveDate: string | null;
    createdAt: string;
    activeSessionsCount: number;
  }>;
  competitions: Array<{
    id: number;
    slug: string;
    name: string;
    description: string;
    gameMode: string;
    status: string;
    visibility: string;
    difficulty: string;
    scoringSystem: string;
    enrollmentPolicy: string;
    rulesLocked: boolean;
    totalCapacity: number;
    perTeamCapacity: number;
    durationMinutes: number;
    startsAt: string;
    registrationDeadline: string | null;
    rulesText: string;
  }>;
  rooms: Array<{
    id: number;
    competitionId: number;
    name: string;
    roomCode: string;
    isActive: boolean;
    isLocked: boolean;
    maxParticipants: number;
    usageLimit?: number | null;
    expiresAt?: string | null;
    currentParticipants?: number;
  }>;
  teams: Array<{
    id: number;
    competitionId: number | null;
    campusId: number | null;
    name: string;
    teamCode: string;
    captainId: number | null;
    maxMembers: number;
    score: number;
    isActive: boolean;
    isSuspended: boolean;
    memberCount: number;
  }>;
  participants: Array<{
    id: number;
    competitionId: number;
    roomId: number;
    teamId: number;
    userId: number;
    status?: string;
    username: string;
    email: string;
    teamName: string;
  }>;
  campuses: Array<{
    id: number;
    code: string;
    name: string;
    country: string;
    city: string;
    emailDomain: string | null;
    verified: boolean;
  }>;
  campusVerificationRequests: Array<{
    id: number;
    userId: number;
    userEmail: string;
    userName: string;
    campusId: number;
    campusName: string;
    method: string;
    evidenceText: string;
    status: string;
    reviewNote: string | null;
    createdAt: string;
  }>;
  courses: Array<{
    id: number;
    slug: string;
    stage: number;
    stageTitle: string;
    titleEn: string;
    summaryEn: string;
    difficulty: string;
    prerequisiteSlug: string | null;
    published: boolean;
    lessons: Array<{
      id: number;
      courseId: number;
      titleEn: string;
      published: boolean;
    }>;
  }>;
  books?: Array<{
    id: number;
    slug: string;
    title: string;
    author: string;
    category: string;
    difficulty: string;
    publisher: string;
    publicationYear: number;
    licenseType: string;
    isFree: boolean;
    canReadOnline: boolean;
    canDownload: boolean;
    officialUrl: string;
    status: string;
  }>;
  ctfChallenges: Array<{
    id: number;
    slug: string;
    title: string;
    category: string;
    difficulty: string;
    basePoints: number;
    currentPoints: number;
    scoringMode: string;
    solveCount: number;
    published: boolean;
    attachmentName: string | null;
  }>;
  ctfSubmissions: Array<{
    id: number;
    challengeId: number;
    challengeTitle: string;
    username: string;
    submittedFlagMasked: string;
    isCorrect: boolean;
    pointsAwarded: number;
    suspicionScore: number;
    createdAt: string;
  }>;
  tournaments: Array<{
    id: number;
    name: string;
    description: string;
    format: string;
    status: string;
    maxTeams: number;
    teamSize: number;
    startsAt: string;
  }>;
  chatChannels: Array<{
    id: number;
    competitionId: number | null;
    teamId: number | null;
    channelType: string;
    name: string;
    isEnabled: boolean;
  }>;
  reportedMessages: Array<{
    id: number;
    channelId: number;
    senderId: number;
    senderUsername: string;
    content: string;
    isReported: boolean;
    isDeleted: boolean;
    createdAt: string;
  }>;
  loginHistory: Array<{
    id: number;
    userId: number;
    userEmail: string;
    ipAddress: string;
    userAgent: string;
    status: string;
    createdAt: string;
  }>;
  auditLogs: Array<{
    id: number;
    actorEmail: string | null;
    action: string;
    resourceType: string;
    resourceId: string;
    createdAt: string;
  }>;
  securityReports: Array<{
    id: number;
    targetType: string;
    targetId: number;
    reason: string;
    status: string;
    createdAt?: string;
  }>;
  appeals?: Array<{
    id: number;
    userId: number;
    userEmail: string;
    username: string;
    scope: string;
    targetId: number | null;
    reason: string;
    status: string;
    adminNote: string | null;
    createdAt: string;
  }>;
  certificates?: Array<{
    id: number;
    verificationId: string;
    title: string;
    category: string;
    recipientEmail: string;
    recipientName: string;
    isRevoked: boolean;
    revokedReason: string | null;
    issuedAt: string;
  }>;
  settings: {
    registrationOpen?: boolean;
    maintenanceMode?: boolean;
    disableAiMentor?: boolean;
    disableCommunity?: boolean;
    aiDailyQuotaPerUser?: number;
    labMaxMinutes?: number;
    requireMfaForAdmins?: boolean;
    globalAnnouncement?: string;
  };
  permissionsMatrix?: Record<string, string>;
  ipViolationReports?: Array<{
    id: number;
    referenceCode: string;
    reportType: string;
    targetType: string;
    targetRef: string;
    reporterName: string;
    reporterEmail: string;
    organization: string;
    description: string;
    evidenceUrl: string | null;
    counterNoticeText: string | null;
    status: string;
    adminResolutionNote: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  securityPosture?: {
    sourcemapDisabledInBuild: boolean;
    xPoweredByDisabled: boolean;
    cacheNoStoreSensitiveRoutes: boolean;
    flagHmacSecretConfigured: boolean;
    ownerEmailConfiguredServerSide: boolean;
    antiScrapingActive: boolean;
    abuseEventsRecent: number;
    brandNotice: string;
    copyrightNotice: string;
  };
}

type AdminTab =
  | 'overview'
  | 'users'
  | 'competitions'
  | 'campuses'
  | 'learning'
  | 'moderation'
  | 'security'
  | 'games'
  | 'ai_mentor';

export const OwnerControlCentre: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [tab, setTab] = useState<AdminTab>('overview');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Competition form
  const [compName, setCompName] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [compMode, setCompMode] = useState('ctf_battle');
  const [compVisibility, setCompVisibility] = useState<'public' | 'private'>('public');
  const [compScoring, setCompScoring] = useState<'dynamic' | 'static'>('dynamic');
  const [compPolicy, setCompPolicy] = useState<'shared_team_code' | 'campus_verified' | 'invite_only'>('shared_team_code');
  const [compCap, setCompCap] = useState(150);
  const [compTeamCap, setCompTeamCap] = useState(30);
  const [compDuration, setCompDuration] = useState(180);
  const [compDeadline, setCompDeadline] = useState('');
  const [compRules, setCompRules] = useState('');
  const [editingCompId, setEditingCompId] = useState<number | null>(null);
  const [editCompPatch, setEditCompPatch] = useState({
    totalCapacity: 150,
    perTeamCapacity: 30,
    durationMinutes: 180,
    visibility: 'public',
    scoringSystem: 'dynamic',
    rulesText: '',
  });

  // Tournament form
  const [tournName, setTournName] = useState('');
  const [tournFormat, setTournFormat] = useState<'knockout' | 'round_robin' | 'group_stage'>('knockout');
  const [tournMaxTeams, setTournMaxTeams] = useState(16);

  // Room & Team forms
  const [newRoomCompId, setNewRoomCompId] = useState<number>(0);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCap, setNewRoomCap] = useState(150);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamCampusId, setNewTeamCampusId] = useState<number>(0);
  const [newTeamCap, setNewTeamCap] = useState(30);

  // Team Edit & Transfer forms
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [editTeamDraft, setEditTeamDraft] = useState({ name: '', maxMembers: 30, captainId: '' });
  const [transferForm, setTransferForm] = useState({
    userId: '',
    competitionId: '',
    toTeamId: '',
    reason: '',
  });

  // Campus forms
  const [campusForm, setCampusForm] = useState({
    code: '',
    name: '',
    country: 'India',
    city: '',
    emailDomain: '',
  });

  // Course & Lesson forms
  const [courseForm, setCourseForm] = useState({
    titleEn: '',
    summaryEn: '',
    stage: 1,
    difficulty: 'Beginner',
    prerequisiteSlug: '',
  });
  const [lessonForm, setLessonForm] = useState({
    courseId: '',
    titleEn: '',
    contentEn: '',
    practicalExample: '',
    quizQuestion: '',
  });

  // CTF Authoring form
  const [ctfTitle, setCtfTitle] = useState('');
  const [ctfCat, setCtfCat] = useState('Web Exploitation');
  const [ctfDifficulty, setCtfDifficulty] = useState('Medium');
  const [ctfDesc, setCtfDesc] = useState('');
  const [ctfFlag, setCtfFlag] = useState('');
  const [ctfPts, setCtfPts] = useState(250);
  const [ctfAttachmentName, setCtfAttachmentName] = useState('');
  const [ctfAttachmentContent, setCtfAttachmentContent] = useState('');

  // Platform Settings draft
  const [settingsDraft, setSettingsDraft] = useState({
    registrationOpen: true,
    maintenanceMode: false,
    disableAiMentor: false,
    disableCommunity: false,
    aiDailyQuotaPerUser: 20,
    labMaxMinutes: 60,
    requireMfaForAdmins: true,
    globalAnnouncement: '',
  });

  // Room details editor
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [roomDetailDraft, setRoomDetailDraft] = useState({
    name: '',
    maxParticipants: 150,
    usageLimit: 150,
    expiresAt: '',
  });

  // Team Detail inspector (members + temp/perm removal)
  const [inspectedTeam, setInspectedTeam] = useState<{
    team: AdminOverview['teams'][number];
    members: Array<{
      userId: number;
      username: string;
      displayName: string;
      email: string;
      roleInTeam: string;
      removalStatus: string;
      removalReason: string | null;
      removalExpiresAt: string | null;
      ctfPoints: number;
    }>;
  } | null>(null);
  const [removalReasonDraft, setRemovalReasonDraft] = useState('Policy or sportsmanship review');
  const [removalHours, setRemovalHours] = useState(24);

  // Books authoring state
  const [bookForm, setBookForm] = useState({
    title: '',
    author: '',
    category: 'Cybersecurity Fundamentals',
    difficulty: 'Beginner',
    publisher: '',
    publicationYear: 2025,
    licenseType: 'Open Access (Free Online Read & Download)',
    isFree: true,
    canReadOnline: true,
    canDownload: true,
    officialUrl: '',
    description: '',
  });

  // Governance Permissions Matrix draft
  const [permMatrixDraft, setPermMatrixDraft] = useState<Record<string, string>>({
    whoCanCreateTeams: 'Admins & Owners',
    whoCanCreateRooms: 'Admins & Owners',
    whoCanJoinPrivateRooms: 'Invited Users with Valid Room Code',
    whoCanInviteMembers: 'Captains & Admins',
    whoCanAccessTeamChat: 'Verified Active Team Members & Audited Moderators',
    whoCanViewScores: 'All Authenticated Participants',
    whoCanManageMemberships: 'Owner, Event Admins & Scoped Moderators',
    whoCanChangeRules: 'Owner & Scoped Event Admins (When Unlocked)',
    whoCanAccessAdminInfo: 'Server-Verified Owner, Event Admins & Moderators Only',
  });

  const [ipReviewNotes, setIpReviewNotes] = useState<Record<number, string>>({});

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    desc: string;
    run: () => Promise<void>;
  } | null>(null);

  const inspectTeamDetail = async (teamId: number) => {
    try {
      const res = await apiFetch<{
        team: AdminOverview['teams'][number];
        members: NonNullable<typeof inspectedTeam>['members'];
      }>(`/api/admin/teams/${teamId}`);
      setInspectedTeam(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to inspect team details.');
    }
  };

  const loadAdmin = async () => {
    try {
      const res = await apiFetch<AdminOverview>(
        `/api/admin/overview${search ? `?q=${encodeURIComponent(search)}` : ''}`,
      );
      setData(res);
      if (res.competitions.length > 0 && newRoomCompId === 0) {
        setNewRoomCompId(res.competitions[0].id);
      }
      if (res.courses.length > 0 && !lessonForm.courseId) {
        setLessonForm((prev) => ({ ...prev, courseId: String(res.courses[0].id) }));
      }
      setSettingsDraft({
        registrationOpen: Boolean(res.settings.registrationOpen ?? true),
        maintenanceMode: Boolean(res.settings.maintenanceMode ?? false),
        disableAiMentor: Boolean(res.settings.disableAiMentor ?? false),
        disableCommunity: Boolean(res.settings.disableCommunity ?? false),
        aiDailyQuotaPerUser: Number(res.settings.aiDailyQuotaPerUser ?? 20),
        labMaxMinutes: Number(res.settings.labMaxMinutes ?? 60),
        requireMfaForAdmins: Boolean(res.settings.requireMfaForAdmins ?? true),
        globalAnnouncement: String(res.settings.globalAnnouncement ?? ''),
      });
      if (res.permissionsMatrix && Object.keys(res.permissionsMatrix).length > 0) {
        setPermMatrixDraft((prev) => ({ ...prev, ...res.permissionsMatrix }));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Admin Panel.');
    }
  };

  useEffect(() => {
    loadAdmin();
  }, [user?.id]);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    return data.users.filter((u) => (roleFilter === 'all' ? true : u.role === roleFilter));
  }, [data, roleFilter]);

  const runAction = async (msg: string, fn: () => Promise<void>) => {
    try {
      setError(null);
      await fn();
      setStatusMsg(msg);
      await loadAdmin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Administrative action failed.');
    }
  };

  const handleRoleChange = (userId: number, role: string) =>
    runAction('User role updated and recorded in audit logs.', async () => {
      await apiFetch(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
    });

  const handleCreateCompetition = (e: React.FormEvent) => {
    e.preventDefault();
    runAction('Competition created and audit-logged.', async () => {
      await apiFetch('/api/admin/competitions', {
        method: 'POST',
        body: JSON.stringify({
          name: compName,
          description: compDesc,
          gameMode: compMode,
          visibility: compVisibility,
          scoringSystem: compScoring,
          enrollmentPolicy: compPolicy,
          totalCapacity: compCap,
          perTeamCapacity: compTeamCap,
          durationMinutes: compDuration,
          registrationDeadline: compDeadline || null,
          rulesText: compRules,
        }),
      });
      setCompName('');
      setCompDesc('');
      setCompRules('');
    });
  };

  const handleSaveCompetitionEdit = (compId: number) =>
    runAction('Competition settings updated.', async () => {
      await apiFetch(`/api/admin/competitions/${compId}`, {
        method: 'PATCH',
        body: JSON.stringify(editCompPatch),
      });
      setEditingCompId(null);
    });

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const compId = newRoomCompId || data?.competitions[0]?.id;
    if (!compId) return;
    runAction('New room code generated.', async () => {
      await apiFetch('/api/admin/rooms', {
        method: 'POST',
        body: JSON.stringify({ competitionId: compId, name: newRoomName, maxParticipants: newRoomCap }),
      });
      setNewRoomName('');
    });
  };

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    const compId = newRoomCompId || data?.competitions[0]?.id || null;
    runAction('New campus team code created.', async () => {
      await apiFetch('/api/admin/teams', {
        method: 'POST',
        body: JSON.stringify({
          competitionId: compId,
          campusId: newTeamCampusId || null,
          name: newTeamName,
          maxMembers: newTeamCap,
        }),
      });
      setNewTeamName('');
    });
  };

  const handleCreateCampus = (e: React.FormEvent) => {
    e.preventDefault();
    runAction('Campus record added.', async () => {
      await apiFetch('/api/admin/campuses', {
        method: 'POST',
        body: JSON.stringify(campusForm),
      });
      setCampusForm({ code: '', name: '', country: 'India', city: '', emailDomain: '' });
    });
  };

  const handleTransferParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    runAction('Participant transferred with audit log entry.', async () => {
      await apiFetch('/api/admin/teams/transfer', {
        method: 'POST',
        body: JSON.stringify({
          userId: Number(transferForm.userId),
          competitionId: Number(transferForm.competitionId),
          toTeamId: Number(transferForm.toTeamId),
          reason: transferForm.reason,
        }),
      });
      setTransferForm({ userId: '', competitionId: '', toTeamId: '', reason: '' });
    });
  };

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    runAction('Course created.', async () => {
      await apiFetch('/api/admin/courses', {
        method: 'POST',
        body: JSON.stringify({
          ...courseForm,
          prerequisiteSlug: courseForm.prerequisiteSlug || null,
        }),
      });
      setCourseForm({ titleEn: '', summaryEn: '', stage: 1, difficulty: 'Beginner', prerequisiteSlug: '' });
    });
  };

  const handleCreateLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonForm.courseId) return;
    runAction('Lesson published to course.', async () => {
      await apiFetch(`/api/admin/courses/${lessonForm.courseId}/lessons`, {
        method: 'POST',
        body: JSON.stringify(lessonForm),
      });
      setLessonForm((prev) => ({
        ...prev,
        titleEn: '',
        contentEn: '',
        practicalExample: '',
        quizQuestion: '',
      }));
    });
  };

  const handleCreateCtf = (e: React.FormEvent) => {
    e.preventDefault();
    runAction('CTF challenge published with server-side HMAC flag hash.', async () => {
      await apiFetch('/api/admin/ctf', {
        method: 'POST',
        body: JSON.stringify({
          title: ctfTitle,
          category: ctfCat,
          difficulty: ctfDifficulty,
          description: ctfDesc,
          flag: ctfFlag,
          basePoints: ctfPts,
          attachmentName: ctfAttachmentName || null,
          attachmentContent: ctfAttachmentContent || null,
        }),
      });
      setCtfTitle('');
      setCtfDesc('');
      setCtfFlag('');
      setCtfAttachmentName('');
      setCtfAttachmentContent('');
    });
  };

  const handleCreateTournament = (e: React.FormEvent) => {
    e.preventDefault();
    runAction('Tournament created.', async () => {
      await apiFetch('/api/admin/tournaments', {
        method: 'POST',
        body: JSON.stringify({
          name: tournName,
          format: tournFormat,
          maxTeams: tournMaxTeams,
        }),
      });
      setTournName('');
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    runAction('Platform settings saved and audited.', async () => {
      await apiFetch('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify(settingsDraft),
      });
    });
  };

  const handleDownloadCsv = async () => {
    try {
      const csvText = await apiFetch<string>('/api/admin/export/csv');
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kali3977-analytics.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export analytics CSV.');
    }
  };

  if (!user || !['owner', 'event_admin', 'moderator'].includes(user.role)) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-500">
        403 Forbidden: Administrative privileges verified server-side are required.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Admin Panel
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Signed in as {user.email} · Role: {user.role.toUpperCase()} · Server-enforced RBAC & audit logging.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
          </button>
        </div>
      </div>

      {user.role === 'owner' && !user.mfaEnabled && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-600 dark:text-amber-300">
          Security Policy Notice: TOTP MFA is recommended for the Platform Owner account. Enable 2FA in Profile &
          Settings to harden administrative operations.
        </div>
      )}

      {statusMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-500">
          {statusMsg}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-500">
          {error}
        </div>
      )}

      {/* 7-Section Navigation Tabs (A-G) */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-1.5">
        {[
          { id: 'overview', label: 'A. Overview' },
          { id: 'users', label: 'B. Users & Roles' },
          { id: 'competitions', label: 'C. Competitions & Codes' },
          { id: 'campuses', label: 'D. Campuses & Teams' },
          { id: 'learning', label: 'E. Learning & CTF' },
          { id: 'moderation', label: 'F. Moderation' },
          { id: 'security', label: 'G. Security & Settings' },
          { id: 'games', label: 'H. Games Arena' },
          { id: 'ai_mentor', label: 'I. AI Cyber Mentor' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as AdminTab)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              tab === t.id
                ? 'bg-emerald-500 text-slate-950 font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SECTION A: OVERVIEW */}
      {data && tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total Users', val: data.metrics.totalUsers, icon: Users, sub: `${data.metrics.activeUsersToday} active today` },
              { label: 'Verified Campuses', val: data.metrics.totalCampuses, icon: Building2, sub: `${data.campusVerificationRequests.filter((r) => r.status === 'pending').length} pending reviews` },
              { label: 'Active Rooms', val: data.metrics.activeRooms, icon: Lock, sub: `${data.competitions.filter((c) => c.status === 'active').length} live competitions` },
              { label: 'Active Teams', val: data.metrics.activeTeams, icon: Trophy, sub: `${data.participants.length} enrolled seats` },
              { label: 'Courses & Lessons', val: data.metrics.totalCourses, icon: BookOpen, sub: `${data.metrics.completedLessons} lessons completed` },
              { label: 'CTF Challenges', val: data.metrics.totalChallenges, icon: Flag, sub: `${data.metrics.totalSubmissions} recent submissions` },
              { label: 'Lab Sessions', val: data.metrics.totalLabSessions, icon: Activity, sub: 'Sandbox records' },
              { label: 'Security Reports', val: data.metrics.openSecurityReports, icon: ShieldAlert, sub: `${data.reportedMessages.length} flagged messages` },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{card.label}</span>
                    <Icon className="h-4 w-4 text-emerald-500" />
                  </div>
                  <p className="mt-2 font-display text-2xl font-bold tabular-nums">{card.val}</p>
                  <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
                </div>
              );
            })}
          </div>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
            <h2 className="font-display text-base font-semibold">Recent Security & Audit Events</h2>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {data.auditLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <span className="font-mono font-semibold text-cyan-500">{log.action}</span>
                    <span className="ml-2 text-slate-500">
                      {log.actorEmail || 'system'} · {log.resourceType} #{log.resourceId}
                    </span>
                  </div>
                  <span className="font-mono text-slate-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* SECTION B: USER MANAGEMENT */}
      {data && tab === 'users' && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold">User & Role Administration</h2>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Filter users by role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5 text-xs"
              >
                <option value="all">All roles</option>
                <option value="owner">owner</option>
                <option value="event_admin">event_admin</option>
                <option value="moderator">moderator</option>
                <option value="team_captain">team_captain</option>
                <option value="player">player</option>
              </select>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by email or handle..."
                aria-label="Search users by email or username"
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={loadAdmin}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Search
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">User</th>
                  <th className="py-2 pr-4 font-medium">Campus</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium">MFA / Sessions</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="h-12">
                    <td className="pr-4">
                      <p className="font-medium">{u.displayName}</p>
                      <p className="font-mono text-slate-500">{u.email}</p>
                    </td>
                    <td className="pr-4">
                      <p>{u.campusName || 'Independent'}</p>
                      <p className="font-mono text-slate-500">{u.campusVerificationStatus}</p>
                    </td>
                    <td className="pr-4">
                      {user.role === 'owner' && u.role !== 'owner' ? (
                        <select
                          aria-label={`Role for ${u.email}`}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A0D12] px-2 py-1 text-xs"
                        >
                          <option value="player">player</option>
                          <option value="team_captain">team_captain</option>
                          <option value="moderator">moderator</option>
                          <option value="event_admin">event_admin</option>
                        </select>
                      ) : (
                        <span className="font-mono text-emerald-500">{u.role}</span>
                      )}
                    </td>
                    <td className="pr-4 font-mono">
                      {u.mfaEnabled ? 'MFA On' : 'MFA Off'} · {u.activeSessionsCount} sess
                    </td>
                    <td className="pr-4">
                      <span
                        className={
                          u.isBanned
                            ? 'text-rose-500 font-medium'
                            : u.isSuspended
                              ? 'text-amber-500 font-medium'
                              : 'text-emerald-500'
                        }
                      >
                        {u.isBanned ? 'Banned' : u.isSuspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          runAction(`Revoked active sessions for ${u.email}.`, async () => {
                            await apiFetch(`/api/admin/users/${u.id}/revoke-sessions`, { method: 'POST' });
                          })
                        }
                        className="text-cyan-500 hover:underline font-medium"
                      >
                        Revoke Sessions
                      </button>
                      {u.role !== 'owner' && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmAction({
                                title: u.isSuspended ? 'Restore Account' : 'Suspend Account',
                                desc: `Confirm ${u.isSuspended ? 'restoring' : 'suspending'} ${u.email}?`,
                                run: async () => {
                                  await apiFetch(`/api/admin/users/${u.id}/status`, {
                                    method: 'POST',
                                    body: JSON.stringify({
                                      action: u.isSuspended ? 'restore' : 'suspend',
                                    }),
                                  });
                                  await loadAdmin();
                                },
                              })
                            }
                            className="text-amber-500 hover:underline font-medium"
                          >
                            {u.isSuspended ? 'Restore' : 'Suspend'}
                          </button>
                          {!u.isBanned && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmAction({
                                  title: 'Ban Account',
                                  desc: `Permanently ban ${u.email} and revoke all active sessions?`,
                                  run: async () => {
                                    await apiFetch(`/api/admin/users/${u.id}/status`, {
                                      method: 'POST',
                                      body: JSON.stringify({ action: 'ban' }),
                                    });
                                    await loadAdmin();
                                  },
                                })
                              }
                              className="text-rose-500 hover:underline font-medium"
                            >
                              Ban
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SECTION C: COMPETITIONS, ROOMS, PARTICIPANTS & TOURNAMENTS */}
      {data && tab === 'competitions' && (
        <div className="space-y-6">
          {/* Create Competition */}
          <form
            onSubmit={handleCreateCompetition}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4"
          >
            <h2 className="font-display text-base font-semibold">Create Competition Event</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input
                type="text"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                placeholder="Competition Name"
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs sm:col-span-2"
                required
              />
              <select
                aria-label="Game Mode"
                value={compMode}
                onChange={(e) => setCompMode(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
              >
                <option value="ctf_battle">CTF Battle</option>
                <option value="red_blue">Red vs Blue</option>
                <option value="cyber_investigation">Cyber Investigation</option>
                <option value="cyber_rush">Cyber Rush</option>
                <option value="soc_incident_response">SOC Incident Response</option>
                <option value="network_defence">Network Defence</option>
                <option value="digital_forensics">Digital Forensics Challenge</option>
                <option value="crypto_battle">Cryptography Battle</option>
                <option value="custom_cyber_games">Custom Cyber Games</option>
              </select>
              <select
                aria-label="Visibility"
                value={compVisibility}
                onChange={(e) => setCompVisibility(e.target.value as 'public' | 'private')}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
              >
                <option value="public">Public Access</option>
                <option value="private">Private / Invite</option>
              </select>
              <select
                aria-label="Scoring System"
                value={compScoring}
                onChange={(e) => setCompScoring(e.target.value as 'dynamic' | 'static')}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
              >
                <option value="dynamic">Dynamic Scoring</option>
                <option value="static">Static Scoring</option>
              </select>
              <select
                aria-label="Joining Permission Policy"
                value={compPolicy}
                onChange={(e) =>
                  setCompPolicy(
                    e.target.value as 'shared_team_code' | 'campus_verified' | 'invite_only',
                  )
                }
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
              >
                <option value="shared_team_code">Shared Team Code</option>
                <option value="campus_verified">Verified Campus Only</option>
                <option value="invite_only">Invite Only</option>
              </select>
              <input
                type="number"
                value={compCap}
                onChange={(e) => setCompCap(Number(e.target.value))}
                placeholder="Total Capacity"
                aria-label="Total Capacity"
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono text-xs"
              />
              <input
                type="number"
                value={compTeamCap}
                onChange={(e) => setCompTeamCap(Number(e.target.value))}
                placeholder="Per-Team Cap"
                aria-label="Per Team Capacity"
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono text-xs"
              />
              <input
                type="number"
                value={compDuration}
                onChange={(e) => setCompDuration(Number(e.target.value))}
                placeholder="Duration (mins)"
                aria-label="Duration Minutes"
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono text-xs"
              />
              <input
                type="datetime-local"
                value={compDeadline}
                onChange={(e) => setCompDeadline(e.target.value)}
                aria-label="Registration Deadline"
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={compDesc}
                onChange={(e) => setCompDesc(e.target.value)}
                placeholder="Short competition description"
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs sm:col-span-2"
                required
              />
              <input
                type="text"
                value={compRules}
                onChange={(e) => setCompRules(e.target.value)}
                placeholder="Competition rules & fair-play guidelines"
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs sm:col-span-2 lg:col-span-3"
              />
              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Create Competition
              </button>
            </div>
          </form>

          {/* Competitions & Lifecycle */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
            <h2 className="font-display text-base font-semibold">Competition Lifecycle, Rules & Capacity</h2>
            {data.competitions.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-xs space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm">{c.name}</p>
                    <p className="text-slate-500">
                      Status: <span className="text-emerald-500 font-medium">{c.status}</span> ·{' '}
                      {c.gameMode} · {c.scoringSystem} · {c.visibility} · Cap {c.totalCapacity} (Team max{' '}
                      {c.perTeamCapacity}) · {c.durationMinutes}m · Rules{' '}
                      {c.rulesLocked ? 'Locked' : 'Editable'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['start', 'pause', 'resume', 'end', 'cancel', 'publish_results'] as const).map((act) => (
                      <button
                        key={act}
                        type="button"
                        onClick={() =>
                          runAction(`Competition action '${act}' applied.`, async () => {
                            await apiFetch(`/api/admin/competitions/${c.id}/control`, {
                              method: 'POST',
                              body: JSON.stringify({ action: act }),
                            });
                          })
                        }
                        className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 capitalize hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {act.replace('_', ' ')}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        if (editingCompId === c.id) {
                          setEditingCompId(null);
                        } else {
                          setEditingCompId(c.id);
                          setEditCompPatch({
                            totalCapacity: c.totalCapacity,
                            perTeamCapacity: c.perTeamCapacity,
                            durationMinutes: c.durationMinutes,
                            visibility: c.visibility,
                            scoringSystem: c.scoringSystem,
                            rulesText: c.rulesText || '',
                          });
                        }
                      }}
                      className="rounded-lg border border-cyan-500/40 px-2.5 py-1 text-cyan-500"
                    >
                      {editingCompId === c.id ? 'Close' : 'Edit'}
                    </button>
                  </div>
                </div>

                {editingCompId === c.id && (
                  <div className="grid gap-2 sm:grid-cols-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <input
                      type="number"
                      value={editCompPatch.totalCapacity}
                      onChange={(e) =>
                        setEditCompPatch((p) => ({ ...p, totalCapacity: Number(e.target.value) }))
                      }
                      aria-label="Edit total capacity"
                      className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5 font-mono"
                    />
                    <input
                      type="number"
                      value={editCompPatch.perTeamCapacity}
                      onChange={(e) =>
                        setEditCompPatch((p) => ({ ...p, perTeamCapacity: Number(e.target.value) }))
                      }
                      aria-label="Edit per-team capacity"
                      className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5 font-mono"
                    />
                    <select
                      aria-label="Edit visibility"
                      value={editCompPatch.visibility}
                      onChange={(e) => setEditCompPatch((p) => ({ ...p, visibility: e.target.value }))}
                      className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                    <select
                      aria-label="Edit scoring"
                      value={editCompPatch.scoringSystem}
                      onChange={(e) => setEditCompPatch((p) => ({ ...p, scoringSystem: e.target.value }))}
                      className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5"
                    >
                      <option value="dynamic">Dynamic</option>
                      <option value="static">Static</option>
                    </select>
                    <input
                      type="text"
                      value={editCompPatch.rulesText}
                      onChange={(e) => setEditCompPatch((p) => ({ ...p, rulesText: e.target.value }))}
                      placeholder="Rules text"
                      className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5 sm:col-span-3"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveCompetitionEdit(c.id)}
                      className="rounded bg-emerald-500 px-3 py-1.5 font-semibold text-slate-950"
                    >
                      Save Changes
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Room Codes */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
              <h2 className="font-display text-base font-semibold">Room Codes Management</h2>
              <form onSubmit={handleCreateRoom} className="flex flex-wrap gap-2">
                <select
                  aria-label="Room Competition"
                  value={newRoomCompId}
                  onChange={(e) => setNewRoomCompId(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5 text-xs"
                >
                  {data.competitions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Room Name"
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                  required
                />
                <input
                  type="number"
                  value={newRoomCap}
                  onChange={(e) => setNewRoomCap(Number(e.target.value))}
                  aria-label="Room Capacity"
                  className="w-20 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2 py-1.5 font-mono text-xs"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
                >
                  Create
                </button>
              </form>
              <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {data.rooms.map((r) => (
                  <div
                    key={r.id}
                    className="py-3 space-y-2 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{r.name}</p>
                        <p className="font-mono text-emerald-500">
                          {r.roomCode} · Cap {r.maxParticipants} · Limit {r.usageLimit ?? r.maxParticipants} ·{' '}
                          {r.isActive ? 'Active' : 'Revoked/Inactive'}
                          {r.expiresAt ? ` · Exp ${new Date(r.expiresAt).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (editingRoomId === r.id) {
                              setEditingRoomId(null);
                            } else {
                              setEditingRoomId(r.id);
                              setRoomDetailDraft({
                                name: r.name,
                                maxParticipants: r.maxParticipants,
                                usageLimit: r.usageLimit ?? r.maxParticipants,
                                expiresAt: r.expiresAt ? r.expiresAt.slice(0, 16) : '',
                              });
                            }
                          }}
                          className="rounded border border-cyan-500/40 px-2 py-1 text-cyan-500"
                        >
                          {editingRoomId === r.id ? 'Close' : 'Details'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            runAction('Room code regenerated.', async () => {
                              await apiFetch(`/api/admin/rooms/${r.id}/regenerate`, { method: 'POST' });
                            })
                          }
                          className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Regen
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            runAction('Room lock status updated.', async () => {
                              await apiFetch(`/api/admin/rooms/${r.id}/toggle`, {
                                method: 'POST',
                                body: JSON.stringify({ isLocked: !r.isLocked }),
                              });
                            })
                          }
                          className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1"
                        >
                          <Lock className="h-3 w-3" />
                          {r.isLocked ? 'Unlock' : 'Lock'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            runAction('Room code revoked and locked.', async () => {
                              await apiFetch(`/api/admin/rooms/${r.id}/details`, {
                                method: 'POST',
                                body: JSON.stringify({ revoke: true }),
                              });
                            })
                          }
                          className="rounded border border-rose-500/40 px-2 py-1 text-rose-500"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>

                    {editingRoomId === r.id && (
                      <div className="grid gap-2 sm:grid-cols-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          value={roomDetailDraft.name}
                          onChange={(e) => setRoomDetailDraft((d) => ({ ...d, name: e.target.value }))}
                          aria-label="Room Name"
                          className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A0D12] px-2 py-1"
                        />
                        <input
                          type="number"
                          value={roomDetailDraft.usageLimit}
                          onChange={(e) =>
                            setRoomDetailDraft((d) => ({ ...d, usageLimit: Number(e.target.value) }))
                          }
                          aria-label="Room Usage Limit"
                          placeholder="Usage limit"
                          className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A0D12] px-2 py-1 font-mono"
                        />
                        <input
                          type="datetime-local"
                          value={roomDetailDraft.expiresAt}
                          onChange={(e) =>
                            setRoomDetailDraft((d) => ({ ...d, expiresAt: e.target.value }))
                          }
                          aria-label="Room Code Expiry"
                          className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A0D12] px-2 py-1"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            runAction('Room configuration updated.', async () => {
                              await apiFetch(`/api/admin/rooms/${r.id}/details`, {
                                method: 'POST',
                                body: JSON.stringify({
                                  name: roomDetailDraft.name,
                                  usageLimit: roomDetailDraft.usageLimit,
                                  expiresAt: roomDetailDraft.expiresAt || null,
                                }),
                              });
                              setEditingRoomId(null);
                            })
                          }
                          className="rounded bg-emerald-500 px-2 py-1 font-semibold text-slate-950"
                        >
                          Save Room
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tournaments Management */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
              <h2 className="font-display text-base font-semibold">Tournaments & Brackets</h2>
              <form onSubmit={handleCreateTournament} className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={tournName}
                  onChange={(e) => setTournName(e.target.value)}
                  placeholder="Tournament Title"
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                  required
                />
                <select
                  aria-label="Tournament Format"
                  value={tournFormat}
                  onChange={(e) =>
                    setTournFormat(e.target.value as 'knockout' | 'round_robin' | 'group_stage')
                  }
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5 text-xs"
                >
                  <option value="knockout">Knockout</option>
                  <option value="round_robin">Round Robin</option>
                  <option value="group_stage">Group Stage</option>
                </select>
                <input
                  type="number"
                  value={tournMaxTeams}
                  onChange={(e) => setTournMaxTeams(Number(e.target.value))}
                  aria-label="Max Teams"
                  className="w-16 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2 py-1.5 font-mono text-xs"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
                >
                  Create
                </button>
              </form>
              <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {data.tournaments.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-slate-500">
                        {t.format.replace('_', ' ')} · {t.status} · Max {t.maxTeams} teams
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        runAction(`Brackets generated for ${t.name}.`, async () => {
                          await apiFetch(`/api/admin/tournaments/${t.id}/generate-brackets`, {
                            method: 'POST',
                          });
                        })
                      }
                      className="rounded border border-cyan-500/40 px-2.5 py-1 text-cyan-500 hover:bg-cyan-500/10"
                    >
                      Generate Brackets
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Competition Participants Roster */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
            <h2 className="font-display text-base font-semibold">Enrolled Participants Roster</h2>
            {data.participants.length === 0 ? (
              <p className="text-xs text-slate-500">No participants enrolled yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Handle</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Team</th>
                      <th className="py-2 pr-4">Comp ID</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {data.participants.map((p) => (
                      <tr key={p.id} className="h-10">
                        <td className="pr-4 font-mono">@{p.username}</td>
                        <td className="pr-4 text-slate-500">{p.email}</td>
                        <td className="pr-4">{p.teamName}</td>
                        <td className="pr-4 font-mono">#{p.competitionId}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmAction({
                                title: 'Remove Participant',
                                desc: `Remove @${p.username} from competition #${p.competitionId}?`,
                                run: async () => {
                                  await apiFetch(
                                    `/api/admin/competitions/${p.competitionId}/participants/${p.userId}`,
                                    { method: 'DELETE' },
                                  );
                                  await loadAdmin();
                                },
                              })
                            }
                            className="text-rose-500 hover:underline font-medium"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* SECTION D: CAMPUSES & TEAMS */}
      {data && tab === 'campuses' && (
        <div className="space-y-6">
          {/* Campus Verification Requests */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-500" />
              <h2 className="font-display text-base font-semibold">Campus Membership Verification Queue</h2>
            </div>
            {data.campusVerificationRequests.length === 0 ? (
              <p className="text-xs text-slate-500">No campus verification requests submitted yet.</p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {data.campusVerificationRequests.map((req) => (
                  <div key={req.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-semibold">
                        {req.userName} ({req.userEmail}) → {req.campusName}
                      </p>
                      <p className="text-slate-500">
                        Method: {req.method} · Evidence: {req.evidenceText} · Status:{' '}
                        <span className="font-mono text-cyan-500">{req.status}</span>
                      </p>
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            runAction('Campus affiliation approved.', async () => {
                              await apiFetch(`/api/admin/campus-verifications/${req.id}/review`, {
                                method: 'POST',
                                body: JSON.stringify({ decision: 'approved', reviewNote: 'Verified by admin' }),
                              });
                            })
                          }
                          className="rounded bg-emerald-500 px-3 py-1 font-semibold text-slate-950"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            runAction('Campus affiliation rejected.', async () => {
                              await apiFetch(`/api/admin/campus-verifications/${req.id}/review`, {
                                method: 'POST',
                                body: JSON.stringify({ decision: 'rejected', reviewNote: 'Insufficient evidence' }),
                              });
                            })
                          }
                          className="rounded border border-rose-500/40 px-3 py-1 text-rose-500"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Campuses CRUD */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
              <h2 className="font-display text-base font-semibold">Registered Campuses</h2>
              <form onSubmit={handleCreateCampus} className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={campusForm.code}
                  onChange={(e) => setCampusForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="Code (e.g. MIT-SEC)"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                  required
                />
                <input
                  type="text"
                  value={campusForm.name}
                  onChange={(e) => setCampusForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Campus Name"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                  required
                />
                <input
                  type="text"
                  value={campusForm.country}
                  onChange={(e) => setCampusForm((f) => ({ ...f, country: e.target.value }))}
                  placeholder="Country"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                  required
                />
                <input
                  type="text"
                  value={campusForm.city}
                  onChange={(e) => setCampusForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="City"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                  required
                />
                <input
                  type="text"
                  value={campusForm.emailDomain}
                  onChange={(e) => setCampusForm((f) => ({ ...f, emailDomain: e.target.value }))}
                  placeholder="Institutional domain (e.g. mit.edu)"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
                >
                  Add Campus
                </button>
              </form>
              <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {data.campuses.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-medium">
                        {c.name} <span className="font-mono text-slate-500">({c.code})</span>
                      </p>
                      <p className="text-slate-500">
                        {c.city}, {c.country} {c.emailDomain ? `· @${c.emailDomain}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          title: 'Delete Campus',
                          desc: `Remove ${c.name}? Users affiliated with it will become unverified.`,
                          run: async () => {
                            await apiFetch(`/api/admin/campuses/${c.id}`, { method: 'DELETE' });
                            await loadAdmin();
                          },
                        })
                      }
                      className="text-rose-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Teams Management & Team Codes */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
              <h2 className="font-display text-base font-semibold">Campus Teams & Team Codes</h2>
              <form onSubmit={handleCreateTeam} className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Campus Team Name"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                  required
                />
                <select
                  aria-label="Team Campus"
                  value={newTeamCampusId}
                  onChange={(e) => setNewTeamCampusId(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5 text-xs"
                >
                  <option value={0}>No Campus Link</option>
                  {data.campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={newTeamCap}
                  onChange={(e) => setNewTeamCap(Number(e.target.value))}
                  aria-label="Team Max Members"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 font-mono text-xs"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
                >
                  Create Team
                </button>
              </form>
              <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {data.teams.map((t) => (
                  <div key={t.id} className="py-3 space-y-2 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {t.name}{' '}
                          <span className="text-slate-500">
                            ({t.memberCount}/{t.maxMembers} members · {t.score} pts)
                          </span>
                        </p>
                        <p className="font-mono text-cyan-500">{t.teamCode}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => inspectTeamDetail(t.id)}
                          className="rounded border border-cyan-500/40 px-2 py-1 text-cyan-500"
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            runAction('Team code regenerated.', async () => {
                              await apiFetch(`/api/admin/teams/${t.id}/regenerate`, { method: 'POST' });
                            })
                          }
                          className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-1"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Regen
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (editingTeamId === t.id) {
                              setEditingTeamId(null);
                            } else {
                              setEditingTeamId(t.id);
                              setEditTeamDraft({
                                name: t.name,
                                maxMembers: t.maxMembers,
                                captainId: t.captainId ? String(t.captainId) : '',
                              });
                            }
                          }}
                          className="rounded border border-slate-200 dark:border-slate-700 px-2 py-1"
                        >
                          {editingTeamId === t.id ? 'Close' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmAction({
                              title: 'Delete Team',
                              desc: `Permanently delete team "${t.name}" and invalidate team code ${t.teamCode}?`,
                              run: async () => {
                                await apiFetch(`/api/admin/teams/${t.id}`, { method: 'DELETE' });
                                if (inspectedTeam?.team.id === t.id) setInspectedTeam(null);
                                await loadAdmin();
                              },
                            })
                          }
                          className="rounded border border-rose-500/40 px-2 py-1 text-rose-500"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {editingTeamId === t.id && (
                      <div className="grid gap-2 sm:grid-cols-4 pt-2">
                        <input
                          type="text"
                          value={editTeamDraft.name}
                          onChange={(e) => setEditTeamDraft((d) => ({ ...d, name: e.target.value }))}
                          aria-label="Edit Team Name"
                          className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A0D12] px-2 py-1"
                        />
                        <input
                          type="number"
                          value={editTeamDraft.maxMembers}
                          onChange={(e) =>
                            setEditTeamDraft((d) => ({ ...d, maxMembers: Number(e.target.value) }))
                          }
                          aria-label="Edit Max Members"
                          className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A0D12] px-2 py-1 font-mono"
                        />
                        <select
                          aria-label="Assign Team Captain"
                          value={editTeamDraft.captainId}
                          onChange={(e) => setEditTeamDraft((d) => ({ ...d, captainId: e.target.value }))}
                          className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A0D12] px-2 py-1"
                        >
                          <option value="">Keep Captain</option>
                          {data.users.map((u) => (
                            <option key={u.id} value={u.id}>
                              @{u.username}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            runAction('Team details updated.', async () => {
                              await apiFetch(`/api/admin/teams/${t.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({
                                  name: editTeamDraft.name,
                                  maxMembers: editTeamDraft.maxMembers,
                                  captainId: editTeamDraft.captainId
                                    ? Number(editTeamDraft.captainId)
                                    : undefined,
                                }),
                              });
                              setEditingTeamId(null);
                            })
                          }
                          className="rounded bg-emerald-500 px-2 py-1 font-semibold text-slate-950"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Inspected Team Roster & Temp/Perm Removal */}
          {inspectedTeam && (
            <section className="rounded-xl border border-cyan-500/30 bg-white dark:bg-[#11161F] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold">
                    Team Inspector: {inspectedTeam.team.name} (ID #{inspectedTeam.team.id} · Code{' '}
                    <span className="font-mono text-cyan-500">{inspectedTeam.team.teamCode}</span>)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Manage active roster, inspect scores, or enforce temporary/permanent team removal with audited reasons.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedTeam(null)}
                  className="rounded border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs"
                >
                  Close Inspector
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 text-xs">
                <input
                  type="text"
                  value={removalReasonDraft}
                  onChange={(e) => setRemovalReasonDraft(e.target.value)}
                  placeholder="Disciplinary reason for removal..."
                  aria-label="Removal Reason"
                  className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5"
                />
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={removalHours}
                  onChange={(e) => setRemovalHours(Number(e.target.value))}
                  aria-label="Temporary Removal Hours"
                  placeholder="Temp hours"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 font-mono"
                />
              </div>

              {inspectedTeam.members.length === 0 ? (
                <p className="text-xs text-slate-500">No members enrolled in this team yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">Member</th>
                        <th className="py-2 pr-4">Team Role</th>
                        <th className="py-2 pr-4">CTF Score</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 text-right">Disciplinary Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {inspectedTeam.members.map((m) => (
                        <tr key={m.userId} className="h-10">
                          <td className="pr-4">
                            {m.displayName} <span className="font-mono text-slate-500">@{m.username}</span>
                          </td>
                          <td className="pr-4 font-mono">{m.roleInTeam}</td>
                          <td className="pr-4 font-mono text-emerald-500">{m.ctfPoints}</td>
                          <td className="pr-4 font-mono">{m.removalStatus}</td>
                          <td className="text-right space-x-2 whitespace-nowrap">
                            {m.removalStatus === 'active' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    runAction(`Temporarily removed @${m.username}.`, async () => {
                                      await apiFetch(
                                        `/api/admin/teams/${inspectedTeam.team.id}/members/${m.userId}/remove`,
                                        {
                                          method: 'POST',
                                          body: JSON.stringify({
                                            mode: 'temp_removed',
                                            reason: removalReasonDraft,
                                            durationHours: removalHours,
                                          }),
                                        },
                                      );
                                      await inspectTeamDetail(inspectedTeam.team.id);
                                    })
                                  }
                                  className="text-amber-500 hover:underline font-medium"
                                >
                                  Temp Remove
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    runAction(`Permanently removed @${m.username}.`, async () => {
                                      await apiFetch(
                                        `/api/admin/teams/${inspectedTeam.team.id}/members/${m.userId}/remove`,
                                        {
                                          method: 'POST',
                                          body: JSON.stringify({
                                            mode: 'perm_removed',
                                            reason: removalReasonDraft,
                                          }),
                                        },
                                      );
                                      await inspectTeamDetail(inspectedTeam.team.id);
                                    })
                                  }
                                  className="text-rose-500 hover:underline font-medium"
                                >
                                  Perm Remove
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  runAction(`Restored @${m.username} to team.`, async () => {
                                    await apiFetch(
                                      `/api/admin/teams/${inspectedTeam.team.id}/members/${m.userId}/remove`,
                                      {
                                        method: 'POST',
                                        body: JSON.stringify({ mode: 'restore' }),
                                      },
                                    );
                                    await inspectTeamDetail(inspectedTeam.team.id);
                                  })
                                }
                                className="text-emerald-500 hover:underline font-medium"
                              >
                                Restore
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Authorized Participant Transfer */}
          <form
            onSubmit={handleTransferParticipant}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3"
          >
            <h2 className="font-display text-base font-semibold">Audited Participant Team Transfer</h2>
            <div className="grid gap-3 sm:grid-cols-4">
              <select
                aria-label="Participant to Transfer"
                value={transferForm.userId}
                onChange={(e) => setTransferForm((f) => ({ ...f, userId: e.target.value }))}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                required
              >
                <option value="">Select User</option>
                {data.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    @{u.username} ({u.email})
                  </option>
                ))}
              </select>
              <select
                aria-label="Competition"
                value={transferForm.competitionId}
                onChange={(e) => setTransferForm((f) => ({ ...f, competitionId: e.target.value }))}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                required
              >
                <option value="">Select Competition</option>
                {data.competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Destination Team"
                value={transferForm.toTeamId}
                onChange={(e) => setTransferForm((f) => ({ ...f, toTeamId: e.target.value }))}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                required
              >
                <option value="">Destination Team</option>
                {data.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={transferForm.reason}
                onChange={(e) => setTransferForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Mandatory audit reason..."
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                required
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-slate-950"
            >
              Execute Audited Transfer
            </button>
          </form>
        </div>
      )}

      {/* SECTION E: LEARNING & CTF MANAGEMENT */}
      {data && tab === 'learning' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Course Authoring */}
            <form
              onSubmit={handleCreateCourse}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3"
            >
              <h2 className="font-display text-base font-semibold">Create Course</h2>
              <input
                type="text"
                value={courseForm.titleEn}
                onChange={(e) => setCourseForm((c) => ({ ...c, titleEn: e.target.value }))}
                placeholder="Course Title"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
                required
              />
              <textarea
                rows={2}
                value={courseForm.summaryEn}
                onChange={(e) => setCourseForm((c) => ({ ...c, summaryEn: e.target.value }))}
                placeholder="Course learning summary"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
                required
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={courseForm.stage}
                  onChange={(e) => setCourseForm((c) => ({ ...c, stage: Number(e.target.value) }))}
                  aria-label="Course Stage"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 font-mono text-xs"
                />
                <select
                  aria-label="Course Difficulty"
                  value={courseForm.difficulty}
                  onChange={(e) => setCourseForm((c) => ({ ...c, difficulty: e.target.value }))}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5 text-xs"
                >
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
                <input
                  type="text"
                  value={courseForm.prerequisiteSlug}
                  onChange={(e) => setCourseForm((c) => ({ ...c, prerequisiteSlug: e.target.value }))}
                  placeholder="Prerequisite slug (optional)"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950"
              >
                Create Course
              </button>
            </form>

            {/* Lesson Authoring */}
            <form
              onSubmit={handleCreateLesson}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3"
            >
              <h2 className="font-display text-base font-semibold">Add Lesson to Course</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  aria-label="Target Course"
                  value={lessonForm.courseId}
                  onChange={(e) => setLessonForm((l) => ({ ...l, courseId: e.target.value }))}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
                  required
                >
                  {data.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      Stage {c.stage}: {c.titleEn}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={lessonForm.titleEn}
                  onChange={(e) => setLessonForm((l) => ({ ...l, titleEn: e.target.value }))}
                  placeholder="Lesson Title"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
                  required
                />
              </div>
              <textarea
                rows={2}
                value={lessonForm.contentEn}
                onChange={(e) => setLessonForm((l) => ({ ...l, contentEn: e.target.value }))}
                placeholder="Lesson body explanation"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
                required
              />
              <input
                type="text"
                value={lessonForm.practicalExample}
                onChange={(e) => setLessonForm((l) => ({ ...l, practicalExample: e.target.value }))}
                placeholder="Practical command/code example (optional)"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 font-mono text-xs"
              />
              <button
                type="submit"
                className="rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950"
              >
                Publish Lesson
              </button>
            </form>
          </div>

          {/* Courses List with Publish/Unpublish */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
            <h2 className="font-display text-base font-semibold">Courses & Publish Controls</h2>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {data.courses.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="font-semibold">
                      Stage {c.stage} · {c.titleEn}{' '}
                      <span className="font-mono text-slate-500">({c.slug})</span>
                    </p>
                    <p className="text-slate-500">
                      {c.lessons.length} lessons · {c.difficulty}{' '}
                      {c.prerequisiteSlug ? `· Prereq: ${c.prerequisiteSlug}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      runAction(`Course '${c.titleEn}' visibility updated.`, async () => {
                        await apiFetch(`/api/admin/courses/${c.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ published: !c.published }),
                        });
                      })
                    }
                    className={`rounded px-3 py-1 font-medium ${
                      c.published
                        ? 'border border-amber-500/40 text-amber-500'
                        : 'bg-emerald-500 text-slate-950'
                    }`}
                  >
                    {c.published ? 'Unpublish' : 'Publish'}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Author CTF + Manage Existing Challenges & Submissions */}
          <div className="grid gap-6 lg:grid-cols-2">
            <form
              onSubmit={handleCreateCtf}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3"
            >
              <h2 className="font-display text-base font-semibold">Author CTF Challenge</h2>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  type="text"
                  value={ctfTitle}
                  onChange={(e) => setCtfTitle(e.target.value)}
                  placeholder="Challenge Title"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
                  required
                />
                <select
                  aria-label="Challenge Category"
                  value={ctfCat}
                  onChange={(e) => setCtfCat(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-2 text-xs"
                >
                  <option>Linux Fundamentals</option>
                  <option>Networking & PCAP</option>
                  <option>Web Exploitation</option>
                  <option>Cryptography</option>
                  <option>Digital Forensics</option>
                  <option>Reverse Engineering</option>
                  <option>Binary Exploitation</option>
                  <option>OSINT</option>
                  <option>Cloud & Container Security</option>
                  <option>SOC / Log Analysis</option>
                  <option>Steganography</option>
                  <option>API Security</option>
                  <option>AI / LLM Security</option>
                  <option>Hardware & IoT</option>
                </select>
                <select
                  aria-label="Challenge Difficulty"
                  value={ctfDifficulty}
                  onChange={(e) => setCtfDifficulty(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-2 text-xs"
                >
                  <option>Beginner</option>
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                  <option>Expert</option>
                  <option>Research Level</option>
                </select>
              </div>
              <textarea
                rows={3}
                value={ctfDesc}
                onChange={(e) => setCtfDesc(e.target.value)}
                placeholder="Challenge prompt and external documentation links"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-2.5 text-xs"
                required
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={ctfFlag}
                  onChange={(e) => setCtfFlag(e.target.value)}
                  placeholder="Secret Flag (never stored plaintext)"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono text-xs"
                  required
                />
                <input
                  type="number"
                  value={ctfPts}
                  onChange={(e) => setCtfPts(Number(e.target.value))}
                  aria-label="Base Points"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono text-xs"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={ctfAttachmentName}
                  onChange={(e) => setCtfAttachmentName(e.target.value)}
                  placeholder="Artifact filename (optional, e.g. trace.log)"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 font-mono text-xs"
                />
                <input
                  type="text"
                  value={ctfAttachmentContent}
                  onChange={(e) => setCtfAttachmentContent(e.target.value)}
                  placeholder="Artifact text payload (optional)"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 font-mono text-xs"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Publish Challenge
              </button>
            </form>

            {/* Challenge Status + Submissions */}
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
                <h2 className="font-display text-base font-semibold">CTF Challenge Controls</h2>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {data.ctfChallenges.map((ch) => (
                    <div key={ch.id} className="flex items-center justify-between gap-2 py-2.5">
                      <div>
                        <p className="font-semibold">
                          {ch.title} ({ch.currentPoints} pts)
                        </p>
                        <p className="text-slate-500">
                          {ch.category} · {ch.difficulty} · {ch.solveCount} solves
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          runAction(`Challenge '${ch.title}' status toggled.`, async () => {
                            await apiFetch(`/api/admin/ctf/${ch.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ published: !ch.published }),
                            });
                          })
                        }
                        className={`rounded px-2.5 py-1 font-medium ${
                          ch.published
                            ? 'border border-rose-500/40 text-rose-500'
                            : 'bg-emerald-500 text-slate-950'
                        }`}
                      >
                        {ch.published ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
                <h2 className="font-display text-base font-semibold">Recent Flag Submissions</h2>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {data.ctfSubmissions.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between gap-2 py-2">
                      <div>
                        <p className="font-medium">
                          @{sub.username} · {sub.challengeTitle}
                        </p>
                        <p className="font-mono text-slate-500">
                          {sub.submittedFlagMasked} · suspicion {sub.suspicionScore}
                        </p>
                      </div>
                      <span className={sub.isCorrect ? 'text-emerald-500 font-semibold' : 'text-rose-500'}>
                        {sub.isCorrect ? `+${sub.pointsAwarded}` : 'Rejected'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Books & Knowledge Library Management */}
          <div className="grid gap-6 lg:grid-cols-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runAction('Book catalog entry added.', async () => {
                  await apiFetch('/api/admin/books', {
                    method: 'POST',
                    body: JSON.stringify(bookForm),
                  });
                  setBookForm((b) => ({ ...b, title: '', author: '', publisher: '', officialUrl: '', description: '' }));
                });
              }}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3"
            >
              <h2 className="font-display text-base font-semibold">Add Book to Knowledge Library</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={bookForm.title}
                  onChange={(e) => setBookForm((b) => ({ ...b, title: e.target.value }))}
                  placeholder="Book Title"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                  required
                />
                <input
                  type="text"
                  value={bookForm.author}
                  onChange={(e) => setBookForm((b) => ({ ...b, author: e.target.value }))}
                  placeholder="Author(s)"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                  required
                />
                <input
                  type="text"
                  value={bookForm.category}
                  onChange={(e) => setBookForm((b) => ({ ...b, category: e.target.value }))}
                  placeholder="Category (e.g. Cryptography)"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={bookForm.publisher}
                  onChange={(e) => setBookForm((b) => ({ ...b, publisher: e.target.value }))}
                  placeholder="Publisher / Standards Body"
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                />
                <input
                  type="url"
                  value={bookForm.officialUrl}
                  onChange={(e) => setBookForm((b) => ({ ...b, officialUrl: e.target.value }))}
                  placeholder="https://official-publisher.example/book"
                  className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                  required
                />
                <select
                  aria-label="Book License Type"
                  value={bookForm.licenseType}
                  onChange={(e) => {
                    const isOpen = e.target.value.toLowerCase().includes('open') || e.target.value.toLowerCase().includes('public');
                    setBookForm((b) => ({
                      ...b,
                      licenseType: e.target.value,
                      isFree: isOpen,
                      canReadOnline: isOpen,
                      canDownload: isOpen,
                    }));
                  }}
                  className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                >
                  <option>Open Access (Free Online Read & Download)</option>
                  <option>CC BY-NC-SA 4.0 Open Textbook</option>
                  <option>Public Domain / US Government Publication</option>
                  <option>Copyrighted — Official External Publisher Reference Only</option>
                </select>
              </div>
              <textarea
                rows={2}
                value={bookForm.description}
                onChange={(e) => setBookForm((b) => ({ ...b, description: e.target.value }))}
                placeholder="Book summary and learning scope..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-2 text-xs"
              />
              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950"
              >
                Publish Book Entry
              </button>
            </form>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
              <h2 className="font-display text-base font-semibold">
                Library Catalog ({data.books?.length ?? 0} Books)
              </h2>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {(data.books || []).map((bk) => (
                  <div key={bk.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{bk.title}</p>
                      <p className="text-slate-500 truncate">
                        {bk.category} · {bk.isFree ? 'Open Access' : 'Publisher Ref'} ·{' '}
                        <span className="font-mono">{bk.status}</span>
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          runAction(`Book '${bk.title}' status updated.`, async () => {
                            await apiFetch(`/api/admin/books/${bk.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: bk.status === 'published' ? 'archived' : 'published' }),
                            });
                          })
                        }
                        className="rounded border border-slate-200 dark:border-slate-700 px-2 py-1"
                      >
                        {bk.status === 'published' ? 'Archive' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runAction(`Deleted '${bk.title}'.`, async () => {
                            await apiFetch(`/api/admin/books/${bk.id}`, { method: 'DELETE' });
                          })
                        }
                        className="text-rose-500 hover:underline px-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION F: COMMUNICATION & MODERATION */}
      {data && tab === 'moderation' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-cyan-500" />
              <h2 className="font-display text-base font-semibold">Reported Chat Messages & Channels</h2>
            </div>
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-slate-400">Chat Channels</p>
              {data.chatChannels.map((ch) => (
                <div
                  key={ch.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{ch.name}</p>
                    <p className="text-slate-500">
                      {ch.channelType} · {ch.isEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      runAction('Chat channel access updated.', async () => {
                        await apiFetch(`/api/admin/chat/channels/${ch.id}/toggle`, {
                          method: 'POST',
                          body: JSON.stringify({ isEnabled: !ch.isEnabled }),
                        });
                      })
                    }
                    className="rounded border border-slate-200 dark:border-slate-700 px-2.5 py-1"
                  >
                    {ch.isEnabled ? 'Suspend Chat' : 'Enable Chat'}
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <p className="font-semibold text-slate-400">Reported Messages</p>
              {data.reportedMessages.length === 0 ? (
                <p className="text-slate-500">No flagged chat messages.</p>
              ) : (
                data.reportedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3"
                  >
                    <div>
                      <p className="font-mono text-rose-500">@{msg.senderUsername}</p>
                      <p className="mt-1">{msg.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        runAction('Reported message deleted.', async () => {
                          await apiFetch(`/api/chat/messages/${msg.id}`, { method: 'DELETE' });
                        })
                      }
                      className="inline-flex items-center gap-1 text-rose-500 hover:underline shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <h2 className="font-display text-base font-semibold">Security & Community Reports</h2>
            </div>
            {data.securityReports.length === 0 ? (
              <p className="text-xs text-slate-500">No open security reports.</p>
            ) : (
              data.securityReports.map((rep) => (
                <div
                  key={rep.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs"
                >
                  <div>
                    <p className="font-medium">
                      {rep.targetType} #{rep.targetId} · <span className="font-mono">{rep.status}</span>
                    </p>
                    <p className="text-slate-500">{rep.reason}</p>
                  </div>
                  {rep.status === 'open' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          runAction('Report resolved.', async () => {
                            await apiFetch(`/api/admin/reports/${rep.id}/resolve`, {
                              method: 'POST',
                              body: JSON.stringify({ status: 'resolved' }),
                            });
                          })
                        }
                        className="text-emerald-500 hover:underline font-medium"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runAction('Report dismissed.', async () => {
                            await apiFetch(`/api/admin/reports/${rep.id}/resolve`, {
                              method: 'POST',
                              body: JSON.stringify({ status: 'dismissed' }),
                            });
                          })
                        }
                        className="text-slate-400 hover:underline font-medium"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Disciplinary Appeals Queue */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
            <h2 className="font-display text-base font-semibold">Disciplinary Appeals Queue</h2>
            {!data.appeals || data.appeals.length === 0 ? (
              <p className="text-xs text-slate-500">No disciplinary appeals submitted yet.</p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {data.appeals.map((ap) => (
                  <div key={ap.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-semibold">
                        @{ap.username} ({ap.userEmail}) · {ap.scope.replace(/_/g, ' ')}
                      </p>
                      <p className="text-slate-500">{ap.reason}</p>
                      <p className="font-mono text-[11px] text-cyan-500">Status: {ap.status}</p>
                    </div>
                    {ap.status === 'open' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            runAction('Appeal approved & access restored.', async () => {
                              await apiFetch(`/api/admin/appeals/${ap.id}/review`, {
                                method: 'POST',
                                body: JSON.stringify({ decision: 'approved', adminNote: 'Appeal approved after review' }),
                              });
                            })
                          }
                          className="rounded bg-emerald-500 px-3 py-1 font-semibold text-slate-950"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            runAction('Appeal declined.', async () => {
                              await apiFetch(`/api/admin/appeals/${ap.id}/review`, {
                                method: 'POST',
                                body: JSON.stringify({ decision: 'rejected', adminNote: 'Decision upheld' }),
                              });
                            })
                          }
                          className="rounded border border-rose-500/40 px-3 py-1 text-rose-500"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Certificate Revocation & Reinstatement */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
            <h2 className="font-display text-base font-semibold">Issued Certificates & Verification Revocation</h2>
            {!data.certificates || data.certificates.length === 0 ? (
              <p className="text-xs text-slate-500">No certificates issued yet.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {data.certificates.map((cert) => (
                  <div key={cert.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-semibold">
                        {cert.title} <span className="font-mono text-cyan-500">({cert.verificationId})</span>
                      </p>
                      <p className="text-slate-500">
                        {cert.recipientName} ({cert.recipientEmail}) ·{' '}
                        {cert.isRevoked ? `REVOKED: ${cert.revokedReason || 'Policy'}` : 'Valid'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        runAction(cert.isRevoked ? 'Certificate reinstated.' : 'Certificate revoked.', async () => {
                          await apiFetch(`/api/admin/certificates/${cert.id}/revoke`, {
                            method: 'POST',
                            body: JSON.stringify({
                              isRevoked: !cert.isRevoked,
                              reason: 'Administrative credential review',
                            }),
                          });
                        })
                      }
                      className={`rounded px-2.5 py-1 font-medium ${
                        cert.isRevoked
                          ? 'bg-emerald-500 text-slate-950'
                          : 'border border-rose-500/40 text-rose-500'
                      }`}
                    >
                      {cert.isRevoked ? 'Reinstate' : 'Revoke'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION G: PLATFORM SECURITY & SETTINGS */}
      {data && tab === 'security' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Audit Trail */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <h2 className="font-display text-base font-semibold">Tamper-Resistant Audit Trail</h2>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {data.auditLogs.map((log) => (
                  <div key={log.id} className="py-2.5">
                    <p className="font-mono font-semibold text-cyan-500">{log.action}</p>
                    <p className="text-slate-500">
                      {log.actorEmail || 'system'} · {log.resourceType} #{log.resourceId} ·{' '}
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Login History */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-purple-500" />
                <h2 className="font-display text-base font-semibold">Recent Authentication & IP Activity</h2>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {data.loginHistory.map((login) => (
                  <div key={login.id} className="py-2.5">
                    <p className="font-medium">
                      {login.userEmail} ·{' '}
                      <span className={login.status === 'success' ? 'text-emerald-500' : 'text-rose-500'}>
                        {login.status}
                      </span>
                    </p>
                    <p className="font-mono text-slate-500">
                      {login.ipAddress} · {new Date(login.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Owner Platform Settings & Kill Switches */}
          <form
            onSubmit={handleSaveSettings}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4 max-w-2xl"
          >
            <h2 className="font-display text-base font-semibold">Platform Controls & Feature Switches (Owner)</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs">
                <span>Worldwide Registration Open</span>
                <input
                  type="checkbox"
                  checked={settingsDraft.registrationOpen}
                  onChange={(e) => setSettingsDraft((s) => ({ ...s, registrationOpen: e.target.checked }))}
                  className="accent-emerald-500"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs">
                <span>Maintenance Mode Banner</span>
                <input
                  type="checkbox"
                  checked={settingsDraft.maintenanceMode}
                  onChange={(e) => setSettingsDraft((s) => ({ ...s, maintenanceMode: e.target.checked }))}
                  className="accent-rose-500"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs">
                <span>Disable AI Cyber Mentor</span>
                <input
                  type="checkbox"
                  checked={settingsDraft.disableAiMentor}
                  onChange={(e) => setSettingsDraft((s) => ({ ...s, disableAiMentor: e.target.checked }))}
                  className="accent-rose-500"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs">
                <span>Disable Community Hub</span>
                <input
                  type="checkbox"
                  checked={settingsDraft.disableCommunity}
                  onChange={(e) => setSettingsDraft((s) => ({ ...s, disableCommunity: e.target.checked }))}
                  className="accent-rose-500"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs sm:col-span-2">
                <span>Require MFA for Owner & Admins</span>
                <input
                  type="checkbox"
                  checked={settingsDraft.requireMfaForAdmins}
                  onChange={(e) => setSettingsDraft((s) => ({ ...s, requireMfaForAdmins: e.target.checked }))}
                  className="accent-emerald-500"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="ai-quota" className="block text-xs font-semibold mb-1">
                  AI Cyber Mentor Daily Quota
                </label>
                <input
                  id="ai-quota"
                  type="number"
                  value={settingsDraft.aiDailyQuotaPerUser}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({ ...s, aiDailyQuotaPerUser: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label htmlFor="lab-minutes" className="block text-xs font-semibold mb-1">
                  Lab Max Duration (Minutes)
                </label>
                <input
                  id="lab-minutes"
                  type="number"
                  value={settingsDraft.labMaxMinutes}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({ ...s, labMaxMinutes: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono text-xs"
                />
              </div>
            </div>
            <div>
              <label htmlFor="global-ann" className="block text-xs font-semibold mb-1">
                Global Platform Announcement
              </label>
              <input
                id="global-ann"
                type="text"
                value={settingsDraft.globalAnnouncement}
                onChange={(e) =>
                  setSettingsDraft((s) => ({ ...s, globalAnnouncement: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Save Platform Settings
            </button>
          </form>

          {/* Governance Permissions Matrix */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAction('Platform governance permissions matrix saved.', async () => {
                await apiFetch('/api/admin/permissions', {
                  method: 'POST',
                  body: JSON.stringify(permMatrixDraft),
                });
              });
            }}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4"
          >
            <h2 className="font-display text-base font-semibold">Platform Permissions Governance Matrix</h2>
            <p className="text-xs text-slate-500">
              Define and audit clear platform governance rules across team creation, private rooms, chat oversight, and rule locks.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
              {[
                { key: 'whoCanCreateTeams', label: 'Who Can Create Teams' },
                { key: 'whoCanCreateRooms', label: 'Who Can Create Rooms' },
                { key: 'whoCanJoinPrivateRooms', label: 'Who Can Join Private Rooms' },
                { key: 'whoCanInviteMembers', label: 'Who Can Invite Members' },
                { key: 'whoCanAccessTeamChat', label: 'Who Can Access Team Chat' },
                { key: 'whoCanViewScores', label: 'Who Can View Scores' },
                { key: 'whoCanManageMemberships', label: 'Who Can Manage Memberships' },
                { key: 'whoCanChangeRules', label: 'Who Can Change Competition Rules' },
                { key: 'whoCanAccessAdminInfo', label: 'Who Can Access Administrative Info' },
              ].map((item) => (
                <div key={item.key}>
                  <label htmlFor={`perm-${item.key}`} className="block font-semibold mb-1">
                    {item.label}
                  </label>
                  <input
                    id={`perm-${item.key}`}
                    type="text"
                    value={permMatrixDraft[item.key] || ''}
                    onChange={(e) =>
                      setPermMatrixDraft((p) => ({ ...p, [item.key]: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                  />
                </div>
              ))}
            </div>
            <button
              type="submit"
              className="rounded-lg bg-cyan-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
            >
              Save Governance Matrix
            </button>
          </form>

          {/* IP Violation, Takedown & Dispute Queue */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <h2 className="font-display text-base font-semibold">
                  Intellectual Property Violation, Takedown &amp; Counter-Dispute Queue
                </h2>
              </div>
              <span className="font-mono text-xs text-slate-500">
                Open Cases: {data.metrics.openIpReports ?? 0}
              </span>
            </div>

            {!data.ipViolationReports || data.ipViolationReports.length === 0 ? (
              <p className="text-xs text-slate-500">No IP violation or dispute filings recorded.</p>
            ) : (
              <div className="space-y-3">
                {data.ipViolationReports.map((ipRep) => (
                  <div
                    key={ipRep.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-4 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-mono font-semibold text-cyan-500">
                        {ipRep.referenceCode} · {ipRep.reportType.replace(/_/g, ' ')} ({ipRep.targetType})
                      </div>
                      <span className="font-mono uppercase text-emerald-500">{ipRep.status}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">
                      <strong>Target:</strong> {ipRep.targetRef} · <strong>Reporter:</strong> {ipRep.reporterName} (
                      {ipRep.reporterEmail}
                      {ipRep.organization ? ` · ${ipRep.organization}` : ''})
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">{ipRep.description}</p>
                    {ipRep.counterNoticeText && (
                      <p className="text-cyan-600 dark:text-cyan-400">
                        <strong>Counter-Notice:</strong> {ipRep.counterNoticeText}
                      </p>
                    )}
                    {ipRep.evidenceUrl && ipRep.evidenceUrl.startsWith('https://') && (
                      <a
                        href={ipRep.evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-cyan-500 hover:underline font-mono"
                      >
                        Evidence: {ipRep.evidenceUrl}
                      </a>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <input
                        type="text"
                        value={ipReviewNotes[ipRep.id] ?? ipRep.adminResolutionNote ?? ''}
                        onChange={(e) =>
                          setIpReviewNotes((prev) => ({ ...prev, [ipRep.id]: e.target.value }))
                        }
                        placeholder="Administrative resolution or takedown note..."
                        className="min-w-[220px] flex-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#11161F] px-2.5 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          runAction(`Updated IP case ${ipRep.referenceCode} to under review.`, async () => {
                            await apiFetch(`/api/admin/ip-reports/${ipRep.id}/review`, {
                              method: 'POST',
                              body: JSON.stringify({
                                status: 'under_review',
                                adminResolutionNote: ipReviewNotes[ipRep.id] || 'Case under legal/IP review.',
                              }),
                            });
                          })
                        }
                        className="rounded border border-cyan-500/40 px-2.5 py-1.5 font-semibold text-cyan-500 hover:bg-cyan-500/10"
                      >
                        Under Review
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runAction(`Executed takedown for IP case ${ipRep.referenceCode}.`, async () => {
                            await apiFetch(`/api/admin/ip-reports/${ipRep.id}/review`, {
                              method: 'POST',
                              body: JSON.stringify({
                                status: 'takedown_executed',
                                unpublishTarget: true,
                                adminResolutionNote:
                                  ipReviewNotes[ipRep.id] || 'Content unpublished pending IP resolution.',
                              }),
                            });
                          })
                        }
                        className="rounded bg-amber-500 px-2.5 py-1.5 font-semibold text-slate-950 hover:bg-amber-400"
                      >
                        Takedown &amp; Unpublish
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runAction(`Resolved IP case ${ipRep.referenceCode}.`, async () => {
                            await apiFetch(`/api/admin/ip-reports/${ipRep.id}/review`, {
                              method: 'POST',
                              body: JSON.stringify({
                                status: 'resolved',
                                adminResolutionNote: ipReviewNotes[ipRep.id] || 'Resolved by KALI3977 admin team.',
                              }),
                            });
                          })
                        }
                        className="rounded bg-emerald-500 px-2.5 py-1.5 font-semibold text-slate-950 hover:bg-emerald-400"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runAction(`Rejected IP claim ${ipRep.referenceCode}.`, async () => {
                            await apiFetch(`/api/admin/ip-reports/${ipRep.id}/review`, {
                              method: 'POST',
                              body: JSON.stringify({
                                status: 'rejected',
                                adminResolutionNote:
                                  ipReviewNotes[ipRep.id] || 'Insufficient documentation or authorized educational use.',
                              }),
                            });
                          })
                        }
                        className="rounded border border-rose-500/40 px-2.5 py-1.5 font-semibold text-rose-500 hover:bg-rose-500/10"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deployment, Source Code & Backup Readiness Posture */}
          {data.securityPosture && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-emerald-500" />
                <h2 className="font-display text-base font-semibold">
                  Source, API &amp; Anti-Cloning Technical Posture
                </h2>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 font-mono">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
                  Production Source Maps:{' '}
                  <span className="text-emerald-500">
                    {data.securityPosture.sourcemapDisabledInBuild ? 'DISABLED' : 'ENABLED'}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
                  X-Powered-By Header:{' '}
                  <span className="text-emerald-500">
                    {data.securityPosture.xPoweredByDisabled ? 'STRIPPED' : 'EXPOSED'}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
                  Sensitive Route Cache:{' '}
                  <span className="text-emerald-500">
                    {data.securityPosture.cacheNoStoreSensitiveRoutes ? 'NO-STORE' : 'DEFAULT'}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
                  Anti-Scraping Monitor:{' '}
                  <span className="text-emerald-500">
                    {data.securityPosture.antiScrapingActive ? 'ACTIVE' : 'INACTIVE'} (
                    {data.securityPosture.abuseEventsRecent} recent alerts)
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
                  Owner Bootstrapping:{' '}
                  <span className="text-emerald-500">
                    {data.securityPosture.ownerEmailConfiguredServerSide ? 'SERVER-SIDE' : 'UNSET'}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
                  Flag HMAC Secret Env:{' '}
                  <span className={data.securityPosture.flagHmacSecretConfigured ? 'text-emerald-500' : 'text-amber-500'}>
                    {data.securityPosture.flagHmacSecretConfigured ? 'CUSTOM ENV' : 'FALLBACK EPHEMERAL'}
                  </span>
                </div>
              </div>
              <p className="text-slate-500 dark:text-slate-400">
                External operational steps (managed outside app code): keep repository private with protected main
                branch/CI secrets, enable Cloud SQL automated daily backups &amp; PITR in GCP asia-southeast1, and
                obtain formal trademark clearance before switching ™ to ®.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SECTION H: GAMES ARENA MANAGEMENT */}
      {tab === 'games' && <GamesAdminPanel />}

      {/* SECTION I: AI CYBER MENTOR QUOTAS & BUDGET */}
      {tab === 'ai_mentor' && <AiMentorAdminPanel />}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title || ''}
        description={confirmAction?.desc || ''}
        confirmLabel="Confirm"
        onConfirm={async () => {
          if (confirmAction) {
            await confirmAction.run();
            setConfirmAction(null);
          }
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};
