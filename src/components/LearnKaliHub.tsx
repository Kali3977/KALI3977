import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  Bookmark,
  BookOpen,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  ExternalLink,
  Eye,
  Flame,
  Gamepad2,
  HelpCircle,
  Info,
  Loader2,
  Lock,
  Play,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Swords,
  Terminal,
  Trophy,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validateMissionCommandSequence } from '../lib/kali/simulator';
import { LearnKaliTerminal } from './LearnKaliTerminal';
import { LoadErrorState, LoadingState } from './LoadingState';

interface KaliLevelItem {
  id: number;
  levelNumber: number;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  xpRequired: number;
  badgeTitle: string;
  topicsJson: string[];
}

interface KaliCategoryItem {
  id: number;
  slug: string;
  name: string;
  description: string;
  officialOrder: number;
  iconKey: string;
  enabled: boolean;
}

interface CommandExample {
  command: string;
  explanation: string;
  flagBreakdown: Array<{ flag: string; meaning: string }>;
  sampleOutput?: string;
}

interface CommonErrorItem {
  error: string;
  cause: string;
  fix: string;
}

interface KaliToolItem {
  id: number;
  slug: string;
  categorySlug: string;
  name: string;
  summary: string;
  purpose: string;
  installCommand: string;
  supportedOs: string;
  versionNote: string;
  difficulty: string;
  minLevelNumber: number;
  xpReward: number;
  status: string;
  prerequisitesJson: string[];
  basicCommandsJson: CommandExample[];
  intermediateCommandsJson: CommandExample[];
  advancedCommandsJson: CommandExample[];
  commonErrorsJson: CommonErrorItem[];
  relatedToolSlugsJson: string[];
  officialDocsUrl: string;
  githubUrl: string | null;
  interactiveSupported: boolean;
  enabled: boolean;
}

interface KaliLessonItem {
  id: number;
  toolId: number;
  slug: string;
  title: string;
  stepOrder: number;
  contentMarkdown: string;
  commandPractice: string;
  expectedGoal: string;
  quizQuestion: string;
  quizOptionsJson: string[];
  xpReward: number;
}

interface KaliMissionItem {
  id: number;
  slug: string;
  title: string;
  missionType: string;
  categorySlug: string;
  levelNumber: number;
  difficulty: string;
  description: string;
  scenarioBrief: string;
  objectivesJson: string[];
  requiredToolSlugsJson: string[];
  terminalChallengeJson: {
    startingDir: string;
    simulatedPrompt: string;
    steps: Array<{
      id: string;
      instruction: string;
      expectedPattern: string;
      hint: string;
      explanation: string;
    }>;
  } | null;
  assessmentJson: {
    question: string;
    options: string[];
  } | null;
  relatedLabSlug: string | null;
  xpReward: number;
  achievementCode: string | null;
}

interface ToolProgressItem {
  toolId: number;
  masteryScore: number;
  lessonsCompletedJson: number[];
  terminalExercisesPassedJson: string[];
  xpAwardedTotal: number;
}

interface MissionProgressItem {
  missionId: number;
  status: string;
  stepsPassedJson: string[];
  xpAwarded: boolean;
}

interface LeaderboardEntry {
  userId: number;
  username: string;
  displayName: string;
  xp: number;
  dailyStreak: number;
  toolsMastered: number;
  avgMastery: number;
}

interface LearnKaliPayload {
  levels: KaliLevelItem[];
  categories: KaliCategoryItem[];
  tools: KaliToolItem[];
  lessons: KaliLessonItem[];
  missions: KaliMissionItem[];
  toolProgress: ToolProgressItem[];
  missionProgress: MissionProgressItem[];
  userLevelSummary: {
    currentLevel: { levelNumber: number; title: string; xpRequired: number };
    nextLevel: { levelNumber: number; title: string; xpRequired: number } | null;
    progressPercent: number;
  };
  leaderboard: LeaderboardEntry[];
  runnerStatus?: {
    configured: boolean;
    connected?: boolean;
    label: string;
    provider?: string;
    runnerUrlConfigured?: boolean;
  };
}

type KaliTab = 'skill_tree' | 'catalog' | 'tool_detail' | 'missions' | 'terminal' | 'leaderboard';

export const LearnKaliHub: React.FC = () => {
  const {
    user,
    learningExperience,
    toggleBookmark,
    hasBookmark,
    loginWithGoogle,
    apiFetch,
    refreshProfile,
  } = useAuth();
  const [data, setData] = useState<LearnKaliPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<KaliTab>('skill_tree');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedToolSlug, setSelectedToolSlug] = useState<string | null>(null);
  const [commandTier, setCommandTier] = useState<'basic' | 'intermediate' | 'advanced'>(() =>
    learningExperience === 'expert' ? 'advanced' : learningExperience === 'intermediate' ? 'intermediate' : 'basic',
  );
  const [missionFilter, setMissionFilter] = useState<string>('all');
  const [activeMissionId, setActiveMissionId] = useState<number | null>(null);
  const [missionCmdHistory, setMissionCmdHistory] = useState<Record<number, string[]>>({});
  const [missionAnswers, setMissionAnswers] = useState<Record<number, number>>({});
  const [verifyingMissionId, setVerifyingMissionId] = useState<number | null>(null);
  const [missionFeedback, setMissionFeedback] = useState<
    Record<number, { ok: boolean; message: string; needsSignIn?: boolean }>
  >({});
  const [lessonAnswers, setLessonAnswers] = useState<Record<number, number>>({});
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [envMode, setEnvMode] = useState<'simulator' | 'microvm'>('simulator');
  const [externalRun, setExternalRun] = useState<{ nonce: number; command: string } | null>(null);
  const [copiedCmdKey, setCopiedCmdKey] = useState<string | null>(null);
  const [expandedOutputs, setExpandedOutputs] = useState<Record<string, boolean>>({});
  const [expandedExplains, setExpandedExplains] = useState<Record<string, boolean>>({});
  const [expandedHints, setExpandedHints] = useState<Record<string, boolean>>({});
  const terminalSectionRef = useRef<HTMLDivElement | null>(null);

  const loadLearnKali = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<LearnKaliPayload>('/api/learn-kali');
      setData(res);
      if (!selectedToolSlug && res.tools.length > 0) {
        setSelectedToolSlug(res.tools[0].slug);
      }
      if (!activeMissionId && res.missions.length > 0) {
        setActiveMissionId(res.missions[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Learn KALI.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLearnKali();
  }, [user?.id]);

  const toolProgressMap = useMemo(() => {
    const map = new Map<number, ToolProgressItem>();
    for (const p of data?.toolProgress || []) map.set(p.toolId, p);
    return map;
  }, [data?.toolProgress]);

  const missionProgressMap = useMemo(() => {
    const map = new Map<number, MissionProgressItem>();
    for (const m of data?.missionProgress || []) map.set(m.missionId, m);
    return map;
  }, [data?.missionProgress]);

  const selectedTool = useMemo(
    () =>
      data?.tools.find((t) => t.slug === selectedToolSlug) ??
      data?.tools[0] ??
      null,
    [data?.tools, selectedToolSlug],
  );

  const selectedToolLessons = useMemo(
    () => (data?.lessons || []).filter((l) => l.toolId === selectedTool?.id),
    [data?.lessons, selectedTool?.id],
  );

  const filteredTools = useMemo(() => {
    const list = data?.tools || [];
    return list.filter((t) => {
      if (selectedCategory !== 'all' && t.categorySlug !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q) ||
          t.categorySlug.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data?.tools, selectedCategory, searchQuery]);

  const filteredMissions = useMemo(() => {
    const list = data?.missions || [];
    if (missionFilter === 'all') return list;
    return list.filter((m) => m.missionType === missionFilter);
  }, [data?.missions, missionFilter]);

  const openToolPage = (slug: string) => {
    setSelectedToolSlug(slug);
    setCommandTier('basic');
    setTab('tool_detail');
  };

  const handleLessonQuizSubmit = async (toolId: number, lessonId: number) => {
    if (!user) return loginWithGoogle();
    setError(null);
    setStatusNotice(null);
    try {
      const res = await apiFetch<{
        xpAwarded: number;
        explanation?: string | null;
        progress: ToolProgressItem;
      }>(`/api/learn-kali/tools/${toolId}/practice`, {
        method: 'POST',
        body: JSON.stringify({
          mode: 'quiz',
          lessonId,
          selectedOption: lessonAnswers[lessonId],
        }),
      });
      setStatusNotice(
        res.xpAwarded > 0
          ? `Lesson mastered! +${res.xpAwarded} XP awarded. ${res.explanation || ''}`
          : `Quiz verified (XP already claimed). Mastery: ${res.progress.masteryScore}%`,
      );
      await loadLearnKali();
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quiz submission failed.');
    }
  };

  const handleTerminalToolCheck = async (toolId: number, command: string) => {
    if (!user) return;
    try {
      const res = await apiFetch<{ xpAwarded: number; progress: ToolProgressItem }>(
        `/api/learn-kali/tools/${toolId}/practice`,
        {
          method: 'POST',
          body: JSON.stringify({ mode: 'terminal', command }),
        },
      );
      if (res.xpAwarded > 0) {
        setStatusNotice(
          `Simulated exercise checkoff verified! +${res.xpAwarded} XP · Tool mastery now ${res.progress.masteryScore}%.`,
        );
        await loadLearnKali();
        await refreshProfile();
      }
    } catch {
      // Ignore non-matching exploratory commands while student explores freely
    }
  };

  const handleCompleteMission = async (mission: KaliMissionItem) => {
    if (!user) {
      setMissionFeedback((prev) => ({
        ...prev,
        [mission.id]: {
          ok: false,
          needsSignIn: true,
          message: 'Sign in with Google to verify your solution, save progress, and claim mission XP.',
        },
      }));
      return;
    }
    setError(null);
    setStatusNotice(null);
    setVerifyingMissionId(mission.id);
    setMissionFeedback((prev) => {
      const next = { ...prev };
      delete next[mission.id];
      return next;
    });
    try {
      const res = await apiFetch<{
        xpAwarded: number;
        alreadyCompleted?: boolean;
        explanation?: string | null;
      }>(`/api/learn-kali/missions/${mission.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          commandsRun: missionCmdHistory[mission.id] || [],
          selectedOption: missionAnswers[mission.id],
        }),
      });
      const successMessage =
        res.alreadyCompleted || res.xpAwarded === 0
          ? `Mission verified (XP was already awarded previously). ${res.explanation || ''}`
          : `Mission Accomplished! Awarded +${res.xpAwarded} XP! ${res.explanation || ''}`;
      setMissionFeedback((prev) => ({
        ...prev,
        [mission.id]: { ok: true, message: successMessage },
      }));
      setStatusNotice(successMessage);
      await loadLearnKali();
      await refreshProfile();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to complete mission yet.';
      setMissionFeedback((prev) => ({
        ...prev,
        [mission.id]: { ok: false, message: msg },
      }));
    } finally {
      setVerifyingMissionId(null);
    }
  };

  const completedMissionsCount = (data?.missionProgress || []).filter(
    (m) => m.status === 'completed',
  ).length;
  const avgMastery = useMemo(() => {
    const list = data?.toolProgress || [];
    if (list.length === 0) return 0;
    return Math.round(list.reduce((acc, item) => acc + item.masteryScore, 0) / list.length);
  }, [data?.toolProgress]);

  const runnerOnline = Boolean(data?.runnerStatus?.configured && data?.runnerStatus?.connected);

  if (loading && !data) {
    return (
      <LoadingState
        title="Initializing Learn KALI..."
        subtitle="Loading skill tree, 28 Kali tools, guided lessons, missions, and safe educational terminal..."
        timeoutMs={12000}
        onRetry={() => void loadLearnKali()}
      />
    );
  }

  if (error && !data) {
    return (
      <LoadErrorState
        title="Unable to initialize Learn KALI"
        message={error}
        onRetry={() => void loadLearnKali()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Adaptive Light/Dark Learn KALI Header */}
      <div className="rounded-2xl border border-emerald-500/25 bg-white dark:bg-gradient-to-br dark:from-slate-950 dark:via-[#0D1520] dark:to-[#081A1F] p-4 sm:p-6 text-slate-900 dark:text-slate-100 space-y-5 min-w-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-2xl min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-300">
                <Gamepad2 className="h-3.5 w-3.5 shrink-0" />
                Learn KALI · 100% Free Interactive Training
              </span>
              <span className="text-slate-400">·</span>
              <span className="font-mono text-cyan-600 dark:text-cyan-300">
                {runnerOnline && envMode === 'microvm'
                  ? 'Mode: Dedicated Kali MicroVM'
                  : 'Mode: Educational Browser Simulator'}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Learn KALI — Linux Foundations to Security Operator
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Learn Linux commands, install packages with <code className="font-mono">apt</code>, inspect tools flag by flag, and run safe simulations right inside your browser.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto kali-keep-cols">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 px-3.5 py-2.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Operator Rank</p>
              <p className="font-display text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                Lv.{data?.userLevelSummary.currentLevel.levelNumber ?? 1}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 px-3.5 py-2.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Tool Catalog</p>
              <p className="font-display text-base font-bold text-cyan-600 dark:text-cyan-300 tabular-nums">
                {data?.tools.length ?? 0} Tools
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 px-3.5 py-2.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Missions Cleared</p>
              <p className="font-display text-base font-bold text-violet-600 dark:text-violet-300 tabular-nums">
                {completedMissionsCount}/{data?.missions.length ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 px-3.5 py-2.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Avg Mastery</p>
              <p className="font-display text-base font-bold text-amber-600 dark:text-amber-300 tabular-nums">{avgMastery}%</p>
            </div>
          </div>
        </div>

        {/* Honest Execution Environment Status (Never show disconnected VM as an available option) */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-4 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Server className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="font-semibold text-slate-800 dark:text-slate-200">Execution Environment:</span>
            {runnerOnline ? (
              <>
                <button
                  type="button"
                  onClick={() => setEnvMode('simulator')}
                  className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                    envMode === 'simulator'
                      ? 'bg-emerald-500 text-slate-950 font-semibold'
                      : 'border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Browser Educational Simulator
                </button>
                <button
                  type="button"
                  onClick={() => setEnvMode('microvm')}
                  className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                    envMode === 'microvm'
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Real Kali MicroVM Runner
                </button>
              </>
            ) : (
              <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 font-semibold text-emerald-600 dark:text-emerald-300">
                Browser Educational Simulator Active
              </span>
            )}
          </div>
          <span className="text-slate-500 dark:text-slate-400">
            {runnerOnline
              ? 'MicroVM lab runner connected and ready.'
              : 'Safe in-browser Linux & Kali sandbox active by default (dedicated Kali Linux VM not provisioned).'}
          </span>
        </div>

        {/* XP Level Progress Bar */}
        <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-800/80 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-emerald-600 dark:text-emerald-300">
              {data?.userLevelSummary.currentLevel.title || 'Level 1 — Linux Rookie'}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {user ? `${user.xp} XP` : 'Sign in with Google to track XP & unlock badges'}
              {data?.userLevelSummary.nextLevel
                ? ` · Next: ${data.userLevelSummary.nextLevel.title} (${data.userLevelSummary.nextLevel.xpRequired} XP)`
                : ' · Max Tier Unlocked'}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all"
              style={{ width: `${data?.userLevelSummary.progressPercent ?? 10}%` }}
            />
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-1.5 min-w-0">
        {[
          { id: 'skill_tree', label: 'Skill Tree & Levels (1–8)', icon: Compass },
          { id: 'catalog', label: `Tool Library (${data?.tools.length ?? 0})`, icon: Wrench },
          { id: 'tool_detail', label: 'Tool Learning Page', icon: BookOpen },
          { id: 'missions', label: `Missions & Boss Ops (${data?.missions.length ?? 0})`, icon: Swords },
          { id: 'terminal', label: 'Practice Terminal', icon: Terminal },
          { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as KaliTab)}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors min-h-[36px] ${
                active
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {statusNotice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs sm:text-sm text-emerald-600 dark:text-emerald-300">
          {statusNotice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs sm:text-sm text-rose-500">
          {error}
        </div>
      )}

      {/* TAB 1: SKILL TREE & LEVELS 1-8 */}
      {tab === 'skill_tree' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {(data?.levels || []).map((lvl) => {
              const userLevel = data?.userLevelSummary.currentLevel.levelNumber ?? 1;
              const unlocked = lvl.levelNumber <= userLevel || !user;
              const levelTools = (data?.tools || []).filter(
                (t) => t.minLevelNumber === lvl.levelNumber,
              );
              return (
                <div
                  key={lvl.id}
                  className={`rounded-xl border p-5 space-y-3 transition-colors ${
                    lvl.levelNumber === userLevel
                      ? 'border-emerald-500/60 bg-emerald-500/5 dark:bg-emerald-500/5'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400">
                        {lvl.xpRequired === 0 ? 'Starter Tier' : `Unlocks at ${lvl.xpRequired} XP`} ·
                        Badge: {lvl.badgeTitle}
                      </span>
                      <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                        {lvl.title}
                      </h2>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {lvl.subtitle}
                      </p>
                    </div>
                    {unlocked ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    ) : (
                      <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                  </div>

                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {lvl.description}
                  </p>

                  <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                    {lvl.topicsJson.map((topic) => (
                      <li key={topic}>{topic}</li>
                    ))}
                  </ul>

                  {levelTools.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 border-t border-slate-200 dark:border-slate-800 pt-3">
                      {levelTools.map((tool) => (
                        <button
                          key={tool.slug}
                          type="button"
                          onClick={() => openToolPage(tool.slug)}
                          className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-emerald-500"
                        >
                          {tool.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: COMPLETE OFFICIAL KALI TOOL LIBRARY */}
      {tab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Kali tools (Nmap, Gobuster, Wireshark, Ghidra...)"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Showing {filteredTools.length} of {data?.tools.length ?? 0} verified tools
            </span>
          </div>

          {/* Official Category Filter Strip */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] text-slate-600 dark:text-slate-300'
              }`}
            >
              All Categories ({data?.categories.length ?? 0})
            </button>
            {(data?.categories || []).map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => setSelectedCategory(cat.slug)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedCategory === cat.slug
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] text-slate-600 dark:text-slate-300'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTools.map((tool) => {
              const prog = toolProgressMap.get(tool.id);
              const mastery = prog?.masteryScore ?? 0;
              return (
                <div
                  key={tool.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Lv.{tool.minLevelNumber}+ · {tool.difficulty}</span>
                      <span className="font-mono text-emerald-500">+{tool.xpReward} XP</span>
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                      {tool.name}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {tool.summary}
                    </p>
                  </div>

                  <div className="space-y-2.5 border-t border-slate-200 dark:border-slate-800 pt-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Mastery: {mastery}%</span>
                      <span>
                        {tool.interactiveSupported ? 'Interactive Sim Ready' : 'Docs & Guide'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openToolPage(tool.slug)}
                      className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
                    >
                      Open Tool Guide &amp; Exercises
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: INDIVIDUAL DEDICATED TOOL LEARNING PAGE */}
      {tab === 'tool_detail' && selectedTool && (
        <div className="space-y-6 min-w-0">
          {/* Quick Tool Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 min-w-0">
            <div className="min-w-0">
              <p className="text-xs text-cyan-600 dark:text-cyan-400 break-words">
                {selectedTool.categorySlug} · Level {selectedTool.minLevelNumber}+ ·{' '}
                {selectedTool.difficulty} · Mastery:{' '}
                {toolProgressMap.get(selectedTool.id)?.masteryScore ?? 0}%
              </p>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
                {selectedTool.name}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto min-w-0">
              <button
                type="button"
                onClick={() =>
                  void toggleBookmark({
                    type: 'tool',
                    slug: selectedTool.slug,
                    title: selectedTool.name,
                  })
                }
                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors min-h-[34px] ${
                  hasBookmark('tool', selectedTool.slug)
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Bookmark className="h-3.5 w-3.5 shrink-0" />
                {hasBookmark('tool', selectedTool.slug) ? 'Saved Tool' : 'Bookmark'}
              </button>
              <select
                value={selectedTool.slug}
                onChange={(e) => openToolPage(e.target.value)}
                aria-label="Select Kali tool to study"
                className="w-full sm:w-auto max-w-full min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 min-h-[34px]"
              >
                {(data?.tools || []).map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
              <a
                href={selectedTool.officialDocsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 px-3 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 min-h-[34px]"
              >
                Official Docs <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              {selectedTool.githubUrl && (
                <a
                  href={selectedTool.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[34px]"
                >
                  GitHub Repo <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              )}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-12 min-w-0">
            {/* Left Overview + Commands + Common Errors */}
            <div className="lg:col-span-7 space-y-5 min-w-0">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 sm:p-5 space-y-3 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Purpose, Installation &amp; Prerequisites
                </h3>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {selectedTool.purpose}
                </p>
                <div className="w-full min-w-0 rounded-lg bg-slate-950 px-3 py-2.5">
                  <pre className="w-full max-w-full overflow-x-auto whitespace-pre font-mono text-xs text-emerald-400">
                    {selectedTool.installCommand}
                  </pre>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>OS: {selectedTool.supportedOs}</span>
                  <span>Version: {selectedTool.versionNote}</span>
                  <span>Status: {selectedTool.status}</span>
                </div>
                {selectedTool.prerequisitesJson.length > 0 && (
                  <div className="pt-1 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Prerequisites:{' '}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {selectedTool.prerequisitesJson.join(' · ')}
                    </span>
                  </div>
                )}
              </div>

              {/* Command Tier Breakdown */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 sm:p-5 space-y-4 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Flag-by-Flag Command Mastery
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(['basic', 'intermediate', 'advanced'] as const).map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setCommandTier(tier)}
                        className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium capitalize ${
                          commandTier === tier
                            ? 'bg-emerald-500 text-slate-950 font-semibold'
                            : 'border border-slate-200 dark:border-slate-700 text-slate-500'
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                {(() => {
                  const list =
                    commandTier === 'basic'
                      ? selectedTool.basicCommandsJson
                      : commandTier === 'intermediate'
                        ? selectedTool.intermediateCommandsJson
                        : selectedTool.advancedCommandsJson;
                  if (!list || list.length === 0) {
                    return (
                      <p className="text-xs text-slate-500">
                        Switch to Basic commands or check the official manual above for deeper {commandTier} switches.
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-4 min-w-0">
                      {list.map((ex, i) => {
                        const cmdKey = `${selectedTool.slug}-${commandTier}-${i}`;
                        const showExplain = expandedExplains[cmdKey] ?? true;
                        const showOut = Boolean(expandedOutputs[cmdKey]);
                        const showHint = Boolean(expandedHints[cmdKey]);
                        return (
                          <div
                            key={i}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3.5 sm:p-4 space-y-3 min-w-0 max-w-full"
                          >
                            {/* Horizontally scrollable command block isolated from button grid */}
                            <div className="w-full min-w-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 px-3 py-2.5">
                              <pre className="w-full max-w-full overflow-x-auto whitespace-pre font-mono text-xs text-emerald-400 font-semibold leading-relaxed">
                                $ {ex.command}
                              </pre>
                            </div>

                            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 break-words">
                              {ex.explanation}
                            </p>

                            {/* Responsive 2-column button grid on mobile, clean inline wrap on sm+ */}
                            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2 w-full min-w-0 kali-keep-cols pt-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setExternalRun({ nonce: Date.now() + i, command: ex.command });
                                  requestAnimationFrame(() => {
                                    terminalSectionRef.current?.scrollIntoView({
                                      behavior: 'smooth',
                                      block: 'center',
                                    });
                                  });
                                }}
                                className={`${ex.sampleOutput ? 'col-span-2 sm:col-span-1 ' : ''}inline-flex w-full sm:w-auto min-w-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors min-h-[38px] text-center leading-tight`}
                              >
                                <Play className="h-3.5 w-3.5 shrink-0" />
                                <span>Run in Terminal</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                    void navigator.clipboard.writeText(ex.command);
                                  }
                                  setCopiedCmdKey(cmdKey);
                                  setTimeout(() => setCopiedCmdKey((c) => (c === cmdKey ? null : c)), 1400);
                                }}
                                className="inline-flex w-full sm:w-auto min-w-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11161F] px-2.5 py-2 text-[11px] font-medium hover:border-emerald-500 transition-colors min-h-[38px] text-center leading-tight"
                              >
                                {copiedCmdKey === cmdKey ? (
                                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5 shrink-0" />
                                )}
                                <span>{copiedCmdKey === cmdKey ? 'Copied' : 'Copy'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedExplains((p) => ({ ...p, [cmdKey]: !showExplain }))
                                }
                                className="inline-flex w-full sm:w-auto min-w-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11161F] px-2.5 py-2 text-[11px] font-medium hover:border-cyan-500 transition-colors min-h-[38px] text-center leading-tight"
                              >
                                <Info className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
                                <span>Explain</span>
                              </button>
                              {ex.sampleOutput && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedOutputs((p) => ({ ...p, [cmdKey]: !showOut }))
                                  }
                                  className="inline-flex w-full sm:w-auto min-w-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11161F] px-2.5 py-2 text-[11px] font-medium hover:border-violet-500 transition-colors min-h-[38px] text-center leading-tight"
                                >
                                  <Eye className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                                  <span>{showOut ? 'Hide Output' : 'Expected Output'}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedHints((p) => ({ ...p, [cmdKey]: !showHint }))
                                }
                                className="inline-flex w-full sm:w-auto min-w-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11161F] px-2.5 py-2 text-[11px] font-medium hover:border-amber-500 transition-colors min-h-[38px] text-center leading-tight"
                              >
                                <HelpCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                <span>Hint</span>
                              </button>
                            </div>

                            {showExplain && (
                              <div className="flex flex-wrap gap-2 pt-0.5 min-w-0">
                                {ex.flagBreakdown.map((fb, idx) => (
                                  <span
                                    key={idx}
                                    className="max-w-full rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] px-2.5 py-1 text-[11px] leading-snug break-words"
                                  >
                                    <strong className="font-mono text-cyan-600 dark:text-cyan-400">{fb.flag}</strong>:{' '}
                                    {fb.meaning}
                                  </span>
                                ))}
                              </div>
                            )}

                            {showOut && ex.sampleOutput && (
                              <pre className="w-full max-w-full overflow-x-auto whitespace-pre rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-900 p-3 font-mono text-[11px] text-slate-200 leading-relaxed">
                                {ex.sampleOutput}
                              </pre>
                            )}

                            {showHint && (
                              <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed break-words">
                                <strong>Beginner Hint:</strong> Make sure prerequisites are installed first (e.g. <code className="font-mono break-all">{selectedTool.installCommand}</code>). Click <strong>Run in Terminal</strong> above to test it immediately in the simulator!
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Common Errors & Related Tools */}
              {selectedTool.commonErrorsJson.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 sm:p-5 space-y-3 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Common Errors &amp; Troubleshooting
                  </h3>
                  {selectedTool.commonErrorsJson.map((errItem, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs space-y-1 break-words"
                    >
                      <p className="font-semibold text-amber-600 dark:text-amber-300">
                        {errItem.error}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400">
                        <strong>Cause:</strong> {errItem.cause}
                      </p>
                      <p className="text-emerald-600 dark:text-emerald-300">
                        <strong>Fix:</strong> {errItem.fix}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {selectedTool.relatedToolSlugsJson.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs min-w-0">
                  <span className="font-semibold text-slate-500">Related Tools:</span>
                  {selectedTool.relatedToolSlugsJson.map((rSlug) => (
                    <button
                      key={rSlug}
                      type="button"
                      onClick={() => openToolPage(rSlug)}
                      className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 font-mono text-[11px] hover:border-emerald-500"
                    >
                      {rSlug}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Guided Quiz + Interactive Simulated Practice */}
            <div className="lg:col-span-5 space-y-5 min-w-0">
              {selectedToolLessons.map((lesson) => {
                const done = toolProgressMap
                  .get(selectedTool.id)
                  ?.lessonsCompletedJson.includes(lesson.id);
                return (
                  <div
                    key={lesson.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 sm:p-5 space-y-3 min-w-0"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                        Interactive Lesson (+{lesson.xpReward} XP)
                      </span>
                      {done && (
                        <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Mastered
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                      {lesson.title}
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {lesson.contentMarkdown}
                    </p>
                    {lesson.expectedGoal && (
                      <p className="rounded bg-slate-50 dark:bg-[#0A0D12] p-2.5 text-[11px] text-slate-600 dark:text-slate-300">
                        <strong>Practice Goal:</strong> {lesson.expectedGoal}
                      </p>
                    )}

                    <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {lesson.quizQuestion}
                      </p>
                      {lesson.quizOptionsJson.map((opt, idx) => (
                        <label
                          key={opt}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                            lessonAnswers[lesson.id] === idx
                              ? 'border-emerald-500 bg-emerald-500/10'
                              : 'border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`lesson-${lesson.id}`}
                            checked={lessonAnswers[lesson.id] === idx}
                            onChange={() =>
                              setLessonAnswers((p) => ({ ...p, [lesson.id]: idx }))
                            }
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                      <button
                        type="button"
                        onClick={() => void handleLessonQuizSubmit(selectedTool.id, lesson.id)}
                        className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                      >
                        Verify Answer &amp; Claim Mastery XP
                      </button>
                    </div>
                  </div>
                );
              })}

              <div ref={terminalSectionRef}>
                <LearnKaliTerminal
                  compact
                  title={`${selectedTool.name} — Safe Practice Terminal`}
                  externalRunTrigger={externalRun}
                  runnerStatus={data?.runnerStatus || null}
                  suggestedCommands={Array.from(
                    new Set([
                      ...selectedTool.basicCommandsJson.map((c) => c.command).slice(0, 3),
                      ...(selectedTool.slug === 'whois' ? ['whois kali.org'] : []),
                    ]),
                  )}
                  onCommandExecuted={(cmd, res) => {
                    if (res.exitCode === 0) {
                      void handleTerminalToolCheck(selectedTool.id, cmd);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MISSIONS, DAILY CHALLENGES, BOSS & CAPSTONE OPS */}
      {tab === 'missions' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'All Ops' },
              { id: 'daily', label: 'Daily Challenge' },
              { id: 'quest', label: 'Quests' },
              { id: 'mission', label: 'Missions' },
              { id: 'boss', label: 'Boss Missions' },
              { id: 'hidden', label: 'Hidden Challenges' },
              { id: 'capstone', label: 'Final Capstones' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setMissionFilter(f.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  missionFilter === f.id
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] text-slate-600 dark:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {filteredMissions.map((mission) => {
              const mProg = missionProgressMap.get(mission.id);
              const isDone = mProg?.status === 'completed';
              const runList = missionCmdHistory[mission.id] || [];
              const liveValidation = mission.terminalChallengeJson?.steps
                ? validateMissionCommandSequence(
                    runList,
                    mission.terminalChallengeJson.steps,
                    mProg?.stepsPassedJson ?? [],
                  )
                : { passedStepIds: [], missingSteps: [], lastError: null };
              const passedStepsSet = new Set(liveValidation.passedStepIds);
              const cardFeedback = missionFeedback[mission.id];
              const isVerifying = verifyingMissionId === mission.id;

              return (
                <div
                  key={mission.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 sm:p-5 space-y-4 min-w-0"
                >
                  <div className="space-y-2.5 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-semibold uppercase text-violet-500">
                        <Flame className="h-3 w-3" />
                        {mission.missionType}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-emerald-500">+{mission.xpReward} XP</span>
                        {isDone && (
                          <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Cleared
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                      {mission.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {mission.scenarioBrief}
                    </p>

                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-slate-500">Objectives</p>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                        {mission.objectivesJson.map((o) => (
                          <li key={o}>{o}</li>
                        ))}
                      </ul>
                    </div>

                    {mission.terminalChallengeJson && (
                      <div className="space-y-2 pt-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <p className="font-semibold text-cyan-600 dark:text-cyan-400">
                            Required Simulated Terminal Steps ({passedStepsSet.size}/
                            {mission.terminalChallengeJson.steps.length} Verified)
                          </p>
                        </div>
                        {mission.terminalChallengeJson.steps.map((s) => {
                          const stepPassed = passedStepsSet.has(s.id);
                          return (
                            <div
                              key={s.id}
                              className={`rounded border p-2.5 text-[11px] space-y-1 ${
                                stepPassed
                                  ? 'border-emerald-500/40 bg-emerald-500/5'
                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 min-w-0">
                                <p className="font-medium text-slate-800 dark:text-slate-200 min-w-0">
                                  {s.instruction}
                                </p>
                                {stepPassed && (
                                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-500 shrink-0">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                                  </span>
                                )}
                              </div>
                              <p className="font-mono text-slate-500 [overflow-wrap:anywhere]">Hint: {s.hint}</p>
                            </div>
                          );
                        })}
                        <LearnKaliTerminal
                          compact
                          title={`Mission Terminal — ${mission.title}`}
                          runnerStatus={data?.runnerStatus || null}
                          suggestedCommands={mission.terminalChallengeJson.steps.map((st) =>
                            st.hint.replace(/^(?:Run|Try):\s*/i, ''),
                          )}
                          onCommandExecuted={(cmd) => {
                            setMissionCmdHistory((prev) => ({
                              ...prev,
                              [mission.id]: [...(prev[mission.id] || []), cmd],
                            }));
                            setMissionFeedback((prev) => {
                              if (!prev[mission.id] || prev[mission.id].ok) return prev;
                              const next = { ...prev };
                              delete next[mission.id];
                              return next;
                            });
                          }}
                        />
                        {runList.length > 0 && (
                          <p className="text-[11px] text-emerald-500">
                            Recorded {runList.length} terminal command(s) —{' '}
                            {passedStepsSet.size}/{mission.terminalChallengeJson.steps.length} required step(s) matched.
                          </p>
                        )}
                      </div>
                    )}

                    {mission.assessmentJson && (
                      <div className="space-y-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {mission.assessmentJson.question}
                        </p>
                        {mission.assessmentJson.options.map((opt, idx) => (
                          <label
                            key={opt}
                            className={`flex cursor-pointer items-center gap-2.5 rounded border px-3 py-2 text-xs min-h-[40px] ${
                              missionAnswers[mission.id] === idx
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : 'border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`mission-${mission.id}`}
                              checked={missionAnswers[mission.id] === idx}
                              onChange={() => {
                                setMissionAnswers((p) => ({ ...p, [mission.id]: idx }));
                                setMissionFeedback((prev) => {
                                  if (!prev[mission.id] || prev[mission.id].ok) return prev;
                                  const next = { ...prev };
                                  delete next[mission.id];
                                  return next;
                                });
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {cardFeedback && (
                      <div
                        role={cardFeedback.ok ? 'status' : 'alert'}
                        className={`rounded-lg border px-3 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 ${
                          cardFeedback.ok
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                            : 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300'
                        }`}
                      >
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          {cardFeedback.ok ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          )}
                          <span>{cardFeedback.message}</span>
                        </div>
                        {cardFeedback.needsSignIn && (
                          <button
                            type="button"
                            onClick={() => void loginWithGoogle()}
                            className="rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 shrink-0"
                          >
                            Sign In with Google
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={() => void handleCompleteMission(mission)}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 transition-colors min-h-[42px]"
                    >
                      {isVerifying ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Verifying Mission...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {isDone
                            ? 'Re-Verify Mission Solution'
                            : `Verify & Complete Mission (+${mission.xpReward} XP)`}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: STANDALONE INTERACTIVE EDUCATIONAL TERMINAL */}
      {tab === 'terminal' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong>Educational Sandbox Notice:</strong> Practice Linux commands and safe synthetic
              Kali scenarios in-browser. External internet targets are blocked automatically.
            </span>
            <Sparkles className="h-4 w-4 text-cyan-500 shrink-0" />
          </div>
          <LearnKaliTerminal
            runnerStatus={data?.runnerStatus || null}
            externalRunTrigger={externalRun}
          />
        </div>
      )}

      {/* TAB 6: LEARN KALI LEADERBOARD */}
      {tab === 'leaderboard' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Top Learn KALI Operators
            </h2>
            <Award className="h-5 w-5 text-amber-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Rank</th>
                  <th className="py-2 pr-3 font-medium">Operator</th>
                  <th className="py-2 pr-3 font-medium">Tools Mastered</th>
                  <th className="py-2 pr-3 font-medium">Avg Mastery</th>
                  <th className="py-2 pr-3 font-medium">Streak</th>
                  <th className="py-2 text-right font-medium">Total XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(data?.leaderboard || []).map((row, idx) => (
                  <tr key={row.userId}>
                    <td className="py-2.5 pr-3 font-mono font-bold text-emerald-500">
                      #{idx + 1}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {row.displayName || row.username}
                      </span>
                      <span className="block text-[11px] text-slate-500">@{row.username}</span>
                    </td>
                    <td className="py-2.5 pr-3">{row.toolsMastered}</td>
                    <td className="py-2.5 pr-3">{row.avgMastery}%</td>
                    <td className="py-2.5 pr-3">{row.dailyStreak}d</td>
                    <td className="py-2.5 text-right font-mono font-semibold text-cyan-500">
                      {row.xp} XP
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
