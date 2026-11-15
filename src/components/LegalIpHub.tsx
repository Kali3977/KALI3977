import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookMarked,
  CheckCircle2,
  Copyright,
  FileText,
  Gavel,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandMark } from './BrandMark';
import { KALI3977_BRAND_NOTICE, KALI3977_COPYRIGHT_NOTICE } from '../lib/domain/anti-abuse';

type PolicyTab = 'terms' | 'privacy' | 'copyright' | 'aup' | 'report';

interface IpReportSummary {
  referenceCode: string;
  reportType: string;
  targetType: string;
  targetRef: string;
  status: string;
  adminResolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export const LegalIpHub: React.FC<{ initialTab?: PolicyTab }> = ({ initialTab = 'copyright' }) => {
  const { user, apiFetch } = useAuth();
  const [tab, setTab] = useState<PolicyTab>(initialTab);

  // Submission state
  const [reportType, setReportType] = useState<
    'copyright_takedown' | 'trademark_misuse' | 'cloning_scraping' | 'content_dispute'
  >('copyright_takedown');
  const [targetType, setTargetType] = useState<
    'course' | 'ctf_challenge' | 'book' | 'brand' | 'platform_clone' | 'other'
  >('course');
  const [targetRef, setTargetRef] = useState('');
  const [reporterName, setReporterName] = useState(user?.displayName || '');
  const [reporterEmail, setReporterEmail] = useState(user?.email || '');
  const [organization, setOrganization] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [description, setDescription] = useState('');
  const [counterNoticeText, setCounterNoticeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; msg: string; ref?: string } | null>(null);

  // Lookup & History state
  const [lookupCode, setLookupCode] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupResult, setLookupResult] = useState<IpReportSummary | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [myReports, setMyReports] = useState<IpReportSummary[]>([]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (user) {
      setReporterName((prev) => prev || user.displayName);
      setReporterEmail((prev) => prev || user.email);
      apiFetch<{ reports: IpReportSummary[] }>('/api/ip-reports/mine')
        .then((res) => setMyReports(res.reports || []))
        .catch(() => {});
    }
  }, [user?.id]);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await apiFetch<{ report: IpReportSummary; message: string }>('/api/ip-reports', {
        method: 'POST',
        body: JSON.stringify({
          reportType,
          targetType,
          targetRef,
          reporterName,
          reporterEmail,
          organization,
          evidenceUrl,
          description,
          counterNoticeText: reportType === 'content_dispute' ? counterNoticeText : undefined,
        }),
      });
      setSubmitResult({
        ok: true,
        msg: res.message || 'IP report logged for review.',
        ref: res.report.referenceCode,
      });
      setTargetRef('');
      setDescription('');
      setEvidenceUrl('');
      setCounterNoticeText('');
      if (user) {
        const mine = await apiFetch<{ reports: IpReportSummary[] }>('/api/ip-reports/mine');
        setMyReports(mine.reports || []);
      }
    } catch (err) {
      setSubmitResult({
        ok: false,
        msg: err instanceof Error ? err.message : 'Failed to submit IP report.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setLookupResult(null);
    if (!lookupCode.trim() || !lookupEmail.trim()) return;
    try {
      const res = await apiFetch<{ report: IpReportSummary }>(
        `/api/ip-reports/status/${encodeURIComponent(lookupCode.trim())}?email=${encodeURIComponent(
          lookupEmail.trim(),
        )}`,
      );
      setLookupResult(res.report);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Report reference not found.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Brand Ownership Identity */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <BrandMark size={30} />
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
              Legal, Intellectual Property &amp; Anti-Abuse Policies
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
              {KALI3977_COPYRIGHT_NOTICE} {KALI3977_BRAND_NOTICE}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            Provenance &amp; Licensing Registry Active
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          {[
            { id: 'copyright', label: 'Copyright & Provenance', icon: Copyright },
            { id: 'terms', label: 'Terms of Service', icon: FileText },
            { id: 'privacy', label: 'Privacy Policy', icon: ShieldCheck },
            { id: 'aup', label: 'Acceptable Use Policy', icon: Scale },
            { id: 'report', label: 'Report IP Violation / Dispute', icon: Gavel },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as PolicyTab)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  tab === item.id
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* COPYRIGHT, PROVENANCE & BRAND PROTECTION */}
      {tab === 'copyright' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <Copyright className="h-4 w-4 text-emerald-500" />
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Original Content &amp; Platform Ownership
              </h2>
            </div>
            <p>
              <strong>Owned by KALI3977:</strong> Original KALI3977 Learning Academy courses, structured modules,
              architecture diagrams, practical lab scenarios, original CTF challenge prompts/artifacts, scoring engines,
              platform software, UI assets, and original SVG logo/branding are protected by copyright laws and
              international treaties.
            </p>
            <p>
              <strong>Permitted Educational License:</strong> Registered learners and verified university teams may view
              and study published educational content on KALI3977 strictly for personal non-commercial cybersecurity
              education and authorized KALI3977 competitions.
            </p>
            <p>
              <strong>Prohibited Conduct:</strong> Systematic bulk scraping, automated cloning of KALI3977 UI/brand
              assets, commercial resale or republishing of proprietary KALI3977 courses or original CTF challenge
              repositories without written permission, and impersonation of KALI3977 are prohibited.
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-cyan-500" />
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Third-Party Content Attribution &amp; Trademark Notice
              </h2>
            </div>
            <p>
              <strong>Third-Party Books &amp; Documentation:</strong> KALI3977 does <strong>not</strong> claim
              ownership over third-party textbooks, NIST publications, RFCs, GNU manuals, MITRE frameworks, OWASP guides,
              or commercial publisher editions listed in the Books Library. All open-access works remain governed by
              their respective licenses (Public Domain, CC BY/NC/SA, MIT, GNU FDL, MITRE License); commercial books
              link exclusively to official publisher pages.
            </p>
            <p>
              <strong>Trademark Readiness &amp; Non-Affiliation:</strong> The name KALI3977™ and its original vector
              shield emblem are prepared for formal brand clearance and registration review. KALI3977 is an
              unregistered common-law mark and does not falsely claim ® federal registration. KALI3977 is strictly
              independent and is <strong>not</strong> affiliated with, sponsored by, or an official Kali Linux or
              Offensive Security product.
            </p>
          </section>
        </div>
      )}

      {/* TERMS OF SERVICE */}
      {tab === 'terms' && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            KALI3977 Terms of Service
          </h2>
          <p>
            <strong>1. Acceptance &amp; Eligibility:</strong> Accessing or competing on KALI3977 constitutes agreement
            with these Terms, Competition Rules, Acceptable Use Policy, and the KALI3977 Administration &amp; Security
            Notice. Accounts require authentic Google/Firebase authentication; role assignments are server-controlled.
          </p>
          <p>
            <strong>2. Server-Authoritative Integrity:</strong> Scores, dynamic CTF points, diagnostic placements,
            verified certificates, and competition standings are computed and persisted server-side. Manipulating client
            requests, sharing competition flags across opposing teams, or bypassing Room/Team code separation may result
            in removal or account suspension, subject to KALI3977&apos;s recorded appeal process.
          </p>
          <p>
            <strong>3. Availability &amp; Operational Limitations:</strong> KALI3977 strives for dependable availability
            but provides educational exercises &ldquo;as available.&rdquo; Administrators may pause rooms, rotate codes,
            or revoke compromised certificates with recorded audit reasons.
          </p>
        </section>
      )}

      {/* PRIVACY POLICY */}
      {tab === 'privacy' && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            KALI3977 Privacy Policy
          </h2>
          <p>
            <strong>1. Data We Process:</strong> When you authenticate, KALI3977 stores your Firebase UID, email,
            display name, verified campus affiliation, learning/CTF progress, competition participations, and security
            session logs (IP address, User-Agent, MFA activation status, policy acknowledgment timestamp).
          </p>
          <p>
            <strong>2. Public vs. Private Controls:</strong> Players can switch profile visibility between Public and
            Private in My Profile. Private users are omitted from public individual leaderboards. Team chats are scoped
            exclusively to verified team members and explicitly authorized moderation personnel with audit logging.
          </p>
          <p>
            <strong>3. Zero Invasive Surveillance:</strong> KALI3977 does not install client spyware, hijack browser
            clipboard/dev-tools aggressively, or track users across unrelated external sites. Rate-limiting and security
            logs operate on API requests strictly to prevent brute-force attempts and scraping abuse.
          </p>
        </section>
      )}

      {/* ACCEPTABLE USE POLICY */}
      {tab === 'aup' && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            Acceptable Use &amp; Anti-Abuse Policy
          </h2>
          <p>
            <strong>1. Authorized Target Scope Only:</strong> Defensive and offensive security techniques taught in
            KALI3977 courses, labs, and CTF challenges must be applied exclusively inside designated challenge artifacts
            or environments where you hold explicit written authorization. Never attack real-world systems or KALI3977
            production infrastructure outside competition mechanics.
          </p>
          <p>
            <strong>2. Anti-Scraping &amp; Quota Protection:</strong> Automated bulk extraction of challenges,
            courses, member rosters, or leaderboards via scrapers or vulnerability scanners triggers automated request
            throttling (`429 Too Many Requests`) and administrative security review. Legitimate browsers and
            accessibility assistive technologies remain unobstructed.
          </p>
          <p>
            <strong>3. Responsible Disclosure:</strong> If you discover a security vulnerability in KALI3977, report it
            promptly via Security Reports or the IP/Security contact channel without exfiltrating data or disrupting
            active competitions.
          </p>
        </section>
      )}

      {/* IP VIOLATION / TAKEDOWN & DISPUTE WORKFLOW */}
      {tab === 'report' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleSubmitReport}
            className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <h2 className="font-display text-base font-semibold">
                Submit IP Violation, Takedown Notice, or Counter-Dispute
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Use this form to report copyright infringement, unauthorized KALI3977 brand/clone mirrors, scraping
              incidents, or submit a counter-dispute regarding a takedown action.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div>
                <label htmlFor="ip-report-type" className="block font-semibold mb-1">
                  Request Type
                </label>
                <select
                  id="ip-report-type"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as typeof reportType)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
                >
                  <option value="copyright_takedown">Copyright Infringement / Takedown</option>
                  <option value="trademark_misuse">Brand / Impersonation Report</option>
                  <option value="cloning_scraping">Unauthorized Cloning / Bulk Scraping</option>
                  <option value="content_dispute">Takedown Counter-Notice / Dispute</option>
                </select>
              </div>
              <div>
                <label htmlFor="ip-target-type" className="block font-semibold mb-1">
                  Affected Asset Type
                </label>
                <select
                  id="ip-target-type"
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as typeof targetType)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
                >
                  <option value="course">Academy Course / Lesson</option>
                  <option value="ctf_challenge">CTF Challenge / Artifact</option>
                  <option value="book">Books Library Entry</option>
                  <option value="brand">KALI3977 Brand / Logo</option>
                  <option value="platform_clone">External Platform Mirror / Clone</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ip-target-ref" className="block font-semibold mb-1">
                  Affected Item, Course Slug, or Infringing URL
                </label>
                <input
                  id="ip-target-ref"
                  type="text"
                  required
                  value={targetRef}
                  onChange={(e) => setTargetRef(e.target.value)}
                  placeholder="e.g. course/web-security-101 or https://mirror.example"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="ip-name" className="block font-semibold mb-1">
                  Full Name / Rights Holder
                </label>
                <input
                  id="ip-name"
                  type="text"
                  required
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="ip-email" className="block font-semibold mb-1">
                  Contact Email
                </label>
                <input
                  id="ip-email"
                  type="email"
                  required
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="ip-org" className="block font-semibold mb-1">
                  Organization / Publisher (Optional)
                </label>
                <input
                  id="ip-org"
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="ip-evidence" className="block font-semibold mb-1">
                  Official Source / Evidence URL (https://)
                </label>
                <input
                  id="ip-evidence"
                  type="url"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
                />
              </div>
            </div>

            <div className="text-xs">
              <label htmlFor="ip-desc" className="block font-semibold mb-1">
                Detailed Basis of Claim / Evidence
              </label>
              <textarea
                id="ip-desc"
                rows={3}
                required
                minLength={15}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Identify the original work, specific disputed material, and good-faith statement..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3"
              />
            </div>

            {reportType === 'content_dispute' && (
              <div className="text-xs">
                <label htmlFor="ip-counter" className="block font-semibold mb-1">
                  Counter-Notice Statement (License / Fair Use / Authorization Basis)
                </label>
                <textarea
                  id="ip-counter"
                  rows={2}
                  value={counterNoticeText}
                  onChange={(e) => setCounterNoticeText(e.target.value)}
                  placeholder="Provide license grant, public domain basis, or mistake-of-fact explanation..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3"
                />
              </div>
            )}

            {submitResult && (
              <div
                className={`rounded-lg p-3 text-xs flex items-start gap-2 ${
                  submitResult.ok
                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                    : 'border border-rose-500/30 bg-rose-500/10 text-rose-500'
                }`}
              >
                {submitResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <div>
                  <p>{submitResult.msg}</p>
                  {submitResult.ref && (
                    <p className="mt-1 font-mono font-semibold">Reference ID: {submitResult.ref}</p>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit IP Notice'}
            </button>
          </form>

          {/* Status Lookup & Authenticated User History */}
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={handleLookup}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3 text-xs"
            >
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-cyan-500" />
                <h2 className="font-display text-base font-semibold">Check Takedown / Dispute Status</h2>
              </div>
              <input
                type="text"
                required
                value={lookupCode}
                onChange={(e) => setLookupCode(e.target.value)}
                placeholder="Reference ID (e.g. KALI-IP-...)"
                aria-label="IP report reference code"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 font-mono"
              />
              <input
                type="email"
                required
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                placeholder="Reporter contact email"
                aria-label="Reporter contact email for status lookup"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2"
              />
              <button
                type="submit"
                className="w-full rounded-lg border border-cyan-500/40 px-4 py-2 font-semibold text-cyan-500 hover:bg-cyan-500/10"
              >
                Check Case Status
              </button>
              {lookupError && <p className="text-rose-500">{lookupError}</p>}
              {lookupResult && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-3 space-y-1">
                  <p className="font-mono font-semibold text-cyan-500">{lookupResult.referenceCode}</p>
                  <p>
                    Status: <strong className="uppercase">{lookupResult.status}</strong> ·{' '}
                    {lookupResult.reportType.replace(/_/g, ' ')}
                  </p>
                  <p className="text-slate-500">Asset: {lookupResult.targetRef}</p>
                  {lookupResult.adminResolutionNote && (
                    <p className="text-emerald-500">Resolution Note: {lookupResult.adminResolutionNote}</p>
                  )}
                </div>
              )}
            </form>

            {user && myReports.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3 text-xs">
                <h2 className="font-display text-base font-semibold">Your Submitted IP Cases</h2>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {myReports.map((r) => (
                    <div key={r.referenceCode} className="py-2.5 space-y-0.5">
                      <div className="flex justify-between font-mono">
                        <span className="text-cyan-500">{r.referenceCode}</span>
                        <span className="uppercase text-emerald-500">{r.status}</span>
                      </div>
                      <p className="font-medium">{r.targetRef}</p>
                      {r.adminResolutionNote && (
                        <p className="text-slate-500">Note: {r.adminResolutionNote}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
