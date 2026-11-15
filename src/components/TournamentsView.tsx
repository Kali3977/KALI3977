import React, { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import crestImg from '../assets/images/badge_tournament_crest_1794688363110.jpg';

interface TournamentItem {
  id: number;
  name: string;
  description?: string;
  format: string;
  recurrence: string;
  status: string;
  maxTeams: number;
  teamSize: number;
  registrationDeadline?: string | null;
  startsAt: string;
  bracketsJson: {
    rounds?: Array<{
      round: number;
      label: string;
      matches: Array<{
        matchId: string;
        teamA: { id: number; name: string } | null;
        teamB: { id: number; name: string } | null;
        status: string;
        winnerTeamId?: number | null;
        scoreSummary?: string | null;
      }>;
    }>;
  };
}

interface LeaderboardsPayload {
  individual: Array<{ id: number; username: string; displayName: string; country: string; xp: number; ctfPoints: number }>;
  teams: Array<{ id: number; name: string; score: number; campusName: string | null }>;
  campuses: Array<{ id: number; code: string; name: string; country: string; totalScore: number }>;
}

export const TournamentsView: React.FC = () => {
  const { user, memberships, loginWithGoogle, apiFetch } = useAuth();
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [boards, setBoards] = useState<LeaderboardsPayload | null>(null);
  const [boardTab, setBoardTab] = useState<'individual' | 'teams' | 'campuses'>('teams');
  const [regMessage, setRegMessage] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<{ tournaments: TournamentItem[] }>('/api/tournaments'),
      apiFetch<LeaderboardsPayload>('/api/leaderboards'),
    ]).then(([tRes, lRes]) => {
      setTournaments(tRes.tournaments);
      setBoards(lRes);
    });
  }, [user?.id]);

  const handleRegister = async (tournamentId: number) => {
    if (!user) return loginWithGoogle();
    const myTeam = memberships[0];
    if (!myTeam) {
      setRegMessage('Join a team in Multiplayer Arena before registering for a tournament.');
      return;
    }
    try {
      const res = await apiFetch<{ status: string }>(`/api/tournaments/${tournamentId}/register`, {
        method: 'POST',
        body: JSON.stringify({ teamId: myTeam.teamId }),
      });
      setRegMessage(`Registered ${myTeam.teamName} (${res.status}).`);
    } catch (err) {
      setRegMessage(err instanceof Error ? err.message : 'Registration error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header with Tournament Crest */}
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900">
            {!imgFailed ? (
              <img
                src={crestImg}
                alt="KALI3977 Inter-University Championship Crest"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Trophy className="h-7 w-7 text-emerald-500" />
              </div>
            )}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
              Tournaments, Brackets & Leaderboards
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Inter-university seasonal leagues, knockout brackets, and live global rankings.
            </p>
          </div>
        </div>
      </div>

      {regMessage && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-700 dark:text-cyan-300">
          {regMessage}
        </div>
      )}

      {/* Tournaments & Brackets */}
      <div className="grid gap-6 lg:grid-cols-2">
        {tournaments.map((t) => (
          <div
            key={t.id}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t.format.replace(/_/g, ' ')} · {t.recurrence} · {t.status.replace(/_/g, ' ')} · Max {t.maxTeams} teams ({t.teamSize}/team)
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t.name}
                </h2>
                {t.description && (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{t.description}</p>
                )}
                {t.registrationDeadline && (
                  <p className="mt-1 font-mono text-[11px] text-cyan-500">
                    Registration deadline: {new Date(t.registrationDeadline).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRegister(t.id)}
                className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 whitespace-nowrap shrink-0"
              >
                Register Team
              </button>
            </div>

            {t.bracketsJson?.rounds && t.bracketsJson.rounds.length > 0 ? (
              <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4">
                {t.bracketsJson.rounds.map((rnd) => (
                  <div key={rnd.round} className="space-y-1">
                    <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 mb-2">{rnd.label}</p>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800">
                      {rnd.matches.map((m) => (
                        <div
                          key={m.matchId}
                          className="flex items-center justify-between py-2.5 text-xs gap-2"
                        >
                          <span>
                            <span className={m.winnerTeamId && m.teamA?.id === m.winnerTeamId ? 'font-bold text-emerald-500' : ''}>
                              {m.teamA?.name || 'TBD'}
                            </span>{' '}
                            <span className="text-slate-400">vs</span>{' '}
                            <span className={m.winnerTeamId && m.teamB?.id === m.winnerTeamId ? 'font-bold text-emerald-500' : ''}>
                              {m.teamB?.name || 'TBD'}
                            </span>
                          </span>
                          <span className="font-mono text-emerald-500">
                            {m.scoreSummary ? `${m.scoreSummary} · ` : ''}{m.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-4">
                No seeded matches yet. Brackets populate automatically when registered teams are paired by tournament administrators.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Global, Team & Campus Leaderboards */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            Live Rankings
          </h2>
          <div className="flex gap-1 rounded-lg border border-slate-200 dark:border-slate-800 p-1">
            {(['teams', 'campuses', 'individual'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setBoardTab(tab)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
                  boardTab === tab
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {boards && boardTab === 'teams' && (
          <div className="space-y-3">
            {boards.teams.map((t, idx) => {
              const maxScore = Math.max(1, boards.teams[0]?.score || 100);
              const pct = Math.round((t.score / maxScore) * 100);
              return (
                <div key={t.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">
                      <span className="font-mono text-slate-400 mr-2">#{idx + 1}</span>
                      {t.name}
                    </span>
                    <span className="font-mono font-semibold text-emerald-500 tabular-nums">
                      {t.score} pts
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {boards && boardTab === 'campuses' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Campus</th>
                  <th className="py-2 pr-4 font-medium">Country</th>
                  <th className="py-2 font-medium text-right">Aggregate Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                {boards.campuses.map((c) => (
                  <tr key={c.id} className="h-9">
                    <td className="pr-4 font-medium">{c.name}</td>
                    <td className="pr-4 text-slate-500">{c.country}</td>
                    <td className="text-right font-mono text-emerald-500">{c.totalScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {boards && boardTab === 'individual' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Rank</th>
                  <th className="py-2 pr-4 font-medium">Player</th>
                  <th className="py-2 pr-4 font-medium">Country</th>
                  <th className="py-2 pr-4 font-medium text-right">CTF Pts</th>
                  <th className="py-2 font-medium text-right">Total XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                {boards.individual.map((p, i) => (
                  <tr key={p.id} className="h-9">
                    <td className="pr-4 font-mono">#{i + 1}</td>
                    <td className="pr-4 font-medium">
                      {p.displayName} <span className="font-mono text-slate-500">@{p.username}</span>
                    </td>
                    <td className="pr-4 text-slate-500">{p.country}</td>
                    <td className="pr-4 text-right font-mono">{p.ctfPoints}</td>
                    <td className="text-right font-mono text-emerald-500">{p.xp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
