import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  ChevronDown,
  ChevronRight,
  Coins,
  Crown,
  Flame,
  Gamepad2,
  KeyRound,
  Medal,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShoppingBag,
  Sparkles,
  Swords,
  Target,
  Trophy,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GameLobbyView } from './GameLobbyView';
import type {
  GameCategoryItem,
  GameItem,
  OpenRoomItem,
  PlayerSummaryPayload,
  RoomSnapshot,
} from './types';

interface CatalogPayload {
  categories: GameCategoryItem[];
  games: GameItem[];
  openRooms: OpenRoomItem[];
  playerSummary: PlayerSummaryPayload | null;
}

interface LeaderboardsPayload {
  global: Array<{
    userId: number;
    username: string;
    displayName: string;
    gameXp: number;
    gameLevel: number;
    matchesWon: number;
    matchesPlayed: number;
    equippedBadge: string;
  }>;
  friends: Array<{
    userId: number;
    username: string;
    displayName: string;
    gameXp: number;
    gameLevel: number;
    matchesWon: number;
    matchesPlayed: number;
    equippedBadge: string;
  }>;
  campus: Array<{
    campusId: number;
    code: string;
    name: string;
    totalScore: number;
    wins: number;
  }>;
  game: Array<{
    userId: number;
    username: string;
    displayName: string;
    bestScore: number;
    wins: number;
  }>;
  weekly: Array<{
    userId: number;
    username: string;
    displayName: string;
    totalScore: number;
    xpEarned: number;
    wins: number;
  }>;
  monthly: Array<{
    userId: number;
    username: string;
    displayName: string;
    totalScore: number;
    xpEarned: number;
    wins: number;
  }>;
  seasonal: Array<{
    userId: number;
    username: string;
    displayName: string;
    totalScore: number;
    xpEarned: number;
    wins: number;
  }>;
}

interface TournamentItem {
  id: number;
  gameId: number;
  gameTitle: string;
  gameSlug: string;
  name: string;
  description: string;
  format: string;
  mode: string;
  status: string;
  maxParticipants: number;
  entryMinLevel: number;
  rewardCoinsPool: number;
  bracketsJson: {
    format?: string;
    rounds?: Array<{
      round: number;
      label: string;
      matches: Array<{
        matchId: string;
        participantA?: { id: number; displayName: string } | null;
        participantB?: { id: number; displayName: string } | null;
        winnerId?: number | null;
        status: string;
        scoreSummary?: string | null;
      }>;
    }>;
  };
  startsAt: string;
  participants: Array<{ id: number; userId: number; displayName: string; seedNumber: number }>;
}

interface GameDetailPayload {
  game: GameItem;
  category: GameCategoryItem | null;
  leaderboard: Array<{
    userId: number;
    username: string;
    displayName: string;
    finalScore: number;
    accuracyPct: number;
    won: boolean;
    createdAt: string;
  }>;
  openRooms: Array<{
    id: number;
    roomCode: string;
    name: string;
    mode: string;
    status: string;
    requiresTeamCode: boolean;
    maxPlayers: number;
    playerCount: number;
  }>;
}

type ArenaSubTab = 'catalog' | 'join' | 'leaderboards' | 'tournaments' | 'progression';
type LeaderboardKind = 'global' | 'friends' | 'campus' | 'game' | 'weekly' | 'monthly' | 'seasonal';

export const GamesArenaHub: React.FC = () => {
  const { user, apiFetch, authPending, loginWithGoogle, refreshProfile } = useAuth();

  const [subTab, setSubTab] = useState<ArenaSubTab>('catalog');
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [leaderboards, setLeaderboards] = useState<LeaderboardsPayload | null>(null);
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Active live lobby/match
  const [activeRoom, setActiveRoom] = useState<RoomSnapshot | null>(null);

  // Catalog filters & accordions
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  const [modeFilter, setModeFilter] = useState('All');
  const [expandedCatIds, setExpandedCatIds] = useState<number[]>([]);

  // Game detail modal
  const [detailGame, setDetailGame] = useState<GameDetailPayload | null>(null);
  const [createMode, setCreateMode] = useState('solo');
  const [createVisibility, setCreateVisibility] = useState<'public' | 'private'>('public');
  const [createRoomName, setCreateRoomName] = useState('');
  const [createRequiresTeam, setCreateRequiresTeam] = useState(false);

  // Join by Code (never pre-filled)
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joinTeamCode, setJoinTeamCode] = useState('');

  // Leaderboards state
  const [lbTab, setLbTab] = useState<LeaderboardKind>('global');
  const [lbGameId, setLbGameId] = useState<number>(0);
  const [friendUsername, setFriendUsername] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, tournRes] = await Promise.all([
        apiFetch<CatalogPayload>('/api/games/catalog'),
        apiFetch<{ tournaments: TournamentItem[] }>('/api/games/tournaments'),
      ]);
      setCatalog(catRes);
      setTournaments(tournRes.tournaments);
      if (catRes.categories.length > 0 && expandedCatIds.length === 0) {
        setExpandedCatIds([catRes.categories[0].id]);
      }
      const defaultGameId = lbGameId || catRes.games[0]?.id || 0;
      if (defaultGameId && !lbGameId) setLbGameId(defaultGameId);
      const lbRes = await apiFetch<LeaderboardsPayload>(
        `/api/games/leaderboards${defaultGameId ? `?gameId=${defaultGameId}` : ''}`,
      );
      setLeaderboards(lbRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Games Arena.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, expandedCatIds.length, lbGameId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll, user?.id]);

  const loadPerGameLeaderboard = async (gameId: number) => {
    setLbGameId(gameId);
    try {
      const lbRes = await apiFetch<LeaderboardsPayload>(`/api/games/leaderboards?gameId=${gameId}`);
      setLeaderboards(lbRes);
    } catch {
      // ignore transient leaderboard refresh error
    }
  };

  const openGameDetail = async (slug: string) => {
    setError(null);
    try {
      const detail = await apiFetch<GameDetailPayload>(`/api/games/detail/${encodeURIComponent(slug)}`);
      setDetailGame(detail);
      setCreateMode(detail.game.supportedModesJson[0] || 'solo');
      setCreateRoomName('');
      setCreateRequiresTeam(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open game briefing.');
    }
  };

  const launchSoloOrCreateRoom = async (params: {
    game: GameItem;
    mode: string;
    visibility?: 'public' | 'private';
    name?: string;
    requiresTeamCode?: boolean;
    autoStart?: boolean;
  }) => {
    if (!user) {
      setError('Sign in with Google to launch matches, earn XP/Game Coins, and save progress.');
      return;
    }
    setError(null);
    try {
      const created = await apiFetch<RoomSnapshot>('/api/games/rooms', {
        method: 'POST',
        body: JSON.stringify({
          gameId: params.game.id,
          mode: params.mode,
          visibility: params.visibility ?? 'public',
          name: params.name || `${params.game.title} Arena`,
          requiresTeamCode: Boolean(params.requiresTeamCode),
        }),
      });
      if (params.autoStart) {
        const started = await apiFetch<RoomSnapshot>(
          `/api/games/rooms/${encodeURIComponent(created.room.roomCode)}/start`,
          { method: 'POST' },
        );
        setDetailGame(null);
        setActiveRoom(started);
      } else {
        setDetailGame(null);
        setActiveRoom(created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create game room.');
    }
  };

  const runQuickMatch = async (game: GameItem, mode = 'free_for_all') => {
    if (!user) {
      setError('Sign in with Google to enter matchmaking.');
      return;
    }
    setError(null);
    try {
      const chosenMode = game.supportedModesJson.includes(mode)
        ? mode
        : game.supportedModesJson[0] || 'solo';
      const room = await apiFetch<RoomSnapshot>('/api/games/matchmaking', {
        method: 'POST',
        body: JSON.stringify({ gameId: game.id, mode: chosenMode }),
      });
      setDetailGame(null);
      setActiveRoom(room);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Matchmaking failed.');
    }
  };

  const handleJoinByCode = async (e?: React.FormEvent, explicitRoomCode?: string) => {
    if (e) e.preventDefault();
    if (!user) {
      setError('Sign in with Google to join game rooms.');
      return;
    }
    const code = (explicitRoomCode ?? joinRoomCode).trim().toUpperCase();
    if (!code) {
      setError('Enter a valid Room Code.');
      return;
    }
    setError(null);
    try {
      const joined = await apiFetch<RoomSnapshot>('/api/games/rooms/join', {
        method: 'POST',
        body: JSON.stringify({
          roomCode: code,
          teamCode: joinTeamCode.trim() ? joinTeamCode.trim().toUpperCase() : undefined,
        }),
      });
      setJoinRoomCode('');
      setJoinTeamCode('');
      setDetailGame(null);
      setActiveRoom(joined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join room.');
    }
  };

  const handleClaimMission = async (missionId: number) => {
    setError(null);
    setStatusMsg(null);
    try {
      const res = await apiFetch<{ ok: boolean; xpAwarded: number; coinsAwarded: number }>(
        `/api/games/missions/${missionId}/claim`,
        { method: 'POST' },
      );
      setStatusMsg(`Mission reward claimed: +${res.xpAwarded} XP and +${res.coinsAwarded} Game Coins.`);
      await loadAll();
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to claim mission reward.');
    }
  };

  const handleCosmeticAction = async (cosmeticId: string, unlocked: boolean) => {
    setError(null);
    setStatusMsg(null);
    try {
      await apiFetch(`/api/games/cosmetics/${unlocked ? 'equip' : 'unlock'}`, {
        method: 'POST',
        body: JSON.stringify({ cosmeticId }),
      });
      setStatusMsg(unlocked ? 'Cosmetic equipped.' : 'Cosmetic unlocked and equipped.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cosmetic action failed.');
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendUsername.trim()) return;
    setError(null);
    setStatusMsg(null);
    try {
      const res = await apiFetch<{ ok: boolean; friend: { username: string; displayName: string } }>(
        '/api/games/friends',
        {
          method: 'POST',
          body: JSON.stringify({ username: friendUsername.trim() }),
        },
      );
      setFriendUsername('');
      setStatusMsg(`Added ${res.friend.displayName} (@${res.friend.username}) to Friends Leaderboard.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add friend.');
    }
  };

  const handleRegisterTournament = async (tournamentId: number) => {
    if (!user) {
      setError('Sign in with Google to register in Games Arena tournaments.');
      return;
    }
    setError(null);
    setStatusMsg(null);
    try {
      await apiFetch(`/api/games/tournaments/${tournamentId}/register`, { method: 'POST' });
      setStatusMsg('Registered in Games Arena tournament.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tournament registration failed.');
    }
  };

  const filteredGamesByCategory = useMemo(() => {
    const all = catalog?.games || [];
    const q = searchQuery.trim().toLowerCase();
    return all.filter((g) => {
      if (difficultyFilter !== 'All' && g.difficulty !== difficultyFilter) return false;
      if (modeFilter !== 'All' && !g.supportedModesJson.includes(modeFilter)) return false;
      if (q) {
        const hay = `${g.title} ${g.tagline} ${g.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [catalog?.games, difficultyFilter, modeFilter, searchQuery]);

  const featuredGames = useMemo(
    () => (catalog?.games || []).filter((g) => g.isFeatured),
    [catalog?.games],
  );

  const toggleCategory = (catId: number) => {
    setExpandedCatIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId],
    );
  };

  // If currently inside a live room/match, render GameLobbyView directly
  if (activeRoom) {
    return (
      <GameLobbyView
        initialSnapshot={activeRoom}
        onExitRoom={() => {
          setActiveRoom(null);
          void loadAll();
        }}
        onMatchSettled={() => {
          void loadAll();
        }}
      />
    );
  }

  const profile = catalog?.playerSummary?.profile;

  return (
    <div className="space-y-8">
      {/* Arena Hero & Player Progression Header */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-wide text-emerald-500">
              KALI3977 Games Arena · 6 Categories · 30 Interactive Cyber Games
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
              Interactive Cybersecurity Games &amp; Live Multiplayer Arena
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Compete in real-time social deduction, CTF cyber battles, forensic investigations, firewall defense waves, and timed terminal sprints.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void loadAll()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Arena
            </button>
            {!user && (
              <button
                type="button"
                disabled={authPending}
                onClick={() => void loginWithGoogle()}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                Sign In to Play &amp; Save XP
              </button>
            )}
          </div>
        </div>

        {/* Authenticated Player Stats Bar */}
        {profile && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Arena Rank &amp; Level</span>
                <Crown className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="mt-1 font-display text-lg font-bold">
                Level {profile.levelInfo.level} · {profile.levelInfo.tier}
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${profile.levelInfo.progressPct}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Arena XP &amp; Badge</span>
                <Zap className="h-4 w-4 text-cyan-500" />
              </div>
              <p className="mt-1 font-display text-lg font-bold font-mono tabular-nums text-cyan-500">
                {profile.gameXp.toLocaleString()} XP
              </p>
              <p className="mt-1 text-xs text-slate-500 truncate">{profile.equippedBadge}</p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Game Coins (Cosmetic)</span>
                <Coins className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-1 font-display text-lg font-bold font-mono tabular-nums text-amber-400">
                {profile.gameCoins.toLocaleString()} GC
              </p>
              <p className="mt-1 text-xs text-slate-500">Non-pay-to-win · Separate from certificates</p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Win Record &amp; Streak</span>
                <Flame className="h-4 w-4 text-rose-500" />
              </div>
              <p className="mt-1 font-display text-lg font-bold font-mono tabular-nums">
                {profile.matchesWon} / {profile.matchesPlayed} Wins
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Current streak: {profile.winStreak} (Best {profile.bestWinStreak})
              </p>
            </div>
          </div>
        )}

        {/* Active Room / Pending Invites Rejoin Bar */}
        {catalog?.playerSummary &&
          (catalog.playerSummary.myActiveRooms.length > 0 ||
            catalog.playerSummary.pendingInvites.length > 0) && (
            <div className="flex flex-wrap gap-3 pt-2">
              {catalog.playerSummary.myActiveRooms.map((r) => (
                <button
                  key={r.roomCode}
                  type="button"
                  onClick={() => void handleJoinByCode(undefined, r.roomCode)}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20"
                >
                  <Play className="h-3.5 w-3.5" />
                  Rejoin {r.roomName} ({r.roomCode})
                </button>
              ))}
              {catalog.playerSummary.pendingInvites.map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => void handleJoinByCode(undefined, inv.roomCode)}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/20"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Invite from @{inv.invitedBy}: Join {inv.gameTitle} ({inv.roomCode})
                </button>
              ))}
            </div>
          )}
      </section>

      {statusMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-400">
          {statusMsg}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-400">
          {error}
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-1.5">
        {[
          { id: 'catalog', label: 'Arena & 30 Games', icon: Gamepad2 },
          { id: 'join', label: 'Join Room / Live Lobbies', icon: KeyRound },
          { id: 'leaderboards', label: '7-Board Rankings', icon: Trophy },
          { id: 'tournaments', label: 'Tournaments & Brackets', icon: Swords },
          { id: 'progression', label: 'Missions, Badges & Shop', icon: ShoppingBag },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as ArenaSubTab)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs whitespace-nowrap shrink-0 ${
                subTab === t.id
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {loading && !catalog ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-8 text-sm text-slate-500">
          Loading 6 categories and 30 cybersecurity games...
        </div>
      ) : null}

      {/* TAB 1: ARENA & ALL 30 GAMES */}
      {subTab === 'catalog' && catalog && (
        <div className="space-y-8">
          {/* Featured Spotlight */}
          {featuredGames.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <h2 className="font-display text-lg font-bold">Featured Flagship Arena Games</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {featuredGames.map((g) => (
                  <div
                    key={g.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs font-mono text-emerald-500">
                        <span>{g.difficulty}</span>
                        <span>
                          {g.minPlayers}–{g.maxPlayers} Players
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-bold">{g.title}</h3>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {g.tagline}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        disabled={!g.isEnabled}
                        onClick={() =>
                          void launchSoloOrCreateRoom({
                            game: g,
                            mode: g.supportedModesJson.includes('solo') ? 'solo' : g.supportedModesJson[0] || 'solo',
                            autoStart: true,
                          })
                        }
                        className="rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        Play Now
                      </button>
                      <button
                        type="button"
                        onClick={() => void runQuickMatch(g)}
                        className="rounded-lg border border-cyan-500/40 px-3 py-2 text-xs font-semibold text-cyan-500 hover:bg-cyan-500/10 whitespace-nowrap shrink-0"
                      >
                        Quick Match
                      </button>
                      <button
                        type="button"
                        onClick={() => void openGameDetail(g.slug)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                      >
                        Rules &amp; Lobby
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Filter Toolbar */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any of the 30 games..."
                aria-label="Search games"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] pl-9 pr-3 py-2 text-xs"
              />
            </div>

            <select
              aria-label="Filter by difficulty"
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
            >
              <option value="All">All Difficulties</option>
              <option value="Beginner">Beginner</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
              <option value="Expert">Expert</option>
            </select>

            <select
              aria-label="Filter by mode"
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
            >
              <option value="All">All Game Modes</option>
              <option value="solo">Solo Practice</option>
              <option value="1v1">1v1 Duel</option>
              <option value="team_vs_team">Team vs Team</option>
              <option value="free_for_all">Free For All</option>
              <option value="coop">Co-op</option>
              <option value="campus_vs_campus">Campus vs Campus</option>
              <option value="tournament">Tournament</option>
            </select>

            <button
              type="button"
              onClick={() => setExpandedCatIds(catalog.categories.map((c) => c.id))}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              Expand All 6 Categories
            </button>
          </section>

          {/* 6 Expandable Category Panels (A-F) */}
          <section className="space-y-4">
            {catalog.categories.map((cat) => {
              const gamesInCat = filteredGamesByCategory.filter((g) => g.categoryId === cat.id);
              const isOpen = expandedCatIds.includes(cat.id) || Boolean(searchQuery.trim());
              return (
                <div
                  key={cat.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-emerald-500">
                          Category {cat.code}
                        </span>
                        <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                          {cat.name}
                        </h3>
                        <span className="font-mono text-xs text-slate-500">
                          ({gamesInCat.length} games)
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{cat.description}</p>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-200 dark:border-slate-800 p-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {gamesInCat.length === 0 ? (
                        <p className="text-xs text-slate-500">No games in this category match the active filter.</p>
                      ) : (
                        gamesInCat.map((g) => (
                          <div
                            key={g.id}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-4 flex flex-col justify-between gap-3"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
                                <span className="text-cyan-500">{g.difficulty}</span>
                                <span>
                                  {g.minPlayers}–{g.maxPlayers} Players · {Math.round(g.durationSeconds / 60)}m
                                </span>
                              </div>
                              <h4 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                                {g.title}
                              </h4>
                              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                {g.tagline}
                              </p>
                              <p className="font-mono text-[11px] text-slate-500">
                                Modes: {g.supportedModesJson.join(' · ').replace(/_/g, ' ')}
                              </p>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                              <button
                                type="button"
                                disabled={!g.isEnabled}
                                onClick={() =>
                                  void launchSoloOrCreateRoom({
                                    game: g,
                                    mode: g.supportedModesJson.includes('solo')
                                      ? 'solo'
                                      : g.supportedModesJson[0] || 'solo',
                                    autoStart: true,
                                  })
                                }
                                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 whitespace-nowrap shrink-0"
                              >
                                {g.isEnabled ? 'Play Solo' : 'Disabled'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void openGameDetail(g.slug)}
                                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                              >
                                Details &amp; Multiplayer
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </div>
      )}

      {/* TAB 2: JOIN WITH ROOM CODE & TEAM CODE + OPEN PUBLIC LOBBIES */}
      {subTab === 'join' && catalog && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={(e) => void handleJoinByCode(e)}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-emerald-500" />
              <h2 className="font-display text-lg font-bold">Join Room by Access Code</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Room Codes identify the game lobby. Team Codes are strictly separate and assign you to Team Alpha/Beta or a verified campus squad when required.
            </p>

            <div className="space-y-3">
              <div>
                <label htmlFor="games-join-room-code" className="block text-xs font-medium mb-1">
                  Game Room Code (Required)
                </label>
                <input
                  id="games-join-room-code"
                  type="text"
                  value={joinRoomCode}
                  onChange={(e) => setJoinRoomCode(e.target.value)}
                  placeholder="Enter Room Code e.g. GA-HAC-9F3K"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono text-xs uppercase"
                  required
                />
              </div>

              <div>
                <label htmlFor="games-join-team-code" className="block text-xs font-medium mb-1">
                  Team Code (Optional — Required for Team/Campus Rooms)
                </label>
                <input
                  id="games-join-team-code"
                  type="text"
                  value={joinTeamCode}
                  onChange={(e) => setJoinTeamCode(e.target.value)}
                  placeholder="Enter Team Code e.g. TM-ALP-4X8P"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono text-xs uppercase"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Validate &amp; Join Game Room
            </button>
          </form>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-cyan-500" />
                Open Public Waiting Rooms
              </h2>
              <span className="font-mono text-xs text-slate-500">
                {catalog.openRooms.length} active
              </span>
            </div>

            {catalog.openRooms.length === 0 ? (
              <p className="text-xs text-slate-500">
                No public waiting rooms open right now. Create a room from any game card or start Quick Match!
              </p>
            ) : (
              <div className="space-y-3">
                {catalog.openRooms.map((rm) => (
                  <div
                    key={rm.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <p className="font-semibold">
                        {rm.name} — <span className="text-cyan-500">{rm.gameTitle}</span>
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        Code: {rm.roomCode} · Mode: {rm.mode} · Players: {rm.playerCount}/{rm.maxPlayers}
                        {rm.requiresTeamCode ? ' · Team Code Required' : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleJoinByCode(undefined, rm.roomCode)}
                      className="rounded-lg bg-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 whitespace-nowrap shrink-0"
                    >
                      Join Lobby
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: 7-BOARD LEADERBOARDS */}
      {subTab === 'leaderboards' && leaderboards && catalog && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold">Games Arena Leaderboards</h2>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['global', 'Global'],
                  ['friends', 'Friends'],
                  ['campus', 'Campus'],
                  ['game', 'Per-Game'],
                  ['weekly', 'Weekly'],
                  ['monthly', 'Monthly'],
                  ['seasonal', 'Seasonal'],
                ] as Array<[LeaderboardKind, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLbTab(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                    lbTab === key
                      ? 'bg-emerald-500 text-slate-950 font-semibold'
                      : 'border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {lbTab === 'friends' && user && (
            <form onSubmit={handleAddFriend} className="flex flex-wrap gap-2">
              <input
                type="text"
                value={friendUsername}
                onChange={(e) => setFriendUsername(e.target.value)}
                placeholder="Add friend by exact username..."
                aria-label="Friend username"
                className="min-w-[220px] rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
              >
                Add Friend
              </button>
            </form>
          )}

          {lbTab === 'game' && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label htmlFor="per-game-lb-select" className="text-slate-500">
                Select Game:
              </label>
              <select
                id="per-game-lb-select"
                value={lbGameId}
                onChange={(e) => void loadPerGameLeaderboard(Number(e.target.value))}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
              >
                {catalog.games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="overflow-x-auto">
            {(lbTab === 'global' || lbTab === 'friends') && (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Rank</th>
                    <th className="py-2 pr-4">Player</th>
                    <th className="py-2 pr-4">Badge</th>
                    <th className="py-2 pr-4">Level</th>
                    <th className="py-2 pr-4">Wins / Played</th>
                    <th className="py-2 text-right">Arena XP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {(lbTab === 'global' ? leaderboards.global : leaderboards.friends).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No ranked players recorded yet. Complete a match to claim #1!
                      </td>
                    </tr>
                  ) : (
                    (lbTab === 'global' ? leaderboards.global : leaderboards.friends).map((r, i) => (
                      <tr key={r.userId} className="h-11">
                        <td className="pr-4 font-mono text-emerald-500">#{i + 1}</td>
                        <td className="pr-4 font-medium">
                          {r.displayName}{' '}
                          <span className="font-mono text-slate-500">@{r.username}</span>
                        </td>
                        <td className="pr-4 text-slate-400">{r.equippedBadge}</td>
                        <td className="pr-4 font-mono">Lv {r.gameLevel}</td>
                        <td className="pr-4 font-mono tabular-nums">
                          {r.matchesWon} / {r.matchesPlayed}
                        </td>
                        <td className="text-right font-mono font-bold text-cyan-500 tabular-nums">
                          {r.gameXp.toLocaleString()} XP
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {lbTab === 'campus' && (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Rank</th>
                    <th className="py-2 pr-4">Campus</th>
                    <th className="py-2 pr-4">Match Wins</th>
                    <th className="py-2 text-right">Total Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {leaderboards.campus.map((c, i) => (
                    <tr key={c.campusId} className="h-11">
                      <td className="pr-4 font-mono text-emerald-500">#{i + 1}</td>
                      <td className="pr-4 font-medium">
                        {c.name} <span className="font-mono text-slate-500">({c.code})</span>
                      </td>
                      <td className="pr-4 font-mono tabular-nums">{c.wins}</td>
                      <td className="text-right font-mono font-bold text-cyan-500 tabular-nums">
                        {c.totalScore.toLocaleString()} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {lbTab === 'game' && (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Rank</th>
                    <th className="py-2 pr-4">Player</th>
                    <th className="py-2 pr-4">Wins</th>
                    <th className="py-2 text-right">Best Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {leaderboards.game.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">
                        No match results recorded for this game yet.
                      </td>
                    </tr>
                  ) : (
                    leaderboards.game.map((r, i) => (
                      <tr key={r.userId} className="h-11">
                        <td className="pr-4 font-mono text-emerald-500">#{i + 1}</td>
                        <td className="pr-4 font-medium">
                          {r.displayName} <span className="font-mono text-slate-500">@{r.username}</span>
                        </td>
                        <td className="pr-4 font-mono tabular-nums">{r.wins}</td>
                        <td className="text-right font-mono font-bold text-cyan-500 tabular-nums">
                          {r.bestScore.toLocaleString()} pts
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {(lbTab === 'weekly' || lbTab === 'monthly' || lbTab === 'seasonal') && (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Rank</th>
                    <th className="py-2 pr-4">Player</th>
                    <th className="py-2 pr-4">Wins</th>
                    <th className="py-2 pr-4">XP Earned</th>
                    <th className="py-2 text-right">Period Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {leaderboards[lbTab].length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        No matches played during this leaderboard window yet.
                      </td>
                    </tr>
                  ) : (
                    leaderboards[lbTab].map((r, i) => (
                      <tr key={r.userId} className="h-11">
                        <td className="pr-4 font-mono text-emerald-500">#{i + 1}</td>
                        <td className="pr-4 font-medium">
                          {r.displayName} <span className="font-mono text-slate-500">@{r.username}</span>
                        </td>
                        <td className="pr-4 font-mono tabular-nums">{r.wins}</td>
                        <td className="pr-4 font-mono tabular-nums text-emerald-500">
                          +{r.xpEarned} XP
                        </td>
                        <td className="text-right font-mono font-bold text-cyan-500 tabular-nums">
                          {r.totalScore.toLocaleString()} pts
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TOURNAMENTS & BRACKETS */}
      {subTab === 'tournaments' && (
        <div className="space-y-6">
          {tournaments.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 text-xs text-slate-500">
              No Games Arena tournaments scheduled yet.
            </div>
          ) : (
            tournaments.map((t) => {
              const registered = Boolean(user && t.participants.some((p) => p.userId === user.id));
              const rounds = t.bracketsJson?.rounds || [];
              return (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-mono text-xs text-cyan-500">
                        {t.gameTitle} · {t.format.replace(/_/g, ' ').toUpperCase()} · {t.status.replace(/_/g, ' ').toUpperCase()}
                      </p>
                      <h3 className="font-display text-lg font-bold">{t.name}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{t.description}</p>
                      <p className="font-mono text-xs text-slate-500">
                        Participants: {t.participants.length} / {t.maxParticipants} · Reward Pool: {t.rewardCoinsPool} GC · Min Level {t.entryMinLevel}
                      </p>
                    </div>

                    {t.status === 'registration_open' && (
                      <button
                        type="button"
                        disabled={registered}
                        onClick={() => void handleRegisterTournament(t.id)}
                        className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        {registered ? 'Registered' : 'Register Now'}
                      </button>
                    )}
                  </div>

                  {rounds.length > 0 && (
                    <div className="grid gap-4 md:grid-cols-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                      {rounds.map((rd) => (
                        <div key={rd.round} className="space-y-2">
                          <h4 className="font-mono text-xs font-semibold text-slate-500 uppercase">
                            {rd.label}
                          </h4>
                          {rd.matches.map((m) => (
                            <div
                              key={m.matchId}
                              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3 text-xs space-y-1"
                            >
                              <div className={m.winnerId === m.participantA?.id && m.winnerId ? 'font-bold text-emerald-500' : ''}>
                                {m.participantA?.displayName || 'TBD'}
                              </div>
                              <div className="text-[10px] text-slate-500">vs</div>
                              <div className={m.winnerId === m.participantB?.id && m.winnerId ? 'font-bold text-emerald-500' : ''}>
                                {m.participantB?.displayName || 'BYE / TBD'}
                              </div>
                              {m.scoreSummary && (
                                <p className="font-mono text-[11px] text-cyan-500 pt-1">{m.scoreSummary}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 5: MISSIONS, ACHIEVEMENTS, COSMETIC SHOP & RECENT HISTORY */}
      {subTab === 'progression' && catalog && (
        <div className="space-y-8">
          {!catalog.playerSummary ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 text-sm text-slate-500">
              Sign in with Google to track daily/weekly missions, claim Game Coins, unlock cosmetic arena themes, and view your match history.
            </div>
          ) : (
            <>
              {/* Missions */}
              <section className="space-y-3">
                <h2 className="font-display text-lg font-bold flex items-center gap-2">
                  <Target className="h-4 w-4 text-emerald-500" />
                  Daily &amp; Weekly Arena Missions
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {catalog.playerSummary.missions.map((m) => {
                    const pct = Math.min(100, Math.round((m.progress / Math.max(1, m.targetValue)) * 100));
                    return (
                      <div
                        key={m.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono uppercase text-cyan-500">{m.cadence}</span>
                          <span className="font-mono text-amber-400">
                            +{m.xpReward} XP · +{m.coinsReward} GC
                          </span>
                        </div>
                        <h3 className="font-display text-sm font-bold">{m.title}</h3>
                        <p className="text-xs text-slate-500">{m.description}</p>
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono text-xs tabular-nums">
                            {m.progress}/{m.targetValue}
                          </span>
                        </div>
                        {m.completed && !m.claimed && (
                          <button
                            type="button"
                            onClick={() => void handleClaimMission(m.id)}
                            className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                          >
                            Claim Mission Reward
                          </button>
                        )}
                        {m.claimed && (
                          <p className="font-mono text-xs text-emerald-500">Reward Claimed</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Non-Pay-To-Win Cosmetic Shop */}
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-bold flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-violet-500" />
                    Cosmetic Arena Frames &amp; Titles (Fair-Play Only)
                  </h2>
                  <span className="font-mono text-xs text-amber-400">
                    Balance: {catalog.playerSummary.profile.gameCoins} Game Coins
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {catalog.playerSummary.cosmetics.map((c) => {
                    const unlocked = catalog.playerSummary!.profile.unlockedCosmeticsJson.includes(c.id);
                    const equipped =
                      catalog.playerSummary!.profile.equippedCosmetic === c.id ||
                      catalog.playerSummary!.profile.equippedBadge === c.name;
                    return (
                      <div
                        key={c.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="uppercase text-violet-400">{c.type}</span>
                            <span className="text-amber-400">
                              {c.costCoins === 0 ? 'Starter' : `${c.costCoins} GC`}
                            </span>
                          </div>
                          <h3 className="font-display text-sm font-bold">{c.name}</h3>
                          <p className="text-xs text-slate-500">{c.description}</p>
                        </div>
                        <button
                          type="button"
                          disabled={equipped}
                          onClick={() => void handleCosmeticAction(c.id, unlocked)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                            equipped
                              ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                              : unlocked
                                ? 'border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10'
                                : 'bg-violet-500 text-white hover:bg-violet-400'
                          }`}
                        >
                          {equipped ? 'Equipped' : unlocked ? 'Equip Item' : `Unlock (${c.costCoins} GC)`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Achievements */}
              <section className="space-y-3">
                <h2 className="font-display text-lg font-bold flex items-center gap-2">
                  <Medal className="h-4 w-4 text-amber-500" />
                  Games Arena Badges &amp; Achievements
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {catalog.playerSummary.achievements.map((a) => (
                    <div
                      key={a.id}
                      className={`rounded-xl border p-4 space-y-1 ${
                        a.earned
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="uppercase text-amber-500">{a.badgeTier}</span>
                        <span>{a.earned ? 'EARNED' : `+${a.xpBonus} XP`}</span>
                      </div>
                      <p className="font-display text-sm font-bold">{a.title}</p>
                      <p className="text-xs text-slate-500">{a.description}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recent Match History */}
              <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
                <h2 className="font-display text-base font-bold flex items-center gap-2">
                  <Award className="h-4 w-4 text-emerald-500" />
                  Recent Arena Match History
                </h2>
                {catalog.playerSummary.recentResults.length === 0 ? (
                  <p className="text-xs text-slate-500">No matches settled yet. Play any game to log your first result.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <tr>
                          <th className="py-2 pr-4">Game</th>
                          <th className="py-2 pr-4">Outcome</th>
                          <th className="py-2 pr-4">Score</th>
                          <th className="py-2 pr-4">Rewards</th>
                          <th className="py-2 text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {catalog.playerSummary.recentResults.map((r) => (
                          <tr key={r.id} className="h-10">
                            <td className="pr-4 font-medium">{r.gameTitle}</td>
                            <td className={`pr-4 font-mono ${r.won ? 'text-emerald-500' : 'text-slate-400'}`}>
                              {r.won ? 'VICTORY' : `Rank #${r.placement}`}
                            </td>
                            <td className="pr-4 font-mono tabular-nums">
                              {r.finalScore} pts ({r.accuracyPct}%)
                            </td>
                            <td className="pr-4 font-mono text-amber-400 tabular-nums">
                              +{r.xpAwarded} XP · +{r.coinsAwarded} GC
                            </td>
                            <td className="text-right font-mono text-slate-500">
                              {new Date(r.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {/* GAME DETAIL & CREATE ROOM MODAL */}
      {detailGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-emerald-500">
                  {detailGame.category?.name} · {detailGame.game.difficulty}
                </p>
                <h2 className="font-display text-xl font-bold">{detailGame.game.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailGame(null)}
                aria-label="Close game detail modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {detailGame.game.description}
            </p>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-4 space-y-1.5 text-xs">
              <p className="font-semibold text-cyan-500">Official Rules &amp; Instructions</p>
              <p className="text-slate-600 dark:text-slate-300">{detailGame.game.instructions}</p>
              <p className="font-mono text-slate-500 pt-1">
                Rewards: Base +{detailGame.game.scoringConfigJson.baseXp} XP / Win +{detailGame.game.scoringConfigJson.winXpBonus} XP · Base +{detailGame.game.scoringConfigJson.baseCoins} GC
              </p>
            </div>

            {/* Create Custom Multiplayer / Solo Room */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <h3 className="font-display text-sm font-bold flex items-center gap-2">
                <Plus className="h-4 w-4 text-emerald-500" />
                Create Match Room
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div>
                  <label htmlFor="create-room-name" className="block text-slate-500 mb-1">
                    Room Name
                  </label>
                  <input
                    id="create-room-name"
                    type="text"
                    value={createRoomName}
                    onChange={(e) => setCreateRoomName(e.target.value)}
                    placeholder={`${detailGame.game.title} Arena`}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
                  />
                </div>
                <div>
                  <label htmlFor="create-room-mode" className="block text-slate-500 mb-1">
                    Match Mode
                  </label>
                  <select
                    id="create-room-mode"
                    value={createMode}
                    onChange={(e) => setCreateMode(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
                  >
                    {detailGame.game.supportedModesJson.map((m) => (
                      <option key={m} value={m}>
                        {m.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="create-room-visibility" className="block text-slate-500 mb-1">
                    Visibility
                  </label>
                  <select
                    id="create-room-visibility"
                    value={createVisibility}
                    onChange={(e) => setCreateVisibility(e.target.value as 'public' | 'private')}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
                  >
                    <option value="public">Public Lobby</option>
                    <option value="private">Private (Room Code Required)</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createRequiresTeam}
                      onChange={(e) => setCreateRequiresTeam(e.target.checked)}
                      className="accent-emerald-500"
                    />
                    <span>Generate Team Alpha/Beta Team Codes</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  disabled={!detailGame.game.isEnabled}
                  onClick={() =>
                    void launchSoloOrCreateRoom({
                      game: detailGame.game,
                      mode: createMode,
                      visibility: createVisibility,
                      name: createRoomName,
                      requiresTeamCode: createRequiresTeam,
                    })
                  }
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  Create &amp; Enter Lobby
                </button>
                <button
                  type="button"
                  disabled={!detailGame.game.isEnabled}
                  onClick={() => void runQuickMatch(detailGame.game, createMode)}
                  className="rounded-lg border border-cyan-500/40 px-4 py-2 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/10"
                >
                  Quick Matchmaking
                </button>
              </div>
            </div>

            {/* Per-Game Top Scores */}
            {detailGame.leaderboard.length > 0 && (
              <div className="space-y-2 text-xs">
                <h4 className="font-semibold text-slate-500 uppercase">Top High Scores</h4>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {detailGame.leaderboard.slice(0, 5).map((l, idx) => (
                    <div key={`${l.userId}-${idx}`} className="flex justify-between py-1.5">
                      <span>
                        #{idx + 1} {l.displayName} (@{l.username})
                      </span>
                      <span className="font-mono text-cyan-500 tabular-nums">
                        {l.finalScore} pts ({l.accuracyPct}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
