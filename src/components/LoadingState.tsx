import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

interface LoadingStateProps {
  title?: string;
  subtitle?: string;
  timeoutMs?: number;
  onRetry?: () => void;
  compact?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  title = 'Loading workspace...',
  subtitle = 'Fetching latest lessons, sandbox modules, and progress.',
  timeoutMs = 12000,
  onRetry,
  compact = false,
}) => {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setTimedOut(false);
    const timer = window.setTimeout(() => {
      setTimedOut(true);
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [timeoutMs, title]);

  const handleRetryClick = () => {
    setTimedOut(false);
    onRetry?.();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] ${
        compact ? 'p-5' : 'p-8 sm:p-10'
      } flex flex-col items-center justify-center text-center gap-3`}
    >
      {!timedOut ? (
        <>
          <Loader2 className="h-7 w-7 animate-spin text-emerald-500" aria-hidden="true" />
          <p className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
              {subtitle}
            </p>
          )}
        </>
      ) : (
        <>
          <AlertTriangle className="h-7 w-7 text-amber-500" aria-hidden="true" />
          <p className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
            Still waiting for server response
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
            This request timed out after {Math.round(timeoutMs / 1000)}s. Retry below to reconnect cleanly.
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={handleRetryClick}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors min-h-[40px]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry Loading
            </button>
          )}
        </>
      )}
    </div>
  );
};

interface LoadErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const LoadErrorState: React.FC<LoadErrorStateProps> = ({
  title = 'Unable to load section data',
  message,
  onRetry,
}) => (
  <div
    role="alert"
    className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-3"
  >
    <AlertTriangle className="h-7 w-7 text-rose-500" aria-hidden="true" />
    <p className="font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
      {title}
    </p>
    <p className="text-xs text-rose-600 dark:text-rose-300 max-w-md leading-relaxed">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors min-h-[40px]"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </button>
    )}
  </div>
);
