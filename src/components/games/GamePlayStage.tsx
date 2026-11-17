import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  HelpCircle,
  Lock,
  Search,
  Shield,
  Skull,
  Terminal,
  Unlock,
} from 'lucide-react';
import type { RoomSnapshot } from './types';

interface Props {
  snapshot: RoomSnapshot;
  currentUserId: number | null;
  submitting: boolean;
  onAction: (eventType: string, payload: Record<string, unknown>) => Promise<void>;
}

export const GamePlayStage: React.FC<Props> = ({
  snapshot,
  currentUserId,
  submitting,
  onAction,
}) => {
  const session = snapshot.session;
  const state = (session?.state || {}) as Record<string, unknown>;
  const engineType = String(state.engineType || snapshot.game.engineType);
  const completed = session?.status === 'completed';

  // Battle / Puzzle local inputs
  const [answerById, setAnswerById] = useState<Record<string, string>>({});

  // Investigation form
  const [suspect, setSuspect] = useState('');
  const [vector, setVector] = useState('');
  const [remediation, setRemediation] = useState('');

  // Strategy wave allocation
  const [fwAlloc, setFwAlloc] = useState(15);
  const [idsAlloc, setIdsAlloc] = useState(10);
  const [patchAlloc, setPatchAlloc] = useState(10);
  const [decepAlloc, setDecepAlloc] = useState(5);

  // Social task answer selector
  const [socialOptions, setSocialOptions] = useState<Record<string, number>>({});
  const [sabotageSystem, setSabotageSystem] = useState('Auth Gateway');

  if (!session) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 text-sm text-slate-500">
        Match session has not started yet.
      </div>
    );
  }

  // =========================================================================
  // 1. SOCIAL DEDUCTION (Hacker Among Us, Spy Network, Campus Mafia, etc.)
  // =========================================================================
  if (engineType === 'social_deduction') {
    const myRole = String(state.myRole || 'spectator');
    const phase = String(state.phase || 'tasks');
    const roster = (state.roster || []) as Array<{ id: number; displayName: string; username: string; isBot?: boolean }>;
    const aliveIds = (state.aliveIds || []) as number[];
    const ejectedIds = (state.ejectedIds || []) as number[];
    const revealedRoles = (state.revealedRoles || {}) as Record<string, string>;
    const tasksCompleted = Number(state.tasksCompleted || 0);
    const taskTarget = Number(state.taskTarget || 4);
    const sabotagesTriggered = Number(state.sabotagesTriggered || 0);
    const sabotageTarget = Number(state.sabotageTarget || 3);
    const completedTaskIds = (state.completedTaskIds || []) as string[];
    const availableTasks = (state.availableTasks || []) as Array<{
      id: string;
      title: string;
      prompt: string;
      options: string[];
    }>;
    const votes = (state.votes || {}) as Record<string, string | number>;
    const winnerTeam = state.winnerTeam as string | null;
    const timeline = (state.timeline || []) as string[];
    const amAlive = currentUserId ? aliveIds.includes(currentUserId) : false;

    return (
      <div className="space-y-5">
        {/* Role & Progress HUD */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4">
            <p className="text-xs text-slate-500">Assigned Secret Role</p>
            <p
              className={`mt-1 font-display text-lg font-bold uppercase ${
                myRole === 'hacker' ? 'text-rose-500' : 'text-emerald-500'
              }`}
            >
              {myRole === 'hacker' ? 'Infiltrator / Hacker' : myRole === 'defender' ? 'SOC Defender' : 'Spectator'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {amAlive ? 'Status: Active in cluster' : 'Status: Ejected'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Security Tasks Completed</span>
              <span className="font-mono font-semibold text-emerald-500 tabular-nums">
                {tasksCompleted} / {taskTarget}
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(100, Math.round((tasksCompleted / Math.max(1, taskTarget)) * 100))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">Phase: {phase.toUpperCase()}</p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Critical Sabotages</span>
              <span className="font-mono font-semibold text-rose-500 tabular-nums">
                {sabotagesTriggered} / {sabotageTarget}
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-all"
                style={{ width: `${Math.min(100, Math.round((sabotagesTriggered / Math.max(1, sabotageTarget)) * 100))}%` }}
              />
            </div>
            {!completed && phase === 'tasks' && amAlive && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void onAction('call_meeting', {})}
                className="mt-2 w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-500 hover:bg-amber-500/20 disabled:opacity-50"
              >
                Call Emergency Meeting
              </button>
            )}
          </div>
        </div>

        {winnerTeam && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-400">
            Match Concluded — Winning Faction: {winnerTeam.toUpperCase()}
          </div>
        )}

        {/* Phase-specific Interactive Panel */}
        {!completed && phase === 'tasks' && amAlive && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
            {myRole === 'hacker' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-rose-500">
                  <Skull className="h-4 w-4" />
                  <h3 className="font-display text-sm font-semibold">Covert Sabotage Console</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Trigger sabotages to reach {sabotageTarget} critical disruptions before defenders complete tasks or eject you.
                </p>
                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label="Sabotage target system"
                    value={sabotageSystem}
                    onChange={(e) => setSabotageSystem(e.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
                  >
                    <option value="Auth Gateway">Auth Gateway</option>
                    <option value="SIEM Telemetry Pipeline">SIEM Telemetry Pipeline</option>
                    <option value="DNS Egress Filter">DNS Egress Filter</option>
                    <option value="Key Vault Cluster">Key Vault Cluster</option>
                  </select>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void onAction('sabotage', { system: sabotageSystem })}
                    className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-400 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    Execute Sabotage (8s cooldown)
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-500">
                  <Shield className="h-4 w-4" />
                  <h3 className="font-display text-sm font-semibold">Cluster Security Hardening Tasks</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {availableTasks.map((task) => {
                    const isDone = completedTaskIds.includes(task.id);
                    const picked = socialOptions[task.id] ?? 0;
                    return (
                      <div
                        key={task.id}
                        className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold">{task.title}</span>
                          {isDone && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{task.prompt}</p>
                        {!isDone && (
                          <div className="space-y-2">
                            <select
                              aria-label={`Select action for ${task.title}`}
                              value={picked}
                              onChange={(e) =>
                                setSocialOptions((prev) => ({ ...prev, [task.id]: Number(e.target.value) }))
                              }
                              className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#11161F] px-2.5 py-1.5 text-xs"
                            >
                              {task.options.map((opt, idx) => (
                                <option key={opt} value={idx}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() =>
                                void onAction('complete_task', { taskId: task.id, selectedOption: picked })
                              }
                              className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                            >
                              Verify &amp; Apply Fix
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Emergency Meeting Voting Board */}
        {!completed && phase === 'meeting' && (
          <div className="rounded-xl border border-amber-500/40 bg-white dark:bg-[#11161F] p-5 space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              <h3 className="font-display text-sm font-semibold">
                Emergency Tribunal — Cast Ejection Vote (Round {String(state.roundNumber || 1)})
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Use the room chat to debate anomalies, then select one suspect to eject or skip vote.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {roster.map((op) => {
                const isAlive = aliveIds.includes(op.id);
                const myVoted = currentUserId && votes[String(currentUserId)] === op.id;
                return (
                  <button
                    key={op.id}
                    type="button"
                    disabled={!isAlive || !amAlive || submitting}
                    onClick={() => void onAction('cast_vote', { targetId: op.id })}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors ${
                      myVoted
                        ? 'border-amber-500 bg-amber-500/15 text-amber-400 font-semibold'
                        : isAlive
                          ? 'border-slate-200 dark:border-slate-800 hover:border-amber-500/50'
                          : 'border-slate-200 dark:border-slate-800 opacity-45 line-through'
                    }`}
                  >
                    <span className="truncate">{op.displayName}</span>
                    <span className="font-mono text-[11px]">{isAlive ? 'Vote' : 'Ejected'}</span>
                  </button>
                );
              })}
              <button
                type="button"
                disabled={!amAlive || submitting}
                onClick={() => void onAction('cast_vote', { targetId: 'skip' })}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Skip Vote
              </button>
            </div>
          </div>
        )}

        {/* Roster & Event Feed */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operator Roster</h4>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {roster.map((op) => {
                const ejected = ejectedIds.includes(op.id);
                const knownRole = revealedRoles[String(op.id)];
                return (
                  <div key={op.id} className="flex items-center justify-between py-2">
                    <span className={ejected ? 'line-through text-slate-500' : 'font-medium'}>
                      {op.displayName}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {knownRole ? knownRole.toUpperCase() : ejected ? 'EJECTED' : 'ACTIVE'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Match Telemetry Log</h4>
            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 max-h-48 overflow-y-auto">
              {timeline.slice(-10).map((entry, idx) => (
                <li key={idx} className="font-mono text-[11px]">
                  {entry}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. CYBER BATTLE & SKILL/SPEED ENGINE (Cyber CTF Battle, Terminal Rush...)
  // =========================================================================
  if (engineType === 'cyber_battle') {
    const questions = (state.questions || []) as Array<{
      id: string;
      title: string;
      category: string;
      prompt: string;
      artifact: string;
      points: number;
      hint: string | null;
      explanation: string | null;
    }>;
    const myProg = (state.myProgress || {
      solvedIds: [],
      hintsUsedIds: [],
      score: 0,
      finished: false,
    }) as { solvedIds: string[]; hintsUsedIds: string[]; score: number; finished: boolean };

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 text-xs">
          <span>
            Solved Rounds:{' '}
            <strong className="font-mono text-emerald-500 tabular-nums">
              {myProg.solvedIds.length} / {questions.length}
            </strong>
          </span>
          <span>
            Session Score:{' '}
            <strong className="font-mono text-cyan-500 tabular-nums">{myProg.score} pts</strong>
          </span>
        </div>

        <div className="space-y-4">
          {questions.map((q, idx) => {
            const solved = myProg.solvedIds.includes(q.id);
            return (
              <div
                key={q.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 sm:p-5 space-y-3 min-w-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Terminal className="h-4 w-4 text-emerald-500 shrink-0" />
                    <h3 className="font-display text-sm font-semibold break-words min-w-0">
                      Round {idx + 1}: {q.title}
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-cyan-500 tabular-nums">
                    {q.category} · {q.points} pts {solved ? '· SOLVED' : ''}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 break-words">{q.prompt}</p>
                <pre className="w-full max-w-full overflow-x-auto whitespace-pre rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 p-3 font-mono text-xs text-emerald-400">
                  {q.artifact}
                </pre>

                {q.hint && (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                    Hint: {q.hint}
                  </p>
                )}

                {q.explanation && (
                  <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                    Verified: {q.explanation}
                  </p>
                )}

                {!solved && !completed && (
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={answerById[q.id] || ''}
                      onChange={(e) => setAnswerById((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Enter flag, command, or exact remediation..."
                      aria-label={`Answer for ${q.title}`}
                      className="w-full sm:flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono text-xs"
                    />
                    <button
                      type="button"
                      disabled={submitting || !(answerById[q.id] || '').trim()}
                      onClick={() =>
                        void onAction('submit_answer', {
                          questionId: q.id,
                          answer: answerById[q.id] || '',
                        })
                      }
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      Verify
                    </button>
                    {!q.hint && (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void onAction('request_hint', { questionId: q.id })}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        Hint (-25)
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. INVESTIGATION / MYSTERY ENGINE (Cyber Detective, etc.)
  // =========================================================================
  if (engineType === 'investigation') {
    const caseInfo = (state.caseInfo || {}) as {
      caseCode: string;
      title: string;
      briefing: string;
      suspectOptions: string[];
      vectorOptions: string[];
      remediationOptions: string[];
      exhibits: Array<{
        id: string;
        label: string;
        source: string;
        clueCost: number;
        isClue: boolean;
        locked: boolean;
        content: string;
      }>;
      resolutionSummary: string | null;
    };
    const mySubmission = state.mySubmission as {
      suspect: string;
      vector: string;
      remediation: string;
      accuracyPct: number;
      score: number;
    } | null;

    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-2">
          <p className="font-mono text-xs text-cyan-500">{caseInfo.caseCode}</p>
          <h3 className="font-display text-lg font-semibold">{caseInfo.title}</h3>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{caseInfo.briefing}</p>
        </div>

        {/* Forensic Evidence Board */}
        <div className="grid gap-4 md:grid-cols-2">
          {(caseInfo.exhibits || []).map((ex) => (
            <div
              key={ex.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 space-y-2 min-w-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold min-w-0">
                  <Search className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                  <span className="break-words">{ex.label}</span>
                </span>
                <span className="font-mono text-[11px] text-slate-500">{ex.source}</span>
              </div>
              <pre className="w-full max-w-full overflow-x-auto whitespace-pre rounded-lg bg-slate-950 p-3 font-mono text-[11px] text-slate-200">
                {ex.content}
              </pre>
              {ex.locked && !completed && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void onAction('unlock_clue', { exhibitId: ex.id })}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/20"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Unlock Deeper Forensic Clue
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Final Verdict Filing */}
        {mySubmission ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 space-y-2 text-xs">
            <p className="font-semibold text-emerald-400">
              Case Verdict Filed · Accuracy: {mySubmission.accuracyPct}% · Score: {mySubmission.score} pts
            </p>
            {caseInfo.resolutionSummary && (
              <p className="text-slate-300">{caseInfo.resolutionSummary}</p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
            <h4 className="font-display text-sm font-semibold">Submit Forensic Attribution Verdict</h4>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Primary Suspect</label>
                <select
                  aria-label="Primary Suspect"
                  value={suspect || caseInfo.suspectOptions?.[0] || ''}
                  onChange={(e) => setSuspect(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
                >
                  {(caseInfo.suspectOptions || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Attack / Breach Vector</label>
                <select
                  aria-label="Attack Vector"
                  value={vector || caseInfo.vectorOptions?.[0] || ''}
                  onChange={(e) => setVector(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
                >
                  {(caseInfo.vectorOptions || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Containment Action</label>
                <select
                  aria-label="Containment Action"
                  value={remediation || caseInfo.remediationOptions?.[0] || ''}
                  onChange={(e) => setRemediation(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
                >
                  {(caseInfo.remediationOptions || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              disabled={submitting}
              onClick={() =>
                void onAction('submit_case', {
                  suspect: suspect || caseInfo.suspectOptions?.[0],
                  vector: vector || caseInfo.vectorOptions?.[0],
                  remediation: remediation || caseInfo.remediationOptions?.[0],
                })
              }
              className="rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              Submit Final Verdict
            </button>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 4. STRATEGY & SURVIVAL ENGINE (Cyber War, Build Your Firewall, etc.)
  // =========================================================================
  if (engineType === 'strategy_survival') {
    const waves = (state.waves || []) as Array<{
      wave: number;
      threatName: string;
      threatType: string;
      severity: number;
      briefing: string;
    }>;
    const myState = (state.myState || {
      waveIndex: 0,
      integrity: 100,
      budget: 100,
      score: 0,
      completed: false,
      failed: false,
      waveHistory: [],
    }) as {
      waveIndex: number;
      integrity: number;
      budget: number;
      score: number;
      completed: boolean;
      failed: boolean;
      waveHistory: Array<{
        wave: number;
        threatName: string;
        mitigatedPct: number;
        damageTaken: number;
        integrityAfter: number;
      }>;
    };
    const currentWave = waves[myState.waveIndex];
    const totalAlloc = fwAlloc + idsAlloc + patchAlloc + decepAlloc;

    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4">
            <p className="text-xs text-slate-500">System Integrity</p>
            <p className="mt-1 font-display text-2xl font-bold text-emerald-500 tabular-nums">
              {myState.integrity}%
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4">
            <p className="text-xs text-slate-500">Defense Energy Credits</p>
            <p className="mt-1 font-display text-2xl font-bold text-cyan-500 tabular-nums">
              {myState.budget}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4">
            <p className="text-xs text-slate-500">Wave Progress</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">
              {Math.min(myState.waveIndex + 1, waves.length)} / {waves.length}
            </p>
          </div>
        </div>

        {currentWave && !myState.completed && !myState.failed && !completed ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
            <div>
              <p className="font-mono text-xs text-amber-500">
                Wave {currentWave.wave} · Threat Severity {currentWave.severity}
              </p>
              <h3 className="font-display text-base font-semibold">{currentWave.threatName}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{currentWave.briefing}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
              {[
                { label: 'Perimeter Firewall', val: fwAlloc, set: setFwAlloc },
                { label: 'IDS / NDR Sensors', val: idsAlloc, set: setIdsAlloc },
                { label: 'Hot-Patching', val: patchAlloc, set: setPatchAlloc },
                { label: 'Deception / HoneyPots', val: decepAlloc, set: setDecepAlloc },
              ].map((ctrl) => (
                <div key={ctrl.label} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span>{ctrl.label}</span>
                    <span className="font-mono text-cyan-500 tabular-nums">{ctrl.val}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={ctrl.val}
                    onChange={(e) => ctrl.set(Number(e.target.value))}
                    aria-label={ctrl.label}
                    className="w-full accent-emerald-500"
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-xs text-slate-500">
                Total Allocation: {totalAlloc} / {myState.budget} credits
              </span>
              <button
                type="button"
                disabled={submitting || totalAlloc <= 0 || totalAlloc > myState.budget}
                onClick={() =>
                  void onAction('deploy_wave', {
                    firewall: fwAlloc,
                    ids: idsAlloc,
                    patching: patchAlloc,
                    deception: decepAlloc,
                  })
                }
                className="rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                Deploy Wave Defense
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-400">
            {myState.failed
              ? 'System integrity depleted — campaign ended.'
              : `Defense Campaign Complete! Final Integrity: ${myState.integrity}% · Score: ${myState.score} pts`}
          </div>
        )}

        {myState.waveHistory.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Wave Mitigation History</h4>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {myState.waveHistory.map((h) => (
                <div key={h.wave} className="flex items-center justify-between py-2">
                  <span>
                    Wave {h.wave}: {h.threatName}
                  </span>
                  <span className="font-mono tabular-nums text-cyan-500">
                    {h.mitigatedPct}% mitigated · -{h.damageTaken}% dmg · {h.integrityAfter}% HP
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 5. ADVENTURE & PUZZLE ENGINE (Cyber Escape Room, Decode The Message...)
  // =========================================================================
  const locks = (state.locks || []) as Array<{
    lockNumber: number;
    title: string;
    cipherType: string;
    points: number;
    status: 'unlocked' | 'active' | 'sealed';
    prompt: string;
    artifact: string | null;
    hint: string | null;
  }>;

  return (
    <div className="space-y-4">
      {locks.map((lock) => (
        <div
          key={lock.lockNumber}
          className={`rounded-xl border p-5 space-y-3 ${
            lock.status === 'unlocked'
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : lock.status === 'active'
                ? 'border-cyan-500/50 bg-white dark:bg-[#11161F]'
                : 'border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#11161F]/50 opacity-65'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {lock.status === 'unlocked' ? (
                <Unlock className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : (
                <Lock className="h-4 w-4 text-cyan-500 shrink-0" />
              )}
              <h3 className="font-display text-sm font-semibold break-words min-w-0">{lock.title}</h3>
            </div>
            <span className="font-mono text-xs text-slate-400">
              {lock.cipherType} · {lock.points} pts · {lock.status.toUpperCase()}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 break-words">{lock.prompt}</p>
          {lock.artifact && (
            <pre className="w-full max-w-full overflow-x-auto whitespace-pre rounded-lg bg-slate-950 p-3 font-mono text-xs text-cyan-400">
              {lock.artifact}
            </pre>
          )}
          {lock.hint && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              Hint: {lock.hint}
            </p>
          )}

          {lock.status === 'active' && !completed && (
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={answerById[String(lock.lockNumber)] || ''}
                onChange={(e) =>
                  setAnswerById((prev) => ({ ...prev, [String(lock.lockNumber)]: e.target.value }))
                }
                placeholder="Enter decrypted lock keycode..."
                aria-label={`Lock ${lock.lockNumber} keycode`}
                className="w-full sm:flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono text-xs"
              />
              <button
                type="button"
                disabled={submitting || !(answerById[String(lock.lockNumber)] || '').trim()}
                onClick={() =>
                  void onAction('submit_lock', {
                    lockNumber: lock.lockNumber,
                    answer: answerById[String(lock.lockNumber)] || '',
                  })
                }
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                Unlock Chamber
              </button>
              {!lock.hint && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void onAction('request_hint', { lockNumber: lock.lockNumber })}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hint (-25)
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
