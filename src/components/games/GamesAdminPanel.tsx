import React, { useCallback, useEffect, useState } from 'react';
import {
  Gamepad2,
  Lock,
  Plus,
  RefreshCw,
  Shield,
  StopCircle,
  Trophy,
  Unlock,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { GameItem } from './types';

interface GamesAdminOverview {
  games: GameItem[];
  rooms: Array<{
    id: number;
    roomCode: string;
    name: string;
    gameTitle: string;
    mode: string;
    visibility: string;
    status: string;
    isLocked: boolean;
    requiresTeamCode: boolean;
    maxPlayers: number;
    playerCount: number;
    createdAt: string;
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
  tournaments: Array<{
    id: number;
    gameId: number;
    name: string;
    format: string;
    status: string;
    maxParticipants: number;
    bracketsJson: {
      rounds?: Array<{
        round: number;
        label: string;
        matches: Array<{
          matchId: string;
          participantA?: { id: number; displayName: string } | null;
          participantB?: { id: number; displayName: string } | null;
          winnerId?: number | null;
          status: string;
        }>;
      }>;
    };
  }>;
  logs: Array<{
    id: number;
    actorEmail: string;
    action: string;
    targetType: string;
    targetId: string;
    createdAt: string;
  }>;
  activePlayersCount: number;
}

export const GamesAdminPanel: React.FC = () => {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<GamesAdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create team form
  const [teamName, setTeamName] = useState('');
  const [teamSide, setTeamSide] = useState<'alpha' | 'beta'>('alpha');
  const [teamMax, setTeamMax] = useState(10);

  // Create tournament form
  const [tournName, setTournName] = useState('');
  const [tournGameId, setTournGameId] = useState<number>(0);
  const [tournFormat, setTournFormat] = useState('single_elimination');
  const [tournPool, setTournPool] = useState(1500);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<GamesAdminOverview>('/api/games/admin/overview');
      setData(res);
      if (res.games.length > 0 && !tournGameId) {
        setTournGameId(res.games[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Games Arena admin overview.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, tournGameId]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const runAdminAction = async (label: string, fn: () => Promise<void>) => {
    setError(null);
    setStatusMsg(null);
    try {
      await fn();
      setStatusMsg(label);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin operation failed.');
    }
  };

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    void runAdminAction('Created new Games Arena Team & Team Code.', async () => {
      await apiFetch('/api/games/admin/teams', {
        method: 'POST',
        body: JSON.stringify({ name: teamName, side: teamSide, maxMembers: teamMax }),
      });
      setTeamName('');
    });
  };

  const handleCreateTournament = (e: React.FormEvent) => {
    e.preventDefault();
    void runAdminAction('Created Games Arena tournament.', async () => {
      await apiFetch('/api/games/admin/tournaments', {
        method: 'POST',
        body: JSON.stringify({
          gameId: tournGameId,
          name: tournName,
          format: tournFormat,
          rewardCoinsPool: tournPool,
        }),
      });
      setTournName('');
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-emerald-500" />
            Games Arena Governance &amp; Live Operations
          </h2>
          <p className="text-xs text-slate-500">
            Manage all 30 cyber games, active multiplayer rooms, team codes, tournaments, and anti-abuse audit logs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadOverview()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {statusMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
          {statusMsg}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 text-xs text-slate-500">
          Loading Games Arena telemetry...
        </div>
      ) : null}

      {data && (
        <>
          {/* Metrics Row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4">
              <p className="text-xs text-slate-500">Catalog Games Enabled</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">
                {data.games.filter((g) => g.isEnabled).length} / {data.games.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4">
              <p className="text-xs text-slate-500">Connected Players</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-emerald-500">
                {data.activePlayersCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4">
              <p className="text-xs text-slate-500">Tracked Rooms</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">{data.rooms.length}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4">
              <p className="text-xs text-slate-500">Arena Tournaments</p>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">{data.tournaments.length}</p>
            </div>
          </div>

          {/* Active & Recent Game Rooms */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
            <h3 className="font-display text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-500" />
              Active &amp; Recent Game Rooms
            </h3>
            {data.rooms.length === 0 ? (
              <p className="text-xs text-slate-500">No game rooms created yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Room &amp; Code</th>
                      <th className="py-2 pr-4">Game / Mode</th>
                      <th className="py-2 pr-4">Players</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 text-right">Room Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {data.rooms.map((rm) => (
                      <tr key={rm.id} className="h-11">
                        <td className="pr-4">
                          <p className="font-medium">{rm.name}</p>
                          <p className="font-mono text-cyan-500">{rm.roomCode}</p>
                        </td>
                        <td className="pr-4">
                          <p>{rm.gameTitle}</p>
                          <p className="font-mono text-slate-500">{rm.mode}</p>
                        </td>
                        <td className="pr-4 font-mono tabular-nums">
                          {rm.playerCount} / {rm.maxPlayers}
                        </td>
                        <td className="pr-4 font-mono uppercase">
                          {rm.status} {rm.isLocked ? '· LOCKED' : ''}
                        </td>
                        <td className="text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              void runAdminAction(
                                `${rm.isLocked ? 'Unlocked' : 'Locked'} room ${rm.roomCode}.`,
                                async () => {
                                  await apiFetch(`/api/games/admin/rooms/${rm.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ isLocked: !rm.isLocked }),
                                  });
                                },
                              )
                            }
                            className="inline-flex items-center gap-1 text-cyan-500 hover:underline"
                          >
                            {rm.isLocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                            {rm.isLocked ? 'Unlock' : 'Lock'}
                          </button>
                          {rm.status !== 'terminated' && rm.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() =>
                                void runAdminAction(`Terminated room ${rm.roomCode}.`, async () => {
                                  await apiFetch(`/api/games/admin/rooms/${rm.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ status: 'terminated', isLocked: true }),
                                  });
                                })
                              }
                              className="inline-flex items-center gap-1 text-rose-500 hover:underline"
                            >
                              <StopCircle className="h-3 w-3" />
                              Terminate
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

          {/* Team Code Management + Tournament Builder */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
              <h3 className="font-display text-base font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-violet-500" />
                Game Team Codes
              </h3>
              <form onSubmit={handleCreateTeam} className="grid gap-2 sm:grid-cols-3 text-xs">
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Team Name"
                  required
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
                />
                <select
                  aria-label="Team side"
                  value={teamSide}
                  onChange={(e) => setTeamSide(e.target.value as 'alpha' | 'beta')}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
                >
                  <option value="alpha">Side Alpha</option>
                  <option value="beta">Side Beta</option>
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-violet-500 px-3 py-2 font-semibold text-white hover:bg-violet-400"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Team Code
                </button>
              </form>

              <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs max-h-60 overflow-y-auto">
                {data.teams.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 py-2">
                    <div>
                      <p className="font-medium">
                        {t.name} ({t.side})
                      </p>
                      <p className="font-mono text-violet-400">{t.teamCode}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void runAdminAction(`Regenerated team code for ${t.name}.`, async () => {
                            await apiFetch(`/api/games/admin/teams/${t.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ regenerateCode: true }),
                            });
                          })
                        }
                        className="text-cyan-500 hover:underline"
                      >
                        Regenerate
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void runAdminAction(
                            `${t.isSuspended ? 'Restored' : 'Suspended'} team ${t.name}.`,
                            async () => {
                              await apiFetch(`/api/games/admin/teams/${t.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ isSuspended: !t.isSuspended }),
                              });
                            },
                          )
                        }
                        className="text-amber-500 hover:underline"
                      >
                        {t.isSuspended ? 'Restore' : 'Suspend'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Tournament Builder & Bracket Actions */}
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
              <h3 className="font-display text-base font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Games Arena Tournaments
              </h3>
              <form onSubmit={handleCreateTournament} className="grid gap-2 sm:grid-cols-2 text-xs">
                <input
                  type="text"
                  value={tournName}
                  onChange={(e) => setTournName(e.target.value)}
                  placeholder="Tournament Title"
                  required
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 sm:col-span-2"
                />
                <select
                  aria-label="Tournament game"
                  value={tournGameId}
                  onChange={(e) => setTournGameId(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
                >
                  {data.games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Tournament format"
                  value={tournFormat}
                  onChange={(e) => setTournFormat(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
                >
                  <option value="single_elimination">Single Elimination</option>
                  <option value="double_elimination">Double Elimination</option>
                  <option value="round_robin">Round Robin</option>
                  <option value="campus_league">Campus League</option>
                </select>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-3 py-2 font-semibold text-slate-950 hover:bg-emerald-400 sm:col-span-2"
                >
                  Create Tournament
                </button>
              </form>

              <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs max-h-60 overflow-y-auto">
                {data.tournaments.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="font-mono text-slate-500">
                        {t.format} · {t.status}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void runAdminAction(`Generated tournament brackets for ${t.name}.`, async () => {
                          await apiFetch(`/api/games/admin/tournaments/${t.id}/generate-brackets`, {
                            method: 'POST',
                          });
                        })
                      }
                      className="rounded border border-cyan-500/40 px-2.5 py-1 text-cyan-500 hover:bg-cyan-500/10"
                    >
                      Seed Brackets
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* 30 Games Catalog Enable / Feature / Difficulty Controls */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
            <h3 className="font-display text-base font-semibold">30-Game Catalog Controls</h3>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 sticky top-0 bg-white dark:bg-[#11161F]">
                  <tr>
                    <th className="py-2 pr-4">Game</th>
                    <th className="py-2 pr-4">Engine</th>
                    <th className="py-2 pr-4">Difficulty</th>
                    <th className="py-2 pr-4">Plays</th>
                    <th className="py-2 text-right">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {data.games.map((g) => (
                    <tr key={g.id} className="h-10">
                      <td className="pr-4 font-medium">{g.title}</td>
                      <td className="pr-4 font-mono text-slate-500">{g.engineType}</td>
                      <td className="pr-4">
                        <select
                          aria-label={`Difficulty for ${g.title}`}
                          value={g.difficulty}
                          onChange={(e) =>
                            void runAdminAction(`Updated ${g.title} difficulty.`, async () => {
                              await apiFetch(`/api/games/admin/games/${g.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ difficulty: e.target.value }),
                              });
                            })
                          }
                          className="rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2 py-1 text-xs"
                        >
                          <option value="Beginner">Beginner</option>
                          <option value="Easy">Easy</option>
                          <option value="Medium">Medium</option>
                          <option value="Hard">Hard</option>
                          <option value="Expert">Expert</option>
                        </select>
                      </td>
                      <td className="pr-4 font-mono tabular-nums">{g.playCount}</td>
                      <td className="text-right space-x-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            void runAdminAction(
                              `${g.isFeatured ? 'Unfeatured' : 'Featured'} ${g.title}.`,
                              async () => {
                                await apiFetch(`/api/games/admin/games/${g.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ isFeatured: !g.isFeatured }),
                                });
                              },
                            )
                          }
                          className={g.isFeatured ? 'text-amber-400 font-semibold' : 'text-slate-400'}
                        >
                          {g.isFeatured ? 'Featured' : 'Feature'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void runAdminAction(
                              `${g.isEnabled ? 'Disabled' : 'Enabled'} ${g.title}.`,
                              async () => {
                                await apiFetch(`/api/games/admin/games/${g.id}`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ isEnabled: !g.isEnabled }),
                                });
                              },
                            )
                          }
                          className={g.isEnabled ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}
                        >
                          {g.isEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Games Admin Audit Log */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
            <h3 className="font-display text-base font-semibold">Games Arena Admin Audit Logs</h3>
            {data.logs.length === 0 ? (
              <p className="text-xs text-slate-500">No administrative actions recorded in Games Arena yet.</p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {data.logs.slice(0, 12).map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <span className="font-mono font-semibold text-cyan-500">{l.action}</span>
                      <span className="ml-2 text-slate-500">
                        {l.actorEmail} · {l.targetType} #{l.targetId}
                      </span>
                    </div>
                    <span className="font-mono text-slate-500">
                      {new Date(l.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
