import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Compass,
  Flag,
  FlaskConical,
  HelpCircle,
  Library,
  Search,
  Terminal,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { NavSection } from '../types/kali';

interface SearchResultsPayload {
  query: string;
  results: {
    courses: Array<{ id: number; slug: string; title: string; stage: number; stageTitle: string; summary: string }>;
    tools: Array<{ id: number; slug: string; name: string; difficulty: string; summary: string }>;
    labs: Array<{ id: number; slug: string; title: string; category: string; difficulty: string; summary: string }>;
    challenges: Array<{ id: number; slug: string; title: string; category: string; difficulty: string; points: number }>;
    books: Array<{ id: number; slug: string; title: string; author: string; category: string }>;
    glossary: Array<{ id?: string; term: string; category: string; shortMeaning?: string; shortDefinition?: string; example?: string }>;
    helpArticles: Array<{ id: string; title: string; summary: string; steps: string[] }>;
  };
}

interface GlobalSearchHelpModalProps {
  open: boolean;
  initialMode: 'search' | 'help';
  onClose: () => void;
  onNavigate: (section: NavSection) => void;
}

export const GlobalSearchHelpModal: React.FC<GlobalSearchHelpModalProps> = ({
  open,
  initialMode,
  onClose,
  onNavigate,
}) => {
  const { apiFetch } = useAuth();
  const [tab, setTab] = useState<'search' | 'help' | 'glossary'>(initialMode === 'help' ? 'help' : 'search');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<SearchResultsPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab(initialMode === 'help' ? 'help' : 'search');
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      apiFetch<SearchResultsPayload>(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => {
          if (active) setData(res);
        })
        .catch(() => {
          // Ignore transient search error
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [apiFetch, open, query]);

  if (!open) return null;

  const go = (section: NavSection) => {
    onNavigate(section);
    onClose();
  };

  const results = data?.results;
  const hasAnySearchMatch =
    Boolean(results) &&
    (results!.courses.length > 0 ||
      results!.tools.length > 0 ||
      results!.labs.length > 0 ||
      results!.challenges.length > 0 ||
      results!.books.length > 0 ||
      results!.glossary.length > 0 ||
      results!.helpArticles.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-2.5 sm:p-4 pt-4 sm:pt-14 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Global Platform Search and Help"
    >
      <div className="w-full max-w-4xl max-h-[90dvh] sm:max-h-[84dvh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] shadow-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            <Search className="h-5 w-5 text-emerald-500 shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses, Kali commands (whois, nmap, ls), labs, CTF challenges, books, or terms..."
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search and help modal"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'search' as const, label: 'Search Results', icon: Search },
              { id: 'help' as const, label: 'Step-by-Step Help Docs', icon: HelpCircle },
              { id: 'glossary' as const, label: 'Cybersecurity Glossary', icon: Compass },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    tab === item.id
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {tab === 'search' && (
            <>
              {loading && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Searching KALI3977...</p>
              )}

              {!query.trim() && (
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Quick Shortcuts
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => go('academy')}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-left hover:border-emerald-500/40"
                    >
                      <BookOpen className="h-4 w-4 text-emerald-500 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">Learning Academy</p>
                        <p className="text-[11px] text-slate-500">Stages 1–8 courses</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => go('learn-kali')}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-left hover:border-emerald-500/40"
                    >
                      <Terminal className="h-4 w-4 text-cyan-500 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">Learn KALI Lab</p>
                        <p className="text-[11px] text-slate-500">Linux CLI &amp; Kali tools</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => go('labs')}
                      className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-left hover:border-emerald-500/40"
                    >
                      <FlaskConical className="h-4 w-4 text-amber-500 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">Cyber Labs &amp; CTF</p>
                        <p className="text-[11px] text-slate-500">Hands-on challenges</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {query.trim() && !loading && !hasAnySearchMatch && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  No direct matches found for &ldquo;{query}&rdquo;. Try searching <code className="font-mono">whois</code>, <code className="font-mono">nmap</code>, <code className="font-mono">linux</code>, <code className="font-mono">crypto</code>, or open the Help Docs tab.
                </div>
              )}

              {results && results.tools.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Learn KALI Commands &amp; Tools
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {results.tools.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => go('learn-kali')}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-left hover:border-emerald-500/40"
                      >
                        <Terminal className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{t.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{t.summary}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results && results.courses.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Academy Courses
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {results.courses.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => go('academy')}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-left hover:border-emerald-500/40"
                      >
                        <BookOpen className="h-4 w-4 text-cyan-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{c.title}</p>
                          <p className="text-[11px] font-mono text-slate-500">Stage {c.stage} · {c.stageTitle}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results && results.labs.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Cyber Labs
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {results.labs.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => go('labs')}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-left hover:border-emerald-500/40"
                      >
                        <FlaskConical className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{l.title}</p>
                          <p className="text-[11px] text-slate-500">{l.category} · {l.difficulty}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results && results.challenges.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    CTF Challenges
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {results.challenges.map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => go('ctf')}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-left hover:border-emerald-500/40"
                      >
                        <Flag className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{ch.title}</p>
                          <p className="text-[11px] font-mono text-slate-500">{ch.category} · {ch.points} pts</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results && results.books.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Books Library
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {results.books.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => go('books')}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-left hover:border-emerald-500/40"
                      >
                        <Library className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{b.title}</p>
                          <p className="text-[11px] text-slate-500">{b.author} · {b.category}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {results && results.glossary.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Cybersecurity Glossary
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {results.glossary.map((g, idx) => (
                      <div
                        key={g.id || `${g.term}-${idx}`}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-left"
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{g.term}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{g.shortMeaning || g.shortDefinition}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'help' && (
            <div className="space-y-4">
              {(results?.helpArticles || []).map((article) => (
                <div
                  key={article.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-2.5"
                >
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{article.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{article.summary}</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300">
                    {article.steps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}

          {tab === 'glossary' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(results?.glossary || []).map((entry, idx) => (
                <div
                  key={entry.id || `${entry.term}-${idx}`}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{entry.term}</span>
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">{entry.category}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{entry.shortMeaning || entry.shortDefinition}</p>
                  {entry.example && (
                    <code className="block rounded bg-slate-900 px-2.5 py-1.5 text-[11px] font-mono text-emerald-300">
                      {entry.example}
                    </code>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
