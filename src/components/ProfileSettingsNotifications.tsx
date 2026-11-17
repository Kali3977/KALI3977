import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Bell,
  Bookmark,
  Building2,
  Check,
  Compass,
  Gavel,
  KeyRound,
  Laptop,
  Monitor,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  SunMoon,
  Tablet,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../context/LayoutContext';
import { ConfirmDialog } from './ConfirmDialog';
import { AdminSecurityNotice } from './AdminSecurityNotice';
import { LoadErrorState, LoadingState } from './LoadingState';
import { LAYOUT_OPTIONS, formatDetectionSummary } from '../lib/domain/responsive-layout';
import type { Campus, LayoutPreference, LearningExperience, NavSection } from '../types/kali';

interface OverviewProfileSummary {
  campuses: Campus[];
  playerDashboard: {
    completedLessonsCount: number;
    completedLabsCount: number;
    solvedChallengesCount: number;
    ctfPoints: number;
    achievements: Array<{ id: number; title: string; description: string; category: string }>;
    certificates: Array<{
      id: number;
      verificationId: string;
      title: string;
      issuedAt: string;
      isRevoked?: boolean;
      revokedReason?: string | null;
    }>;
    competitionHistory?: Array<{
      competitionId: number;
      competitionName: string;
      roomName: string;
      teamName: string;
      teamScore: number;
      status?: string;
      removalReason?: string | null;
      joinedAt: string;
    }>;
  } | null;
}

interface AppealRecord {
  id: number;
  scope: string;
  targetId: number | null;
  reason: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

interface CampusVerifRequest {
  id: number;
  campusId: number;
  campusName: string;
  method: string;
  evidenceText: string;
  status: string;
  reviewNote: string | null;
  createdAt: string;
}

export const ProfileView: React.FC<{ onNavigate?: (section: NavSection) => void }> = ({
  onNavigate,
}) => {
  const {
    user,
    memberships,
    removedMemberships,
    bookmarks,
    learningExperience,
    progressionMode,
    progressionSummary,
    toggleBookmark,
    authPending,
    loginWithGoogle,
    refreshProfile,
    apiFetch,
  } = useAuth();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [summary, setSummary] = useState<OverviewProfileSummary['playerDashboard']>(null);
  const [verifRequests, setVerifRequests] = useState<CampusVerifRequest[]>([]);
  const [appeals, setAppeals] = useState<AppealRecord[]>([]);
  const [appealScope, setAppealScope] = useState<
    'team_removal' | 'competition_removal' | 'platform_suspension' | 'platform_ban'
  >('team_removal');
  const [appealTargetId, setAppealTargetId] = useState('');
  const [appealReason, setAppealReason] = useState('');
  const [appealMsg, setAppealMsg] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [country, setCountry] = useState(user?.country || 'Global');
  const [visibility, setVisibility] = useState<'public' | 'private'>(user?.profileVisibility || 'public');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Campus Verification Request state
  const [reqCampusId, setReqCampusId] = useState<number | ''>('');
  const [reqMethod, setReqMethod] = useState<'institutional_email' | 'organizer_approval' | 'invite_code' | 'roster'>('institutional_email');
  const [reqEvidence, setReqEvidence] = useState('');
  const [verifMsg, setVerifMsg] = useState<string | null>(null);

  // Public Certificate Verification
  const [verifyId, setVerifyId] = useState('');
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    certificate?: {
      verificationId: string;
      title: string;
      category: string;
      issuer: string;
      recipientName: string;
      issuedAt: string;
      isRevoked?: boolean;
      revokedReason?: string | null;
    };
    error?: string;
  } | null>(null);

  const loadData = async () => {
    const ov = await apiFetch<OverviewProfileSummary>('/api/overview');
    setCampuses(ov.campuses);
    setSummary(ov.playerDashboard);
    if (user) {
      const [vr, ap] = await Promise.all([
        apiFetch<{ requests: CampusVerifRequest[] }>('/api/campus/verify-requests'),
        apiFetch<{ appeals: AppealRecord[] }>('/api/appeals'),
      ]);
      setVerifRequests(vr.requests);
      setAppeals(ap.appeals || []);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setBio(user.bio);
      setCountry(user.country);
      setVisibility(user.profileVisibility);
    }
  }, [user?.id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    await apiFetch('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        displayName,
        bio,
        country,
        profileVisibility: visibility,
      }),
    });
    await refreshProfile();
    setSaveMsg('Profile updated.');
  };

  const handleCampusVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reqCampusId) return;
    setVerifMsg(null);
    try {
      const res = await apiFetch<{ autoVerified: boolean; message: string }>('/api/campus/verify-request', {
        method: 'POST',
        body: JSON.stringify({
          campusId: Number(reqCampusId),
          method: reqMethod,
          evidenceText: reqEvidence,
        }),
      });
      setVerifMsg(res.message);
      setReqEvidence('');
      await Promise.all([refreshProfile(), loadData()]);
    } catch (err) {
      setVerifMsg(err instanceof Error ? err.message : 'Verification submission failed.');
    }
  };

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAppealMsg(null);
    try {
      await apiFetch('/api/appeals', {
        method: 'POST',
        body: JSON.stringify({
          scope: appealScope,
          targetId: appealTargetId ? Number(appealTargetId) : null,
          reason: appealReason,
        }),
      });
      setAppealReason('');
      setAppealTargetId('');
      setAppealMsg('Appeal submitted for Administrator review.');
      await loadData();
    } catch (err) {
      setAppealMsg(err instanceof Error ? err.message : 'Unable to submit appeal.');
    }
  };

  const handleVerifyCert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyId.trim()) return;
    try {
      const res = await apiFetch<{ valid: boolean; certificate: any }>(
        `/api/certificates/verify/${encodeURIComponent(verifyId.trim())}`,
      );
      setVerifyResult(res);
    } catch (err) {
      setVerifyResult({
        valid: false,
        error: err instanceof Error ? err.message : 'Certificate not found',
      });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Player Profile & Certificate Verification
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage your identity, verified campus affiliation, progress records, appeals, and verify issued credentials.
        </p>
      </div>

      {!user ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-8 text-center space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sign in with Google to view and customize your KALI3977 profile.
          </p>
          <button
            type="button"
            disabled={authPending}
            onClick={() => void loginWithGoogle()}
            className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {authPending ? 'Signing in...' : 'Sign In with Google'}
          </button>
        </div>
      ) : (
        <>
          <AdminSecurityNotice compact />

          <div className="grid gap-6 lg:grid-cols-12">
            <form
              onSubmit={handleSaveProfile}
              className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <p className="font-display text-lg font-semibold">{user.displayName}</p>
                  <p className="font-mono text-xs text-slate-500">
                    @{user.username} · Role: {user.role} · {user.xp} XP
                  </p>
                </div>
                {user.mfaEnabled && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                    <ShieldCheck className="h-4 w-4" />
                    MFA Active
                  </span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="prof-name" className="block text-xs font-semibold mb-1">
                    Display Name
                  </label>
                  <input
                    id="prof-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="prof-country" className="block text-xs font-semibold mb-1">
                    Country
                  </label>
                  <input
                    id="prof-country"
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="prof-vis" className="block text-xs font-semibold mb-1">
                  Profile Privacy
                </label>
                <select
                  id="prof-vis"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-sm"
                >
                  <option value="public">Public (Visible on Leaderboards)</option>
                  <option value="private">Private (Hidden from Public Directory)</option>
                </select>
              </div>

              <div>
                <label htmlFor="prof-bio" className="block text-xs font-semibold mb-1">
                  Biography
                </label>
                <textarea
                  id="prof-bio"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share your security interests, defensive focus, or competition roles..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3 text-sm"
                />
              </div>

              {saveMsg && <p className="text-xs text-emerald-500">{saveMsg}</p>}

              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Save Profile
              </button>
            </form>

            {/* Campus Affiliation Verification Workflow */}
            <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-cyan-500" />
                  <h2 className="font-display text-base font-semibold">Campus Affiliation</h2>
                </div>
                <span className="font-mono text-xs text-emerald-500">
                  {user.campusVerificationStatus || 'unverified'}
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Current Campus:{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {user.campusName || 'Unaffiliated'}
                </strong>
                . Campus affiliation cannot be freely edited; verify via institutional email domain or organizer review.
              </p>

              <form onSubmit={handleCampusVerify} className="space-y-2.5 border-t border-slate-200 dark:border-slate-800 pt-3">
                <select
                  aria-label="Select campus to verify"
                  value={reqCampusId}
                  onChange={(e) => setReqCampusId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
                  required
                >
                  <option value="">Choose Campus...</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.emailDomain || c.country})
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Campus verification method"
                  value={reqMethod}
                  onChange={(e) => setReqMethod(e.target.value as typeof reqMethod)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
                >
                  <option value="institutional_email">Verified Institutional Email Domain</option>
                  <option value="organizer_approval">Organizer / Admin Manual Review</option>
                  <option value="invite_code">Faculty / Captain Invite Code</option>
                  <option value="roster">Official University Roster</option>
                </select>
                <input
                  type="text"
                  value={reqEvidence}
                  onChange={(e) => setReqEvidence(e.target.value)}
                  placeholder="Student ID ref, faculty note, or invite code..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
                />
                {verifMsg && <p className="text-xs text-cyan-500">{verifMsg}</p>}
                <button
                  type="submit"
                  className="w-full rounded-lg border border-cyan-500/40 px-4 py-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10"
                >
                  Request Campus Verification
                </button>
              </form>

              {verifRequests.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-1.5 text-xs">
                  <p className="font-semibold text-slate-500">Verification History</p>
                  {verifRequests.slice(0, 3).map((r) => (
                    <div key={r.id} className="flex justify-between">
                      <span>{r.campusName}</span>
                      <span className="font-mono text-emerald-500">{r.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Learning Progress, Competition History, Achievements & Certificates */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
              <h2 className="font-display text-base font-semibold">Progress & Team History</h2>
              <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <p className="text-lg font-bold text-emerald-500">{summary?.completedLessonsCount ?? 0}</p>
                  <p className="text-slate-500">Lessons</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-cyan-500">{summary?.completedLabsCount ?? 0}</p>
                  <p className="text-slate-500">Labs</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-violet-400">{summary?.solvedChallengesCount ?? 0}</p>
                  <p className="text-slate-500">CTFs</p>
                </div>
              </div>
              {memberships.length === 0 ? (
                <p className="text-xs text-slate-500">No competition team memberships recorded yet.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {memberships.map((m) => (
                    <li key={m.teamId} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
                      <p className="font-semibold">{m.teamName}</p>
                      <p className="font-mono text-slate-500">Role: {m.roleInTeam}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
              <h2 className="font-display text-base font-semibold">Earned Achievements</h2>
              {!summary || summary.achievements.length === 0 ? (
                <p className="text-xs text-slate-500">Complete lessons, labs, or CTF flags to unlock achievements.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {summary.achievements.map((a) => (
                    <li key={a.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
                      <p className="font-semibold text-emerald-500">{a.title}</p>
                      <p className="text-slate-500">{a.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3">
              <h2 className="font-display text-base font-semibold">Issued Certificates</h2>
              {!summary || summary.certificates.length === 0 ? (
                <p className="text-xs text-slate-500">Finish Learning Academy course assessments to earn verified certificates.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {summary.certificates.map((c) => (
                    <li
                      key={c.id}
                      className={`rounded-lg border p-2.5 ${
                        c.isRevoked
                          ? 'border-rose-500/40 bg-rose-500/5'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{c.title}</p>
                        <span
                          className={`font-mono text-[10px] font-semibold uppercase ${
                            c.isRevoked ? 'text-rose-500' : 'text-emerald-500'
                          }`}
                        >
                          {c.isRevoked ? 'Revoked' : 'Valid'}
                        </span>
                      </div>
                      <p className="font-mono text-[11px] text-cyan-500">{c.verificationId}</p>
                      {c.isRevoked && c.revokedReason && (
                        <p className="mt-1 text-[11px] text-rose-500">Reason: {c.revokedReason}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Disciplinary Status & Appeals */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Gavel className="h-4 w-4 text-amber-500" />
              <h2 className="font-display text-base font-semibold">Disciplinary Status &amp; Appeals</h2>
            </div>

            {removedMemberships.length === 0 &&
            !(summary?.competitionHistory || []).some((h) => h.status === 'removed') ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No active team or competition removals on your account. If you believe an enforcement action was applied in error, you can submit an appeal below.
              </p>
            ) : (
              <div className="space-y-2">
                {removedMemberships.map((rm) => (
                  <div
                    key={`rm-team-${rm.teamId}`}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-rose-500">
                          Removed from Team: {rm.teamName} ({rm.removalStatus})
                        </p>
                        {rm.removalReason && (
                          <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                            Recorded Reason: {rm.removalReason}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">Team ID #{rm.teamId}</span>
                  </div>
                ))}
                {(summary?.competitionHistory || [])
                  .filter((h) => h.status === 'removed')
                  .map((h) => (
                    <div
                      key={`rm-comp-${h.competitionId}`}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold text-rose-500">
                            Removed from Competition: {h.competitionName} ({h.roomName})
                          </p>
                          {h.removalReason && (
                            <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                              Recorded Reason: {h.removalReason}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500">
                        Comp ID #{h.competitionId}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            <form
              onSubmit={handleSubmitAppeal}
              className="grid gap-3 md:grid-cols-12 border-t border-slate-200 dark:border-slate-800 pt-4"
            >
              <div className="md:col-span-4">
                <label htmlFor="appeal-scope" className="block text-xs font-semibold mb-1">
                  Appeal Scope
                </label>
                <select
                  id="appeal-scope"
                  value={appealScope}
                  onChange={(e) => setAppealScope(e.target.value as typeof appealScope)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
                >
                  <option value="team_removal">Team Removal</option>
                  <option value="competition_removal">Competition Removal</option>
                  <option value="platform_suspension">Platform Suspension</option>
                  <option value="platform_ban">Platform Ban</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label htmlFor="appeal-target" className="block text-xs font-semibold mb-1">
                  Target Team / Comp ID (Optional)
                </label>
                <input
                  id="appeal-target"
                  type="number"
                  min={1}
                  value={appealTargetId}
                  onChange={(e) => setAppealTargetId(e.target.value)}
                  placeholder="e.g. 12"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
                />
              </div>
              <div className="md:col-span-5 flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-lg border border-amber-500/40 px-4 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  Submit Disciplinary Appeal
                </button>
              </div>
              <div className="md:col-span-12">
                <label htmlFor="appeal-reason" className="block text-xs font-semibold mb-1">
                  Explanation &amp; Context
                </label>
                <textarea
                  id="appeal-reason"
                  rows={2}
                  required
                  minLength={10}
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  placeholder="Provide factual context, verification details, or steps taken to resolve the issue..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3 text-xs"
                />
              </div>
              {appealMsg && <p className="md:col-span-12 text-xs text-cyan-500">{appealMsg}</p>}
            </form>

            {appeals.length > 0 && (
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2 text-xs">
                <p className="font-semibold text-slate-500">Submitted Appeals History</p>
                {appeals.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex flex-wrap items-start justify-between gap-2"
                  >
                    <div>
                      <p className="font-semibold">
                        {a.scope.replace(/_/g, ' ')}{' '}
                        {a.targetId ? `(#${a.targetId})` : ''}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 mt-0.5">{a.reason}</p>
                      {a.adminNote && (
                        <p className="text-cyan-500 mt-1">Reviewer Note: {a.adminNote}</p>
                      )}
                    </div>
                    <span
                      className={`font-mono text-[11px] uppercase font-semibold ${
                        a.status === 'approved'
                          ? 'text-emerald-500'
                          : a.status === 'rejected'
                            ? 'text-rose-500'
                            : 'text-amber-500'
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Saved Bookmarks & Learning Shortcuts (Available to all learners) */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-emerald-500" />
            <h2 className="font-display text-base font-semibold">Saved Bookmarks &amp; Learning Experience</h2>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Experience: <strong className="capitalize text-emerald-600 dark:text-emerald-400">{learningExperience}</strong> ·{' '}
            Progression: <strong className="capitalize">{progressionMode}</strong>
          </span>
        </div>

        {progressionSummary && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3.5 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span>
                {progressionSummary.nextTier
                  ? `Next Milestone (${progressionSummary.nextTier} experience)`
                  : 'Expert Learning Experience Criteria Met'}
              </span>
              <span className="font-mono font-semibold text-emerald-500 tabular-nums">
                {progressionSummary.xpProgressPct}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progressionSummary.xpProgressPct}%` }}
              />
            </div>
          </div>
        )}

        {bookmarks.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No bookmarks saved yet. Use the Bookmark button on any Academy course, Learn KALI tool, Cyber Lab, or CTF challenge to pin it here.
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {bookmarks.map((b) => {
              const targetSection: NavSection =
                b.type === 'course'
                  ? 'academy'
                  : b.type === 'tool'
                    ? 'learn-kali'
                    : b.type === 'lab'
                      ? 'labs'
                      : 'ctf';
              return (
                <div
                  key={`${b.type}:${b.slug}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2.5 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => onNavigate?.(targetSection)}
                    className="min-w-0 text-left hover:text-emerald-500"
                  >
                    <p className="font-semibold truncate text-slate-900 dark:text-slate-100">{b.title}</p>
                    <p className="font-mono text-[10px] uppercase text-slate-500">{b.type}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleBookmark({ type: b.type, slug: b.slug, title: b.title })}
                    aria-label={`Remove bookmark ${b.title}`}
                    className="rounded p-1 text-slate-400 hover:text-rose-500 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Public Certificate Verification */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-emerald-500" />
          <h2 className="font-display text-base font-semibold">Public Certificate Verification</h2>
        </div>
        <form onSubmit={handleVerifyCert} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={verifyId}
            onChange={(e) => setVerifyId(e.target.value)}
            placeholder="Enter Certificate Verification ID (e.g. KALI3977-ACAD-1-...)"
            aria-label="Certificate Verification ID"
            className="w-full sm:w-auto sm:flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3.5 py-2 font-mono text-xs"
          />
          <button
            type="submit"
            className="rounded-lg border border-emerald-500/40 px-4 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            Verify Credential
          </button>
        </form>
        {verifyResult && (
          <div
            className={`rounded-lg p-4 text-xs ${
              verifyResult.valid
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                : 'border border-rose-500/30 bg-rose-500/10 text-rose-500'
            }`}
          >
            {verifyResult.valid && verifyResult.certificate && !verifyResult.certificate.isRevoked ? (
              <div>
                <p className="font-semibold">Authentic KALI3977 Certificate Verified</p>
                <p className="mt-1">
                  Recipient: {verifyResult.certificate.recipientName} · Credential:{' '}
                  {verifyResult.certificate.title} · Issued by {verifyResult.certificate.issuer}
                </p>
              </div>
            ) : verifyResult.certificate?.isRevoked ? (
              <div>
                <p className="font-semibold">Certificate Revoked</p>
                <p className="mt-1">
                  Credential: {verifyResult.certificate.title} ({verifyResult.certificate.verificationId})
                  {verifyResult.certificate.revokedReason
                    ? ` · Reason: ${verifyResult.certificate.revokedReason}`
                    : ''}
                </p>
              </div>
            ) : (
              <p>{verifyResult.error || 'Certificate is revoked or invalid.'}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export const NotificationsView: React.FC = () => {
  const { user, authPending, loginWithGoogle, refreshProfile, apiFetch } = useAuth();
  const [items, setItems] = useState<
    Array<{ id: number; type: string; title: string; body: string; isRead: boolean; createdAt: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiFetch<{ notifications: any[] }>('/api/notifications');
      setItems(res.notifications || []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  const markRead = async (id: number) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
    await Promise.all([load(), refreshProfile()]);
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      await Promise.all([load(), refreshProfile()]);
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Notifications
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Competition updates, achievements, team invitations, and account security alerts.
          </p>
        </div>
        {user && unreadCount > 0 && (
          <button
            type="button"
            disabled={markingAll}
            onClick={() => void markAllRead()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 min-h-[38px]"
          >
            <Check className="h-3.5 w-3.5" />
            {markingAll ? 'Updating...' : `Mark All Read (${unreadCount})`}
          </button>
        )}
      </div>

      {!user ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-8 text-center space-y-3">
          <p className="text-sm text-slate-500">Sign in to view your notifications.</p>
          <button
            type="button"
            disabled={authPending}
            onClick={() => void loginWithGoogle()}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {authPending ? 'Signing in...' : 'Sign In with Google'}
          </button>
        </div>
      ) : loading && items.length === 0 ? (
        <LoadingState
          title="Loading Notifications..."
          subtitle="Fetching security alerts, competition updates, and achievements."
          onRetry={() => void load()}
        />
      ) : loadError && items.length === 0 ? (
        <LoadErrorState
          title="Unable to load Notifications"
          message={loadError}
          onRetry={() => void load()}
        />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-8 text-center text-sm text-slate-500">
          <Bell className="mx-auto mb-2 h-6 w-6 text-slate-400" />
          No notifications yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F]">
          {items.map((n) => (
            <div key={n.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4">
              <div className="min-w-0">
                <p className={`text-sm font-medium ${n.isRead ? 'text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                  {n.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-words">{n.body}</p>
              </div>
              {!n.isRead && (
                <button
                  type="button"
                  onClick={() => void markRead(n.id)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 self-start sm:self-center"
                >
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Mark Read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const SettingsView: React.FC<{ onOpenOnboarding?: () => void }> = ({ onOpenOnboarding }) => {
  const {
    user,
    sessions,
    loginHistory,
    theme,
    learningExperience,
    progressionMode,
    learningConfig,
    setAppearanceTheme,
    setLearningExperience,
    setProgressionMode,
    authPending,
    loginWithGoogle,
    refreshProfile,
    apiFetch,
  } = useAuth();
  const layout = useLayout();
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [mfaMsg, setMfaMsg] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [prefs, setPrefs] = useState({
    competitions: true,
    teamChat: true,
    securityAlerts: true,
    achievements: true,
  });
  const [prefsMsg, setPrefsMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user?.notificationPrefs) {
      setPrefs(user.notificationPrefs);
    }
  }, [user?.id]);

  const handleSavePrefs = async (next: typeof prefs) => {
    setPrefs(next);
    await apiFetch('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({ notificationPrefs: next }),
    });
    setPrefsMsg('Notification preferences saved.');
    await refreshProfile();
  };

  const handleEnrollMfa = async () => {
    const res = await apiFetch<{ secret: string; otpauthUri: string }>('/api/auth/mfa/enroll', {
      method: 'POST',
    });
    setMfaSetup(res);
    setMfaMsg(null);
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ token: totpCode }),
      });
      setMfaMsg('TOTP Multi-Factor Authentication is now active on your account.');
      setMfaSetup(null);
      setTotpCode('');
      await refreshProfile();
    } catch (err) {
      setMfaMsg(err instanceof Error ? err.message : 'Invalid TOTP token');
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    await apiFetch(`/api/auth/sessions/${encodeURIComponent(revokeTarget)}/revoke`, {
      method: 'POST',
    });
    setRevokeTarget(null);
    await refreshProfile();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Settings & Account Security
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure display layout, appearance, learning guidance, notifications, TOTP MFA, active sessions, and login history.
        </p>
      </div>

      {/* 0. Display & Layout (Device-Adaptive Automatic / Manual Override — Independent from Colors & Skill Level) */}
      <section
        aria-label="Display and Layout Settings"
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <SlidersHorizontal className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Display &amp; Layout Mode
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Adapt automatically to screen size and orientation, or pick a preferred layout style. Safe viewport clamping prevents clipping or overflow on smaller screens.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
            <span className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0A0D12] px-2.5 py-1 text-slate-600 dark:text-slate-300">
              Detected: {formatDetectionSummary(layout)}
            </span>
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-600 dark:text-emerald-400 capitalize">
              Active: {layout.effectiveLayout}
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LAYOUT_OPTIONS.map((opt) => {
            const active = layout.preference === opt.id;
            const Icon =
              opt.id === 'mobile'
                ? Smartphone
                : opt.id === 'tablet'
                  ? Tablet
                  : opt.id === 'desktop'
                    ? Monitor
                    : SlidersHorizontal;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => void layout.setPreference(opt.id as LayoutPreference)}
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  active
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                    <Icon className="h-4 w-4 text-emerald-500 shrink-0" />
                    {opt.label}
                  </span>
                  {active && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>

        {layout.isSafeConstrained && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            Manual Safe Mode active: keeping desktop-style navigation &amp; layout preferences safely fitted inside your {layout.width}×{layout.height} viewport without horizontal overflow.
          </p>
        )}
      </section>

      {/* 1. Appearance Theme (Dark / Light — Independent from Learning Experience) */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SunMoon className="h-5 w-5 text-cyan-500" />
            <div>
              <h2 className="text-sm font-semibold">Appearance Theme (Visual Colors Only)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose Dark or Light mode independently from your Learning Experience level. Active: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void setAppearanceTheme('dark')}
              className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                theme === 'dark'
                  ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Dark Mode
            </button>
            <button
              type="button"
              onClick={() => void setAppearanceTheme('light')}
              className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                theme === 'light'
                  ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Light Mode
            </button>
          </div>
        </div>
      </section>

      {/* 2. Learning Experience Theme & Automatic vs Manual Progression */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            <div>
              <h2 className="text-sm font-semibold">Learning Experience &amp; Guidance Density</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tailors explanations, tooltips, and dashboard layout. Never locks advanced courses, tools, or permissions.
              </p>
            </div>
          </div>
          {onOpenOnboarding && (
            <button
              type="button"
              onClick={onOpenOnboarding}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Compass className="h-3.5 w-3.5 text-cyan-500" />
              Re-open Quick Start Tour
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              {
                id: 'beginner',
                title: 'Beginner (Default)',
                desc: 'Step-by-step guidance, glossary hints, and simplified workflows.',
              },
              {
                id: 'intermediate',
                title: 'Intermediate',
                desc: 'Balanced command references, structured practice, and direct tips.',
              },
              {
                id: 'expert',
                title: 'Expert',
                desc: 'Compact workspace with dense technical controls and minimal hints.',
              },
            ] as Array<{ id: LearningExperience; title: string; desc: string }>
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => void setLearningExperience(opt.id)}
              className={`rounded-xl border p-3.5 text-left transition-colors ${
                learningExperience === opt.id
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <p className="text-xs font-bold text-slate-900 dark:text-white">{opt.title}</p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{opt.desc}</p>
            </button>
          ))}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Progression Mode
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void setProgressionMode('automatic')}
              className={`rounded-xl border p-3.5 text-left transition-colors ${
                progressionMode === 'automatic'
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <p className="text-xs font-bold text-slate-900 dark:text-white">Automatic Progression</p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Notifies you before suggesting an upgrade when you exceed{' '}
                {learningConfig.beginnerMaxXp + 1} XP / {learningConfig.intermediateMaxXp + 1} XP and practical milestones.
              </p>
            </button>
            <button
              type="button"
              onClick={() => void setProgressionMode('manual')}
              className={`rounded-xl border p-3.5 text-left transition-colors ${
                progressionMode === 'manual'
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <p className="text-xs font-bold text-slate-900 dark:text-white">Manual Selection</p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Keeps your chosen Learning Experience locked unless you change it manually. Never overrides your choice.
              </p>
            </button>
          </div>
        </div>
      </section>

      {!user ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-8 text-center space-y-3">
          <p className="text-sm text-slate-500">Sign in to manage notification preferences, MFA, sessions, and login history.</p>
          <button
            type="button"
            disabled={authPending}
            onClick={() => void loginWithGoogle()}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {authPending ? 'Signing in...' : 'Sign In with Google'}
          </button>
        </div>
      ) : (
        <>
          {/* Notification Preferences */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-emerald-500" />
              <h2 className="text-base font-semibold">Notification Preferences</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              {[
                { key: 'competitions', label: 'Competition & Room Announcements' },
                { key: 'teamChat', label: 'Team Chat Mentions & Captain Briefs' },
                { key: 'securityAlerts', label: 'Account Security & Session Alerts' },
                { key: 'achievements', label: 'Certificates & Achievements' },
              ].map((item) => {
                const k = item.key as keyof typeof prefs;
                return (
                  <label key={k} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-xs">
                    <span>{item.label}</span>
                    <input
                      type="checkbox"
                      checked={prefs[k]}
                      onChange={(e) => handleSavePrefs({ ...prefs, [k]: e.target.checked })}
                      className="accent-emerald-500"
                    />
                  </label>
                );
              })}
            </div>
            {prefsMsg && <p className="text-xs text-emerald-500">{prefsMsg}</p>}
          </section>

          {/* TOTP MFA */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <KeyRound className="h-5 w-5 text-emerald-500" />
                <div>
                  <h2 className="text-base font-semibold">Multi-Factor Authentication (TOTP RFC 6238)</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {user.mfaEnabled
                      ? 'Enabled. Required for Owner and Administrator operations.'
                      : 'Protect your account with an authenticator app.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleEnrollMfa}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
              >
                {user.mfaEnabled ? 'Rotate MFA Secret' : 'Enable TOTP MFA'}
              </button>
            </div>

            {mfaSetup && (
              <form
                onSubmit={handleVerifyMfa}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-4 space-y-3"
              >
                <p className="text-xs">
                  Add this secret key to your authenticator app:{' '}
                  <code className="font-mono font-semibold text-emerald-500">{mfaSetup.secret}</code>
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    aria-label="6-digit TOTP verification code"
                    className="w-full sm:w-auto min-w-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] px-3 py-2 font-mono text-xs"
                    required
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shrink-0"
                  >
                    Verify & Activate
                  </button>
                </div>
              </form>
            )}

            {mfaMsg && <p className="text-xs text-cyan-500">{mfaMsg}</p>}
          </section>

          {/* Active Sessions */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Laptop className="h-4 w-4 text-cyan-500" />
              <h2 className="text-base font-semibold">Active Sessions & Login History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">IP Address</th>
                    <th className="py-2 pr-4 font-medium">Device / Agent</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {sessions.map((s) => (
                    <tr key={s.id} className="h-10">
                      <td className="pr-4 font-mono">{s.ipAddress}</td>
                      <td className="pr-4 max-w-xs truncate text-slate-500">{s.userAgent}</td>
                      <td className={`pr-4 ${s.revoked ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {s.revoked ? 'Revoked' : 'Active'}
                      </td>
                      <td className="text-right">
                        {!s.revoked && (
                          <button
                            type="button"
                            onClick={() => setRevokeTarget(s.sessionId)}
                            className="text-rose-500 hover:underline font-medium"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {loginHistory.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                Recent Sign-Ins: {loginHistory.slice(0, 3).map((l) => `${l.ipAddress} (${l.status})`).join(' · ')}
              </div>
            )}
          </section>

          <AdminSecurityNotice />
        </>
      )}

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Revoke Session"
        description="Revoking this session will immediately invalidate access from that device."
        confirmLabel="Revoke Session"
        onConfirm={handleConfirmRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
};
