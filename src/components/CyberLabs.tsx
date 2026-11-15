import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cpu, HardDrive, Play, RotateCcw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import labDiagramImg from '../assets/images/academy_lab_diagram_1794688362798.jpg';

interface LabItem {
  id: number;
  slug: string;
  category: string;
  title: string;
  description: string;
  difficulty: string;
  objectivesJson: string[];
  hintsJson: string[];
  timeLimitMinutes: number;
  cpuLimitMilli: number;
  ramLimitMb: number;
  isolationBackend: string;
  xpReward: number;
}

interface LabSessionItem {
  id: number;
  labId: number;
  status: string;
  resetCount: number;
  startedAt: string;
  completedAt: string | null;
}

export const CyberLabs: React.FC = () => {
  const { user, loginWithGoogle, apiFetch } = useAuth();
  const [labs, setLabs] = useState<LabItem[]>([]);
  const [sessions, setSessions] = useState<LabSessionItem[]>([]);
  const [category, setCategory] = useState('All');
  const [proofInputs, setProofInputs] = useState<Record<number, string>>({});
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const loadLabs = async () => {
    const res = await apiFetch<{ labs: LabItem[]; sessions: LabSessionItem[] }>('/api/labs');
    setLabs(res.labs);
    setSessions(res.sessions);
  };

  useEffect(() => {
    loadLabs().catch((err) => setError(err instanceof Error ? err.message : 'Unable to load labs'));
  }, [user?.id]);

  const categories = ['All', ...Array.from(new Set(labs.map((l) => l.category)))];
  const filtered = category === 'All' ? labs : labs.filter((l) => l.category === category);

  const handleLaunch = async (labId: number) => {
    if (!user) return loginWithGoogle();
    setError(null);
    const res = await apiFetch<{ message: string }>(`/api/labs/${labId}/launch`, { method: 'POST' });
    setStatusNotice(res.message);
    await loadLabs();
  };

  const handleReset = async (labId: number) => {
    if (!user) return loginWithGoogle();
    await apiFetch(`/api/labs/${labId}/reset`, { method: 'POST' });
    setStatusNotice('Lab session state reset cleanly.');
    await loadLabs();
  };

  const handleVerify = async (labId: number) => {
    if (!user) return loginWithGoogle();
    setError(null);
    try {
      const res = await apiFetch<{ xpAwarded: number }>(`/api/labs/${labId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ token: proofInputs[labId] || '' }),
      });
      setStatusNotice(`Lab verified! Awarded +${res.xpAwarded} XP.`);
      await loadLabs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Architecture & Security Boundary Banner */}
      <div className="grid gap-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">
              MicroVM Isolation Architecture · Requires External Sandbox Runner for Live Execution
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
              Cyber Labs — Isolated Hands-On Training
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Student lab workloads never execute inside the main application backend. Each lab
              enforces per-user network isolation, CPU/RAM quotas, and automatic cleanup on
              dedicated microVM nodes.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 border-t border-slate-200 dark:border-slate-800 pt-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-emerald-500" />
              500m–1000m vCPU limit
            </span>
            <span className="inline-flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-cyan-500" />
              512MB–1024MB RAM cap
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-violet-500" />
              Zero production DB access
            </span>
          </div>
        </div>
        <div className="lg:col-span-5 relative min-h-[180px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          {!imgFailed ? (
            <img
              src={labDiagramImg}
              alt="Isometric diagram of isolated microVM cyber lab nodes and firewall boundaries"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-slate-900 to-cyan-950" />
          )}
        </div>
      </div>

      {statusNotice && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-700 dark:text-cyan-300">
          {statusNotice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-500">
          {error}
        </div>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              category === cat
                ? 'bg-emerald-500 text-slate-950 font-semibold'
                : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] text-slate-600 dark:text-slate-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Lab Cards */}
      <div className="grid gap-5 md:grid-cols-2">
        {filtered.map((lab) => {
          const latestSession = sessions.find((s) => s.labId === lab.id);
          const isCompleted = sessions.some((s) => s.labId === lab.id && s.status === 'completed');

          return (
            <div
              key={lab.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {lab.category} · {lab.difficulty} · {lab.timeLimitMinutes} min · +{lab.xpReward} XP
                  </span>
                  {isCompleted && (
                    <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Completed
                    </span>
                  )}
                </div>
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {lab.title}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">{lab.description}</p>
                <div className="space-y-1 pt-1">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Objectives</p>
                  <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                    {lab.objectivesJson.map((obj) => (
                      <li key={obj}>{obj}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono">
                    Quota: {lab.cpuLimitMilli}m CPU / {lab.ramLimitMb}MB RAM
                  </span>
                  <span>
                    Status:{' '}
                    {latestSession?.status === 'provision_required'
                      ? 'External MicroVM Runner Not Connected (Unavailable)'
                      : latestSession?.status || 'Runner Not Connected (Ready for Token Proof)'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleLaunch(lab.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Request Isolated Lab
                  </button>
                  {latestSession && (
                    <button
                      type="button"
                      onClick={() => handleReset(lab.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={proofInputs[lab.id] || ''}
                    onChange={(e) => setProofInputs((p) => ({ ...p, [lab.id]: e.target.value }))}
                    placeholder="Enter lab verification token (e.g. LAB-PROOF-...)"
                    aria-label={`Verification token for ${lab.title}`}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleVerify(lab.id)}
                    className="rounded-lg border border-cyan-500/40 px-3 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 transition-colors whitespace-nowrap shrink-0"
                  >
                    Verify Proof
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
