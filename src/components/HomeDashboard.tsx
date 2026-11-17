import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  Compass,
  Flag,
  FlaskConical,
  Gamepad2,
  HelpCircle,
  Library,
  ShieldAlert,
  Sparkles,
  Terminal,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSections } from '../context/SectionContext';
import type { Campus, NavSection } from '../types/kali';
import { AdminSecurityNotice } from './AdminSecurityNotice';
import heroBannerImg from '../assets/images/hero_cyber_arena_1794688362854.jpg';
import { getExperienceBadgeLabel } from '../lib/domain/learning-experience';

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

export const HomeDashboard: React.FC<{
  onNavigate: (section: NavSection) => void;
  onOpenOnboarding?: () => void;
  onOpenHelp?: () => void;
}> = ({ onNavigate, onOpenOnboarding, onOpenHelp }) => {
  const {
    user,
    memberships,
    authPending,
    learningExperience,
    progressionMode,
    progressionSummary,
    onboardingCompleted,
    onboardingGoal,
    bookmarks,
    loginWithGoogle,
    apiFetch,
  } = useAuth();
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

  const isBeginner = learningExperience === 'beginner';
  const isExpert = learningExperience === 'expert';
  const experienceLabel = getExperienceBadgeLabel(learningExperience);

  const recommendedStep = (() => {
    const pd = data?.playerDashboard;
    if (!pd || (pd.completedLessonsCount === 0 && pd.completedLabsCount === 0)) {
      return {
        title: 'Start with Linux CLI Foundations in Learn KALI',
        detail:
          'Practice safe essential commands like ls, pwd, cat, sudo apt update, and whois kali.org step by step before diving into live labs.',
        target: isSectionVisibleInNav('learn-kali') ? ('learn-kali' as NavSection) : ('academy' as NavSection),
        cta: 'Open Learn KALI Terminal',
      };
    }
    if (pd.weakSkills.length > 0 && isSectionVisibleInNav('ctf')) {
      return {
        title: `Strengthen ${pd.weakSkills[0].category}`,
        detail: pd.weakSkills[0].recommendation,
        target: 'ctf' as NavSection,
        cta: 'Practice in CTF Arena',
      };
    }
    if (isSectionVisibleInNav('labs')) {
      return {
        title: 'Apply Your Knowledge in Hands-On Cyber Labs',
        detail: 'Complete guided practical walkthroughs and security verification checks to earn extra XP.',
        target: 'labs' as NavSection,
        cta: 'Open Cyber Labs',
      };
    }
    return {
      title: 'Continue Your Cybersecurity Track',
      detail: 'Explore structured stages in Learning Academy or join a multiplayer training room.',
      target: 'academy' as NavSection,
      cta: 'Continue Learning',
    };
  })();

  return (
    <div className="space-y-6">
      {/* Announcement & Maintenance Strip */}
      {data?.platformControls?.maintenanceMode ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-sm">
          <p className="text-amber-700 dark:text-amber-300 font-medium">
            Scheduled Maintenance Notice: Some competitive operations may be paused by platform administration.
          </p>
          <span className="text-xs font-mono text-amber-600 dark:text-amber-400 whitespace-nowrap shrink-0">Maintenance</span>
        </div>
      ) : data?.globalAnnouncement ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] px-5 py-3 text-sm">
          <p className="text-slate-700 dark:text-slate-300">{data.globalAnnouncement}</p>
          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0">
            {experienceLabel}
          </span>
        </div>
      ) : null}

      {/* 1. Welcome & Primary Start / Continue Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#0D1118] min-h-[260px] flex items-end">
        {!imgFailed ? (
          <img
            src={heroBannerImg}
            alt="KALI3977 cybersecurity operations and global network topology"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 h-full w-full object-cover opacity-65"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0E1622] to-emerald-950/50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/30" />

        <div className="kali-hero-layout relative z-10 flex w-full flex-col justify-between gap-5 sm:gap-6 p-5 sm:p-6 md:p-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl space-y-2.5 min-w-0">
            <p className="text-xs font-medium tracking-wide text-emerald-400">
              {user ? `Welcome back, ${user.displayName}` : 'Welcome to KALI3977'} · {experienceLabel}
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
              ZERO TO ADVANCED. Learn. Practise. Compete. Master.
            </h1>
            <p className="text-sm leading-relaxed text-slate-200">
              {onboardingGoal
                ? `Active goal: ${onboardingGoal}. Follow your recommended next step or jump into any hub below.`
                : 'Simple for beginners, practical for learners, and deep enough for specialists. Every course, command lab, and challenge stays open to explore.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            {isSectionVisibleInNav(recommendedStep.target) && (
              <button
                type="button"
                onClick={() => onNavigate(recommendedStep.target)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0"
              >
                {data?.playerDashboard && data.playerDashboard.completedLessonsCount > 0
                  ? 'Continue Learning'
                  : 'Start Learning'}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {!user && (
              <button
                type="button"
                disabled={authPending}
                onClick={() => void loginWithGoogle()}
                className="rounded-lg border border-white/25 bg-black/40 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {authPending ? 'Signing in...' : 'Sign In to Save XP'}
              </button>
            )}
            {onOpenOnboarding && (
              <button
                type="button"
                onClick={onOpenOnboarding}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3.5 py-2.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 whitespace-nowrap shrink-0"
              >
                <Compass className="h-3.5 w-3.5" />
                {onboardingCompleted ? 'Quick Start Guide' : 'Take Guided Tour'}
              </button>
            )}
            {onOpenHelp && (
              <button
                type="button"
                onClick={onOpenHelp}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-500/50 bg-black/40 px-3.5 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/10 whitespace-nowrap shrink-0"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Glossary &amp; Help
              </button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-500">
          {error}
        </div>
      )}

      {/* 2. Quick-Action Hub Cards (Start Learning / Learn KALI / Practice / Play) */}
      <section aria-label="Quick Start Actions" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isSectionVisibleInNav('academy') && (
          <button
            type="button"
            onClick={() => onNavigate('academy')}
            className="group text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 hover:border-emerald-500/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <BookOpen className="h-5 w-5 text-emerald-500" />
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
            </div>
            <h2 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">
              Learning Academy
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {isExpert
                ? 'Stages 1–8 modules, skill diagnostics, and verified completion certificates.'
                : 'Step-by-step lessons in English or Hindi with interactive quizzes and notes.'}
            </p>
          </button>
        )}

        {isSectionVisibleInNav('learn-kali') && (
          <button
            type="button"
            onClick={() => onNavigate('learn-kali')}
            className="group text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 hover:border-cyan-500/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <Terminal className="h-5 w-5 text-cyan-500" />
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-cyan-500 transition-colors" />
            </div>
            <h2 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">
              Learn KALI &amp; Linux CLI
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {isExpert
                ? 'Built-in simulator + Kali command workflows (whois, nmap, metasploit, sqlmap).'
                : 'Try real commands like ls, whois, and apt safely in our guided browser terminal.'}
            </p>
          </button>
        )}

        {isSectionVisibleInNav('labs') && (
          <button
            type="button"
            onClick={() => onNavigate('labs')}
            className="group text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 hover:border-amber-500/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <FlaskConical className="h-5 w-5 text-amber-500" />
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
            </div>
            <h2 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">
              Practice: Labs &amp; CTF
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Solve practical cybersecurity labs, download challenge artifacts, and verify flags.
            </p>
          </button>
        )}

        {isSectionVisibleInNav('games') && (
          <button
            type="button"
            onClick={() => onNavigate('games')}
            className="group text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 hover:border-violet-500/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <Gamepad2 className="h-5 w-5 text-violet-500" />
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-violet-500 transition-colors" />
            </div>
            <h2 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">
              Play: Games &amp; Arenas
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Play solo cyber challenges or invite friends using Room Codes and Team Codes.
            </p>
          </button>
        )}
      </section>

      {/* 3. Recommended Next Step + Learning Experience Path */}
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-xl border border-emerald-500/30 bg-white dark:bg-[#11161F] p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-4 w-4" />
              <span>Recommended Next Step</span>
            </div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {recommendedStep.title}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">{recommendedStep.detail}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Mode: <strong className="capitalize text-slate-700 dark:text-slate-200">{learningExperience}</strong> ·{' '}
              Progression: <strong className="capitalize text-slate-700 dark:text-slate-200">{progressionMode}</strong>
            </span>
            <button
              type="button"
              onClick={() => onNavigate(recommendedStep.target)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 whitespace-nowrap shrink-0"
            >
              {recommendedStep.cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              My Learning Path
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Theme Settings
            </button>
          </div>

          {progressionSummary ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <span>
                  {progressionSummary.nextTier
                    ? `Progress toward ${progressionSummary.nextTier} experience`
                    : 'Expert Learning Experience Unlocked'}
                </span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {progressionSummary.xpProgressPct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all"
                  style={{ width: `${progressionSummary.xpProgressPct}%` }}
                />
              </div>
              <div className="grid grid-cols-3 kali-keep-cols gap-2 pt-1 text-center text-xs">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-2">
                  <p className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    {progressionSummary.completedLessonsCount}
                  </p>
                  <p className="text-[11px] text-slate-500">Lessons</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-2">
                  <p className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                    {progressionSummary.practiceCount}
                  </p>
                  <p className="text-[11px] text-slate-500">Practical Tasks</p>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-2">
                  <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {bookmarks.length}
                  </p>
                  <p className="text-[11px] text-slate-500">Saved</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <p>
                You can switch freely between <strong>Beginner</strong>, <strong>Intermediate</strong>, and <strong>Expert</strong> learning experiences at any time from the top bar without losing access to any content.
              </p>
              {isBeginner && (
                <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Beginner Tip: Bookmark any course, Kali command, lab, or CTF to find it quickly later in My Profile.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 4. Personalized Player Dashboard (Real Stored Records) */}
      {user && data?.playerDashboard && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                Recent Progress &amp; Telemetry
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Level {data.playerDashboard.level.level} · Global Rank #{data.playerDashboard.globalRank}
                {memberships[0] ? ` · Team: ${memberships[0].teamName}` : ''}
              </p>
            </div>
            <div className="font-mono text-xs tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {data.playerDashboard.xp} XP
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {' '}
                · {data.playerDashboard.dailyStreak} day streak
              </span>
            </div>
          </div>

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
                <p className="text-xs text-slate-500 dark:text-slate-400">Saved Items</p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                  {bookmarks.length}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Skill Gap Analysis &amp; Diagnostics
                </h3>
              </div>
              {data.playerDashboard.weakSkills.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
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

      {/* 5. Real Database Metrics Strip */}
      <section aria-label="Platform Statistics">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
          {[
            { label: 'Registered Learners', value: data?.platformStats.totalUsers ?? 0, icon: Users, visible: true },
            { label: 'Academy Courses', value: data?.platformStats.totalCourses ?? 0, icon: BookOpen, visible: isSectionVisibleInNav('academy') },
            { label: 'Library Books', value: data?.platformStats.totalBooks ?? 0, icon: Library, visible: isSectionVisibleInNav('books') },
            { label: 'Cyber Labs', value: data?.platformStats.totalLabs ?? 0, icon: FlaskConical, visible: isSectionVisibleInNav('labs') },
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

      {/* 6. Upcoming & Live Competitions */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-violet-500" />
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              Active &amp; Upcoming Competitions
            </h2>
          </div>
          {isSectionVisibleInNav('arena') && (
            <button
              type="button"
              onClick={() => onNavigate('arena')}
              className="text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Join with Room &amp; Team Code
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
