export interface GameRoomCandidate {
  id: number;
  roomCode: string;
  gameId: number;
  status: string;
  isLocked: boolean;
  registrationOpen: boolean;
  requiresTeamCode: boolean;
  maxPlayers: number;
  currentPlayers: number;
  usageCount: number;
  usageLimit: number | null;
  expiresAt: Date | null;
}

export interface GameTeamCandidate {
  id: number;
  roomId: number | null;
  campusId: number | null;
  teamCode: string;
  name: string;
  isActive: boolean;
  isSuspended: boolean;
  maxMembers: number;
  currentMembers: number;
  codeUsageCount: number;
  codeUsageLimit: number | null;
  codeExpiresAt: Date | null;
}

export interface GameJoinValidationResult {
  allowed: boolean;
  code: string;
  message: string;
}

export function validateGameRoomJoin(params: {
  room: GameRoomCandidate | null;
  team: GameTeamCandidate | null;
  userId: number;
  userSuspended: boolean;
  userBanned: boolean;
  userCampusId: number | null;
  requiresCampusMatch?: boolean;
  alreadyInRoom: boolean;
  now?: Date;
}): GameJoinValidationResult {
  const now = params.now ?? new Date();
  if (params.userBanned || params.userSuspended) {
    return {
      allowed: false,
      code: 'USER_RESTRICTED',
      message: 'Suspended or banned accounts cannot join Games Arena rooms.',
    };
  }

  const { room, team } = params;
  if (!room) {
    return { allowed: false, code: 'INVALID_ROOM_CODE', message: 'Room code is invalid or does not exist.' };
  }
  if (room.isLocked) {
    return { allowed: false, code: 'ROOM_LOCKED', message: 'This game room has been locked by hosts or admins.' };
  }
  if (!room.registrationOpen && !params.alreadyInRoom) {
    return { allowed: false, code: 'REGISTRATION_CLOSED', message: 'Room entry is closed for new players.' };
  }
  if (['completed', 'terminated'].includes(room.status)) {
    return { allowed: false, code: 'ROOM_ENDED', message: 'This game match has already ended.' };
  }
  if (room.expiresAt && room.expiresAt.getTime() <= now.getTime()) {
    return { allowed: false, code: 'ROOM_CODE_EXPIRED', message: 'This room code has expired.' };
  }
  if (!params.alreadyInRoom && room.usageLimit !== null && room.usageCount >= room.usageLimit) {
    return { allowed: false, code: 'ROOM_CODE_LIMIT_REACHED', message: 'Room code usage limit reached.' };
  }
  if (!params.alreadyInRoom && room.currentPlayers >= room.maxPlayers) {
    return { allowed: false, code: 'ROOM_FULL', message: 'This game room is at maximum player capacity.' };
  }

  if (params.alreadyInRoom) {
    return { allowed: true, code: 'RECONNECT_OK', message: 'Reconnected to active room.' };
  }

  if (room.requiresTeamCode && !team) {
    return {
      allowed: false,
      code: 'TEAM_CODE_REQUIRED',
      message: 'This team/campus match requires a valid Team Code separate from the Room Code.',
    };
  }

  if (team) {
    if (room.roomCode.trim().toUpperCase() === team.teamCode.trim().toUpperCase()) {
      return {
        allowed: false,
        code: 'CODE_SEPARATION_VIOLATION',
        message: 'Room Code and Team Code must be distinct.',
      };
    }
    if (team.roomId !== null && team.roomId !== room.id) {
      return {
        allowed: false,
        code: 'TEAM_WRONG_ROOM',
        message: 'This Team Code belongs to a different game room.',
      };
    }
    if (!team.isActive || team.isSuspended) {
      return { allowed: false, code: 'TEAM_DISABLED', message: 'This team is suspended or inactive.' };
    }
    if (team.codeExpiresAt && team.codeExpiresAt.getTime() <= now.getTime()) {
      return { allowed: false, code: 'TEAM_CODE_EXPIRED', message: 'This team code has expired.' };
    }
    if (team.codeUsageLimit !== null && team.codeUsageCount >= team.codeUsageLimit) {
      return { allowed: false, code: 'TEAM_CODE_LIMIT_REACHED', message: 'Team code usage limit reached.' };
    }
    if (team.currentMembers >= team.maxMembers) {
      return { allowed: false, code: 'TEAM_FULL', message: 'This team roster is full.' };
    }
    if (params.requiresCampusMatch && team.campusId && params.userCampusId !== team.campusId) {
      return {
        allowed: false,
        code: 'CAMPUS_MISMATCH',
        message: 'Your verified campus affiliation does not match this campus team.',
      };
    }
  }

  return { allowed: true, code: 'OK', message: 'Room and team access validated.' };
}

export type GameRankTier = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | 'Elite';

export function calculateGameLevel(gameXp: number): {
  level: number;
  tier: GameRankTier;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPct: number;
} {
  const safeXp = Math.max(0, Math.floor(gameXp));
  const level = Math.floor(Math.sqrt(safeXp / 80)) + 1;
  const currentThreshold = Math.pow(level - 1, 2) * 80;
  const nextThreshold = Math.pow(level, 2) * 80;
  const span = Math.max(1, nextThreshold - currentThreshold);
  const progressPct = Math.min(100, Math.round(((safeXp - currentThreshold) / span) * 100));

  let tier: GameRankTier = 'Beginner';
  if (level >= 15) tier = 'Elite';
  else if (level >= 10) tier = 'Expert';
  else if (level >= 6) tier = 'Advanced';
  else if (level >= 3) tier = 'Intermediate';

  return {
    level,
    tier,
    currentLevelXp: safeXp - currentThreshold,
    nextLevelXp: nextThreshold - currentThreshold,
    progressPct,
  };
}

export function calculateMatchRewards(params: {
  scoringConfig: {
    baseXp: number;
    winXpBonus: number;
    baseCoins: number;
    winCoinsBonus: number;
    timeBonusMax: number;
  };
  won: boolean;
  score: number;
  accuracyPct: number;
  isMultiplayer: boolean;
}): { xpAwarded: number; coinsAwarded: number } {
  const accuracyFactor = Math.max(0.25, Math.min(1, params.accuracyPct / 100));
  const perfBonus = Math.min(80, Math.floor(Math.max(0, params.score) / 25));
  const multiBoost = params.isMultiplayer ? 1.15 : 1;

  const rawXp =
    (params.scoringConfig.baseXp * accuracyFactor +
      (params.won ? params.scoringConfig.winXpBonus : 0) +
      perfBonus) *
    multiBoost;
  const rawCoins =
    (params.scoringConfig.baseCoins * accuracyFactor +
      (params.won ? params.scoringConfig.winCoinsBonus : 0) +
      Math.floor(perfBonus / 2)) *
    multiBoost;

  return {
    xpAwarded: Math.max(15, Math.round(rawXp)),
    coinsAwarded: Math.max(10, Math.round(rawCoins)),
  };
}

export interface TournamentMatchNode {
  matchId: string;
  round: number;
  bracket: 'winners' | 'losers' | 'pool';
  participantA: { id: number; displayName: string } | null;
  participantB: { id: number; displayName: string } | null;
  winnerId: number | null;
  scoreSummary: string | null;
  status: 'scheduled' | 'active' | 'completed' | 'bye';
}

export interface TournamentBracketStructure {
  format: string;
  rounds: Array<{
    round: number;
    label: string;
    matches: TournamentMatchNode[];
  }>;
}

export function generateGameTournamentBracket(
  participants: Array<{ id: number; displayName: string; seedNumber: number }>,
  format: string,
): TournamentBracketStructure {
  const sorted = [...participants].sort((a, b) => a.seedNumber - b.seedNumber);
  if (sorted.length === 0) {
    return { format, rounds: [] };
  }

  if (format === 'round_robin' || format === 'campus_league') {
    const matches: TournamentMatchNode[] = [];
    let idx = 1;
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        matches.push({
          matchId: `RR-${idx++}`,
          round: 1,
          bracket: 'pool',
          participantA: { id: sorted[i].id, displayName: sorted[i].displayName },
          participantB: { id: sorted[j].id, displayName: sorted[j].displayName },
          winnerId: null,
          scoreSummary: null,
          status: 'scheduled',
        });
      }
    }
    return {
      format,
      rounds: [{ round: 1, label: format === 'campus_league' ? 'Campus League Pool' : 'Round Robin Pool', matches }],
    };
  }

  // Single or Double elimination opening bracket
  const matches: TournamentMatchNode[] = [];
  for (let i = 0; i < sorted.length; i += 2) {
    const a = sorted[i] ? { id: sorted[i].id, displayName: sorted[i].displayName } : null;
    const b = sorted[i + 1] ? { id: sorted[i + 1].id, displayName: sorted[i + 1].displayName } : null;
    matches.push({
      matchId: `R1-M${Math.floor(i / 2) + 1}`,
      round: 1,
      bracket: 'winners',
      participantA: a,
      participantB: b,
      winnerId: a && !b ? a.id : null,
      scoreSummary: a && !b ? 'BYE' : null,
      status: a && !b ? 'bye' : 'scheduled',
    });
  }

  const rounds: TournamentBracketStructure['rounds'] = [
    { round: 1, label: 'Round 1', matches },
  ];

  if (format === 'double_elimination' && matches.length >= 2) {
    rounds.push({
      round: 2,
      label: 'Lower Bracket Redemption',
      matches: [
        {
          matchId: 'LB-M1',
          round: 2,
          bracket: 'losers',
          participantA: null,
          participantB: null,
          winnerId: null,
          scoreSummary: null,
          status: 'scheduled',
        },
      ],
    });
  }

  return { format, rounds };
}

export function advanceGameTournamentMatch(
  bracket: TournamentBracketStructure,
  matchId: string,
  winnerId: number,
  scoreSummary: string,
): TournamentBracketStructure {
  const nextRounds = bracket.rounds.map((r) => ({
    ...r,
    matches: r.matches.map((m) => ({ ...m })),
  }));

  let targetRoundIndex = -1;
  let targetMatch: TournamentMatchNode | null = null;
  for (let rIdx = 0; rIdx < nextRounds.length; rIdx++) {
    const found = nextRounds[rIdx].matches.find((m) => m.matchId === matchId);
    if (found) {
      targetRoundIndex = rIdx;
      targetMatch = found;
      break;
    }
  }
  if (!targetMatch || targetRoundIndex === -1) return bracket;

  const validWinner =
    targetMatch.participantA?.id === winnerId
      ? targetMatch.participantA
      : targetMatch.participantB?.id === winnerId
        ? targetMatch.participantB
        : null;
  if (!validWinner) return bracket;

  targetMatch.winnerId = validWinner.id;
  targetMatch.scoreSummary = scoreSummary;
  targetMatch.status = 'completed';

  // Auto-advance winners into next elimination round if elimination format
  if (bracket.format === 'single_elimination' || bracket.format === 'double_elimination') {
    const currentRound = nextRounds[targetRoundIndex];
    const winners = currentRound.matches
      .map((m) => {
        if (!m.winnerId) return null;
        return m.participantA?.id === m.winnerId ? m.participantA : m.participantB;
      })
      .filter((w): w is { id: number; displayName: string } => Boolean(w));

    const allFinished = currentRound.matches.every((m) => m.status === 'completed' || m.status === 'bye');
    if (allFinished && winners.length >= 2) {
      const nextRoundNum = currentRound.round + 1;
      const alreadyExists = nextRounds.find((r) => r.round === nextRoundNum && r.matches.some((m) => m.bracket === 'winners'));
      if (!alreadyExists) {
        const nextMatches: TournamentMatchNode[] = [];
        for (let i = 0; i < winners.length; i += 2) {
          const a = winners[i] || null;
          const b = winners[i + 1] || null;
          nextMatches.push({
            matchId: `R${nextRoundNum}-M${Math.floor(i / 2) + 1}`,
            round: nextRoundNum,
            bracket: 'winners',
            participantA: a,
            participantB: b,
            winnerId: a && !b ? a.id : null,
            scoreSummary: a && !b ? 'BYE' : null,
            status: a && !b ? 'bye' : 'scheduled',
          });
        }
        nextRounds.push({
          round: nextRoundNum,
          label: nextMatches.length === 1 ? 'Grand Final' : `Round ${nextRoundNum}`,
          matches: nextMatches,
        });
      }
    }
  }

  return { ...bracket, rounds: nextRounds };
}
