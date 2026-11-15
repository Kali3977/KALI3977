export interface GameCategoryItem {
  id: number;
  code: string;
  slug: string;
  name: string;
  description: string;
  accentColor: string;
  orderIndex: number;
}

export interface GameItem {
  id: number;
  categoryId: number;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  instructions: string;
  engineType: string;
  difficulty: string;
  minPlayers: number;
  maxPlayers: number;
  supportedModesJson: string[];
  scoringConfigJson: {
    baseXp: number;
    winXpBonus: number;
    baseCoins: number;
    winCoinsBonus: number;
    timeBonusMax: number;
  };
  durationSeconds: number;
  isFeatured: boolean;
  isEnabled: boolean;
  playCount: number;
}

export interface OpenRoomItem {
  id: number;
  roomCode: string;
  gameId: number;
  gameTitle: string;
  gameSlug: string;
  name: string;
  mode: string;
  visibility: string;
  requiresTeamCode: boolean;
  status: string;
  maxPlayers: number;
  playerCount: number;
}

export interface PlayerSummaryPayload {
  profile: {
    userId: number;
    gameXp: number;
    gameLevel: number;
    gameCoins: number;
    matchesPlayed: number;
    matchesWon: number;
    winStreak: number;
    bestWinStreak: number;
    equippedBadge: string;
    equippedCosmetic: string;
    unlockedCosmeticsJson: string[];
    levelInfo: {
      level: number;
      tier: string;
      currentLevelXp: number;
      nextLevelXp: number;
      progressPct: number;
    };
  };
  missions: Array<{
    id: number;
    code: string;
    cadence: string;
    title: string;
    description: string;
    targetValue: number;
    xpReward: number;
    coinsReward: number;
    progress: number;
    completed: boolean;
    claimed: boolean;
  }>;
  achievements: Array<{
    id: number;
    code: string;
    title: string;
    description: string;
    category: string;
    xpBonus: number;
    coinsBonus: number;
    badgeTier: string;
    earned: boolean;
    earnedAt: string | null;
  }>;
  cosmetics: Array<{
    id: string;
    name: string;
    type: string;
    costCoins: number;
    description: string;
    accentClass: string;
  }>;
  recentResults: Array<{
    id: number;
    gameTitle: string;
    gameSlug: string;
    placement: number;
    finalScore: number;
    accuracyPct: number;
    xpAwarded: number;
    coinsAwarded: number;
    won: boolean;
    createdAt: string;
  }>;
  pendingInvites: Array<{
    id: number;
    roomCode: string;
    roomName: string;
    gameTitle: string;
    invitedBy: string;
  }>;
  myActiveRooms: Array<{
    roomCode: string;
    roomName: string;
    gameTitle: string;
    status: string;
    mode: string;
  }>;
}

export interface RoomSnapshot {
  room: {
    id: number;
    roomCode: string;
    gameId: number;
    hostUserId: number;
    name: string;
    mode: string;
    visibility: string;
    requiresTeamCode: boolean;
    isLocked: boolean;
    status: string;
    registrationOpen: boolean;
    maxPlayers: number;
    durationSeconds: number;
    startedAt: string | null;
    endedAt: string | null;
  };
  game: GameItem;
  players: Array<{
    id: number;
    userId: number;
    username: string;
    displayName: string;
    gameTeamId: number | null;
    side: string;
    roleInGame: string;
    ready: boolean;
    connected: boolean;
    status: string;
    score: number;
    accuracyPct: number;
    actionsCount: number;
  }>;
  teams: Array<{
    id: number;
    name: string;
    teamCode: string;
    side: string;
    score: number;
    maxMembers: number;
    isActive: boolean;
    isSuspended: boolean;
  }>;
  createdTeams?: Array<{ id: number; name: string; teamCode: string; side: string }>;
  myPlayer: {
    id: number;
    userId: number;
    ready: boolean;
    score: number;
    status: string;
  } | null;
  session: {
    id: number;
    status: string;
    phase: string;
    roundNumber: number;
    startedAt: string;
    endedAt: string | null;
    state: Record<string, unknown>;
  } | null;
  feedback?: string;
  valid?: boolean;
  pointsAwarded?: number;
  matchEnded?: boolean;
}
