import React, { useState } from 'react';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AdminSecurityNotice: React.FC<{
  compact?: boolean;
  requireAcknowledge?: boolean;
  onAcknowledged?: () => void;
}> = ({ compact = false, requireAcknowledge = false, onAcknowledged }) => {
  const { user, apiFetch, refreshProfile, loginWithGoogle } = useAuth();
  const [checked, setChecked] = useState(Boolean(user?.policyAcknowledgedAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acknowledged = Boolean(user?.policyAcknowledgedAt);

  const handleAcknowledge = async () => {
    if (!user) {
      await loginWithGoogle();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/policies/acknowledge', { method: 'POST' });
      await refreshProfile();
      onAcknowledged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record policy acknowledgment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-label="KALI3977 Administration and Security Notice"
      className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
          <h2 className="font-display text-sm font-bold tracking-wide text-slate-900 dark:text-slate-100">
            KALI3977 ADMINISTRATION AND SECURITY NOTICE
          </h2>
        </div>
        {acknowledged && (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Policy Acknowledged
          </span>
        )}
      </div>

      <div className={`space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300 ${compact ? 'max-h-40 overflow-y-auto pr-1' : ''}`}>
        <p>
          KALI3977 administrators may access team and competition management information, including Room Codes, Team Codes, membership records, and relevant activity logs, when required for platform administration, security investigations, competition management, or suspected suspicious activity.
        </p>
        <p>
          Authorized administrators may change, rotate, or revoke codes and permissions.
        </p>
        <p>
          Where necessary under platform rules, authorized administrators may temporarily suspend or permanently ban accounts, temporarily or permanently remove users from teams, or remove participants from competition rooms.
        </p>
        <p>
          Administrative actions may be logged and reviewed. Disciplinary actions should include a recorded reason and follow the platform&apos;s published rules and applicable appeal process.
        </p>
        <p>
          Private team conversations are accessible only to authorized participants and personnel with explicitly assigned moderation or security permissions. Such access must be restricted, justified, and audited.
        </p>
        <p className="font-medium text-slate-800 dark:text-slate-200">
          By using KALI3977, users agree to follow its Terms of Service, Competition Rules, Community Guidelines, and Security Policies.
        </p>
      </div>

      {(requireAcknowledge || (user && !acknowledged)) && (
        <div className="border-t border-amber-500/20 pt-3 flex flex-wrap items-center justify-between gap-3">
          {!acknowledged ? (
            <>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span>
                  I acknowledge the KALI3977 Administration and Security Notice, Terms of Service, Competition Rules, and Security Policies.
                </span>
              </label>
              <button
                type="button"
                disabled={saving || (Boolean(user) && !checked)}
                onClick={handleAcknowledge}
                className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {user ? (saving ? 'Recording...' : 'Acknowledge Policies') : 'Sign In & Acknowledge'}
              </button>
            </>
          ) : (
            <p className="text-[11px] font-mono text-slate-500">
              Recorded on {user?.policyAcknowledgedAt ? new Date(user.policyAcknowledgedAt).toLocaleString() : 'file'}.
            </p>
          )}
          {error && <p className="w-full text-xs text-rose-500">{error}</p>}
        </div>
      )}
    </section>
  );
};
