import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Power,
  RefreshCw,
  Shield,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSections } from '../context/SectionContext';
import { ConfirmDialog } from './ConfirmDialog';
import type { PlatformSectionState, SectionDisplayStatus } from '../types/kali';

interface SectionAuditEntry {
  id: number;
  actorEmail: string | null;
  action: string;
  resourceId: string;
  previousStateJson: Record<string, unknown> | null;
  newStateJson: Record<string, unknown> | null;
  createdAt: string;
}

export const SectionManagementAdminPanel: React.FC<{
  onSectionsChanged?: () => Promise<void>;
}> = ({ onSectionsChanged }) => {
  const { user, apiFetch } = useAuth();
  const { previewAsStudent, setPreviewAsStudent, refreshSections } = useSections();

  const [sections, setSections] = useState<PlatformSectionState[]>([]);
  const [auditLogs, setAuditLogs] = useState<SectionAuditEntry[]>([]);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, { displayStatus: SectionDisplayStatus; statusMessage: string }>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisableAllOpen, setConfirmDisableAllOpen] = useState(false);

  const isOwner = user?.role === 'owner';

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ sections: PlatformSectionState[]; auditLogs: SectionAuditEntry[] }>(
        '/api/admin/sections',
      );
      setSections(res.sections);
      setAuditLogs(res.auditLogs || []);
      const drafts: Record<string, { displayStatus: SectionDisplayStatus; statusMessage: string }> = {};
      for (const s of res.sections) {
        drafts[s.sectionKey] = {
          displayStatus: s.displayStatus,
          statusMessage: s.statusMessage || '',
        };
      }
      setStatusDrafts(drafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load platform sections.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const syncAfterChange = async () => {
    await Promise.all([loadData(), refreshSections(), onSectionsChanged ? onSectionsChanged() : Promise.resolve()]);
  };

  const handleUpdateSection = async (
    sectionKey: string,
    displayStatus: SectionDisplayStatus,
    statusMessage?: string,
  ) => {
    setBusyKey(sectionKey);
    setMessage(null);
    setError(null);
    try {
      await apiFetch(`/api/admin/sections/${sectionKey}`, {
        method: 'POST',
        body: JSON.stringify({
          displayStatus,
          enabledStatus: displayStatus === 'enabled',
          maintenanceStatus: displayStatus === 'maintenance',
          statusMessage: statusMessage ?? statusDrafts[sectionKey]?.statusMessage ?? '',
        }),
      });
      await syncAfterChange();
      setMessage(`Updated "${sectionKey}" status to ${displayStatus.replace('_', ' ').toUpperCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update section.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleBulkAction = async (action: 'enable_all' | 'disable_all') => {
    setBusyKey(`bulk:${action}`);
    setMessage(null);
    setError(null);
    try {
      await apiFetch('/api/admin/sections/bulk', {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      await syncAfterChange();
      setMessage(
        action === 'enable_all'
          ? 'All toggleable platform sections enabled.'
          : 'All toggleable platform sections disabled. Core essentials & Admin Panel remain active.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk section update failed.');
    } finally {
      setBusyKey(null);
      setConfirmDisableAllOpen(false);
    }
  };

  const lockableSections = sections.filter((s) => s.isLockable);
  const protectedSections = sections.filter((s) => !s.isLockable);
  const enabledCount = lockableSections.filter((s) => s.displayStatus === 'enabled').length;

  return (
    <div className="space-y-6">
      {/* Header & Global Controls */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Global Section Management
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enable, disable, or place individual student-facing sections into Maintenance or Coming Soon mode. Changes persist in PostgreSQL and enforce both frontend routing and backend APIs. ({enabledCount}/{lockableSections.length} student sections active)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewAsStudent(!previewAsStudent)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                previewAsStudent
                  ? 'border-amber-500 bg-amber-500/15 text-amber-500'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {previewAsStudent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {previewAsStudent ? 'Exit Student Preview' : 'Preview as Student'}
            </button>

            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>

            {isOwner && (
              <>
                <button
                  type="button"
                  disabled={busyKey !== null}
                  onClick={() => void handleBulkAction('enable_all')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  <Power className="h-3.5 w-3.5" />
                  Enable All
                </button>
                <button
                  type="button"
                  disabled={busyKey !== null}
                  onClick={() => setConfirmDisableAllOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/20 disabled:opacity-50"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Disable All
                </button>
              </>
            )}
          </div>
        </div>

        {!isOwner && (
          <p className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-600 dark:text-cyan-400">
            Read-only staff view: Only the Platform Owner can change global section availability switches. You may still preview student navigation state.
          </p>
        )}

        {message && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-500">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-500">
            {error}
          </div>
        )}
      </div>

      {/* Toggleable Sections Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {lockableSections.map((sec) => {
          const draft = statusDrafts[sec.sectionKey] || {
            displayStatus: sec.displayStatus,
            statusMessage: sec.statusMessage || '',
          };
          const isSaving = busyKey === sec.sectionKey;
          const statusTone =
            sec.displayStatus === 'enabled'
              ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
              : sec.displayStatus === 'maintenance'
                ? 'text-amber-500 border-amber-500/30 bg-amber-500/10'
                : sec.displayStatus === 'coming_soon'
                  ? 'text-cyan-500 border-cyan-500/30 bg-cyan-500/10'
                  : 'text-rose-500 border-rose-500/30 bg-rose-500/10';
          const StatusIcon =
            sec.displayStatus === 'enabled'
              ? CheckCircle2
              : sec.displayStatus === 'maintenance'
                ? Wrench
                : sec.displayStatus === 'coming_soon'
                  ? Clock
                  : Lock;

          return (
            <div
              key={sec.sectionKey}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                      {sec.sectionName}
                    </h3>
                    <span className="font-mono text-[11px] text-slate-500">/{sec.sectionKey}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{sec.description}</p>
                </div>

                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap shrink-0 ${statusTone}`}
                >
                  <StatusIcon className="h-3 w-3" />
                  {sec.displayStatus.replace('_', ' ')}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-12 items-center">
                <div className="sm:col-span-5">
                  <select
                    aria-label={`Status mode for ${sec.sectionName}`}
                    disabled={!isOwner || isSaving}
                    value={draft.displayStatus}
                    onChange={(e) => {
                      const nextMode = e.target.value as SectionDisplayStatus;
                      setStatusDrafts((prev) => ({
                        ...prev,
                        [sec.sectionKey]: { ...draft, displayStatus: nextMode },
                      }));
                    }}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5 text-xs"
                  >
                    <option value="enabled">Enabled (Visible to Students)</option>
                    <option value="disabled">Disabled (Hidden &amp; Blocked)</option>
                    <option value="coming_soon">Coming Soon (Locked Notice)</option>
                    <option value="maintenance">Maintenance Mode (503 Lock)</option>
                  </select>
                </div>

                <div className="sm:col-span-7 flex gap-2">
                  <input
                    type="text"
                    disabled={!isOwner || isSaving}
                    value={draft.statusMessage}
                    onChange={(e) =>
                      setStatusDrafts((prev) => ({
                        ...prev,
                        [sec.sectionKey]: { ...draft, statusMessage: e.target.value },
                      }))
                    }
                    placeholder="Optional student notice when locked..."
                    aria-label={`Notice message for ${sec.sectionName}`}
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800 pt-3 text-[11px] text-slate-500">
                <span className="truncate">
                  {sec.updatedAt
                    ? `Updated ${new Date(sec.updatedAt).toLocaleString()}${sec.updatedByEmail ? ` by ${sec.updatedByEmail}` : ''}`
                    : 'Default active state'}
                </span>

                {isOwner && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        void handleUpdateSection(
                          sec.sectionKey,
                          sec.displayStatus === 'enabled' ? 'disabled' : 'enabled',
                          draft.statusMessage,
                        )
                      }
                      className={`rounded-lg border px-2.5 py-1 font-semibold transition-colors ${
                        sec.displayStatus === 'enabled'
                          ? 'border-rose-500/40 text-rose-500 hover:bg-rose-500/10'
                          : 'border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10'
                      }`}
                    >
                      {sec.displayStatus === 'enabled' ? 'Quick Disable' : 'Quick Enable'}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void handleUpdateSection(sec.sectionKey, draft.displayStatus, draft.statusMessage)}
                      className="rounded-lg bg-cyan-500 px-3 py-1 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save State'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Protected Non-Lockable Core Sections */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-500" />
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Protected Essential Sections (Never Disabled by Bulk Lock)
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {protectedSections.map((sec) => (
            <span
              key={sec.sectionKey}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300"
            >
              {sec.sectionName} <span className="font-mono text-emerald-500">({sec.sectionKey})</span>
            </span>
          ))}
        </div>
      </div>

      {/* Section Change Audit History */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
        <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
          Section Management Audit History
        </h3>
        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-500">No section status changes recorded yet.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="font-mono font-semibold text-cyan-500">
                    {log.action} · {log.resourceId}
                  </p>
                  <p className="text-slate-500">
                    {log.actorEmail || 'system'}
                    {log.newStateJson?.displayStatus
                      ? ` -> ${String(log.newStateJson.displayStatus)}`
                      : ''}
                  </p>
                </div>
                <span className="font-mono text-[11px] text-slate-400">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDisableAllOpen}
        title="Disable All Student Sections?"
        description="This immediately hides Learning Academy, Books, Cyber Labs, Learn KALI, CTF Arena, Multiplayer Arena, Games Arena, Tournaments, AI Cyber Mentor, Community, and Career Hub from students and blocks non-admin API requests. Home, Profile, Settings, Legal, and Admin Panel stay active."
        confirmLabel="Disable All Sections"
        destructive
        onCancel={() => setConfirmDisableAllOpen(false)}
        onConfirm={() => void handleBulkAction('disable_all')}
      />
    </div>
  );
};
