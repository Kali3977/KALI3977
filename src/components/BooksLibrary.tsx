import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  ListPlus,
  Search,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SafeRichText } from './SafeRichText';

const BOOK_CATEGORIES = [
  'All',
  'Computer Science Fundamentals',
  'Operating Systems',
  'Linux',
  'Windows Administration',
  'Networking',
  'Programming',
  'Cybersecurity Fundamentals',
  'Ethical Hacking and Penetration Testing',
  'Blue Team and SOC',
  'Digital Forensics',
  'Malware Analysis and Reverse Engineering',
  'Cryptography',
  'Cloud and DevSecOps',
  'IoT and Hardware Security',
  'Mobile and Wireless Security',
  'Web and API Security',
  'Binary Exploitation',
  'Career Preparation',
  'Open-Source Documentation',
  'Academic Research',
  'Compliance and Governance',
];

interface BookChapter {
  title: string;
  summary?: string;
  content?: string;
  body?: string;
}

interface BookProgress {
  bookmarked: boolean;
  inReadingList: boolean;
  progressPct: number;
  lastChapterIndex: number;
  notes: string;
}

interface BookItem {
  id: number;
  slug: string;
  title: string;
  author: string;
  description: string;
  category: string;
  difficulty: string;
  language: string;
  publisher: string;
  publicationYear: number;
  isbnOrId: string;
  licenseType: string;
  isFree: boolean;
  canReadOnline: boolean;
  canDownload: boolean;
  downloadPermitted: boolean;
  officialUrl: string;
  coverAccent?: string;
  coverTone?: string;
  readableChaptersJson: BookChapter[];
  progress: BookProgress | null;
}

export const BooksLibrary: React.FC = () => {
  const { user, loginWithGoogle, apiFetch } = useAuth();
  const [books, setBooks] = useState<BookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [availability, setAvailability] = useState<'all' | 'free' | 'external_ref'>('all');
  const [viewMode, setViewMode] = useState<'all' | 'reading_list' | 'bookmarked'>('all');
  const [readerBook, setReaderBook] = useState<BookItem | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [notesDraft, setNotesDraft] = useState('');
  const [progressPctDraft, setProgressPctDraft] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ books: BookItem[] }>('/api/books');
      setBooks(res.books);
      if (readerBook) {
        const updated = res.books.find((b) => b.id === readerBook.id) || null;
        setReaderBook(updated);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, [user?.id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return books.filter((b) => {
      if (category !== 'All' && b.category !== category) return false;
      if (availability === 'free' && !b.isFree) return false;
      if (availability === 'external_ref' && b.isFree) return false;
      if (viewMode === 'reading_list' && !b.progress?.inReadingList) return false;
      if (viewMode === 'bookmarked' && !b.progress?.bookmarked) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.publisher.toLowerCase().includes(q) ||
        b.isbnOrId.toLowerCase().includes(q)
      );
    });
  }, [books, category, availability, viewMode, search]);

  const updateProgress = async (
    bookId: number,
    patch: Partial<{
      bookmarked: boolean;
      inReadingList: boolean;
      progressPct: number;
      lastChapterIndex: number;
      notes: string;
    }>,
    feedback?: string,
  ) => {
    if (!user) {
      await loginWithGoogle();
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/books/${bookId}/progress`, {
        method: 'POST',
        body: JSON.stringify(patch),
      });
      await loadBooks();
      if (feedback) setNotice(feedback);
    } finally {
      setSaving(false);
    }
  };

  const openReader = (book: BookItem) => {
    setReaderBook(book);
    setChapterIndex(book.progress?.lastChapterIndex ?? 0);
    setNotesDraft(book.progress?.notes ?? '');
    setProgressPctDraft(book.progress?.progressPct ?? (book.readableChaptersJson.length > 0 ? 25 : 0));
  };

  const handleDownloadOpenAccess = (book: BookItem) => {
    if (!book.downloadPermitted || book.readableChaptersJson.length === 0) return;
    const text = [
      `${book.title} — ${book.author}`,
      `License: ${book.licenseType}`,
      `Official Source: ${book.officialUrl}`,
      '================================================================',
      ...book.readableChaptersJson.map((ch, idx) => {
        const chapterBody = ch.content || ch.body || '';
        const summaryLine = ch.summary ? `${ch.summary}\n\n` : '';
        return `\n## ${idx + 1}. ${ch.title}\n\n${summaryLine}${chapterBody}\n`;
      }),
    ].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${book.slug}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const readingListCount = books.filter((b) => b.progress?.inReadingList).length;
  const bookmarkedCount = books.filter((b) => b.progress?.bookmarked).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Books & Knowledge Library
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            100% free platform access to open-access textbooks, GNU & official vendor manuals, and curated publisher references across 21 technical domains.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-1">
          {[
            { id: 'all', label: `All (${books.length})` },
            { id: 'reading_list', label: `Reading List (${readingListCount})` },
            { id: 'bookmarked', label: `Bookmarked (${bookmarkedCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setViewMode(tab.id as typeof viewMode)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                viewMode === tab.id
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="grid gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 md:grid-cols-12 items-center">
        <div className="md:col-span-5 relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, author, publisher, or ISBN..."
            aria-label="Search books library"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] pl-9 pr-3 py-1.5 text-xs"
          />
        </div>
        <div className="md:col-span-4">
          <select
            aria-label="Filter books by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
          >
            {Array.from(new Set([...BOOK_CATEGORIES, ...books.map((b) => b.category)])).map((c) => (
              <option key={c} value={c}>
                Category: {c}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <select
            aria-label="Filter books by license"
            value={availability}
            onChange={(e) => setAvailability(e.target.value as typeof availability)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
          >
            <option value="all">Access: All Titles</option>
            <option value="free">Open Access &amp; Readable Online</option>
            <option value="external_ref">Copyrighted Publisher References</option>
          </select>
        </div>
      </div>

      {/* Licensing Integrity Banner */}
      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
        Copyright & Licensing Policy: KALI3977 is 100% free with zero fees or paywalls. Open-access, public-domain, and GNU manuals support direct online reading and legal download. Copyrighted reference books include metadata and official external publisher links only—never unauthorized PDFs.
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-500">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="font-mono hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Book Catalog Grid */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-8 text-sm text-slate-500">
          Loading Books & Knowledge Library...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-8 text-sm text-slate-500">
          No books match the selected category, search query, or filter.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((book) => {
            const pct = book.progress?.progressPct ?? 0;
            return (
              <article
                key={book.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4"
              >
                <div className="space-y-3">
                  {/* Cover Block + Meta */}
                  <div className="flex gap-3.5 items-start">
                    <div
                      className={`h-20 w-16 shrink-0 rounded-lg border border-slate-700/60 bg-gradient-to-br ${
                        (book.coverAccent || book.coverTone) === 'cyan'
                          ? 'from-cyan-950 to-slate-900 text-cyan-400'
                          : (book.coverAccent || book.coverTone) === 'violet'
                            ? 'from-violet-950 to-slate-900 text-violet-400'
                            : (book.coverAccent || book.coverTone) === 'amber'
                              ? 'from-amber-950 to-slate-900 text-amber-400'
                              : 'from-emerald-950 to-slate-900 text-emerald-400'
                      } flex flex-col justify-between p-2`}
                    >
                      <BookOpen className="h-4 w-4" />
                      <span className="font-mono text-[9px] uppercase leading-tight line-clamp-2">
                        {book.category}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                        <span className={book.isFree ? 'text-emerald-500 font-semibold' : 'text-cyan-500 font-semibold'}>
                          {book.isFree ? 'Open Access' : 'External Reference'}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 dark:text-slate-400">{book.difficulty}</span>
                      </div>
                      <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                        {book.title}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {book.author} · {book.publisher} ({book.publicationYear})
                      </p>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-3">
                    {book.description}
                  </p>

                  <div className="space-y-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    <p className="truncate">License: {book.licenseType}</p>
                    <p>
                      {book.language} · ID: {book.isbnOrId}
                    </p>
                  </div>

                  {user && pct > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-emerald-500">
                        <span>Reading Progress</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {book.canReadOnline && book.readableChaptersJson.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openReader(book)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        Read Online
                      </button>
                    )}
                    {book.downloadPermitted && book.readableChaptersJson.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleDownloadOpenAccess(book)}
                        className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 px-2.5 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </button>
                    )}
                    <a
                      href={book.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Official Source
                    </a>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        updateProgress(
                          book.id,
                          { bookmarked: !(book.progress?.bookmarked ?? false) },
                          book.progress?.bookmarked ? 'Bookmark removed.' : 'Bookmarked in your library.',
                        )
                      }
                      aria-label={`Bookmark ${book.title}`}
                      className={`rounded-lg border p-1.5 transition-colors ${
                        book.progress?.bookmarked
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-500'
                          : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-amber-500'
                      }`}
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        updateProgress(
                          book.id,
                          { inReadingList: !(book.progress?.inReadingList ?? false) },
                          book.progress?.inReadingList
                            ? 'Removed from Personal Reading List.'
                            : 'Added to Personal Reading List.',
                        )
                      }
                      aria-label={`Add ${book.title} to reading list`}
                      className={`rounded-lg border p-1.5 transition-colors ${
                        book.progress?.inReadingList
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                          : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-emerald-500'
                      }`}
                    >
                      <ListPlus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Online Reader Modal */}
      {readerBook && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Reading ${readerBook.title}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1117]">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-emerald-500">
                  {readerBook.licenseType} · Online Reader
                </p>
                <h2 className="truncate font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  {readerBook.title} — {readerBook.author}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setReaderBook(null)}
                aria-label="Close online reader"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid flex-1 overflow-y-auto md:grid-cols-12">
              <aside className="border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-4 md:col-span-4 space-y-2 bg-slate-50 dark:bg-[#0A0D12]">
                <p className="text-xs font-semibold text-slate-500 uppercase">Chapters</p>
                {readerBook.readableChaptersJson.map((ch, idx) => (
                  <button
                    key={ch.title}
                    type="button"
                    onClick={() => {
                      setChapterIndex(idx);
                      const nextPct = Math.round(
                        ((idx + 1) / Math.max(1, readerBook.readableChaptersJson.length)) * 100,
                      );
                      setProgressPctDraft(Math.max(progressPctDraft, nextPct));
                    }}
                    className={`w-full text-left rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      chapterIndex === idx
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                    }`}
                  >
                    {idx + 1}. {ch.title}
                  </button>
                ))}

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <label htmlFor="reader-progress" className="block text-xs font-semibold text-slate-500">
                    Completion: <span className="font-mono text-emerald-500">{progressPctDraft}%</span>
                  </label>
                  <input
                    id="reader-progress"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={progressPctDraft}
                    onChange={(e) => setProgressPctDraft(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                  <textarea
                    rows={3}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Personal book notes..."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-2 text-xs"
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      updateProgress(
                        readerBook.id,
                        {
                          progressPct: progressPctDraft,
                          lastChapterIndex: chapterIndex,
                          notes: notesDraft,
                          inReadingList: true,
                        },
                        'Reading progress and notes saved.',
                      )
                    }
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {user ? 'Save Progress' : 'Sign In to Save Progress'}
                  </button>
                </div>
              </aside>

              <div className="p-6 md:col-span-8 space-y-4 overflow-y-auto">
                {readerBook.readableChaptersJson[chapterIndex] ? (
                  <>
                    <h3 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                      {readerBook.readableChaptersJson[chapterIndex].title}
                    </h3>
                    {readerBook.readableChaptersJson[chapterIndex].summary && (
                      <p className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3.5 py-2.5 text-xs font-medium text-cyan-700 dark:text-cyan-300">
                        {readerBook.readableChaptersJson[chapterIndex].summary}
                      </p>
                    )}
                    <SafeRichText
                      content={
                        readerBook.readableChaptersJson[chapterIndex].content ||
                        readerBook.readableChaptersJson[chapterIndex].body ||
                        ''
                      }
                      className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300"
                    />
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Select a chapter to begin reading.</p>
                )}

                <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500">Source: {readerBook.publisher}</span>
                  <a
                    href={readerBook.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-cyan-500 hover:underline"
                  >
                    Open Official Publisher Documentation
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
