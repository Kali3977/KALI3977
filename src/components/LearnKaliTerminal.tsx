import React, { useRef, useState } from 'react';
import { Info, Play, RotateCcw, ShieldAlert, Terminal as TerminalIcon } from 'lucide-react';
import {
  executeSimulatedCommand,
  type FlagExplanation,
  type SimulatedCommandResult,
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
  onCommandExecuted?: (command: string, result: SimulatedCommandResult) => void;
  title?: string;
  compact?: boolean;
}

const DEFAULT_STARTERS = [
  'help',
  'ls -la',
  'nmap -sV -sC 192.168.56.10',
  'gobuster dir -u http://app.lab.local -w /home/kali/wordlists/common.txt',
  'tshark -r /home/kali/captures/dns_tunnel.pcap',
  'grep "Accepted" /home/kali/evidence/auth.log',
  'find / -perm -4000 2>/dev/null',
];

export const LearnKaliTerminal: React.FC<LearnKaliTerminalProps> = ({
  initialCommand = '',
  suggestedCommands = DEFAULT_STARTERS,
  onCommandExecuted,
  title = 'Interactive Educational Terminal (Safe Browser Simulation)',
  compact = false,
}) => {
  const [cwd, setCwd] = useState('/home/kali');
  const [input, setInput] = useState(initialCommand);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [entries, setEntries] = useState<TerminalEntry[]>([
    {
      id: 0,
      cwd: '/home/kali',
      command: 'cat README.txt',
      output: executeSimulatedCommand('cat README.txt').output,
      exitCode: 0,
      breakdown: [{ token: 'cat', meaning: 'Read synthetic welcome file' }],
      coachingHint: 'Run any suggested command below or type `help`. Zero host commands are executed.',
    },
  ]);
  const [activeBreakdown, setActiveBreakdown] = useState<{
    breakdown: FlagExplanation[];
    hint: string | null;
  }>({
    breakdown: [],
    hint: 'Click a command chip or type a Linux/Kali command to see flag-by-flag explanations.',
  });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const runCommand = (rawCmd: string) => {
    const trimmed = rawCmd.trim();
    if (!trimmed) return;

    const result = executeSimulatedCommand(trimmed, { cwd, history });
    if (result.clearScreen) {
      setEntries([]);
      setCwd(result.nextCwd);
      setInput('');
      setHistory((prev) => [trimmed, ...prev.slice(0, 49)]);
      setHistoryIdx(-1);
      onCommandExecuted?.(trimmed, result);
      return;
    }

    const nextEntry: TerminalEntry = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      cwd,
      command: trimmed,
      output: result.output,
      exitCode: result.exitCode,
      breakdown: result.commandBreakdown,
      coachingHint: result.coachingHint,
      safetyBlocked: result.safetyBlocked,
    };

    setEntries((prev) => [...prev, nextEntry]);
    setCwd(result.nextCwd);
    setActiveBreakdown({
      breakdown: result.commandBreakdown,
      hint: result.coachingHint,
    });
    setHistory((prev) => [trimmed, ...prev.slice(0, 49)]);
    setHistoryIdx(-1);
    setInput('');
    onCommandExecuted?.(trimmed, result);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runCommand(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = Math.min(history.length - 1, historyIdx + 1);
      setHistoryIdx(nextIdx);
      setInput(history[nextIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx <= 0) {
        setHistoryIdx(-1);
        setInput('');
      } else {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setInput(history[nextIdx] || '');
      }
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[#070B11] text-slate-100 overflow-hidden shadow-sm">
        {/* Terminal Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#0D131D] px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold text-slate-100">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-300">
              Simulated Sandbox · Not Host Shell
            </span>
            <button
              type="button"
              onClick={() => {
                setEntries([]);
                setCwd('/home/kali');
              }}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200"
            >
              <RotateCcw className="h-3 w-3" />
              Clear
            </button>
          </div>
        </div>

        {/* Starter / Practice Command Chips */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-800/80 bg-[#090E16] px-4 py-2">
          {suggestedCommands.map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => {
                setInput(cmd);
                runCommand(cmd);
              }}
              className="rounded border border-slate-700 bg-slate-900/90 px-2 py-1 font-mono text-[11px] text-emerald-300 hover:border-emerald-500/50 hover:bg-slate-800 transition-colors text-left"
            >
              $ {cmd}
            </button>
          ))}
        </div>

        {/* Output Buffer */}
        <div
          onClick={() => inputRef.current?.focus()}
          className={`${compact ? 'max-h-[260px]' : 'max-h-[360px]'} min-h-[180px] overflow-y-auto px-4 py-3 font-mono text-xs space-y-3 cursor-text`}
        >
          {entries.map((entry) => (
            <div key={entry.id} className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-emerald-400 font-semibold">kali@kali3977</span>
                <span className="text-slate-500">:</span>
                <span className="text-cyan-400">{entry.cwd}</span>
                <span className="text-slate-400">$</span>
                <span className="text-slate-100">{entry.command}</span>
              </div>
              {entry.output && (
                <pre
                  className={`whitespace-pre-wrap break-words pl-1 leading-relaxed ${
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
        <div className="flex items-center gap-2 border-t border-slate-800 bg-[#0B1018] px-4 py-2.5 font-mono text-xs">
          <span className="text-emerald-400 font-semibold shrink-0">kali@kali3977:{cwd}$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a simulated Linux/Kali command (e.g. nmap -sV 192.168.56.10)..."
            aria-label="Simulated Kali terminal command input"
            className="min-w-0 flex-1 bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => runCommand(input)}
            className="inline-flex items-center gap-1 rounded bg-emerald-500 px-2.5 py-1 font-sans text-xs font-semibold text-slate-950 hover:bg-emerald-400 shrink-0"
          >
            <Play className="h-3 w-3" />
            Run
          </button>
        </div>
      </div>

      {/* Live Flag Explainer & Coaching Drawer */}
      {(activeBreakdown.breakdown.length > 0 || activeBreakdown.hint) && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-3.5 text-xs space-y-2">
          {activeBreakdown.breakdown.length > 0 && (
            <div className="space-y-1.5">
              <p className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                <Info className="h-3.5 w-3.5 text-cyan-500" />
                Command &amp; Flag Breakdown
              </p>
              <div className="flex flex-wrap gap-2">
                {activeBreakdown.breakdown.map((b, idx) => (
                  <div
                    key={`${b.token}-${idx}`}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1.5"
                  >
                    <span className="font-mono font-semibold text-emerald-500">{b.token}</span>
                    <span className="text-slate-600 dark:text-slate-300"> — {b.meaning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeBreakdown.hint && (
            <p className="inline-flex items-start gap-1.5 text-amber-600 dark:text-amber-300">
              <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{activeBreakdown.hint}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
