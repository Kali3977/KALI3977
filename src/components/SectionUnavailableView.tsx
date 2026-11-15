import React from 'react';
import { Clock, Home, Lock, Wrench } from 'lucide-react';
import type { NavSection, SectionDisplayStatus } from '../types/kali';

export const SectionUnavailableView: React.FC<{
  sectionName: string;
  status: SectionDisplayStatus;
  message: string;
  onNavigateHome: () => void;
  previewAsStudent?: boolean;
  onExitPreview?: () => void;
}> = ({
  sectionName,
  status,
  message,
  onNavigateHome,
  previewAsStudent,
  onExitPreview,
}) => {
  const Icon = status === 'maintenance' ? Wrench : status === 'coming_soon' ? Clock : Lock;
  const label =
    status === 'maintenance'
      ? 'Under Maintenance'
      : status === 'coming_soon'
        ? 'Coming Soon'
        : 'Section Disabled';

  const toneClass =
    status === 'maintenance'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
      : status === 'coming_soon'
        ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-500'
        : 'border-rose-500/40 bg-rose-500/10 text-rose-500';

  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-8 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${toneClass}`}>
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </div>
          {previewAsStudent && (
            <span className="font-mono text-xs text-amber-500">Student Preview Active</span>
          )}
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            {sectionName} is currently unavailable
          </h1>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
          >
            <Home className="h-4 w-4" />
            Return to Home
          </button>
          {previewAsStudent && onExitPreview && (
            <button
              type="button"
              onClick={onExitPreview}
              className="rounded-lg border border-amber-500/40 px-4 py-2 text-xs font-semibold text-amber-500 hover:bg-amber-500/10"
            >
              Exit Student Preview
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export function getUnavailableSectionTitle(key: NavSection): string {
  switch (key) {
    case 'academy':
      return 'Learning Academy';
    case 'books':
      return 'Books & Knowledge Library';
    case 'labs':
      return 'Cyber Labs';
    case 'learn-kali':
      return 'Learn KALI';
    case 'ctf':
      return 'CTF Arena';
    case 'arena':
      return 'Multiplayer Arena';
    case 'games':
      return 'Games Arena';
    case 'tournaments':
      return 'Tournaments & Events';
    case 'mentor':
      return 'AI Cyber Mentor';
    case 'community':
      return 'Community';
    case 'career':
      return 'Career Hub';
    default:
      return 'Platform Section';
  }
}
