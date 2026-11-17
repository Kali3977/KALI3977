import React, { useEffect, useState } from 'react';
import { Briefcase, Flag, MessageSquarePlus, Pencil, Search, Send, ThumbsUp, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LoadErrorState, LoadingState } from './LoadingState';

interface CommunityReply {
  id: number;
  postId: number;
  authorId: number;
  body: string;
  createdAt: string;
  authorUsername: string;
  authorName: string;
}

interface CommunityPost {
  id: number;
  authorId: number;
  topic: string;
  title: string;
  body: string;
  upvotes: number;
  authorUsername: string;
  authorName: string;
  createdAt: string;
  replies: CommunityReply[];
}

const COMMUNITY_TOPICS = [
  'Blue Team',
  'Web Security',
  'Cryptography',
  'Forensics',
  'Study Groups',
  'Weekly Challenges',
  'Research Sharing',
  'Project Showcases',
  'Team Discovery',
];

export const CommunityView: React.FC = () => {
  const { user, loginWithGoogle, apiFetch } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [topic, setTopic] = useState('Blue Team');
  const [filterTopic, setFilterTopic] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPosts = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (filterTopic !== 'All') params.set('topic', filterTopic);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch<{ posts: CommunityPost[] }>(`/api/community${qs}`);
      setPosts(res.posts);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load community discussions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPosts();
  }, [filterTopic]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return loginWithGoogle();
    setError(null);
    try {
      await apiFetch('/api/community', {
        method: 'POST',
        body: JSON.stringify({ topic, title, body }),
      });
      setTitle('');
      setBody('');
      await loadPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish discussion');
    }
  };

  const handleReply = async (e: React.FormEvent, postId: number) => {
    e.preventDefault();
    if (!user) return loginWithGoogle();
    const replyBody = (replyDrafts[postId] || '').trim();
    if (!replyBody) return;
    try {
      await apiFetch(`/api/community/${postId}/replies`, {
        method: 'POST',
        body: JSON.stringify({ body: replyBody }),
      });
      setReplyDrafts((prev) => ({ ...prev, [postId]: '' }));
      await loadPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post reply');
    }
  };

  const handleSaveEdit = async (postId: number) => {
    await apiFetch(`/api/community/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: editTitle, body: editBody }),
    });
    setEditingId(null);
    await loadPosts();
  };

  const handleDeletePost = async (postId: number) => {
    await apiFetch(`/api/community/${postId}`, { method: 'DELETE' });
    await loadPosts();
  };

  const handleReportPost = async (postId: number) => {
    if (!user) return loginWithGoogle();
    await apiFetch(`/api/community/${postId}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Flagged by community member' }),
    });
    setStatusNotice('Discussion reported for moderator review.');
  };

  const handleUpvote = async (id: number) => {
    if (!user) return loginWithGoogle();
    await apiFetch(`/api/community/${id}/upvote`, { method: 'POST' });
    await loadPosts();
  };

  const isStaff = Boolean(user && ['owner', 'event_admin', 'moderator'].includes(user.role));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Global Cybersecurity Community
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Topic-based discussions, study groups, weekly challenges, research sharing, project showcases, and team discovery.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-3">
        <div className="flex flex-wrap gap-1.5">
          {['All', ...COMMUNITY_TOPICS].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterTopic(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                filterTopic === t
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadPosts();
          }}
          className="flex w-full sm:w-auto gap-2"
        >
          <div className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search discussions..."
              aria-label="Search community discussions"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] pl-8 pr-3 py-1.5 text-xs"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium shrink-0"
          >
            Filter
          </button>
        </form>
      </div>

      {statusNotice && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-500">
          {statusNotice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <form
          onSubmit={handlePublish}
          className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3 h-fit"
        >
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4 text-emerald-500" />
            <h2 className="text-base font-semibold">Start a Discussion</h2>
          </div>

          <select
            aria-label="Discussion Topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-xs"
          >
            {COMMUNITY_TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Discussion title"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-sm"
            required
          />

          <textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share a write-up, study group invite, research note, or portfolio showcase..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-2 text-sm"
            required
          />

          {error && <p className="text-xs text-rose-500">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
          >
            {user ? 'Publish Discussion' : 'Sign In to Post'}
          </button>
        </form>

        <div className="lg:col-span-8 space-y-4">
          {loading && posts.length === 0 ? (
            <LoadingState
              title="Loading Community Discussions..."
              subtitle="Fetching study groups, write-ups, and team threads."
              onRetry={() => void loadPosts()}
            />
          ) : loadError && posts.length === 0 ? (
            <LoadErrorState
              title="Unable to load Community"
              message={loadError}
              onRetry={() => void loadPosts()}
            />
          ) : posts.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-8 text-sm text-slate-500">
              No community discussions match your filter yet. Start the first thread on the left!
            </div>
          ) : (
            posts.map((p) => {
              const canEdit = Boolean(user && (user.id === p.authorId || user.role === 'owner'));
              const canDelete = Boolean(user && (user.id === p.authorId || isStaff));
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {p.topic} · {p.authorName} (@{p.authorUsername}) ·{' '}
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpvote(p.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-800 px-2.5 py-1 hover:border-emerald-500 text-xs font-mono tabular-nums"
                      >
                        <ThumbsUp className="h-3 w-3 text-emerald-500" />
                        {p.upvotes}
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(p.id);
                            setEditTitle(p.title);
                            setEditBody(p.body);
                          }}
                          aria-label={`Edit post ${p.title}`}
                          className="p-1 text-slate-400 hover:text-cyan-500"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeletePost(p.id)}
                          aria-label={`Delete post ${p.title}`}
                          className="p-1 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleReportPost(p.id)}
                        aria-label={`Report post ${p.title}`}
                        className="p-1 text-slate-400 hover:text-amber-500"
                      >
                        <Flag className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {editingId === p.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-sm"
                      />
                      <textarea
                        rows={3}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] p-2.5 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(p.id)}
                          className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                        {p.title}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{p.body}</p>
                    </>
                  )}

                  {/* Replies Thread */}
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
                    {p.replies?.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg bg-slate-50 dark:bg-[#0A0D12] border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs"
                      >
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {r.authorName}
                        </span>{' '}
                        <span className="font-mono text-slate-500">@{r.authorUsername}</span>
                        <p className="mt-0.5 text-slate-600 dark:text-slate-300">{r.body}</p>
                      </div>
                    ))}
                    <form onSubmit={(e) => handleReply(e, p.id)} className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        type="text"
                        value={replyDrafts[p.id] || ''}
                        onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder={user ? 'Write a reply...' : 'Sign in to reply'}
                        aria-label={`Reply to ${p.title}`}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-3 py-1.5 text-xs"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                      >
                        <Send className="h-3 w-3" />
                        Reply
                      </button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

interface CareerSpecialization {
  id: string;
  title: string;
  domain: 'Offensive' | 'Defensive' | 'Engineering & Cloud' | 'Research & Governance';
  stages: string;
  skills: string;
  project: string;
  interview: string;
}

const CAREER_SPECIALIZATIONS: CareerSpecialization[] = [
  {
    id: 'pentester',
    title: 'Penetration Tester',
    domain: 'Offensive',
    stages: 'Stages 2–7 · Web Exploitation, AD, Auth Logic, Reporting',
    skills: 'HTTP/TLS internals, SQLi/SSRF verification, Linux & Windows privilege escalation, clear remediation writing.',
    project: 'Publish an anonymized sample penetration test report adhering to PTES/OWASP WSTG methodology.',
    interview: 'Scoping rules of engagement, verifying business-logic IDOR vs false positives, executive vs technical findings.',
  },
  {
    id: 'red_team',
    title: 'Red Team Operator',
    domain: 'Offensive',
    stages: 'Stages 5–8 · Adversary Emulation, Threat Modelling & Telemetry Evasion',
    skills: 'MITRE ATT&CK mapping, Active Directory trust paths, C2 channel hygiene, purple-team detection feedback.',
    project: 'Document an adversary-emulation lab playbook pairing every simulated step with a Sysmon detection rule.',
    interview: 'Assumption-of-breach scenarios, operational security boundaries, collaborating with Blue Teams post-exercise.',
  },
  {
    id: 'blue_team',
    title: 'Blue Team Analyst',
    domain: 'Defensive',
    stages: 'Stages 1–7 · Network Defence, Endpoint Hardening & Detection',
    skills: 'Wireshark/Zeek analysis, Linux auditd, baseline hardening, least-privilege firewalling.',
    project: 'Build a reproducible open-source lab stack with Sigma detections and Suricata signatures.',
    interview: 'Packet-level anomaly detection, credential-dumping telemetry indicators, network segmentation.',
  },
  {
    id: 'soc_analyst',
    title: 'SOC Analyst',
    domain: 'Defensive',
    stages: 'Stages 1–6 · Log Triage, SIEM Correlation & Playbook Execution',
    skills: 'DNS/HTTP telemetry, Windows Event IDs (4624/4625/4688), phishing header verification, alert prioritization.',
    project: 'Maintain a documented Sigma/YARA rule repository with measured false-positive tuning notes.',
    interview: 'Triage severity ordering, containment vs eradication sequencing, true vs false positive verification.',
  },
  {
    id: 'sec_eng',
    title: 'Security Engineer',
    domain: 'Engineering & Cloud',
    stages: 'Stages 3–7 · Systems Hardening, IAM & Cryptographic Controls',
    skills: 'mTLS/PKI lifecycles, secrets vaults, Python/Go security automation, authentication hardening.',
    project: 'Engineer an automated TLS certificate expiry & weak-cipher scanner for containerized services.',
    interview: 'Designing zero-trust service authentication, rate-limiting architecture, secure key rotation.',
  },
  {
    id: 'sec_arch',
    title: 'Security Architect',
    domain: 'Engineering & Cloud',
    stages: 'Stages 4–8 · Threat Modelling, Zero Trust & Enterprise Design',
    skills: 'STRIDE/PASTA threat modeling, cross-region KMS architecture, regulatory compliance mapping.',
    project: 'Produce full architecture threat-model diagrams and data-classification controls for a multi-tenant SaaS.',
    interview: 'Defense-in-depth trade-offs, blast-radius isolation, compensating controls for legacy workloads.',
  },
  {
    id: 'appsec',
    title: 'Application Security Engineer',
    domain: 'Engineering & Cloud',
    stages: 'Stages 4–7 · Secure SDLC, SAST/DAST & Code Auditing',
    skills: 'Parameterized SQL, OAuth2 PKCE/OIDC invariants, SSRF mitigation, XSS encoding, dependency auditing.',
    project: 'Publish custom Semgrep rules catching IDOR, missing auth middleware, and unsafe deserialization.',
    interview: 'Code review walkthroughs, CSP & SameSite cookie interactions, JWT signature & algorithm confusion.',
  },
  {
    id: 'cloud_sec',
    title: 'Cloud Security Engineer',
    domain: 'Engineering & Cloud',
    stages: 'Stages 5–8 · IAM Least Privilege, Kubernetes & IaC Security',
    skills: 'IAM trust policy auditing, IMDSv2 enforcement, container runtime isolation, Terraform compliance scanning.',
    project: 'Build hardened Terraform VPC + CloudTrail/Audit pipeline with OPA policy-as-code guardrails.',
    interview: 'Cross-account IAM role confusion, Kubernetes RBAC escalation paths, secret injection patterns.',
  },
  {
    id: 'dfir_inv',
    title: 'Digital Forensics Investigator',
    domain: 'Defensive',
    stages: 'Stages 2–7 · Chain of Custody, Disk, Memory & Timeline Forensics',
    skills: 'Hashing/imaging integrity, Volatility memory analysis, NTFS MFT & Linux journal timeline reconstruction.',
    project: 'Publish a step-by-step PCAP & memory forensics walkthrough using open-access CTF artifacts.',
    interview: 'Preserving volatile state, order of volatility, anti-forensics artifact detection.',
  },
  {
    id: 'malware_analyst',
    title: 'Malware Analyst',
    domain: 'Research & Governance',
    stages: 'Stages 4–8 · Static Triage, Sandboxing & Behavioral Signatures',
    skills: 'PE/ELF section inspection, API import resolution, YARA signature authoring, safe isolated VM execution.',
    project: 'Write static deobfuscation utilities in Python for benign educational CrackMe samples.',
    interview: 'Packed binary heuristics, dynamic API monitoring in isolated sandboxes, YARA performance.',
  },
  {
    id: 'reverse_eng',
    title: 'Reverse Engineer',
    domain: 'Research & Governance',
    stages: 'Stages 4–8 · Assembly, Decompilation & Protocol Analysis',
    skills: 'x86-64/ARM64 ABI, Ghidra/radare2 control-flow graphs, proprietary binary format decoding.',
    project: 'Reconstruct clean C pseudocode and protocol specifications from open-source CrackMe binaries.',
    interview: 'Stack frames & calling conventions, identifying state machines in stripped ELF binaries.',
  },
  {
    id: 'threat_hunter',
    title: 'Threat Hunter',
    domain: 'Defensive',
    stages: 'Stages 5–8 · Hypothesis-Driven Detection & Anomaly Telemetry',
    skills: 'Beacon periodicity statistics, DNS tunneling heuristics, Living-off-the-Land telemetry baselines.',
    project: 'Create Jupyter notebook statistical detectors for DNS entropy and anomalous outbound sessions.',
    interview: 'Formulating falsifiable hunt hypotheses, transitioning ad-hoc hunts into automated detections.',
  },
  {
    id: 'incident_responder',
    title: 'Incident Responder',
    domain: 'Defensive',
    stages: 'Stages 4–8 · Containment, Eradication & Post-Incident Lessons',
    skills: 'PICERL lifecycle, session/credential revocation, forensic artifact preservation, executive comms.',
    project: 'Author an end-to-end Tabletop & IR Runbook for OAuth token compromise and database exposure.',
    interview: 'Decision-making under ambiguity, avoiding premature tipping-off, coordinated recovery validation.',
  },
  {
    id: 'vuln_researcher',
    title: 'Vulnerability Researcher',
    domain: 'Research & Governance',
    stages: 'Stages 6–8 · Fuzzing, Memory Safety & Root-Cause Analysis',
    skills: 'Coverage-guided fuzzing (AFL++/libFuzzer), ASAN/UBSAN sanitizers, coordinated vulnerability disclosure.',
    project: 'Fuzz an open-source parser in a sandbox and document crash deduplication & patch verification.',
    interview: 'Heap/stack mitigations (ASLR, DEP, CFI), triage exploitability, responsible disclosure timelines.',
  },
  {
    id: 'sec_researcher',
    title: 'Security Researcher',
    domain: 'Research & Governance',
    stages: 'Stages 6–8 · Protocol Proofs, Novel Defenses & Advisories',
    skills: 'Cryptographic proofs, academic literature review, empirical measurement, CVE advisory writing.',
    project: 'Publish a reproducible security evaluation paper or advisory with proof-of-concept patch.',
    interview: 'Formal threat assumptions, experimental methodology, communicating findings clearly.',
  },
  {
    id: 'grc_specialist',
    title: 'GRC Specialist',
    domain: 'Research & Governance',
    stages: 'Stages 1–6 · Risk Management, ISO 27001, NIST CSF & Auditing',
    skills: 'Control mapping (NIST 800-53, ISO 27001, SOC 2), third-party risk, policy writing, audit evidence.',
    project: 'Map a realistic SaaS architecture against NIST CSF 2.0 with measurable control tests.',
    interview: 'Quantifying risk likelihood/impact, technical vs administrative controls, exception governance.',
  },
  {
    id: 'devsecops',
    title: 'DevSecOps Engineer',
    domain: 'Engineering & Cloud',
    stages: 'Stages 4–8 · CI/CD Supply Chain, SBOMs & Automated Gates',
    skills: 'SLSA provenance, container signing (Cosign), secret scanning, automated policy gates in pipelines.',
    project: 'Implement a signed SBOM + Trivy/Semgrep GitHub Actions pipeline that blocks critical CVEs.',
    interview: 'Balancing developer velocity with security gates, dependency pinning, CI secret isolation.',
  },
  {
    id: 'ai_sec',
    title: 'AI Security Researcher',
    domain: 'Research & Governance',
    stages: 'Stages 6–8 · LLM Guardrails, Prompt Injection & Model Integrity',
    skills: 'Prompt/indirect-injection defenses, least-privilege tool calling, training data poisoning & privacy auditing.',
    project: 'Benchmark deterministic schema validation and output filtering against adversarial prompt suites.',
    interview: 'Separating trusted system prompts from untrusted RAG context, tool authorization checks.',
  },
];

export const CareerHubView: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>(CAREER_SPECIALIZATIONS[0].id);
  const [domainFilter, setDomainFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  const filtered = CAREER_SPECIALIZATIONS.filter((c) => {
    const domOk = domainFilter === 'All' || c.domain === domainFilter;
    const q = search.trim().toLowerCase();
    const qOk =
      !q ||
      c.title.toLowerCase().includes(q) ||
      c.skills.toLowerCase().includes(q) ||
      c.domain.toLowerCase().includes(q);
    return domOk && qOk;
  });

  const active = filtered.find((c) => c.id === selectedId) || filtered[0] || CAREER_SPECIALIZATIONS[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            Career Hub — 18 Cybersecurity Specializations
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Structured career roadmaps, GitHub portfolio blueprints, and interview readiness. KALI3977 provides educational guidance and does not guarantee employment or internships.
          </p>
        </div>
      </div>

      {/* Domain & Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-3">
        <div className="flex flex-wrap gap-1.5">
          {['All', 'Offensive', 'Defensive', 'Engineering & Cloud', 'Research & Governance'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDomainFilter(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                domainFilter === d
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter specializations..."
            aria-label="Filter career specializations"
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] pl-8 pr-3 py-1.5 text-xs"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* 18 Roles Selector List */}
        <div className="lg:col-span-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 max-h-[540px] overflow-y-auto pr-1">
          {filtered.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelectedId(role.id)}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                active.id === role.id
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <p className="text-[11px] font-mono text-cyan-500">{role.domain}</p>
              <p className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                {role.title}
              </p>
            </button>
          ))}
        </div>

        {/* Active Specialization Blueprint */}
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-cyan-500" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                  {active.title}
                </h2>
              </div>
              <span className="font-mono text-xs text-emerald-500">{active.domain}</span>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-500">Curriculum Alignment</p>
                <p className="mt-0.5">{active.stages}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Core Technical Skills</p>
                <p className="mt-0.5">{active.skills}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">GitHub Portfolio Project</p>
                <p className="mt-0.5">{active.project}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-500">Interview Readiness Focus</p>
                <p className="mt-0.5">{active.interview}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] p-6 space-y-3">
            <h2 className="font-display text-base font-semibold">Resume, GitHub & Certification Alignment</h2>
            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                <strong>Resume Guidance:</strong> Quantify remediation impact, tooling built, and verified
                CTF/lab write-ups rather than listing raw tool names alone.
              </p>
              <p>
                <strong>GitHub Portfolio:</strong> Document threat models, reproducible lab scripts, and
                clean defensive patches with clear READMEs.
              </p>
              <p>
                <strong>Certification Foundations:</strong> Stages 1–5 prepare core concepts for CompTIA
                Network+ & Security+; Stages 6–8 align with BTL1, PNPT, and OSCP-style methodology.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
