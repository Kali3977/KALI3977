import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bot, DollarSign, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from './ConfirmDialog';

interface AdminMentorOverview {
  canManageBudget: boolean;
  config: {
    enabled: boolean;
    dailyUserLimit: number;
    monthlyUserLimit: number;
    maxPromptTokens: number;
    maxResponseTokens: number;
    cooldownSeconds: number;
    monthlyBudgetUsd: number;
    budgetHalted: boolean;
    haltedReason: string | null;
    overrideActiveThisMonth: boolean;
  };
  ledger: {
    monthKey: string;
    totalRequests: number;
    totalPromptTokens: number;
    totalResponseTokens: number;
    totalThinkingTokens: number;
    spentUsd: number;
    reservedUsd: number;
    remainingBudgetUsd: number;
    costIsEstimated: boolean;
  };
  resets: {
    dayKey: string;
    monthKey: string;
    dailyResetsAt: string;
    monthlyResetsAt: string;
  };
  userUsage: Array<{
    userId: number;
    email: string;
    username: string;
    displayName: string;
    dailyCount: number;
    monthlyCount: number;
    dailyTokens: number;
    monthlyTokens: number;
    monthlyEstimatedSpendUsd: number;
    activeRequest: boolean;
    lastRequestAt: string | null;
  }>;
  recentRecords: Array<{
    id: number;
    userId: number;
    email: string | null;
    mode: string;
    language: string;
    model: string;
    promptTokens: number;
    responseTokens: number;
    thinkingTokens: number;
    estimatedCostUsd: number;
    costIsEstimated: boolean;
    status: string;
    createdAt: string;
  }>;
}

export const AiMentorAdminPanel: React.FC = () => {
  const { user, apiFetch } = useAuth();
  const [overview, setOverview] = useState<AdminMentorOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Admin limits form
  const [enabled, setEnabled] = useState(true);
  const [dailyUserLimit, setDailyUserLimit] = useState(20);
  const [monthlyUserLimit, setMonthlyUserLimit] = useState(300);
  const [maxPromptTokens, setMaxPromptTokens] = useState(4000);
  const [maxResponseTokens, setMaxResponseTokens] = useState(1500);
  const [cooldownSeconds, setCooldownSeconds] = useState(3);

  // Owner-only budget & resume form
  const [monthlyBudgetUsd, setMonthlyBudgetUsd] = useState(20);
  const [overrideSpendingLimit, setOverrideSpendingLimit] = useState(false);

  const [confirmReset, setConfirmReset] = useState<{
    title: string;
    desc: string;
    scope: 'daily' | 'monthly' | 'all' | 'active_lock';
    targetUserId?: number;
  } | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<AdminMentorOverview>('/api/admin/ai-mentor/overview');
      setOverview(res);
      setEnabled(res.config.enabled);
      setDailyUserLimit(res.config.dailyUserLimit);
      setMonthlyUserLimit(res.config.monthlyUserLimit);
      setMaxPromptTokens(res.config.maxPromptTokens);
      setMaxResponseTokens(res.config.maxResponseTokens);
      setCooldownSeconds(res.config.cooldownSeconds);
      setMonthlyBudgetUsd(res.config.monthlyBudgetUsd);
      setOverrideSpendingLimit(res.config.overrideActiveThisMonth);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load AI Cyber Mentor controls.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const isOwner = user?.role === 'owner';
  const canAccess = user?.role === 'owner' || user?.role === 'event_admin';

  if (!canAccess) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-xs text-rose-500">
        Authorized Admin or Platform Owner privileges are required to manage AI Cyber Mentor limits and usage.
      </div>
    );
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setStatusMsg(null);
      const body: Record<string, unknown> = {
        enabled,
        dailyUserLimit,
        monthlyUserLimit,
        maxPromptTokens,
        maxResponseTokens,
        cooldownSeconds,
      };
      if (isOwner) {
        body.monthlyBudgetUsd = monthlyBudgetUsd;
      }
      await apiFetch('/api/admin/ai-mentor/config', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setStatusMsg('AI Cyber Mentor configuration saved and audit-logged.');
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save AI Cyber Mentor settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleResumeBudget = async () => {
    if (!isOwner) return;
    try {
      setSaving(true);
      setError(null);
      setStatusMsg(null);
      await apiFetch('/api/admin/ai-mentor/budget-resume', {
        method: 'POST',
        body: JSON.stringify({
          monthlyBudgetUsd,
          overrideSpendingLimit,
        }),
      });
      setStatusMsg('AI Cyber Mentor budget updated and service resumed.');
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume AI Cyber Mentor service.');
    } finally {
      setSaving(false);
    }
  };

  const executeReset = async () => {
    if (!confirmReset) return;
    try {
      setSaving(true);
      setError(null);
      setStatusMsg(null);
      const res = await apiFetch<{ ok: boolean; affectedUsers: number }>('/api/admin/ai-mentor/reset', {
        method: 'POST',
        body: JSON.stringify({
          scope: confirmReset.scope,
          targetUserId: confirmReset.targetUserId,
        }),
      });
      setStatusMsg(
        `Usage counters reset (${confirmReset.scope}) for ${res.affectedUsers} user record(s) and audit-logged.`,
      );
      setConfirmReset(null);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Counter reset failed.');
      setConfirmReset(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Bot className="h-5 w-5 text-violet-500" />
          <div>
            <h2 className="font-display text-base font-semibold">
              AI Cyber Mentor — Usage Quotas, Budget &amp; Rate Controls
            </h2>
            <p className="text-xs text-slate-500">
              All limits are enforced server-side in PostgreSQL. Spending figures are estimated from provider token usageMetadata.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadOverview}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {statusMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-500">
          {statusMsg}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-500">
          {error}
        </div>
      )}

      {/* Usage & Estimated Spending Summary */}
      {overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4">
            <p className="text-xs text-slate-500">Monthly Requests ({overview.ledger.monthKey})</p>
            <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">
              {overview.ledger.totalRequests.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-slate-500 font-mono">
              In: {overview.ledger.totalPromptTokens.toLocaleString()} · Out:{' '}
              {overview.ledger.totalResponseTokens.toLocaleString()} tok
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4">
            <p className="text-xs text-slate-500">Estimated Monthly Spend</p>
            <p className="mt-1.5 font-display text-2xl font-bold text-amber-500 tabular-nums">
              ${overview.ledger.spentUsd.toFixed(4)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Estimated from token counts (reserved: ${overview.ledger.reservedUsd.toFixed(4)})
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4">
            <p className="text-xs text-slate-500">Remaining Monthly Budget</p>
            <p
              className={`mt-1.5 font-display text-2xl font-bold tabular-nums ${
                overview.ledger.remainingBudgetUsd <= 0 ? 'text-rose-500' : 'text-emerald-500'
              }`}
            >
              ${overview.ledger.remainingBudgetUsd.toFixed(4)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500 font-mono">
              Cap: ${overview.config.monthlyBudgetUsd.toFixed(2)} / month
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-4">
            <p className="text-xs text-slate-500">Service State</p>
            <p
              className={`mt-1.5 font-display text-lg font-bold ${
                !overview.config.enabled
                  ? 'text-amber-500'
                  : overview.config.budgetHalted
                    ? 'text-rose-500'
                    : 'text-emerald-500'
              }`}
            >
              {!overview.config.enabled
                ? 'DISABLED'
                : overview.config.budgetHalted
                  ? 'BUDGET HALTED'
                  : overview.config.overrideActiveThisMonth
                    ? 'ACTIVE (OVERRIDE)'
                    : 'ACTIVE'}
            </p>
            <p className="mt-1 text-[11px] text-slate-500 font-mono">
              Resets: {new Date(overview.resets.monthlyResetsAt).toLocaleDateString()} UTC
            </p>
          </div>
        </div>
      )}

      {/* Forms: Per-User Limits (Admins + Owner) & Global Monthly Budget (Owner ONLY) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSaveConfig}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold">Per-User Limits &amp; Service Switch</h3>
            <label className="inline-flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="accent-emerald-500"
              />
              <span>AI Mentor Enabled</span>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <div>
              <label htmlFor="mentor-cfg-daily" className="block font-medium mb-1">
                Daily Messages / User
              </label>
              <input
                id="mentor-cfg-daily"
                type="number"
                min={1}
                max={5000}
                value={dailyUserLimit}
                onChange={(e) => setDailyUserLimit(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label htmlFor="mentor-cfg-monthly" className="block font-medium mb-1">
                Monthly Messages / User
              </label>
              <input
                id="mentor-cfg-monthly"
                type="number"
                min={1}
                max={50000}
                value={monthlyUserLimit}
                onChange={(e) => setMonthlyUserLimit(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label htmlFor="mentor-cfg-prompt" className="block font-medium mb-1">
                Max Prompt Tokens
              </label>
              <input
                id="mentor-cfg-prompt"
                type="number"
                min={100}
                max={32000}
                value={maxPromptTokens}
                onChange={(e) => setMaxPromptTokens(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label htmlFor="mentor-cfg-response" className="block font-medium mb-1">
                Max Response Tokens
              </label>
              <input
                id="mentor-cfg-response"
                type="number"
                min={100}
                max={8192}
                value={maxResponseTokens}
                onChange={(e) => setMaxResponseTokens(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="mentor-cfg-cooldown" className="block font-medium mb-1">
                Cooldown Between Requests (Seconds)
              </label>
              <input
                id="mentor-cfg-cooldown"
                type="number"
                min={0}
                max={300}
                value={cooldownSeconds}
                onChange={(e) => setCooldownSeconds(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            Save AI Mentor Limits
          </button>
        </form>

        {/* Owner-Only Monthly Budget & Override Controls */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-cyan-500" />
              <h3 className="font-display text-sm font-semibold">Global Monthly Budget &amp; Override</h3>
            </div>
            <span className="rounded border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-mono text-[10px] text-violet-400">
              OWNER ONLY
            </span>
          </div>

          {overview?.config.budgetHalted && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-500">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Service is currently paused because the monthly spending limit was reached. Raise the monthly budget or enable spending override and click Resume Service.
              </p>
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label htmlFor="mentor-cfg-budget" className="block font-medium mb-1">
                Monthly AI Budget (USD, Estimated)
              </label>
              <input
                id="mentor-cfg-budget"
                type="number"
                step="0.5"
                min={0}
                max={100000}
                disabled={!isOwner}
                value={monthlyBudgetUsd}
                onChange={(e) => setMonthlyBudgetUsd(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono disabled:opacity-50"
              />
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <input
                type="checkbox"
                disabled={!isOwner}
                checked={overrideSpendingLimit}
                onChange={(e) => setOverrideSpendingLimit(e.target.checked)}
                className="mt-0.5 accent-amber-500"
              />
              <span>
                <strong className="block">Override spending halt for current month</strong>
                <span className="text-slate-500">
                  Allows AI Cyber Mentor requests to proceed even if current spend meets the monthly budget.
                </span>
              </span>
            </label>
          </div>

          {isOwner ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleResumeBudget}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Apply Budget &amp; Resume Service
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Only the Platform Owner can modify the global monthly budget or manually override spending limits.
            </p>
          )}
        </div>
      </div>

      {/* Counter Reset Controls */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold">Global Usage Counter Resets</h3>
            <p className="text-xs text-slate-500">
              Reset daily or monthly user message counters with audit logging. Does not erase monthly API spend records.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setConfirmReset({
                  title: 'Reset All Users Daily Counters',
                  desc: 'Reset daily AI Cyber Mentor message counters to 0 for all users?',
                  scope: 'daily',
                })
              }
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset All Daily
            </button>
            <button
              type="button"
              onClick={() =>
                setConfirmReset({
                  title: 'Reset All Users Monthly Counters',
                  desc: 'Reset monthly AI Cyber Mentor message counters to 0 for all users?',
                  scope: 'monthly',
                })
              }
              className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-500 hover:bg-amber-500/10"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset All Monthly
            </button>
          </div>
        </div>
      </div>

      {/* Individual User Usage Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
        <h3 className="font-display text-sm font-semibold">Individual User Usage</h3>
        {!overview || overview.userUsage.length === 0 ? (
          <p className="text-xs text-slate-500">No AI Cyber Mentor usage recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">User</th>
                  <th className="py-2 pr-4 font-medium">Daily</th>
                  <th className="py-2 pr-4 font-medium">Monthly</th>
                  <th className="py-2 pr-4 font-medium">Tokens (Mo)</th>
                  <th className="py-2 pr-4 font-medium">Est. Spend (Mo)</th>
                  <th className="py-2 pr-4 font-medium">Lock</th>
                  <th className="py-2 text-right font-medium">Reset Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {overview.userUsage.map((row) => (
                  <tr key={row.userId}>
                    <td className="py-2.5 pr-4">
                      <div className="font-medium">{row.displayName || row.username}</div>
                      <div className="text-[11px] text-slate-500">{row.email}</div>
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums">
                      {row.dailyCount} / {overview.config.dailyUserLimit}
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums">
                      {row.monthlyCount} / {overview.config.monthlyUserLimit}
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums">
                      {row.monthlyTokens.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 font-mono tabular-nums">
                      ${row.monthlyEstimatedSpendUsd.toFixed(4)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono">
                      {row.activeRequest ? (
                        <span className="text-amber-500">IN FLIGHT</span>
                      ) : (
                        <span className="text-slate-500">IDLE</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmReset({
                            title: 'Reset User Daily Quota',
                            desc: `Reset daily AI Cyber Mentor count to 0 for ${row.email}?`,
                            scope: 'daily',
                            targetUserId: row.userId,
                          })
                        }
                        className="text-cyan-500 hover:underline font-medium"
                      >
                        Reset Daily
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmReset({
                            title: 'Reset User Monthly Quota',
                            desc: `Reset monthly AI Cyber Mentor count to 0 for ${row.email}?`,
                            scope: 'monthly',
                            targetUserId: row.userId,
                          })
                        }
                        className="text-amber-500 hover:underline font-medium"
                      >
                        Reset Monthly
                      </button>
                      {row.activeRequest && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmReset({
                              title: 'Clear Active Request Lock',
                              desc: `Clear active in-flight request lock for ${row.email}?`,
                              scope: 'active_lock',
                              targetUserId: row.userId,
                            })
                          }
                          className="text-rose-500 hover:underline font-medium"
                        >
                          Clear Lock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirmReset)}
        title={confirmReset?.title || ''}
        description={confirmReset?.desc || ''}
        confirmLabel="Confirm Reset"
        onConfirm={executeReset}
        onCancel={() => setConfirmReset(null)}
      />
    </div>
  );
};
