import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, Clock, RotateCcw, Send, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { estimateTokens } from '../lib/ai/mentor-limits';
import { SafeRichText } from './SafeRichText';

type MentorModeUi =
  | 'concept'
  | 'teach_me'
  | 'practice_questions'
  | 'error_help'
  | 'linux_cli'
  | 'code_review'
  | 'roadmap'
  | 'ctf_hint'
  | 'research_assistant'
  | 'career_guidance';

interface MentorTurn {
  role: 'user' | 'mentor';
  text: string;
}

interface MentorStatus {
  enabled: boolean;
  budgetHalted: boolean;
  budgetMessage: string | null;
  limits: {
    dailyUserLimit: number;
    monthlyUserLimit: number;
    maxPromptTokens: number;
    maxResponseTokens: number;
    cooldownSeconds: number;
  };
  usage: {
    dailyUsed: number;
    dailyRemaining: number;
    monthlyUsed: number;
    monthlyRemaining: number;
    cooldownRemainingSeconds: number;
    activeRequest: boolean;
  } | null;
  resets: {
    dayKey: string;
    monthKey: string;
    dailyResetsAt: string;
    monthlyResetsAt: string;
  };
}

function formatResetTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })} (${d.toISOString().slice(11, 16)} UTC)`;
  } catch {
    return iso;
  }
}

export const AiCyberMentor: React.FC = () => {
  const { user, loginWithGoogle, apiFetch } = useAuth();
  const [mode, setMode] = useState<MentorModeUi>('concept');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [prompt, setPrompt] = useState('');
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState<string | null>(null);
  const [turns, setTurns] = useState<MentorTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<MentorStatus | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState<number>(0);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiFetch<MentorStatus>('/api/ai/mentor/status');
      setStatus(res);
      if (res.usage?.cooldownRemainingSeconds) {
        setCooldownLeft(res.usage.cooldownRemainingSeconds);
      }
    } catch {
      // Non-fatal; backend still enforces all limits authoritatively
    }
  }, [apiFetch]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus, user?.id]);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownLeft]);

  const estimatedPromptTokens = useMemo(() => estimateTokens(prompt), [prompt]);
  const maxPromptTokens = status?.limits.maxPromptTokens ?? 4000;
  const maxResponseTokens = status?.limits.maxResponseTokens ?? 1500;
  const promptTooLong = estimatedPromptTokens > maxPromptTokens;

  const dailyLimitReached = Boolean(status?.usage && status.usage.dailyRemaining <= 0);
  const monthlyLimitReached = Boolean(status?.usage && status.usage.monthlyRemaining <= 0);
  const isServiceUnavailable = Boolean(
    status && (!status.enabled || status.budgetHalted),
  );
  const isBlocked =
    loading ||
    cooldownLeft > 0 ||
    dailyLimitReached ||
    monthlyLimitReached ||
    isServiceUnavailable ||
    promptTooLong;

  const submitQuestion = async (questionText: string, appendUserTurn: boolean) => {
    if (!user) return loginWithGoogle();
    const cleaned = questionText.trim();
    if (!cleaned || loading) return;

    if (appendUserTurn) {
      setTurns((prev) => [...prev, { role: 'user', text: cleaned }]);
      setPrompt('');
    }
    setLastSubmittedPrompt(cleaned);
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch<{
        reply: string;
        remainingDailyQuota: number;
        remainingMonthlyQuota: number;
        status?: MentorStatus;
      }>('/api/ai/mentor', {
        method: 'POST',
        body: JSON.stringify({ prompt: cleaned, mode, language, level }),
      });
      setTurns((prev) => [...prev, { role: 'mentor', text: res.reply }]);
      if (res.status) {
        setStatus(res.status);
        setCooldownLeft(res.status.limits.cooldownSeconds);
      } else {
        await loadStatus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach AI Cyber Mentor.');
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitQuestion(prompt, true);
  };

  const dailyRemaining = status?.usage
    ? status.usage.dailyRemaining
    : status?.limits.dailyUserLimit ?? 20;
  const dailyLimit = status?.limits.dailyUserLimit ?? 20;
  const monthlyRemaining = status?.usage
    ? status.usage.monthlyRemaining
    : status?.limits.monthlyUserLimit ?? 300;
  const monthlyLimit = status?.limits.monthlyUserLimit ?? 300;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            AI Cyber Mentor
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Server-side educational cybersecurity mentor in English and Hindi across 10 specialized mentorship modes.
          </p>
        </div>

        {/* Live User Quotas & Reset Dates */}
        <div
          data-testid="mentor-quota-summary"
          className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] px-4 py-2.5 text-xs w-full lg:w-auto sm:inline-flex sm:items-center sm:gap-5 kali-keep-cols"
        >
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Daily Remaining</p>
            <p
              className={`font-mono font-semibold tabular-nums ${
                dailyRemaining === 0 ? 'text-rose-500' : 'text-emerald-500'
              }`}
            >
              {dailyRemaining} / {dailyLimit}
            </p>
            {status?.resets.dailyResetsAt && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Resets {formatResetTime(status.resets.dailyResetsAt)}
              </p>
            )}
          </div>
          <div className="sm:border-l sm:border-slate-200 dark:sm:border-slate-800 sm:pl-5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Monthly Remaining</p>
            <p
              className={`font-mono font-semibold tabular-nums ${
                monthlyRemaining === 0 ? 'text-rose-500' : 'text-cyan-500'
              }`}
            >
              {monthlyRemaining} / {monthlyLimit}
            </p>
            {status?.resets.monthlyResetsAt && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Resets {formatResetTime(status.resets.monthlyResetsAt)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Clear Service Status / Budget / Limit Banners */}
      {status && !status.enabled && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            AI Cyber Mentor is currently disabled by platform administration. Please check back later.
          </p>
        </div>
      )}

      {status && status.enabled && status.budgetHalted && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Global Monthly AI Budget Reached</p>
            <p>
              {status.budgetMessage ||
                `AI Cyber Mentor has reached its global monthly spending limit and is paused until ${formatResetTime(
                  status.resets.monthlyResetsAt,
                )} or Platform Owner review.`}
            </p>
          </div>
        </div>
      )}

      {status && status.enabled && !status.budgetHalted && (dailyLimitReached || monthlyLimitReached) && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300">
          <Clock className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              {monthlyLimitReached ? 'Monthly Prompt Limit Reached' : 'Daily Prompt Limit Reached'}
            </p>
            <p>
              {monthlyLimitReached
                ? `You have used all ${monthlyLimit} monthly AI Cyber Mentor messages. Your monthly quota resets on ${formatResetTime(
                    status.resets.monthlyResetsAt,
                  )}.`
                : `You have used all ${dailyLimit} daily AI Cyber Mentor messages. Your daily quota resets on ${formatResetTime(
                    status.resets.dailyResetsAt,
                  )}.`}
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="grid gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 sm:grid-cols-3">
        <div>
          <label htmlFor="mentor-mode" className="block text-xs font-medium text-slate-500 mb-1">
            Mentorship Mode
          </label>
          <select
            id="mentor-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as MentorModeUi)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
          >
            <option value="concept">Explain Concept</option>
            <option value="teach_me">Teach Step by Step (Guided Lesson)</option>
            <option value="ctf_hint">Give Hints (Progressive CTF Coach)</option>
            <option value="practice_questions">Quiz Me (Practice Questions & Answers)</option>
            <option value="code_review">Review My Code (Secure Engineering)</option>
            <option value="error_help">Explain My Error</option>
            <option value="linux_cli">Linux & CLI Reference</option>
            <option value="roadmap">Personalized Learning Roadmap</option>
            <option value="research_assistant">Research Assistant (Papers & Advisories)</option>
            <option value="career_guidance">Career Guidance (Specializations & Portfolios)</option>
          </select>
        </div>

        <div>
          <label htmlFor="mentor-level" className="block text-xs font-medium text-slate-500 mb-1">
            Depth Level
          </label>
          <select
            id="mentor-level"
            value={level}
            onChange={(e) => setLevel(e.target.value as typeof level)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced / Research</option>
          </select>
        </div>

        <div>
          <label htmlFor="mentor-lang" className="block text-xs font-medium text-slate-500 mb-1">
            Response Language
          </label>
          <select
            id="mentor-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'en' | 'hi')}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी (Hindi)</option>
          </select>
        </div>
      </div>

      {/* Safety boundary notice */}
      <div className="flex items-start gap-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 text-xs text-slate-600 dark:text-slate-300">
        <ShieldCheck className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
        <p>
          Educational Safety Policy: AI Cyber Mentor strictly distinguishes between authorized training
          environments and real-world systems. Requests to attack real targets or generate malicious
          payloads are declined.
        </p>
      </div>

      {/* Chat Viewport */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
        <div className="min-h-[260px] max-h-[420px] overflow-y-auto space-y-4">
          {turns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
              <Bot className="h-8 w-8 text-violet-500" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Ask about Linux permissions, Wireshark filters, secure code review, vulnerability research, or career preparation.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {[
                  { text: 'Explain why parameterized SQL prevents SQL injection', m: 'concept' as MentorModeUi },
                  { text: 'Teach me how TLS 1.3 handshakes authenticate servers', m: 'teach_me' as MentorModeUi },
                  { text: 'Summarize defensive takeaways from memory corruption CVEs and ASLR', m: 'research_assistant' as MentorModeUi },
                  { text: 'Map a 6-month portfolio plan for a SOC Analyst vs AppSec role', m: 'career_guidance' as MentorModeUi },
                ].map((sample) => (
                  <button
                    key={sample.text}
                    type="button"
                    onClick={() => {
                      setMode(sample.m);
                      setPrompt(sample.text);
                    }}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:border-violet-500/50"
                  >
                    {sample.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((t, i) => (
              <div
                key={i}
                className={`rounded-xl p-4 text-sm leading-relaxed ${
                  t.role === 'user'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 ml-4 sm:ml-8'
                    : 'bg-slate-50 dark:bg-[#0A0D12] border border-slate-200 dark:border-slate-800 mr-4 sm:mr-8'
                }`}
              >
                <p className="text-xs font-semibold mb-1.5 text-slate-500">
                  {t.role === 'user' ? 'You' : 'KALI3977 AI Cyber Mentor'}
                </p>
                {t.role === 'mentor' ? (
                  <SafeRichText content={t.text} />
                ) : (
                  <p className="whitespace-pre-wrap">{t.text}</p>
                )}
              </div>
            ))
          )}
        </div>

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
            <span>{error}</span>
            {lastSubmittedPrompt && !dailyLimitReached && !monthlyLimitReached && !isServiceUnavailable && (
              <button
                type="button"
                disabled={loading || cooldownLeft > 0}
                onClick={() => submitQuestion(lastSubmittedPrompt, false)}
                className="inline-flex items-center gap-1 rounded border border-rose-500/40 px-2.5 py-1 font-medium hover:bg-rose-500/10 disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" />
                {cooldownLeft > 0 ? `Retry (${cooldownLeft}s)` : 'Retry'}
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleAsk} className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isServiceUnavailable}
              placeholder={
                !user
                  ? 'Sign in with Google to use AI Cyber Mentor'
                  : isServiceUnavailable
                    ? 'AI Cyber Mentor is currently paused'
                    : 'Ask your cybersecurity question...'
              }
              aria-label="Question for AI Cyber Mentor"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-4 py-2.5 text-sm focus:border-violet-500 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={user ? isBlocked || !prompt.trim() : false}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="h-4 w-4" />
              {!user
                ? 'Sign In'
                : loading
                  ? 'Thinking...'
                  : cooldownLeft > 0
                    ? `Wait ${cooldownLeft}s`
                    : 'Ask Mentor'}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className={promptTooLong ? 'text-rose-500 font-medium' : ''}>
              Prompt: ~{estimatedPromptTokens.toLocaleString()} / {maxPromptTokens.toLocaleString()} tokens
              {' · '}Max response: {maxResponseTokens.toLocaleString()} tokens
              {' · '}Cooldown: {status?.limits.cooldownSeconds ?? 3}s (1 active request)
            </span>
            {status?.resets.dailyResetsAt && (
              <span className="font-mono">
                Daily reset: {formatResetTime(status.resets.dailyResetsAt)}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
