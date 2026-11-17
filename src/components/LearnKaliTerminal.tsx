import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  History,
  Info,
  ListChecks,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Terminal as TerminalIcon,
} from 'lucide-react';
import {
  createDefaultSimulatorState,
  executeSimulatedCommand,
  SUPPORTED_SIMULATOR_COMMANDS,
  type FlagExplanation,
  type SimulatedCommandResult,
  type SimulatorState,
} from '../lib/kali/simulator';

interface TerminalEntry {
  id: number;
  cwd: string;
  command: string;
  output: string;
  exitCode: number;
  breakdown: FlagExplanation[];
  coachingHint: string | null;
  safetyBlocked?: boolean;
}

interface LearnKaliTerminalProps {
  initialCommand?: string;
  suggestedCommands?: string[];
  externalRunTrigger?: { nonce: number; command: string } | null;
  runnerStatus?: { configured: boolean; connected?: boolean; label: string; provider?: string } | null;
  onCommandExecuted?: (command: string, result: SimulatedCommandResult) => void;
  title?: string;
  compact?: boolean;
}

const DEFAULT_STARTERS = [
  'help',
  'ls -la',
  'sudo apt update && sudo apt install -y whois',
  'whois kali.org',
  'nmap -sV -sC 192.168.56.10',
  'gobuster dir -u http://app.lab.local -w /home/kali/wordlists/common.txt',
  'tshark -r /home/kali/captures/dns_tunnel.pcap',
  'grep "Accepted" /home/kali/evidence/auth.log',
];

function createInitialEntries(): TerminalEntry[] {
  const initialState = createDefaultSimulatorState();
  const intro = executeSimulatedCommand('cat README.txt', initialState);
  return [
    {
      id: 0,
      cwd: '/home/kali',
      command: 'cat README.txt',
      output: intro.output,
      exitCode: 0,
      breakdown: [{ token: 'cat', meaning: 'Read synthetic welcome file' }],
      coachingHint: 'Run any suggested command below or type `help`. Zero host commands are executed.',
    },
  ];
}

export const LearnKaliTerminal: React.FC<LearnKaliTerminalProps> = ({
  initialCommand = '',
  suggestedCommands = DEFAULT_STARTERS,
  externalRunTrigger = null,
  runnerStatus = null,
  onCommandExecuted,
  title = 'Interactive Educational Terminal (Browser Simulator)',
  compact = false,
}) => {
  const [simState, setSimState] = useState<SimulatorState>(() => createDefaultSimulatorState());
  const [input, setInput] = useState(initialCommand);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [entries, setEntries] = useState<TerminalEntry[]>(() => createInitialEntries());
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showCommandsDrawer, setShowCommandsDrawer] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeBreakdown, setActiveBreakdown] = useState<{
    breakdown: FlagExplanation[];
    hint: string | null;
  }>({
    breakdown: [],
    hint: 'Click a command chip or type a Linux/Kali command to see flag-by-flag explanations.',
  });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bufferRef = useRef<HTMLDivElement | null>(null);
  const simStateRef = useRef<SimulatorState>(simState);
  simStateRef.current = simState;

  const copyText = (key: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
    setCopiedId(key);
    setTimeout(() => setCopiedId((cur) => (cur === key ? null : cur)), 1400);
  };

  const runCommand = (rawCmd: string) => {
    const trimmed = rawCmd.trim();
    if (!trimmed) return;

    const currentState = simStateRef.current;
    const result = executeSimulatedCommand(trimmed, currentState);
    const nextHistory = [trimmed, ...currentState.history].slice(0, 50);
    const updatedState: SimulatorState = result.nextState
      ? {
          ...result.nextState,
          cwd: result.nextCwd,
          history: nextHistory,
        }
      : {
          ...currentState,
          cwd: result.nextCwd,
          history: nextHistory,
        };
    simStateRef.current = updatedState;
    setSimState(updatedState);

    if (result.clearScreen) {
      setEntries([]);
      setInput('');
      setHistoryIdx(-1);
      onCommandExecuted?.(trimmed, result);
      return;
    }

    const nextEntry: TerminalEntry = {
      id: Date.now() + Math.floor(Math.random() * 10000),
      cwd: currentState.cwd,
      command: trimmed,
      output: result.output,
      exitCode: result.exitCode,
      breakdown: result.commandBreakdown,
      coachingHint: result.coachingHint,
      safetyBlocked: result.safetyBlocked,
    };

    setEntries((prev) => [...prev, nextEntry]);
    setActiveBreakdown({
      breakdown: result.commandBreakdown,
      hint: result.coachingHint,
    });
    setHistoryIdx(-1);
    setInput('');
    onCommandExecuted?.(trimmed, result);

    requestAnimationFrame(() => {
      if (bufferRef.current) {
        bufferRef.current.scrollTop = bufferRef.current.scrollHeight;
      }
    });
  };

  useEffect(() => {
    if (externalRunTrigger?.command) {
      runCommand(externalRunTrigger.command);
      requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true });
      });
    }
  }, [externalRunTrigger?.nonce]);

  const handleResetEnvironment = () => {
    const fresh = createDefaultSimulatorState();
    simStateRef.current = fresh;
    setSimState(fresh);
    setEntries(createInitialEntries());
    setInput('');
    setHistoryIdx(-1);
    setActiveBreakdown({
      breakdown: [],
      hint: 'Sandbox environment reset: virtual files, directories, and installed packages restored to clean defaults.',
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const hist = simState.history;
    if (e.key === 'Enter') {
      e.preventDefault();
      runCommand(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hist.length === 0) return;
      const nextIdx = Math.min(hist.length - 1, historyIdx + 1);
      setHistoryIdx(nextIdx);
      setInput(hist[nextIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx <= 0) {
        setHistoryIdx(-1);
        setInput('');
      } else {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setInput(hist[nextIdx] || '');
      }
    }
  };

  return (
    <div className="space-y-3 min-w-0 max-w-full">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[#070B11] text-slate-100 overflow-hidden shadow-sm min-w-0 max-w-full">
        {/* Terminal Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#0D131D] px-3 sm:px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <TerminalIcon className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-slate-100 truncate">{title}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-300">
              {runnerStatus?.configured && runnerStatus?.connected
                ? 'MicroVM Connected'
                : 'Browser Educational Simulator'}
            </span>
            <button
              type="button"
              onClick={() => setShowCommandsDrawer((v) => !v)}
              className="inline-flex items-center gap-1 rounded border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800 min-h-[32px]"
            >
              <ListChecks className="h-3 w-3 text-emerald-400 shrink-0" />
              <span>Commands</span>
            </button>
            <button
              type="button"
              onClick={() => setShowHistoryDrawer((v) => !v)}
              className="inline-flex items-center gap-1 rounded border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800 min-h-[32px]"
            >
              <History className="h-3 w-3 text-cyan-400 shrink-0" />
              <span>History ({simState.history.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setEntries([])}
              className="inline-flex items-center gap-1 rounded border border-slate-700 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800 min-h-[32px]"
            >
              <RotateCcw className="h-3 w-3 shrink-0" />
              <span>Clear</span>
            </button>
            <button
              type="button"
              onClick={handleResetEnvironment}
              className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-300 hover:bg-amber-500/20 min-h-[32px]"
            >
              <RefreshCw className="h-3 w-3 shrink-0" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Supported Commands Drawer */}
        {showCommandsDrawer && (
          <div className="border-b border-slate-800 bg-[#0A1019] px-4 py-3 text-xs space-y-2 max-h-56 overflow-y-auto">
            <p className="font-semibold text-emerald-400">
              Supported Educational Simulator Commands ({SUPPORTED_SIMULATOR_COMMANDS.length} groups)
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {SUPPORTED_SIMULATOR_COMMANDS.map((item) => (
                <div
                  key={item.command}
                  className="flex items-start justify-between gap-2 rounded border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-mono font-semibold text-cyan-300 [overflow-wrap:anywhere]">{item.command}</span>
                    <p className="text-[11px] text-slate-400 break-words">{item.summary}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">{item.category}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Command History Drawer */}
        {showHistoryDrawer && (
          <div className="border-b border-slate-800 bg-[#0A1019] px-4 py-3 text-xs space-y-2 max-h-48 overflow-y-auto">
            <p className="font-semibold text-cyan-400">Recent Session Commands</p>
            {simState.history.length === 0 ? (
              <p className="text-slate-400">No commands entered yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 min-w-0">
                {simState.history.map((cmd, idx) => (
                  <button
                    key={`${cmd}-${idx}`}
                    type="button"
                    onClick={() => runCommand(cmd)}
                    className="max-w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[11px] text-emerald-300 hover:border-emerald-500 text-left [overflow-wrap:anywhere]"
                  >
                    $ {cmd}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Starter / Practice Command Chips */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-800/80 bg-[#090E16] px-3 sm:px-4 py-2">
          {Array.from(new Set(suggestedCommands)).map((cmd, idx) => (
            <button
              key={`${cmd}-${idx}`}
              type="button"
              onClick={() => {
                setInput(cmd);
                runCommand(cmd);
              }}
              className="max-w-full rounded border border-slate-700 bg-slate-900/90 px-2.5 py-1.5 font-mono text-[11px] text-emerald-300 hover:border-emerald-500/50 hover:bg-slate-800 transition-colors text-left whitespace-normal break-words"
            >
              $ {cmd}
            </button>
          ))}
        </div>

        {/* Output Buffer */}
        <div
          ref={bufferRef}
          onClick={() => inputRef.current?.focus()}
          className={`${compact ? 'max-h-[260px]' : 'max-h-[380px]'} min-h-[190px] overflow-y-auto px-3 sm:px-4 py-3 font-mono text-xs space-y-3 cursor-text min-w-0`}
        >
          {entries.map((entry) => (
            <div key={entry.id} className="space-y-1 group min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-emerald-400 font-semibold">kali@kali3977</span>
                  <span className="text-slate-500">:</span>
                  <span className="text-cyan-400">{entry.cwd}</span>
                  <span className="text-slate-400">$</span>
                  <span className="text-slate-100 [overflow-wrap:anywhere]">{entry.command}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyText(`cmd-${entry.id}`, entry.command);
                    }}
                    className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-200"
                    title="Copy command"
                  >
                    {copiedId === `cmd-${entry.id}` ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                    Cmd
                  </button>
                  {entry.output && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyText(`out-${entry.id}`, entry.output);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-200"
                      title="Copy output"
                    >
                      {copiedId === `out-${entry.id}` ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                      Output
                    </button>
                  )}
                </div>
              </div>
              {entry.output && (
                <pre
                  className={`max-w-full overflow-x-auto whitespace-pre-wrap break-words pl-1 leading-relaxed ${
                    entry.safetyBlocked
                      ? 'text-amber-300'
                      : entry.exitCode !== 0
                        ? 'text-rose-400'
                        : 'text-slate-300'
                  }`}
                >
                  {entry.output}
                </pre>
              )}
            </div>
          ))}
        </div>

        {/* Command Input Prompt */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 border-t border-slate-800 bg-[#0B1018] px-3 sm:px-4 py-2.5 font-mono text-xs min-w-0">
          <span className="text-emerald-400 font-semibold shrink-0 max-w-full sm:max-w-[230px] truncate">
            kali@kali3977:{simState.cwd}$
          </span>
          <div className="flex items-center gap-2 min-w-0 flex-1 w-full sm:w-auto">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type command (e.g. help, whois kali.org)..."
              aria-label="Simulated Kali terminal command input"
              className="min-w-0 flex-1 min-h-[36px] bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => runCommand(input)}
              className="inline-flex items-center gap-1 rounded bg-emerald-500 px-3 py-1.5 font-sans text-xs font-semibold text-slate-950 hover:bg-emerald-400 shrink-0 min-h-[36px]"
            >
              <Play className="h-3 w-3" />
              Run
            </button>
          </div>
        </div>
      </div>

      {/* Live Flag Explainer & Coaching Drawer */}
      {(activeBreakdown.breakdown.length > 0 || activeBreakdown.hint) && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-3.5 text-xs space-y-2 min-w-0">
          {activeBreakdown.breakdown.length > 0 && (
            <div className="space-y-1.5 min-w-0">
              <p className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                <Info className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                Command &amp; Flag Breakdown
              </p>
              <div className="flex flex-wrap gap-2 min-w-0">
                {activeBreakdown.breakdown.map((b, idx) => (
                  <div
                    key={`${b.token}-${idx}`}
                    className="max-w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5 break-words"
                  >
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 [overflow-wrap:anywhere]">{b.token}</span>
                    <span className="text-slate-600 dark:text-slate-300"> — {b.meaning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeBreakdown.hint && (
            <p className="inline-flex items-start gap-1.5 text-amber-700 dark:text-amber-300">
              <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{activeBreakdown.hint}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
