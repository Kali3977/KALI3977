import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  Flag,
  HelpCircle,
  Lock,
  Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SafeRichText } from './SafeRichText';

interface Challenge {
  id: number;
  slug: string;
  title: string;
  category: string;
  difficulty: string;
  description: string;
  basePoints: number;
  currentPoints: number;
  scoringMode: string;
  hints: string[];
  learningObjectives?: string[];
  relatedCourseSlug?: string | null;
  relatedBookTitle?: string | null;
  referenceUrl?: string | null;
  flagFormat?: string;
  attachmentName?: string | null;
  solveCount: number;
  solved: boolean;
  bookmarked?: boolean;
  unlocked: boolean;
  explanationAfterSolve: string | null;
  licenseType?: string;
  contentVersion?: string;
  provenanceAuthor?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface SubmissionItem {
  id: number;
  challengeId: number;
  submittedFlagMasked: string;
  isCorrect: boolean;
  pointsAwarded: number;
  createdAt: string;
}

interface ExternalPlatform {
  name: string;
  category: string;
  description: string;
  url: string;
}

const CTF_DIFFICULTIES = ['All', 'Beginner', 'Easy', 'Medium', 'Hard', 'Expert', 'Research Level'];

export const CtfArena: React.FC = () => {
  const { user, loginWithGoogle, apiFetch, refreshProfile } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [externalPlatforms, setExternalPlatforms] = useState<ExternalPlatform[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unsolved' | 'solved' | 'bookmarked'>('all');
  const [sortBy, setSortBy] = useState<'points_asc' | 'points_desc' | 'solves_desc' | 'title'>('points_asc');

  const [flagInputs, setFlagInputs] = useState<Record<number, string>>({});
  const [openHints, setOpenHints] = useState<Record<number, boolean>>({});
  const [openDetails, setOpenDetails] = useState<Record<number, boolean>>({});
  const [reportingId, setReportingId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [feedback, setFeedback] = useState<Record<number, { ok: boolean; msg: string }>>({});
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  const loadCtf = async () => {
    const res = await apiFetch<{
      challenges: Challenge[];
      submissions: SubmissionItem[];
      externalPlatforms?: ExternalPlatform[];
    }>('/api/ctf');
    setChallenges(res.challenges);
    setSubmissions(res.submissions);
    setExternalPlatforms(res.externalPlatforms || []);
  };

  useEffect(() => {
    loadCtf();
  }, [user?.id]);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(challenges.map((c) => c.category)))],
    [challenges],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = challenges.filter((c) => {
      if (category !== 'All' && c.category !== category) return false;
      if (difficulty !== 'All' && c.difficulty !== difficulty) return false;
      if (statusFilter === 'solved' && !c.solved) return false;
      if (statusFilter === 'unsolved' && c.solved) return false;
      if (statusFilter === 'bookmarked' && !c.bookmarked) return false;
      if (
        q &&
        !c.title.toLowerCase().includes(q) &&
        !c.category.toLowerCase().includes(q) &&
        !c.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'points_desc') return b.currentPoints - a.currentPoints;
      if (sortBy === 'points_asc') return a.currentPoints - b.currentPoints;
      if (sortBy === 'solves_desc') return b.solveCount - a.solveCount;
      return a.title.localeCompare(b.title);
    });
  }, [challenges, category, difficulty, statusFilter, searchQuery, sortBy]);

  const handleSubmitFlag = async (e: React.FormEvent, chId: number) => {
    e.preventDefault();
    if (!user) {
      await loginWithGoogle();
      return;
    }
    setSubmittingId(chId);
    try {
      const res = await apiFetch<{ correct: boolean; pointsAwarded: number; explanation: string }>(
        `/api/ctf/${chId}/submit`,
        {
          method: 'POST',
          body: JSON.stringify({ flag: flagInputs[chId] || '' }),
        },
      );
      setFeedback((f) => ({
        ...f,
        [chId]: { ok: true, msg: `Flag verified! +${res.pointsAwarded} points awarded.` },
      }));
      setFlagInputs((p) => ({ ...p, [chId]: '' }));
      await Promise.all([loadCtf(), refreshProfile()]);
    } catch (err) {
      setFeedback((f) => ({
        ...f,
        [chId]: { ok: false, msg: err instanceof Error ? err.message : 'Flag verification failed' },
      }));
    } finally {
      setSubmittingId(null);
    }
  };

  const handleToggleBookmark = async (chId: number) => {
    if (!user) {
      await loginWithGoogle();
      return;
    }
    await apiFetch(`/api/ctf/${chId}/bookmark`, { method: 'POST' });
    await loadCtf();
  };

  const handleReportChallenge = async (e: React.FormEvent, chId: number) => {
    e.preventDefault();
    if (!user) {
      await loginWithGoogle();
      return;
    }
    await apiFetch(`/api/ctf/${chId}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason: reportReason || 'Flagged challenge issue' }),
    });
    setReportingId(null);
    setReportReason('');
    setFeedback((f) => ({
      ...f,
      [chId]: { ok: true, msg: 'Issue reported to KALI3977 CTF moderators.' },
    }));
  };

  const solvedCount = challenges.filter((c) => c.solved).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            CTF Arena ({challenges.length} Original Challenges)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Server-verified Capture The Flag challenges across 14 security categories with dynamic scoring, artifacts, and educational post-solve explanations.
          </p>
        </div>
        <div className="font-mono text-xs text-emerald-500 tabular-nums">
          Solved: {solvedCount}/{challenges.length} · Showing {filtered.length}
        </div>
      </div>

      {/* Search, Difficulty, Status & Sort Controls */}
      <div className="grid gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 sm:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-4 relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search CTF challenges..."
            aria-label="Search CTF challenges"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] pl-9 pr-3 py-1.5 text-xs"
          />
        </div>

        <div className="lg:col-span-3">
          <select
            aria-label="Filter CTF challenges by difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
          >
            {CTF_DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                Difficulty: {d}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-3">
          <select
            aria-label="Filter CTF status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
          >
            <option value="all">Status: All Challenges</option>
            <option value="unsolved">Unsolved Only</option>
            <option value="solved">Solved Only</option>
            <option value="bookmarked">Bookmarked Only</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <select
            aria-label="Sort CTF challenges"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
          >
            <option value="points_asc">Points: Low–High</option>
            <option value="points_desc">Points: High–Low</option>
            <option value="solves_desc">Most Solved</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>
      </div>

      {/* Category Filter Strip */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              category === cat
                ? 'bg-emerald-500 text-slate-950 font-semibold'
                : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] text-slate-600 dark:text-slate-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Challenges Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-8 text-center text-sm text-slate-500">
          No CTF challenges match your active search or filters.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filtered.map((ch) => (
            <div
              key={ch.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {ch.category} · {ch.difficulty} · {ch.solveCount} solves
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {ch.currentPoints} pts ({ch.scoringMode})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleBookmark(ch.id)}
                      aria-label={`Bookmark ${ch.title}`}
                      className={`p-1 rounded transition-colors ${
                        ch.bookmarked
                          ? 'text-amber-500 bg-amber-500/10'
                          : 'text-slate-400 hover:text-amber-500'
                      }`}
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportingId(reportingId === ch.id ? null : ch.id)}
                      aria-label={`Report issue with ${ch.title}`}
                      className="p-1 text-slate-400 hover:text-rose-500"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {ch.title}
                  </h2>
                  {ch.solved ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500 shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                      Solved
                    </span>
                  ) : !ch.unlocked ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-500 shrink-0">
                      <Lock className="h-3.5 w-3.5" />
                      Locked
                    </span>
                  ) : null}
                </div>

                <SafeRichText content={ch.description} />

                {reportingId === ch.id && (
                  <form
                    onSubmit={(e) => handleReportChallenge(e, ch.id)}
                    className="flex gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-2.5"
                  >
                    <input
                      type="text"
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      placeholder="Describe broken artifact or ambiguity..."
                      className="min-w-0 flex-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0A0D12] px-2.5 py-1 text-xs"
                      required
                    />
                    <button
                      type="submit"
                      className="rounded bg-rose-500 px-3 py-1 text-xs font-semibold text-white"
                    >
                      Send Report
                    </button>
                  </form>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  {ch.attachmentName && ch.unlocked && (
                    <a
                      href={`/api/ctf/${ch.id}/artifact`}
                      download={ch.attachmentName}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 font-mono text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5 shrink-0" />
                      {ch.attachmentName}
                    </a>
                  )}

                  {ch.hints.length > 0 && ch.unlocked && (
                    <button
                      type="button"
                      onClick={() => setOpenHints((h) => ({ ...h, [ch.id]: !h[ch.id] }))}
                      className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      {openHints[ch.id] ? 'Hide Hints' : `Hints (${ch.hints.length})`}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setOpenDetails((d) => ({ ...d, [ch.id]: !d[ch.id] }))}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    {openDetails[ch.id] ? 'Hide Learning Context' : 'Objectives & Study Links'}
                  </button>
                </div>

                {openHints[ch.id] && (
                  <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {ch.hints.map((hint) => (
                      <li key={hint}>
                        <SafeRichText content={hint} className="space-y-1 text-xs" />
                      </li>
                    ))}
                  </ul>
                )}

                {openDetails[ch.id] && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3 text-xs space-y-2">
                    {ch.learningObjectives && ch.learningObjectives.length > 0 && (
                      <div>
                        <p className="font-semibold text-slate-600 dark:text-slate-300">Learning Objectives:</p>
                        <ul className="list-disc pl-4 text-slate-500 dark:text-slate-400">
                          {ch.learningObjectives.map((obj) => (
                            <li key={obj}>{obj}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 text-[11px] font-mono text-slate-500">
                      {ch.flagFormat && <span>Format: {ch.flagFormat}</span>}
                      {ch.relatedCourseSlug && <span>Course: {ch.relatedCourseSlug}</span>}
                      {ch.relatedBookTitle && <span>Book: {ch.relatedBookTitle}</span>}
                    </div>
                    {ch.referenceUrl && ch.referenceUrl.startsWith('https://') && (
                      <a
                        href={ch.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-500 hover:underline"
                      >
                        Official Technical Reference
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-2 text-[11px] text-slate-500 space-y-0.5">
                      <p>
                        <strong>Provenance:</strong> {ch.provenanceAuthor || 'KALI3977 Security Engineering'} ·{' '}
                        <span className="font-mono">{ch.contentVersion || 'v1.0.0'}</span>
                        {ch.createdAt && ` · Created ${new Date(ch.createdAt).toLocaleDateString()}`}
                      </p>
                      <p>
                        {ch.licenseType ||
                          '© 2026 KALI3977 — Original Challenge Material (Educational Use Only)'}
                      </p>
                    </div>
                  </div>
                )}

                {ch.solved && ch.explanationAfterSolve && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
                    <strong>Post-Solve Takeaway:</strong>
                    <SafeRichText content={ch.explanationAfterSolve} className="space-y-1 text-xs" />
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => handleSubmitFlag(e, ch.id)}
                className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    disabled={!ch.unlocked || ch.solved}
                    value={flagInputs[ch.id] || ''}
                    onChange={(e) => setFlagInputs((p) => ({ ...p, [ch.id]: e.target.value }))}
                    placeholder={ch.solved ? 'Flag already verified' : ch.flagFormat || 'KALI3977{...}'}
                    aria-label={`Submit flag for ${ch.title}`}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!ch.unlocked || ch.solved || submittingId === ch.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    {user ? 'Verify Flag' : 'Sign In'}
                  </button>
                </div>
                {feedback[ch.id] && (
                  <p
                    className={`text-xs ${
                      feedback[ch.id].ok ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {feedback[ch.id].msg}
                  </p>
                )}
              </form>
            </div>
          ))}
        </div>
      )}

      {/* Submission History */}
      {user && submissions.length > 0 && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Your Submission History
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-2 pr-4 font-medium">Challenge ID</th>
                  <th className="py-2 pr-4 font-medium">Masked Flag</th>
                  <th className="py-2 pr-4 font-medium">Outcome</th>
                  <th className="py-2 pr-4 font-medium text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono tabular-nums">
                {submissions.map((s) => (
                  <tr key={s.id} className="h-9">
                    <td className="pr-4">#{s.challengeId}</td>
                    <td className="pr-4">{s.submittedFlagMasked}</td>
                    <td className={`pr-4 ${s.isCorrect ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {s.isCorrect ? 'Verified' : 'Rejected'}
                    </td>
                    <td className="text-right">{s.pointsAwarded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* External CTF Training & Practice Directory (Clearly Separated) */}
      {externalPlatforms.length > 0 && (
        <section className="rounded-xl border border-cyan-500/30 bg-white dark:bg-[#11161F] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                External CTF Practice & Competition Directory
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Independent external platforms listed strictly as outbound learning references (not affiliated with or hosted by KALI3977).
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {externalPlatforms
              .filter((p) => p.url.startsWith('https://'))
              .map((p) => (
                <a
                  key={p.name}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-4 hover:border-cyan-500/60 transition-colors space-y-2"
                >
                  <div>
                    <p className="text-[11px] font-mono text-cyan-500">{p.category}</p>
                    <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {p.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{p.description}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                    Visit Official Site <ExternalLink className="h-3 w-3" />
                  </span>
                </a>
              ))}
          </div>
        </section>
      )}
    </div>
  );
};
