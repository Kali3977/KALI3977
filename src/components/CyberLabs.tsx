import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  HardDrive,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import labDiagramImg from '../assets/images/academy_lab_diagram_1794688362798.jpg';

interface WalkthroughStep {
  step: number;
  title: string;
  commandExample: string;
  instruction: string;
  expectedObservation: string;
}

interface LabAssessmentPrompt {
  prompt: string;
  artifactLabel: string;
  artifactContent: string;
  options: string[];
}

interface LabItem {
  id: number;
  slug: string;
  category: string;
  title: string;
  description: string;
  difficulty: string;
  objectivesJson: string[];
  hintsJson: string[];
  walkthroughJson: WalkthroughStep[];
  assessmentJson: LabAssessmentPrompt | null;
  timeLimitMinutes: number;
  cpuLimitMilli: number;
  ramLimitMb: number;
  storageLimitMb?: number;
  networkPolicy?: string;
  imageRef?: string;
  isolationBackend: string;
  runnerRequired: boolean;
  verificationRequired: boolean;
  verificationMode: string;
  xpReward: number;
  enabled: boolean;
}

interface LabSessionItem {
  id: number;
  sessionUuid?: string;
  labId: number;
  status: string;
  verified?: boolean;
  xpAwarded?: boolean;
  resetCount: number;
  startedAt: string;
  expiresAt?: string | null;
  completedAt: string | null;
}

export const CyberLabs: React.FC = () => {
  const { user, loginWithGoogle, apiFetch, refreshProfile } = useAuth();
  const [labs, setLabs] = useState<LabItem[]>([]);
  const [sessions, setSessions] = useState<LabSessionItem[]>([]);
  const [runnerConnected, setRunnerConnected] = useState(false);
  const [category, setCategory] = useState('All');
  const [proofInputs, setProofInputs] = useState<Record<number, string>>({});
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const [expandedWalkthrough, setExpandedWalkthrough] = useState<Record<number, boolean>>({});
  const [explanations, setExplanations] = useState<Record<number, string>>({});
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const loadLabs = async () => {
    const res = await apiFetch<{
      labs: LabItem[];
      sessions: LabSessionItem[];
      runnerConnected?: boolean;
    }>('/api/labs');
    setLabs(res.labs || []);
    setSessions(res.sessions || []);
    setRunnerConnected(Boolean(res.runnerConnected));
  };

  useEffect(() => {
    loadLabs().catch((err) => setError(err instanceof Error ? err.message : 'Unable to load labs'));
  }, [user?.id]);

  const categories = ['All', ...Array.from(new Set(labs.map((l) => l.category)))];
  const filtered = category === 'All' ? labs : labs.filter((l) => l.category === category);

  const handleLaunch = async (lab: LabItem) => {
    if (!user) return loginWithGoogle();
    setError(null);
    setStatusNotice(null);
    try {
      const res = await apiFetch<{ message: string }>(`/api/labs/${lab.id}/launch`, {
        method: 'POST',
      });
      setStatusNotice(res.message);
      setExpandedWalkthrough((prev) => ({ ...prev, [lab.id]: true }));
      await loadLabs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to launch lab.');
    }
  };

  const handleReset = async (labId: number) => {
    if (!user) return loginWithGoogle();
    setError(null);
    setStatusNotice(null);
    try {
      await apiFetch(`/api/labs/${labId}/reset`, { method: 'POST' });
      setStatusNotice('Lab session state reset cleanly. Any previously earned XP remains intact.');
      await loadLabs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset lab session.');
    }
  };

  const handleVerify = async (lab: LabItem) => {
    if (!user) return loginWithGoogle();
    setError(null);
    setStatusNotice(null);
    try {
      const payload =
        lab.verificationRequired && lab.verificationMode === 'task_assessment'
          ? { selectedOption: selectedOptions[lab.id] }
          : { token: proofInputs[lab.id] || '' };

      const res = await apiFetch<{
        xpAwarded: number;
        alreadyCompleted?: boolean;
        explanation?: string | null;
      }>(`/api/labs/${lab.id}/verify`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.explanation) {
        setExplanations((prev) => ({ ...prev, [lab.id]: res.explanation! }));
      }
      if (res.alreadyCompleted || res.xpAwarded === 0) {
        setStatusNotice(
          `Practice verified for "${lab.title}". Completion XP was already awarded previously (single-award policy).`,
        );
      } else {
        setStatusNotice(`Lab verified! Awarded +${res.xpAwarded} XP.`);
      }
      await loadLabs();
      await refreshProfile();
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
              100% Free Hands-On Labs ·{' '}
              {runnerConnected
                ? 'External MicroVM Runner Connected'
                : 'Interactive Guided Labs Active · External MicroVM Runner Disconnected'}
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
              Cyber Labs — Hands-On Security &amp; Isolation Training
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Browser-based guided artifact labs run safely right now with step-by-step analysis and
              server-verified assessments. Full container labs isolate student workloads on external
              microVM runners — never inside the production backend.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 border-t border-slate-200 dark:border-slate-800 pt-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-cyan-500" />
              Interactive Browser Labs Ready
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-emerald-500" />
              250m–1000m vCPU limits
            </span>
            <span className="inline-flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-cyan-500" />
              256MB–1024MB RAM caps
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
          const hasAwardedXp = sessions.some((s) => s.labId === lab.id && s.xpAwarded);
          const walkthroughOpen = Boolean(expandedWalkthrough[lab.id]);

          const sessionStatusLabel = !latestSession
            ? lab.runnerRequired && !runnerConnected
              ? 'External MicroVM Runner Not Connected'
              : 'Ready to Start (Free Access)'
            : latestSession.status === 'provision_required'
              ? 'External MicroVM Runner Not Connected'
              : latestSession.status === 'active'
                ? 'Interactive Session Active'
                : latestSession.status === 'terminated'
                  ? 'Terminated by Admin'
                  : 'Completed';

          return (
            <div
              key={lab.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {lab.category} · {lab.difficulty} · {lab.timeLimitMinutes} min · +{lab.xpReward} XP
                  </span>
                  <div className="flex items-center gap-2">
                    {!lab.enabled && (
                      <span className="font-medium text-rose-500">Admin Preview (Disabled)</span>
                    )}
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {hasAwardedXp ? 'Completed · XP Awarded' : 'Completed'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span
                    className={`rounded-md border px-2 py-0.5 font-medium ${
                      lab.runnerRequired
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300'
                        : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300'
                    }`}
                  >
                    {lab.runnerRequired ? 'External MicroVM Sandbox' : 'Interactive Guided Lab'}
                  </span>
                  <span className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-slate-500 dark:text-slate-400">
                    {lab.verificationRequired
                      ? 'Verification Required: YES'
                      : 'Verification Required: NO'}
                  </span>
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

                {lab.walkthroughJson && lab.walkthroughJson.length > 0 && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12]">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedWalkthrough((p) => ({ ...p, [lab.id]: !p[lab.id] }))
                      }
                      className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <span>Guided Walkthrough Steps ({lab.walkthroughJson.length})</span>
                      {walkthroughOpen ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {walkthroughOpen && (
                      <div className="space-y-2.5 border-t border-slate-200 dark:border-slate-800 p-3 text-xs">
                        {lab.walkthroughJson.map((step) => (
                          <div key={step.step} className="space-y-1">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {step.step}. {step.title}
                            </p>
                            <p className="text-slate-600 dark:text-slate-400">{step.instruction}</p>
                            <pre className="overflow-x-auto rounded bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-emerald-400">
                              {step.commandExample}
                            </pre>
                            <p className="text-[11px] text-cyan-600 dark:text-cyan-400">
                              Expected: {step.expectedObservation}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Interactive Task Assessment Artifact & Questions */}
                {lab.verificationRequired &&
                  lab.verificationMode === 'task_assessment' &&
                  lab.assessmentJson && (
                    <div className="space-y-2.5 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
                      <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                        {lab.assessmentJson.artifactLabel}
                      </p>
                      <pre className="overflow-x-auto rounded bg-slate-950 p-2.5 font-mono text-[11px] leading-relaxed text-slate-200">
                        {lab.assessmentJson.artifactContent}
                      </pre>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        {lab.assessmentJson.prompt}
                      </p>
                      <div className="space-y-1.5">
                        {lab.assessmentJson.options.map((opt, idx) => (
                          <label
                            key={opt}
                            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors ${
                              selectedOptions[lab.id] === idx
                                ? 'border-emerald-500 bg-emerald-500/10 text-slate-900 dark:text-slate-100'
                                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`lab-opt-${lab.id}`}
                              checked={selectedOptions[lab.id] === idx}
                              onChange={() =>
                                setSelectedOptions((prev) => ({ ...prev, [lab.id]: idx }))
                              }
                              className="mt-0.5"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                      {explanations[lab.id] && (
                        <p className="rounded bg-emerald-500/10 p-2 text-[11px] text-emerald-600 dark:text-emerald-300">
                          {explanations[lab.id]}
                        </p>
                      )}
                    </div>
                  )}
              </div>

              <div className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono">
                    Quota: {lab.cpuLimitMilli}m CPU / {lab.ramLimitMb}MB RAM
                  </span>
                  <span>Status: {sessionStatusLabel}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleLaunch(lab)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Play className="h-3.5 w-3.5" />
                    {lab.runnerRequired ? 'Request Isolated Lab' : 'Start Interactive Lab'}
                  </button>
                  {latestSession && (
                    <button
                      type="button"
                      onClick={() => void handleReset(lab.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset
                    </button>
                  )}
                </div>

                {!lab.verificationRequired ? (
                  <button
                    type="button"
                    onClick={() => void handleVerify(lab)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {isCompleted
                      ? 'Mark Practice Walkthrough Reviewed'
                      : `Complete Guided Walkthrough (+${lab.xpReward} XP)`}
                  </button>
                ) : lab.verificationMode === 'task_assessment' ? (
                  <button
                    type="button"
                    onClick={() => void handleVerify(lab)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {isCompleted
                      ? 'Re-Verify Assessment Answer'
                      : `Submit Verification & Claim +${lab.xpReward} XP`}
                  </button>
                ) : (
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
                      onClick={() => void handleVerify(lab)}
                      className="rounded-lg border border-cyan-500/40 px-3 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 transition-colors whitespace-nowrap shrink-0"
                    >
                      Verify Proof
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
