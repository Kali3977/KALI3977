import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Globe,
  Layers,
  Lock,
  Save,
  Search,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ADAPTIVE_LEVELS = [
  'All',
  'Absolute Beginner',
  'Beginner',
  'Elementary',
  'Intermediate',
  'Upper Intermediate',
  'Advanced',
  'Expert',
  'Research and Specialist Level',
];

interface LessonItem {
  id: number;
  courseId: number;
  moduleTitle?: string;
  titleEn: string;
  titleHi: string;
  contentEn: string;
  contentHi: string;
  practicalExample: string;
  diagramSpec: string;
  exercisesText?: string;
  revisionSummary?: string;
  quizJson: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
  progress: {
    completed: boolean;
    quizScore: number;
    bookmarked: boolean;
    notes: string;
  } | null;
}

interface CourseItem {
  id: number;
  slug: string;
  stage: number;
  stageTitle: string;
  subjectArea?: string;
  adaptiveLevel?: string;
  titleEn: string;
  titleHi: string;
  summaryEn: string;
  summaryHi: string;
  difficulty: string;
  prerequisiteSlug: string | null;
  prerequisitesJson?: string[];
  learningObjectivesJson?: string[];
  referencesJson?: Array<{ title: string; url: string }>;
  caseStudyText?: string;
  projectBrief?: string;
  estimatedMinutes: number;
  licenseType?: string;
  contentVersion?: string;
  provenanceAuthor?: string;
  attributionText?: string;
  createdAt?: string;
  updatedAt?: string;
  lessons: LessonItem[];
}

interface DiagnosticQuestion {
  id: string;
  prompt: string;
  options: string[];
  weight?: number;
}

interface DiagnosticAssessment {
  id: number;
  slug: string;
  title: string;
  subjectArea: string;
  description: string;
  questions: DiagnosticQuestion[];
}

interface SkillAssessment {
  id: number;
  subjectArea: string;
  verifiedLevel: string;
  scorePct: number;
  skippedCourseSlugsJson: string[];
  completedAt: string;
}

type LessonTab = 'lesson' | 'exercises' | 'case_project' | 'revision' | 'references';

export const LearningAcademy: React.FC = () => {
  const { user, loginWithGoogle, apiFetch, refreshProfile } = useAuth();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticAssessment[]>([]);
  const [userSkills, setUserSkills] = useState<SkillAssessment[]>([]);

  const [selectedStage, setSelectedStage] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  const [adaptiveFilter, setAdaptiveFilter] = useState('All');
  const [subjectFilter, setSubjectFilter] = useState('All');

  const [activeCourseId, setActiveCourseId] = useState<number | null>(null);
  const [activeLessonIdx, setActiveLessonIdx] = useState(0);
  const [lessonTab, setLessonTab] = useState<LessonTab>('lesson');

  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Diagnostic runner state
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [activeDiagSlug, setActiveDiagSlug] = useState<string>('');
  const [diagAnswers, setDiagAnswers] = useState<Record<string, number>>({});
  const [diagSubmitting, setDiagSubmitting] = useState(false);
  const [diagResult, setDiagResult] = useState<{
    verifiedLevel: string;
    scorePct: number;
    unlockIntermediate: boolean;
    skippedCourseSlugs: string[];
    review?: Array<{ id: string; isCorrect: boolean; explanation: string }>;
  } | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);

  const loadAcademy = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{
        courses: CourseItem[];
        diagnostics?: DiagnosticAssessment[];
        userSkills?: SkillAssessment[];
      }>('/api/academy');
      setCourses(res.courses);
      const diags = res.diagnostics || [];
      setDiagnostics(diags);
      setUserSkills(res.userSkills || []);
      if (diags.length > 0 && !activeDiagSlug) {
        setActiveDiagSlug(diags[0].slug);
      }
      if (res.courses.length > 0 && !activeCourseId) {
        setActiveCourseId(res.courses[0].id);
        setNotesDraft(res.courses[0].lessons[0]?.progress?.notes || '');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAcademy();
  }, [user?.id]);

  const subjectAreas = [
    'All',
    ...Array.from(new Set(courses.map((c) => c.subjectArea).filter((s): s is string => Boolean(s)))),
  ];

  const filteredCourses = courses.filter((c) => {
    const stageOk = selectedStage === 'all' || c.stage === selectedStage;
    const diffOk = difficultyFilter === 'All' || c.difficulty === difficultyFilter;
    const adaptOk = adaptiveFilter === 'All' || (c.adaptiveLevel || c.difficulty) === adaptiveFilter;
    const subjOk = subjectFilter === 'All' || c.subjectArea === subjectFilter;
    const q = searchQuery.trim().toLowerCase();
    const qOk =
      !q ||
      c.titleEn.toLowerCase().includes(q) ||
      c.titleHi.toLowerCase().includes(q) ||
      c.summaryEn.toLowerCase().includes(q) ||
      (c.subjectArea || '').toLowerCase().includes(q) ||
      c.stageTitle.toLowerCase().includes(q);
    return stageOk && diffOk && adaptOk && subjOk && qOk;
  });

  const activeCourse =
    filteredCourses.find((c) => c.id === activeCourseId) || filteredCourses[0] || null;
  const safeLessonIdx =
    activeCourse && activeLessonIdx < activeCourse.lessons.length ? activeLessonIdx : 0;
  const activeLesson = activeCourse?.lessons[safeLessonIdx] || null;

  useEffect(() => {
    setActiveLessonIdx(0);
    setLessonTab('lesson');
  }, [activeCourse?.id]);

  useEffect(() => {
    setNotesDraft(activeLesson?.progress?.notes || '');
    setSelectedOption(null);
    setQuizFeedback(null);
  }, [activeLesson?.id]);

  const completedSlugs = new Set(
    courses.filter((c) => c.lessons.some((l) => l.progress?.completed)).map((c) => c.slug),
  );
  const skippedSlugs = new Set(
    userSkills.flatMap((s) => (Array.isArray(s.skippedCourseSlugsJson) ? s.skippedCourseSlugsJson : [])),
  );
  const satisfiedPrereqs = new Set([...completedSlugs, ...skippedSlugs]);

  const completedCount = completedSlugs.size;
  const progressPct = courses.length > 0 ? Math.round((completedCount / courses.length) * 100) : 0;

  const isCoursePrereqMet = (course: CourseItem): boolean => {
    const reqs = new Set<string>();
    if (course.prerequisiteSlug) reqs.add(course.prerequisiteSlug);
    if (Array.isArray(course.prerequisitesJson)) {
      for (const r of course.prerequisitesJson) if (r) reqs.add(r);
    }
    if (reqs.size === 0) return true;
    for (const slug of reqs) {
      if (!satisfiedPrereqs.has(slug)) return false;
    }
    return true;
  };

  const handleSubmitQuiz = async (lesson: LessonItem) => {
    if (!user) {
      await loginWithGoogle();
      return;
    }
    if (selectedOption === null) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ quizPassed: boolean; explanation: string | null }>(
        `/api/academy/lessons/${lesson.id}/progress`,
        {
          method: 'POST',
          body: JSON.stringify({ selectedOption, notes: notesDraft }),
        },
      );
      setQuizFeedback({
        ok: res.quizPassed,
        text: res.quizPassed
          ? `Passed! ${res.explanation || 'Lesson marked complete and certificate eligibility updated.'}`
          : `Not quite. ${res.explanation || 'Review the lesson and try again.'}`,
      });
      await Promise.all([loadAcademy(), refreshProfile()]);
    } catch (err) {
      setQuizFeedback({ ok: false, text: err instanceof Error ? err.message : 'Submission error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotesOrBookmark = async (lesson: LessonItem, toggleBookmark: boolean) => {
    if (!user) {
      await loginWithGoogle();
      return;
    }
    setSaving(true);
    try {
      const nextBookmark = toggleBookmark
        ? !(lesson.progress?.bookmarked ?? false)
        : lesson.progress?.bookmarked ?? false;
      await apiFetch(`/api/academy/lessons/${lesson.id}/progress`, {
        method: 'POST',
        body: JSON.stringify({ bookmarked: nextBookmark, notes: notesDraft }),
      });
      await loadAcademy();
    } finally {
      setSaving(false);
    }
  };

  const activeDiag = diagnostics.find((d) => d.slug === activeDiagSlug) || diagnostics[0] || null;

  const handleSubmitDiagnostic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDiag) return;
    if (!user) {
      await loginWithGoogle();
      return;
    }
    setDiagSubmitting(true);
    setDiagError(null);
    try {
      const res = await apiFetch<{
        placement: {
          verifiedLevel: string;
          scorePct: number;
          unlockIntermediate: boolean;
          skippedCourseSlugs: string[];
        };
        review: Array<{ id: string; isCorrect: boolean; explanation: string }>;
      }>(`/api/academy/diagnostics/${activeDiag.slug}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: diagAnswers }),
      });
      setDiagResult({
        ...res.placement,
        review: res.review,
      });
      await Promise.all([loadAcademy(), refreshProfile()]);
    } catch (err) {
      setDiagError(err instanceof Error ? err.message : 'Diagnostic submission failed.');
    } finally {
      setDiagSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Learning Academy — Stages 1 to 8
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Adaptive progression from Absolute Beginner to Research & Specialist Level with skill diagnostics and prerequisite skipping.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDiagnostics((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              showDiagnostics
                ? 'border-cyan-500 bg-cyan-500/15 text-cyan-500'
                : 'border-cyan-500/40 bg-cyan-500/5 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/15'
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            {showDiagnostics ? 'Hide Skill Diagnostics' : 'Diagnostic & Skip Assessment'}
          </button>

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-1">
            <Globe className="ml-2 h-4 w-4 text-cyan-500" />
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                lang === 'en'
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLang('hi')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                lang === 'hi'
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              हिन्दी (Hindi)
            </button>
          </div>
        </div>
      </div>

      {/* Verified Adaptive Skill Badges */}
      {userSkills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" />
            Verified Skill Placements:
          </span>
          {userSkills.map((sk) => (
            <span
              key={sk.id}
              className="rounded-md border border-emerald-500/30 bg-white dark:bg-[#11161F] px-2.5 py-1 font-mono"
            >
              {sk.subjectArea}: <strong className="text-emerald-500">{sk.verifiedLevel}</strong> ({sk.scorePct}%)
            </span>
          ))}
        </div>
      )}

      {/* Diagnostic Assessment Runner */}
      {showDiagnostics && (
        <section className="rounded-xl border border-cyan-500/30 bg-white dark:bg-[#11161F] p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                Diagnostic Assessment & Prerequisite Verification
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Score 50%+ to unlock intermediate tracks and automatically satisfy beginner prerequisites.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {diagnostics.map((d) => (
                <button
                  key={d.slug}
                  type="button"
                  onClick={() => {
                    setActiveDiagSlug(d.slug);
                    setDiagAnswers({});
                    setDiagResult(null);
                    setDiagError(null);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeDiag?.slug === d.slug
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {d.title}
                </button>
              ))}
            </div>
          </div>

          {activeDiag && (
            <form onSubmit={handleSubmitDiagnostic} className="space-y-5">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                <strong className="text-cyan-500">{activeDiag.subjectArea}:</strong> {activeDiag.description}
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {activeDiag.questions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-4 space-y-2.5"
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {qIdx + 1}. {q.prompt}
                    </p>
                    <div className="space-y-1.5">
                      {q.options.map((opt, optIdx) => (
                        <label
                          key={opt}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-xs transition-colors ${
                            diagAnswers[q.id] === optIdx
                              ? 'border-cyan-500 bg-cyan-500/10 text-slate-900 dark:text-slate-100'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-[#11161F]'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`diag-${q.id}`}
                            checked={diagAnswers[q.id] === optIdx}
                            onChange={() => setDiagAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                            className="accent-cyan-500"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {diagError && <p className="text-xs text-rose-500">{diagError}</p>}

              {diagResult && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs space-y-2">
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Placement Result: {diagResult.verifiedLevel} ({diagResult.scorePct}%)
                  </p>
                  <p className="text-slate-700 dark:text-slate-300">
                    {diagResult.unlockIntermediate
                      ? `Prerequisites bypassed (+75 XP): ${diagResult.skippedCourseSlugs.join(', ')}`
                      : 'Keep studying foundational lessons and retry this diagnostic whenever ready (+75 XP recorded).'}
                  </p>
                  {diagResult.review && (
                    <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400">
                      {diagResult.review.map((r) => (
                        <li key={r.id}>
                          <strong className={r.isCorrect ? 'text-emerald-500' : 'text-amber-500'}>
                            {r.isCorrect ? 'Correct' : 'Review'}:
                          </strong>{' '}
                          {r.explanation}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={diagSubmitting}
                className="rounded-lg bg-cyan-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
              >
                {user
                  ? diagSubmitting
                    ? 'Evaluating Placement...'
                    : 'Submit Diagnostic & Verify Level'
                  : 'Sign In to Verify Level'}
              </button>
            </form>
          )}
        </section>
      )}

      {/* Curriculum Progress + Search + Adaptive Level + Subject Filters */}
      <div className="grid gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 md:grid-cols-12 items-center">
        <div className="md:col-span-3 relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search courses or topics..."
            aria-label="Search curriculum courses"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] pl-9 pr-3 py-1.5 text-xs"
          />
        </div>
        <div className="md:col-span-2">
          <select
            aria-label="Filter courses by adaptive level"
            value={adaptiveFilter}
            onChange={(e) => setAdaptiveFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5 text-xs"
          >
            {ADAPTIVE_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl === 'All' ? 'Adaptive Level: All' : lvl}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <select
            aria-label="Filter courses by subject area"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5 text-xs"
          >
            {subjectAreas.map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'Subject: All' : s}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <select
            aria-label="Filter courses by difficulty"
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5 text-xs"
          >
            <option value="All">Tier: All</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>
        <div className="md:col-span-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Curriculum Completion</span>
            <span className="font-mono text-emerald-500 tabular-nums">
              {completedCount}/{courses.length} ({progressPct}%)
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stage Filter */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-1.5">
        <button
          type="button"
          onClick={() => setSelectedStage('all')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            selectedStage === 'all'
              ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          All 8 Stages
        </button>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((stageNum) => (
          <button
            key={stageNum}
            type="button"
            onClick={() => setSelectedStage(stageNum)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              selectedStage === stageNum
                ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Stage {stageNum}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-8 text-sm text-slate-500">
          Loading cybersecurity curriculum...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Course List */}
          <div className="lg:col-span-4 min-w-0 space-y-3">
            {filteredCourses.map((course) => {
              const isCompleted = course.lessons.some((l) => l.progress?.completed);
              const isSkipped = skippedSlugs.has(course.slug);
              const prereqMet = isCoursePrereqMet(course);
              const isActive = activeCourse?.id === course.id;

              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => setActiveCourseId(course.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-colors ${
                    isActive
                      ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="truncate">
                      Stage {course.stage} · {course.adaptiveLevel || course.difficulty} · {course.lessons.length} lesson{course.lessons.length === 1 ? '' : 's'}
                    </span>
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : isSkipped ? (
                      <span className="font-mono text-[10px] text-cyan-500 shrink-0">PLACED</span>
                    ) : !prereqMet && user ? (
                      <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    ) : null}
                  </div>
                  <h3 className="mt-1.5 font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'hi' ? course.titleHi : course.titleEn}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {lang === 'hi' ? course.summaryHi : course.summaryEn}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Active Lesson Workspace */}
          <div className="lg:col-span-8 min-w-0">
            {activeCourse && activeLesson ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 sm:p-6 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
                      {activeCourse.stageTitle} · {activeCourse.adaptiveLevel || activeCourse.difficulty}
                      {activeCourse.subjectArea ? ` · ${activeCourse.subjectArea}` : ''}
                    </p>
                    <h2 className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                      {lang === 'hi' ? activeLesson.titleHi : activeLesson.titleEn}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveNotesOrBookmark(activeLesson, true)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      activeLesson.progress?.bookmarked
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    {activeLesson.progress?.bookmarked ? 'Bookmarked' : 'Bookmark'}
                  </button>
                </div>

                {/* Multi-lesson switcher inside course */}
                {activeCourse.lessons.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {activeCourse.lessons.map((l, idx) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setActiveLessonIdx(idx)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          safeLessonIdx === idx
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span>
                          {l.moduleTitle || `Lesson ${idx + 1}`}: {lang === 'hi' ? l.titleHi : l.titleEn}
                        </span>
                        {l.progress?.completed && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                      </button>
                    ))}
                  </div>
                )}

                {!isCoursePrereqMet(activeCourse) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-600 dark:text-amber-300">
                    <div className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Recommended Prerequisite: Complete{' '}
                        <code className="font-mono">{activeCourse.prerequisiteSlug}</code> or verify placement via Diagnostic Assessment.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDiagnostics(true)}
                      className="font-semibold underline hover:text-amber-400"
                    >
                      Take Diagnostic
                    </button>
                  </div>
                )}

                {/* Lesson Sub-Navigation */}
                <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
                  {[
                    { id: 'lesson', label: 'Lesson & Lab Flow' },
                    { id: 'exercises', label: 'Practical Exercises' },
                    { id: 'case_project', label: 'Case Study & Project' },
                    { id: 'revision', label: 'Objectives & Revision' },
                    { id: 'references', label: 'External References' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setLessonTab(t.id as LessonTab)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        lessonTab === t.id
                          ? 'bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950 font-semibold'
                          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {lessonTab === 'lesson' && (
                  <>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {lang === 'hi' ? activeLesson.contentHi : activeLesson.contentEn}
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="min-w-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-4">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                          Architecture & Signal Flow
                        </p>
                        <p className="font-mono text-xs leading-relaxed text-cyan-700 dark:text-cyan-300 break-words">
                          {activeLesson.diagramSpec}
                        </p>
                      </div>
                      <div className="min-w-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-4">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                          Practical Command Reference
                        </p>
                        <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-emerald-700 dark:text-emerald-400">
                          {activeLesson.practicalExample}
                        </pre>
                      </div>
                    </div>
                  </>
                )}

                {lessonTab === 'exercises' && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-4 space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-500">
                      Guided Practical Exercises
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {activeLesson.exercisesText ||
                        'Reproduce the practical command reference in an isolated sandbox and document each observed invariant.'}
                    </p>
                  </div>
                )}

                {lessonTab === 'case_project' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-4 space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-500">
                        Real-World Case Study
                      </h3>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {activeCourse.caseStudyText ||
                          'Analyze real defensive engineering incidents related to this module.'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-4 space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-400">
                        Portfolio Project Brief
                      </h3>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {activeCourse.projectBrief ||
                          'Build an open-source technical artifact demonstrating mastery of this stage.'}
                      </p>
                    </div>
                  </div>
                )}

                {lessonTab === 'revision' && (
                  <div className="space-y-4">
                    {activeCourse.learningObjectivesJson && activeCourse.learningObjectivesJson.length > 0 && (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-4 space-y-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-500">
                          Learning Objectives
                        </h3>
                        <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                          {activeCourse.learningObjectivesJson.map((obj) => (
                            <li key={obj}>{obj}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-4 space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-500">
                        Revision Summary
                      </h3>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {activeLesson.revisionSummary ||
                          'Verify key definitions, security controls, and hands-on commands before proceeding.'}
                      </p>
                    </div>
                  </div>
                )}

                {lessonTab === 'references' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Authoritative External References
                      </h3>
                      {activeCourse.referencesJson && activeCourse.referencesJson.length > 0 ? (
                        <ul className="space-y-2">
                          {activeCourse.referencesJson
                            .filter((r) => r.url.startsWith('https://'))
                            .map((r) => (
                              <li key={r.url}>
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:border-cyan-500"
                                >
                                  <BookOpen className="h-3.5 w-3.5" />
                                  {r.title}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-500">
                          No external links cataloged for this course yet.
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-4 space-y-1.5 text-xs">
                      <h4 className="font-semibold uppercase tracking-wider text-emerald-500">
                        Content Provenance &amp; Licensing
                      </h4>
                      <p className="text-slate-600 dark:text-slate-300">
                        <strong>Author:</strong> {activeCourse.provenanceAuthor || 'KALI3977 Curriculum Team'} ·{' '}
                        <strong>Version:</strong>{' '}
                        <span className="font-mono">{activeCourse.contentVersion || 'v1.0.0'}</span>
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">
                        <strong>License:</strong>{' '}
                        {activeCourse.licenseType || '© 2026 KALI3977 — All Rights Reserved (Personal Educational Use)'}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        <strong>Attribution:</strong>{' '}
                        {activeCourse.attributionText ||
                          'Original curriculum by KALI3977; third-party standards and documentation credited separately.'}
                      </p>
                      {(activeCourse.createdAt || activeCourse.updatedAt) && (
                        <p className="font-mono text-[11px] text-slate-500">
                          {activeCourse.createdAt && `Created: ${new Date(activeCourse.createdAt).toLocaleDateString()}`}
                          {activeCourse.createdAt && activeCourse.updatedAt ? ' · ' : ''}
                          {activeCourse.updatedAt && `Updated: ${new Date(activeCourse.updatedAt).toLocaleDateString()}`}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Assessment Quiz */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Knowledge Assessment
                  </h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {activeLesson.quizJson.question}
                  </p>
                  <div className="space-y-2">
                    {activeLesson.quizJson.options.map((opt, idx) => (
                      <label
                        key={opt}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                          selectedOption === idx
                            ? 'border-emerald-500 bg-emerald-500/10 text-slate-900 dark:text-slate-100'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`quiz-${activeLesson.id}`}
                          checked={selectedOption === idx}
                          onChange={() => setSelectedOption(idx)}
                          className="accent-emerald-500"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>

                  {quizFeedback && (
                    <div
                      className={`rounded-lg p-3 text-xs ${
                        quizFeedback.ok
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {quizFeedback.text}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={saving || (Boolean(user) && selectedOption === null)}
                    onClick={() => handleSubmitQuiz(activeLesson)}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    {user ? 'Submit Assessment (+50 XP)' : 'Sign In to Save Progress'}
                  </button>
                </div>

                {/* Personal Revision Notes */}
                <div className="space-y-2">
                  <label
                    htmlFor="lesson-notes"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400"
                  >
                    Personal Study Notes
                  </label>
                  <textarea
                    id="lesson-notes"
                    rows={3}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Record commands, takeaways, or revision points..."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveNotesOrBookmark(activeLesson, false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save Notes
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-8 text-sm text-slate-500">
                No courses match the active filters. Reset filters or pick another stage.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
