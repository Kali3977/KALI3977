import type { UserRole } from './rbac';

export interface RoomCandidate {
  id: number;
  competitionId: number;
  roomCode: string;
  isActive: boolean;
  isLocked: boolean;
  maxParticipants: number;
  currentParticipants: number;
  usageCount: number;
  usageLimit: number | null;
  expiresAt: Date | null;
}

export interface TeamCandidate {
  id: number;
  competitionId: number | null;
  campusId: number | null;
  name: string;
  teamCode: string;
  isActive: boolean;
  isSuspended: boolean;
  maxMembers: number;
  currentMembers: number;
  codeUsageCount: number;
  codeUsageLimit: number | null;
  codeExpiresAt: Date | null;
}

export interface CompetitionPolicy {
  id: number;
  status: string;
  enrollmentPolicy: string;
  allowLateJoin: boolean;
  totalCapacity: number;
  perTeamCapacity: number;
  registrationDeadline?: Date | null;
}

export interface JoinValidationResult {
  allowed: boolean;
  code: string;
  message: string;
}

export function doesEmailMatchCampusDomain(
  email: string | null | undefined,
  emailVerified: boolean,
  campusDomain: string | null | undefined,
): boolean {
  if (!email || !emailVerified || !campusDomain) return false;
  const parts = email.toLowerCase().trim().split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  const expected = campusDomain.toLowerCase().trim().replace(/^@/, '');
  if (!expected) return false;
  return domain === expected || domain.endsWith(`.${expected}`);
}

export function validateRoomAndTeamJoin(params: {
  room: RoomCandidate | null;
  team: TeamCandidate | null;
  competition: CompetitionPolicy | null;
  userCampusId: number | null;
  existingParticipationInCompetition: { teamId: number; status?: string } | null;
  teamRemovalState?: { status: string; expiresAt: Date | null } | null;
  now?: Date;
}): JoinValidationResult {
  const now = params.now ?? new Date();
  const { room, team, competition } = params;

  if (!room) {
    return { allowed: false, code: 'INVALID_ROOM_CODE', message: 'Room code is invalid or does not exist.' };
  }
  if (!room.isActive || room.isLocked) {
    return { allowed: false, code: 'ROOM_DISABLED', message: 'This competition room is currently closed or locked.' };
  }
  if (room.expiresAt && room.expiresAt.getTime() <= now.getTime()) {
    return { allowed: false, code: 'ROOM_CODE_EXPIRED', message: 'This room code has expired.' };
  }
  if (room.usageLimit !== null && room.usageCount >= room.usageLimit) {
    return { allowed: false, code: 'ROOM_CODE_LIMIT_REACHED', message: 'This room code has reached its usage limit.' };
  }
  if (room.currentParticipants >= room.maxParticipants) {
    return { allowed: false, code: 'ROOM_CAPACITY_REACHED', message: 'This competition room is at full capacity.' };
  }

  if (!competition) {
    return { allowed: false, code: 'COMPETITION_NOT_FOUND', message: 'Competition configuration not found.' };
  }
  if (competition.status === 'cancelled' || competition.status === 'ended') {
    return { allowed: false, code: 'COMPETITION_CLOSED', message: 'This competition has ended or was cancelled.' };
  }
  if (competition.status === 'paused') {
    return { allowed: false, code: 'COMPETITION_PAUSED', message: 'This competition is currently paused by organizers.' };
  }
  if (
    competition.registrationDeadline &&
    competition.registrationDeadline.getTime() < now.getTime() &&
    competition.status === 'registration_open'
  ) {
    return { allowed: false, code: 'REGISTRATION_CLOSED', message: 'The registration deadline for this competition has passed.' };
  }
  if (competition.status === 'active' && !competition.allowLateJoin) {
    return { allowed: false, code: 'LATE_JOIN_DISABLED', message: 'Late joining is disabled for this active competition.' };
  }
  if (room.currentParticipants >= competition.totalCapacity) {
    return { allowed: false, code: 'COMPETITION_CAPACITY_REACHED', message: 'Competition participant capacity has been reached.' };
  }

  if (!team) {
    return { allowed: false, code: 'INVALID_TEAM_CODE', message: 'Team code is invalid or does not exist.' };
  }
  if (room.roomCode === team.teamCode) {
    return { allowed: false, code: 'CODE_SEPARATION_VIOLATION', message: 'Room code and Team code must be distinct.' };
  }
  if (!team.isActive || team.isSuspended) {
    return { allowed: false, code: 'TEAM_DISABLED', message: 'This team is currently inactive or suspended.' };
  }
  if (team.competitionId !== null && team.competitionId !== competition.id) {
    return { allowed: false, code: 'TEAM_WRONG_COMPETITION', message: 'This team code belongs to a different competition.' };
  }
  if (team.codeExpiresAt && team.codeExpiresAt.getTime() <= now.getTime()) {
    return { allowed: false, code: 'TEAM_CODE_EXPIRED', message: 'This team code has expired.' };
  }
  if (team.codeUsageLimit !== null && team.codeUsageCount >= team.codeUsageLimit) {
    return { allowed: false, code: 'TEAM_CODE_LIMIT_REACHED', message: 'This team code has reached its usage limit.' };
  }
  const effectiveTeamCap = Math.min(team.maxMembers, competition.perTeamCapacity);
  if (team.currentMembers >= effectiveTeamCap) {
    return { allowed: false, code: 'TEAM_CAPACITY_REACHED', message: 'This campus team has reached maximum capacity.' };
  }

  if (competition.enrollmentPolicy === 'campus_verified') {
    if (!params.userCampusId || !team.campusId || params.userCampusId !== team.campusId) {
      return {
        allowed: false,
        code: 'CAMPUS_VERIFICATION_REQUIRED',
        message: 'This competition requires your verified campus affiliation to match the team campus.',
      };
    }
  }

  if (params.teamRemovalState) {
    if (params.teamRemovalState.status === 'perm_removed') {
      return {
        allowed: false,
        code: 'TEAM_PERMANENTLY_REMOVED',
        message: 'You were permanently removed from this team. Submit an appeal or contact an administrator.',
      };
    }
    if (
      params.teamRemovalState.status === 'temp_removed' &&
      (!params.teamRemovalState.expiresAt || params.teamRemovalState.expiresAt.getTime() > now.getTime())
    ) {
      return {
        allowed: false,
        code: 'TEAM_TEMPORARILY_REMOVED',
        message: 'You are temporarily removed from this team.',
      };
    }
  }

  if (params.existingParticipationInCompetition) {
    if (params.existingParticipationInCompetition.status === 'removed') {
      return {
        allowed: false,
        code: 'COMPETITION_PARTICIPANT_REMOVED',
        message: 'You were removed from this competition room. Submit an appeal for review.',
      };
    }
    if (params.existingParticipationInCompetition.teamId !== team.id) {
      return {
        allowed: false,
        code: 'TEAM_SWITCH_FORBIDDEN',
        message: 'Unauthorized team switching is blocked once registered in this competition.',
      };
    }
    return {
      allowed: false,
      code: 'DUPLICATE_PARTICIPATION',
      message: 'You are already registered in this competition.',
    };
  }

  return { allowed: true, code: 'OK', message: 'Validated room and team codes.' };
}

export function calculateDynamicCtfPoints(
  basePoints: number,
  solveCount: number,
  minPoints: number = 100,
): number {
  const floor = Math.min(minPoints, basePoints);
  if (solveCount <= 0) return basePoints;
  const decay = Math.floor((basePoints - floor) * (1 - 1 / (1 + solveCount * 0.12)));
  return Math.max(floor, basePoints - decay);
}

export function calculateLevelFromXp(xp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPct: number;
} {
  const safeXp = Math.max(0, Math.floor(xp));
  const level = Math.floor(Math.sqrt(safeXp / 100)) + 1;
  const currentThreshold = Math.pow(level - 1, 2) * 100;
  const nextThreshold = Math.pow(level, 2) * 100;
  const span = Math.max(1, nextThreshold - currentThreshold);
  const progressPct = Math.min(100, Math.round(((safeXp - currentThreshold) / span) * 100));
  return {
    level,
    currentLevelXp: safeXp - currentThreshold,
    nextLevelXp: nextThreshold - currentThreshold,
    progressPct,
  };
}

export function createCompetitionRulesSnapshot(comp: {
  gameMode: string;
  scoringSystem: string;
  totalCapacity: number;
  perTeamCapacity: number;
  maxTeams: number;
  penaltyPerWrongFlag: number;
  hintsEnabled: boolean;
  allowLateJoin: boolean;
  enrollmentPolicy: string;
  durationMinutes: number;
}) {
  return {
    snapshottedAt: new Date().toISOString(),
    gameMode: comp.gameMode,
    scoringSystem: comp.scoringSystem,
    totalCapacity: comp.totalCapacity,
    perTeamCapacity: comp.perTeamCapacity,
    maxTeams: comp.maxTeams,
    penaltyPerWrongFlag: comp.penaltyPerWrongFlag,
    hintsEnabled: comp.hintsEnabled,
    allowLateJoin: comp.allowLateJoin,
    enrollmentPolicy: comp.enrollmentPolicy,
    durationMinutes: comp.durationMinutes,
  };
}

export function evaluateChatAccess(params: {
  channelType: string;
  channelTeamId: number | null;
  channelEnabled: boolean;
  userRole: UserRole;
  userTeamIds: number[];
  isCaptainOfChannelTeam: boolean;
  isMutedInChat?: boolean;
  isWrite?: boolean;
}): { allowed: boolean; reason: string } {
  if (!params.channelEnabled && params.userRole !== 'owner' && params.userRole !== 'event_admin') {
    return { allowed: false, reason: 'Channel has been disabled by competition administrators.' };
  }
  if (params.isWrite && params.isMutedInChat && params.userRole !== 'owner') {
    return { allowed: false, reason: 'You are currently muted in team chat by moderation.' };
  }

  switch (params.channelType) {
    case 'announcements':
      return { allowed: true, reason: 'Public competition announcements' };
    case 'team':
      if (params.userRole === 'owner') return { allowed: true, reason: 'Owner oversight' };
      if (!params.channelTeamId || !params.userTeamIds.includes(params.channelTeamId)) {
        return { allowed: false, reason: 'Access restricted to verified members of this team.' };
      }
      return { allowed: true, reason: 'Verified team member' };
    case 'captain':
      if (
        params.userRole === 'owner' ||
        params.userRole === 'event_admin' ||
        params.userRole === 'moderator' ||
        params.isCaptainOfChannelTeam
      ) {
        return { allowed: true, reason: 'Authorized captain or organizer' };
      }
      return { allowed: false, reason: 'Access restricted to team captains, deputies, and organizers.' };
    case 'organizer':
      if (
        params.userRole === 'owner' ||
        params.userRole === 'event_admin' ||
        params.userRole === 'moderator'
      ) {
        return { allowed: true, reason: 'Authorized competition staff' };
      }
      return { allowed: false, reason: 'Access restricted to event admins and moderators.' };
    case 'dm':
      return { allowed: true, reason: 'Participant DM channel' };
    default:
      return { allowed: false, reason: 'Unknown channel type' };
  }
}

export class SlidingWindowRateLimiter {
  private buckets = new Map<string, number[]>();

  check(key: string, limit: number, windowMs: number, nowMs: number = Date.now()): {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
  } {
    const timestamps = (this.buckets.get(key) || []).filter((ts) => nowMs - ts < windowMs);
    if (timestamps.length >= limit) {
      const oldest = timestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (nowMs - oldest)) / 1000));
      this.buckets.set(key, timestamps);
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }
    timestamps.push(nowMs);
    this.buckets.set(key, timestamps);
    return {
      allowed: true,
      remaining: Math.max(0, limit - timestamps.length),
      retryAfterSeconds: 0,
    };
  }
}

export function analyzeWeakSkills(
  categoryStats: Array<{ category: string; solved: number; attempts: number }>,
): Array<{ category: string; accuracyPct: number; recommendation: string }> {
  return categoryStats
    .filter((s) => s.attempts > 0)
    .map((s) => {
      const accuracyPct = Math.round((s.solved / s.attempts) * 100);
      return {
        category: s.category,
        accuracyPct,
        recommendation:
          accuracyPct < 50
            ? `Review foundational ${s.category} lessons and practise beginner labs before attempting timed CTF challenges.`
            : `Continue advancing through intermediate ${s.category} exercises to raise solve consistency.`,
      };
    })
    .filter((s) => s.accuracyPct < 75)
    .sort((a, b) => a.accuracyPct - b.accuracyPct);
}

export interface BracketMatch {
  matchId: string;
  teamA: { id: number; name: string } | null;
  teamB: { id: number; name: string } | null;
  status: string;
  winnerTeamId?: number | null;
  scoreSummary?: string | null;
}

export function generateTournamentBrackets(
  teamsList: Array<{ id: number; name: string }>,
  format: string,
): {
  format: string;
  rounds: Array<{
    round: number;
    label: string;
    matches: BracketMatch[];
  }>;
} {
  if (teamsList.length === 0) {
    return { format, rounds: [] };
  }
  if (format === 'round_robin') {
    const matches: BracketMatch[] = [];
    let idx = 1;
    for (let i = 0; i < teamsList.length; i++) {
      for (let j = i + 1; j < teamsList.length; j++) {
        matches.push({
          matchId: `RR-${idx++}`,
          teamA: teamsList[i],
          teamB: teamsList[j],
          status: 'scheduled',
        });
      }
    }
    return { format, rounds: [{ round: 1, label: 'Round Robin Pool', matches }] };
  }

  if (format === 'group_stage') {
    const mid = Math.ceil(teamsList.length / 2);
    const groupA = teamsList.slice(0, mid);
    const groupB = teamsList.slice(mid);
    const buildGroupMatches = (grp: Array<{ id: number; name: string }>, prefix: string) => {
      const matches: BracketMatch[] = [];
      let idx = 1;
      for (let i = 0; i < grp.length; i++) {
        for (let j = i + 1; j < grp.length; j++) {
          matches.push({
            matchId: `${prefix}-${idx++}`,
            teamA: grp[i],
            teamB: grp[j],
            status: 'scheduled',
          });
        }
      }
      return matches;
    };
    const rounds: Array<{ round: number; label: string; matches: BracketMatch[] }> = [
      { round: 1, label: 'Group A Matches', matches: buildGroupMatches(groupA, 'GA') },
    ];
    if (groupB.length > 0) {
      rounds.push({ round: 2, label: 'Group B Matches', matches: buildGroupMatches(groupB, 'GB') });
    }
    return { format, rounds };
  }

  const round1Matches: BracketMatch[] = [];
  for (let i = 0; i < teamsList.length; i += 2) {
    round1Matches.push({
      matchId: `R1-M${Math.floor(i / 2) + 1}`,
      teamA: teamsList[i] || null,
      teamB: teamsList[i + 1] || null,
      status: teamsList[i + 1] ? 'scheduled' : 'bye',
    });
  }
  return {
    format,
    rounds: [{ round: 1, label: 'Opening Bracket', matches: round1Matches }],
  };
}

export const ADAPTIVE_LEVELS = [
  'Absolute Beginner',
  'Beginner',
  'Elementary',
  'Intermediate',
  'Upper Intermediate',
  'Advanced',
  'Expert',
  'Research and Specialist Level',
] as const;

export type AdaptiveLevel = (typeof ADAPTIVE_LEVELS)[number];

export function evaluateDiagnosticPlacement(
  correctCount: number,
  totalCount: number,
  candidateSkipSlugs: string[] = [],
): {
  scorePct: number;
  verifiedLevel: AdaptiveLevel;
  unlockIntermediate: boolean;
  skippedCourseSlugs: string[];
} {
  const safeTotal = Math.max(1, totalCount);
  const safeCorrect = Math.max(0, Math.min(safeTotal, correctCount));
  const scorePct = Math.round((safeCorrect / safeTotal) * 100);

  let verifiedLevel: AdaptiveLevel = 'Absolute Beginner';
  if (scorePct >= 95) verifiedLevel = 'Research and Specialist Level';
  else if (scorePct >= 88) verifiedLevel = 'Expert';
  else if (scorePct >= 78) verifiedLevel = 'Advanced';
  else if (scorePct >= 65) verifiedLevel = 'Upper Intermediate';
  else if (scorePct >= 50) verifiedLevel = 'Intermediate';
  else if (scorePct >= 35) verifiedLevel = 'Elementary';
  else if (scorePct >= 20) verifiedLevel = 'Beginner';

  const unlockIntermediate = scorePct >= 50;
  const skippedCourseSlugs = unlockIntermediate ? candidateSkipSlugs : [];

  return {
    scorePct,
    verifiedLevel,
    unlockIntermediate,
    skippedCourseSlugs,
  };
}

export function isBookDownloadPermitted(book: {
  canDownload: boolean;
  licenseType: string;
}): boolean {
  if (!book.canDownload) return false;
  const normalized = book.licenseType.toLowerCase();
  return (
    normalized.includes('public domain') ||
    normalized.includes('cc') ||
    normalized.includes('gnu') ||
    normalized.includes('mit') ||
    normalized.includes('apache') ||
    normalized.includes('open access')
  );
}
