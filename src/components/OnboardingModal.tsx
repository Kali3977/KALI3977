import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Flag,
  FlaskConical,
  Gamepad2,
  GraduationCap,
  Shield,
  Terminal,
  X,
} from 'lucide-react';
import type { LearningExperience, NavSection } from '../types/kali';

interface OnboardingModalProps {
  open: boolean;
  initialExperience: LearningExperience;
  initialGoal: string;
  onComplete: (opts: { experience: LearningExperience; goal: string; skipped?: boolean }) => Promise<void>;
  onSkip: () => Promise<void>;
  onNavigate?: (section: NavSection) => void;
}

const EXPERIENCE_OPTIONS: Array<{
  id: LearningExperience;
  title: string;
  subtitle: string;
  details: string;
}> = [
  {
    id: 'beginner',
    title: 'Beginner (Default)',
    subtitle: 'Guided explanations, command breakdowns, and beginner-safe hints',
    details: 'Best if you are new to cybersecurity, Linux terminals, or CTF challenges. Every advanced lab and course stays accessible whenever you want it.',
  },
  {
    id: 'intermediate',
    title: 'Intermediate',
    subtitle: 'Balanced walkthroughs, tool workflows, and structured practice',
    details: 'Best if you know basic networking and Linux commands and want a compact workspace focused on practical labs and challenges.',
  },
  {
    id: 'expert',
    title: 'Expert',
    subtitle: 'Compact technical interface for faster workflow execution',
    details: 'Minimal introductory clutter with direct command references, challenge metrics, and quick tool switching.',
  },
];

const LEARNING_GOALS = [
  'Learn cybersecurity from scratch',
  'Master Linux & Kali security commands',
  'Solve hands-on Cyber Labs & CTF challenges',
  'Prepare for multiplayer competitions & team tournaments',
  'Build a cybersecurity career & portfolio',
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  open,
  initialExperience,
  initialGoal,
  onComplete,
  onSkip,
  onNavigate,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedExperience, setSelectedExperience] = useState<LearningExperience>(initialExperience);
  const [selectedGoal, setSelectedGoal] = useState<string>(initialGoal || LEARNING_GOALS[0]);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleFinish = async (goTo?: NavSection) => {
    setSaving(true);
    try {
      await onComplete({
        experience: selectedExperience,
        goal: selectedGoal,
        skipped: false,
      });
      if (goTo && onNavigate) {
        onNavigate(goTo);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      await onSkip();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              KALI3977 Quick Start · Optional Guide
            </p>
            <h2 id="onboarding-title" className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {step === 1 ? 'How KALI3977 Works' : 'Choose Your Starting Experience'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Zero to Advanced — learn fundamentals, practice commands safely, and compete in real-time arenas.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSkip()}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
            aria-label="Skip onboarding"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 1 ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <BookOpen className="h-4 w-4 text-emerald-500" />
                  <span>1. Learn (Academy, Learn KALI & Books)</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Start with structured courses and the interactive Learn KALI terminal simulator where every command is explained step by step.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <FlaskConical className="h-4 w-4 text-cyan-500" />
                  <span>2. Practice (Cyber Labs & CTF Arena)</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Apply skills in practical scenarios, inspect artifacts, and submit server-verified Capture The Flag answers to earn XP.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <Gamepad2 className="h-4 w-4 text-amber-500" />
                  <span>3. Play (Games & Team Competitions)</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Join solo cybersecurity games, invite teammates with a Room Code or Team Code, and compete in campus tournaments.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <Shield className="h-4 w-4 text-violet-500" />
                  <span>4. Everything Stays Accessible</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Your Learning Experience adjusts guidance depth and visual comfort — it never locks courses, tools, or advanced challenges.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-200">
                <Terminal className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>
                  New to Linux? We recommend starting with <strong>Learn KALI → Level 1: Linux CLI Foundations</strong> right after setup.
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSkip()}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Skip Onboarding
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Next: Pick Experience &amp; Goal →
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Current Experience Level
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {EXPERIENCE_OPTIONS.map((opt) => {
                  const selected = selectedExperience === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedExperience(opt.id)}
                      className={`text-left rounded-xl border p-4 transition-colors ${
                        selected
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{opt.title}</span>
                        {selected && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                      </div>
                      <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">{opt.subtitle}</p>
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{opt.details}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Primary Learning Goal (Optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {LEARNING_GOALS.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => setSelectedGoal(goal)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      selectedGoal === goal
                        ? 'border-emerald-500 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSkip()}
                  className="rounded-lg px-3.5 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  Skip for now
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleFinish('learn-kali')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  Save &amp; Start Learn KALI
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleFinish()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  <Flag className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save & Open Dashboard'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
