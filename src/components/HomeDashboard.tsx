import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  Flag,
  FlaskConical,
  Library,
  ShieldAlert,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSections } from '../context/SectionContext';
import type { Campus, NavSection } from '../types/kali';
import { AdminSecurityNotice } from './AdminSecurityNotice';
import heroBannerImg from '../assets/images/hero_cyber_arena_1794688362854.jpg';

interface OverviewPayload {
  platformStats: {
    totalUsers: number;
    totalCourses: number;
    totalBooks?: number;
    totalLabs: number;
    totalChallenges: number;
    totalCompetitions: number;
    totalCampuses: number;
  };
  campuses?: Campus[];
  upcomingEvents: Array<{
    id: number;
    name: string;
    gameMode: string;
    status: string;
    difficulty: string;
    totalCapacity: number;
    startsAt: string;
  }>;
  globalAnnouncement: string;
  platformControls?: {
    maintenanceMode?: boolean;
    disableAiMentor?: boolean;
    disableCommunity?: boolean;
    globalAnnouncement?: string;
  };
  playerDashboard: {
    xp: number;
    level: {
      level: number;
      currentLevelXp: number;
      nextLevelXp: number;
      progressPct: number;
    };
    globalRank: number;
    completedLessonsCount: number;
    completedLabsCount: number;
    solvedChallengesCount: number;
    ctfPoints: number;
    dailyStreak: number;
    achievements: Array<{ id: number; title: string; description: string; category: string }>;
    certificates: Array<{ id: number; verificationId: string; title: string; issuedAt: string }>;
    recommendedChallenges: Array<{
      id: number;
      title: string;
      category: string;
      difficulty: string;
      currentPoints: number;
    }>;
    weakSkills: Array<{ category: string; accuracyPct: number; recommendation: string }>;
    bookStats?: {
      inReadingListCount: number;
      bookmarkedCount: number;
      activeBooksCount: number;
      readingItems: Array<{ bookId: number; title: string; progressPct: number; inReadingList: boolean }>;
    };
    ctfBookmarksCount?: number;
    verifiedSkills?: Array<{ subjectArea: string; verifiedLevel: string; scorePct: number }>;
  } | null;
}

export const HomeDashboard: React.FC<{ onNavigate: (section: NavSection) => void }> = ({
  onNavigate,
}) => {
  const { user, memberships, authPending, loginWithGoogle, apiFetch } = useAuth();
  const { isSectionVisibleInNav } = useSections();
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<OverviewPayload>('/api/overview')
      .then((res) => {
        if (active) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiFetch, user?.id]);

  return (
    <div className="space-y-8">
      {/* Announcement & Maintenance Strip */}
      {data?.platformControls?.maintenanceMode ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-sm">
          <p className="text-amber-600 dark:text-amber-300 font-medium">
            Scheduled Maintenance Notice: Some competitive operations may be paused by platform administration.
          </p>
          <span className="text-xs font-mono text-amber-500 whitespace-nowrap shrink-0">Maintenance</span>
        </div>
      ) : data?.globalAnnouncement ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] px-5 py-3 text-sm">
          <p className="text-slate-700 dark:text-slate-300">{data.globalAnnouncement}</p>
          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0">
            Announcement
          </span>
        </div>
      ) : null}

      {/* Hero Banner — Single focal anchor */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#0D1118] min-h-[290px] flex items-end">
        {!imgFailed ? (
          <img
            src={heroBannerImg}
            alt="KALI3977 cybersecurity operations and global network topology"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0E1622] to-emerald-950/50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/25" />

        <div className="relative z-10 flex w-full flex-col justify-between gap-6 p-6 md:p-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-medium tracking-wide text-emerald-400">
              Independent Worldwide Cybersecurity Education Platform · Not an Official Kali Linux Product
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
              ZERO TO ADVANCED. Learn. Practise. Compete. Master.
            </h1>
            <p className="text-sm leading-relaxed text-slate-300 md:text-base">
              Adaptive learning from Absolute Beginner to Research & Specialist level, open-access
              cybersecurity books, isolated practical labs, and real-time campus CTF competitions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {!user ? (
              <button
                type="button"
                disabled={authPending}
                onClick={() => void loginWithGoogle()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
              >
                {authPending ? 'Signing in...' : 'Sign In with Google'}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : isSectionVisibleInNav('arena') ? (
              <button
                type="button"
                onClick={() => onNavigate('arena')}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0"
              >
                Enter Multiplayer Arena
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}
            {isSectionVisibleInNav('learn-kali') && (
              <button
                type="button"
                onClick={() => onNavigate('learn-kali')}
                className="rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-4 py-2.5 text-sm font-medium text-cyan-300 hover:bg-cyan-500/25 transition-colors whitespace-nowrap shrink-0"
              >
                Learn KALI
              </button>
            )}
            {isSectionVisibleInNav('games') && (
              <button
                type="button"
                onClick={() => onNavigate('games')}
                className="rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/25 transition-colors whitespace-nowrap shrink-0"
              >
                Games Arena (30 Games)
              </button>
            )}
            {isSectionVisibleInNav('academy') && (
              <button
                type="button"
                onClick={() => onNavigate('academy')}
                className="rounded-lg border border-slate-600 bg-black/40 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
              >
                Explore Academy
              </button>
            )}
            {isSectionVisibleInNav('books') && (
              <button
                type="button"
                onClick={() => onNavigate('books')}
                className="rounded-lg border border-slate-600 bg-black/40 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
              >
                Browse Books
              </button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
          {error}
        </div>
      )}

      {/* Real Database Metrics Strip */}
      <section aria-label="Platform Statistics">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
          {[
            { label: 'Registered Learners', value: data?.platformStats.totalUsers ?? 0, icon: Users, visible: true },
            { label: 'Academy Courses', value: data?.platformStats.totalCourses ?? 0, icon: BookOpen, visible: isSectionVisibleInNav('academy') },
            { label: 'Library Books', value: data?.platformStats.totalBooks ?? 0, icon: Library, visible: isSectionVisibleInNav('books') },
            { label: 'Isolated Labs', value: data?.platformStats.totalLabs ?? 0, icon: FlaskConical, visible: isSectionVisibleInNav('labs') },
            { label: 'CTF Challenges', value: data?.platformStats.totalChallenges ?? 0, icon: Flag, visible: isSectionVisibleInNav('ctf') },
            { label: 'Verified Campuses', value: data?.platformStats.totalCampuses ?? 0, icon: Award, visible: true },
            { label: 'Competitions', value: data?.platformStats.totalCompetitions ?? 0, icon: Trophy, visible: isSectionVisibleInNav('arena') },
          ]
            .filter((s) => s.visible)
            .map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4"
                >
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="text-xs font-medium">{stat.label}</span>
                  <Icon className="h-4 w-4 text-cyan-500" />
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {loading ? '—' : stat.value}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Personalized Player Dashboard (Strictly Real Stored Records) */}
      {user && data?.playerDashboard && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
                Player Progress & Telemetry
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {user.displayName} · Level {data.playerDashboard.level.level} · Rank #
                {data.playerDashboard.globalRank}
                {memberships[0] ? ` · ${memberships[0].teamName}` : ' · No active campus team'}
              </p>
            </div>
            <div className="text-right font-mono text-sm tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {data.playerDashboard.xp} XP
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {' '}
                · {data.playerDashboard.dailyStreak} day streak
              </span>
            </div>
          </div>

          {/* XP Level Bar */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              <span>Level {data.playerDashboard.level.level} Progress</span>
              <span className="font-mono tabular-nums">
                {data.playerDashboard.level.currentLevelXp} / {data.playerDashboard.level.nextLevelXp} XP
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${data.playerDashboard.level.progressPct}%` }}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-6 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Completed Lessons</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                  {data.playerDashboard.completedLessonsCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Completed Labs</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                  {data.playerDashboard.completedLabsCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Solved CTF Flags</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                  {data.playerDashboard.solvedChallengesCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">CTF Points</p>
                <p className="mt-1 font-mono text-lg font-semibold text-cyan-600 dark:text-cyan-400 tabular-nums">
                  {data.playerDashboard.ctfPoints}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Reading List</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                  {data.playerDashboard.bookStats?.inReadingListCount ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Saved CTFs</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                  {data.playerDashboard.ctfBookmarksCount ?? 0}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Weak Skills & Verified Diagnostic Levels */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Skill Gap Analysis & Diagnostics
                </h3>
              </div>
              {data.playerDashboard.verifiedSkills && data.playerDashboard.verifiedSkills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.playerDashboard.verifiedSkills.map((sk) => (
                    <span
                      key={sk.subjectArea}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] text-emerald-500"
                    >
                      {sk.subjectArea}: {sk.verifiedLevel} ({sk.scorePct}%)
                    </span>
                  ))}
                </div>
              )}
              {data.playerDashboard.weakSkills.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No weak-skill gaps recorded yet. Take a Diagnostic Assessment in Learning Academy or solve CTF challenges to calibrate your personalized path.
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.playerDashboard.weakSkills.map((ws) => (
                    <li
                      key={ws.category}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-sm"
                    >
                      <div className="flex items-center justify-between font-medium">
                        <span>{ws.category}</span>
                        <span className="font-mono text-amber-500 tabular-nums">{ws.accuracyPct}% accuracy</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{ws.recommendation}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Recommended Challenges & Reading Progress */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Recommended Challenges
                  </h3>
                </div>
                {isSectionVisibleInNav('ctf') && (
                  <button
                    type="button"
                    onClick={() => onNavigate('ctf')}
                    className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Open CTF Arena
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {data.playerDashboard.recommendedChallenges.map((ch) => (
                  <div key={ch.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{ch.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {ch.category} · {ch.difficulty}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {ch.currentPoints} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Initial Participating Campuses Directory (5 NFSU Campuses) */}
      {data?.campuses && data.campuses.length > 0 && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              Participating University Campuses ({data.campuses.length})
            </h2>
            {isSectionVisibleInNav('arena') && (
              <button
                type="button"
                onClick={() => onNavigate('arena')}
                className="text-xs font-medium text-emerald-500 hover:underline"
              >
                Join Campus Squad
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {data.campuses.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3.5 text-xs"
              >
                <p className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</p>
                <p className="mt-1 text-slate-500">
                  {c.city}, {c.country}
                </p>
                <p className="mt-1 font-mono text-[11px] text-cyan-500">{c.code}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming & Live Competitions */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-violet-500" />
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              Active & Upcoming Competitions
            </h2>
          </div>
          {isSectionVisibleInNav('arena') && (
            <button
              type="button"
              onClick={() => onNavigate('arena')}
              className="text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Join with Room & Team Code
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {(data?.upcomingEvents || []).map((ev) => (
            <div key={ev.id} className="flex flex-wrap items-center justify-between gap-4 py-3.5">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">{ev.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {ev.gameMode.replace(/_/g, ' ')} · {ev.difficulty} · Capacity{' '}
                  <span className="font-mono tabular-nums">{ev.totalCapacity}</span> · Status:{' '}
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">{ev.status}</span>
                </p>
              </div>
              {isSectionVisibleInNav('arena') && (
                <button
                  type="button"
                  onClick={() => onNavigate('arena')}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  View Room
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <AdminSecurityNotice compact />
    </div>
  );
};

