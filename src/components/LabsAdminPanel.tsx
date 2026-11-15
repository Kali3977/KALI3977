import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AdminLabRecord {
  id: number;
  slug: string;
  category: string;
  title: string;
  difficulty: string;
  timeLimitMinutes: number;
  cpuLimitMilli: number;
  ramLimitMb: number;
  storageLimitMb: number;
  networkPolicy: string;
  imageRef: string;
  isolationBackend: string;
  runnerRequired: boolean;
  verificationRequired: boolean;
  verificationMode: string;
  xpReward: number;
  enabled: boolean;
  published: boolean;
}

interface AdminLabSessionRecord {
  id: number;
  sessionUuid: string;
  labId: number;
  labTitle: string;
  labSlug: string;
  userId: number;
  username: string;
  userEmail: string;
  status: string;
  verified: boolean;
  xpAwarded: boolean;
  startedAt: string;
  expiresAt: string | null;
  completedAt: string | null;
  terminatedAt: string | null;
  resetCount: number;
  failureReason: string | null;
}

export const LabsAdminPanel: React.FC = () => {
  const { apiFetch } = useAuth();
  const [runnerConnected, setRunnerConnected] = useState(false);
  const [labs, setLabs] = useState<AdminLabRecord[]>([]);
  const [sessions, setSessions] = useState<AdminLabSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        runnerConnected: boolean;
        labs: AdminLabRecord[];
        sessions: AdminLabSessionRecord[];
      }>('/api/admin/labs');
      setRunnerConnected(Boolean(res.runnerConnected));
      setLabs(res.labs || []);
      setSessions(res.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load lab administration data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const updateLabFlag = async (
    lab: AdminLabRecord,
    patch: Partial<Pick<AdminLabRecord, 'enabled' | 'verificationRequired'>>,
  ) => {
    setBusyId(`lab-${lab.id}`);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/admin/labs/${lab.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setNotice(`Updated settings for "${lab.title}".`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lab configuration.');
    } finally {
      setBusyId(null);
    }
  };

  const terminateSession = async (session: AdminLabSessionRecord) => {
    setBusyId(`sess-${session.id}`);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/admin/labs/sessions/${session.id}/terminate`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Terminated by administrator from Cyber Labs Ops.' }),
      });
      setNotice(`Terminated session #${session.id} (${session.username}).`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to terminate lab session.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Runner Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            Cyber Labs Operations &amp; Verification Policy
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Toggle per-lab availability and Completion Verification Required (YES / NO), inspect
            sandbox limits, and terminate active sessions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${
              runnerConnected
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            {runnerConnected
              ? 'External MicroVM Runner Connected'
              : 'External MicroVM Runner Not Connected'}
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-500">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-500">
          {error}
        </div>
      )}

      {/* Per-Lab Controls */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Lab Catalog &amp; Verification Rules ({labs.length})
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Single-XP-Award enforced server-side per user/lab
          </span>
        </div>

        <div className="space-y-3">
          {labs.map((lab) => {
            const busy = busyId === `lab-${lab.id}`;
            return (
              <div
                key={lab.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {lab.title}
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      ({lab.slug})
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>{lab.category} · {lab.difficulty}</span>
                    <span>+{lab.xpReward} XP</span>
                    <span className="inline-flex items-center gap-1">
                      {lab.runnerRequired ? (
                        <>
                          <Cpu className="h-3 w-3 text-amber-500" />
                          MicroVM Runner ({lab.cpuLimitMilli}m / {lab.ramLimitMb}MB)
                        </>
                      ) : (
                        <>
                          <Terminal className="h-3 w-3 text-cyan-500" />
                          Interactive Guided ({lab.verificationMode})
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void updateLabFlag(lab, { verificationRequired: !lab.verificationRequired })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      lab.verificationRequired
                        ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verification Required: {lab.verificationRequired ? 'YES' : 'NO'}
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void updateLabFlag(lab, { enabled: !lab.enabled })}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      lab.enabled
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                        : 'border-rose-500/40 bg-rose-500/10 text-rose-500'
                    }`}
                  >
                    {lab.enabled ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Enabled
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5" />
                        Disabled
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent & Active Lab Sessions */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Recent Lab Sessions ({sessions.length})
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Audited session &amp; XP award ledger
          </span>
        </div>

        {sessions.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">No lab sessions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Learner</th>
                  <th className="py-2 pr-3 font-medium">Lab</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">XP Awarded</th>
                  <th className="py-2 pr-3 font-medium">Started</th>
                  <th className="py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {sessions.map((s) => {
                  const canTerminate = !['completed', 'terminated'].includes(s.status);
                  return (
                    <tr key={s.id}>
                      <td className="py-2.5 pr-3">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {s.username}
                        </span>
                        <span className="block text-[11px] text-slate-500">{s.userEmail}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-300">
                        {s.labTitle}
                      </td>
                      <td className="py-2.5 pr-3 font-mono">{s.status}</td>
                      <td className="py-2.5 pr-3">
                        {s.xpAwarded ? (
                          <span className="text-emerald-500 font-medium">Yes</span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-500">
                        {new Date(s.startedAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right">
                        {canTerminate ? (
                          <button
                            type="button"
                            disabled={busyId === `sess-${s.id}`}
                            onClick={() => void terminateSession(s)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 px-2.5 py-1 text-[11px] font-medium text-rose-500 hover:bg-rose-500/10"
                          >
                            <ShieldAlert className="h-3 w-3" />
                            Terminate
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
