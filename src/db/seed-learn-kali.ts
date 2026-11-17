import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  achievements,
  kaliCategories,
  kaliLevels,
  kaliMissions,
  kaliToolLessons,
  kaliTools,
  type KaliCommandExample,
  type KaliCommonErrorItem,
} from './schema.ts';

const LEARN_KALI_LEVELS = [
  {
    levelNumber: 1,
    slug: 'level-1-linux-rookie',
    title: 'Level 1 — Linux Rookie',
    subtitle: 'OS Architecture, Terminal Navigation & Kali Basics',
    description:
      'Master POSIX directory trees, Kali rolling basics, desktop environment orientation, and core shell commands from zero prior Linux knowledge.',
    xpRequired: 0,
    badgeTitle: 'Linux Rookie',
    topicsJson: [
      'Linux fundamentals',
      'Kali Linux introduction & safe VM setup',
      'Filesystem hierarchy (/etc, /var, /home)',
      'Basic terminal commands (pwd, ls, cd, cat)',
    ],
    sortOrder: 1,
  },
  {
    levelNumber: 2,
    slug: 'level-2-terminal-explorer',
    title: 'Level 2 — Terminal Explorer',
    subtitle: 'Permissions, Processes, APT Packages & Bash Pipelines',
    description:
      'Manage file mode bits, users and groups, background services, APT package updates, and text filtering pipelines.',
    xpRequired: 200,
    badgeTitle: 'Terminal Explorer',
    topicsJson: [
      'POSIX file permissions & chmod/chown',
      'Users, groups & sudo boundaries',
      'Processes (ps, top) & systemd services',
      'APT package management & Bash scripting',
    ],
    sortOrder: 2,
  },
  {
    levelNumber: 3,
    slug: 'level-3-network-hunter',
    title: 'Level 3 — Network Hunter',
    subtitle: 'TCP/IP, Ports, DNS, Nmap & Wireshark',
    description:
      'Analyze sockets, resolve DNS records, fingerprint TCP/UDP services with Nmap, inspect traffic with Wireshark/tshark, and test raw sockets with Netcat.',
    xpRequired: 550,
    badgeTitle: 'Network Hunter',
    topicsJson: [
      'IPv4/IPv6 addressing & TCP handshake',
      'Port states & DNS resolution',
      'Nmap service discovery & NSE basics',
      'Wireshark, tshark & Netcat debugging',
    ],
    sortOrder: 3,
  },
  {
    levelNumber: 4,
    slug: 'level-4-recon-specialist',
    title: 'Level 4 — Recon Specialist',
    subtitle: 'OSINT, Attack Surface Mapping & Enumeration',
    description:
      'Conduct structured passive OSINT, domain enumeration, subdomain discovery, and disciplined reconnaissance workflows in authorized scopes.',
    xpRequired: 1050,
    badgeTitle: 'Recon Specialist',
    topicsJson: [
      'Passive vs active information gathering',
      'OSINT & public DNS intelligence',
      'Subdomain & host enumeration (Amass, theHarvester)',
      'Structured recon note-taking & reporting',
    ],
    sortOrder: 4,
  },
  {
    levelNumber: 5,
    slug: 'level-5-web-security-agent',
    title: 'Level 5 — Web Security Agent',
    subtitle: 'HTTP Proxying, Fuzzing, OWASP ZAP, Burp & SQLmap',
    description:
      'Intercept HTTP requests, fuzz hidden routes safely in labs, verify injection risks, and map OWASP Top 10 weaknesses.',
    xpRequired: 1700,
    badgeTitle: 'Web Security Agent',
    topicsJson: [
      'HTTP request/response anatomy & cookies',
      'Burp Suite & OWASP ZAP proxying',
      'Directory discovery (Gobuster, ffuf, Nikto)',
      'Automated SQLi testing in isolated labs (SQLmap)',
    ],
    sortOrder: 5,
  },
  {
    levelNumber: 6,
    slug: 'level-6-penetration-tester',
    title: 'Level 6 — Penetration Tester',
    subtitle: 'Vulnerability Validation, Password Auditing & Metasploit',
    description:
      'Verify CVEs responsibly, audit weak credentials offline with John & Hashcat, and practice structured exploitation methodology in authorized ranges.',
    xpRequired: 2500,
    badgeTitle: 'Penetration Tester',
    topicsJson: [
      'PTES & OWASP testing methodologies',
      'Offline hash & credential strength auditing',
      'Metasploit module architecture & handlers',
      'Remediation reporting & evidence handling',
    ],
    sortOrder: 6,
  },
  {
    levelNumber: 7,
    slug: 'level-7-digital-forensics-expert',
    title: 'Level 7 — Digital Forensics Expert',
    subtitle: 'Disk Artifacts, Volatility Memory Analysis & Autopsy',
    description:
      'Preserve volatile memory, uncover injected processes, trace filesystem timelines, and reconstruct incident timelines.',
    xpRequired: 3400,
    badgeTitle: 'DFIR Specialist',
    topicsJson: [
      'Evidence integrity & SHA-256 chain of custody',
      'Disk timeline forensics with Autopsy',
      'Volatile RAM triage with Volatility 3',
      'Firmware & artifact carving (Binwalk)',
    ],
    sortOrder: 7,
  },
  {
    levelNumber: 8,
    slug: 'level-8-elite-security-operator',
    title: 'Level 8 — Elite Security Operator',
    subtitle: 'Privilege Audits, Reverse Engineering, Automation & Capstones',
    description:
      'Decompile binaries with Ghidra & Radare2, audit Linux privilege escalation vectors in authorized ranges, and automate multi-tool assessments.',
    xpRequired: 4500,
    badgeTitle: 'Elite Security Operator',
    topicsJson: [
      'POSIX SUID & capability escalation audits',
      'Reverse engineering with Ghidra & Radare2',
      'Python & Bash security automation',
      'Multi-stage capstone defense & offense scenarios',
    ],
    sortOrder: 8,
  },
];

const KALI_CATEGORIES_SEED = [
  {
    slug: 'information-gathering',
    name: 'Information Gathering',
    description: 'Network scanners, DNS/OSINT harvesters, and attack-surface discovery utilities.',
    officialOrder: 1,
    iconKey: 'radar',
  },
  {
    slug: 'vulnerability-analysis',
    name: 'Vulnerability Analysis',
    description: 'Configuration scanners, web server misconfiguration auditors, and CVE validators.',
    officialOrder: 2,
    iconKey: 'shield-alert',
  },
  {
    slug: 'web-application-analysis',
    name: 'Web Application Analysis',
    description: 'Intercepting proxies, endpoint fuzzers, and OWASP application testing suites.',
    officialOrder: 3,
    iconKey: 'globe',
  },
  {
    slug: 'database-assessment',
    name: 'Database Assessment',
    description: 'Automated SQL injection testers and database security validation tools.',
    officialOrder: 4,
    iconKey: 'database',
  },
  {
    slug: 'password-attacks',
    name: 'Password Attacks',
    description: 'Offline hash strength auditors and authorized credential policy testers.',
    officialOrder: 5,
    iconKey: 'key',
  },
  {
    slug: 'wireless-attacks',
    name: 'Wireless Attacks',
    description: '802.11 monitoring, WPA handshake auditing, and RF spectrum inspection.',
    officialOrder: 6,
    iconKey: 'wifi',
  },
  {
    slug: 'reverse-engineering',
    name: 'Reverse Engineering',
    description: 'Disassemblers, decompilers, and binary analysis frameworks.',
    officialOrder: 7,
    iconKey: 'cpu',
  },
  {
    slug: 'exploitation-tools',
    name: 'Exploitation Tools',
    description: 'Modular vulnerability validation frameworks for authorized lab engagements.',
    officialOrder: 8,
    iconKey: 'zap',
  },
  {
    slug: 'sniffing-and-spoofing',
    name: 'Sniffing & Spoofing',
    description: 'Packet capture analyzers, MITM lab frameworks, and network protocol debuggers.',
    officialOrder: 9,
    iconKey: 'activity',
  },
  {
    slug: 'digital-forensics',
    name: 'Digital Forensics',
    description: 'Memory forensics, disk carving, and incident evidence triage tools.',
    officialOrder: 10,
    iconKey: 'search',
  },
  {
    slug: 'reporting-tools',
    name: 'Reporting Tools',
    description: 'Hierarchical note-taking, evidence structuring, and technical reporting utilities.',
    officialOrder: 11,
    iconKey: 'file-text',
  },
  {
    slug: 'social-engineering-tools',
    name: 'Social Engineering Tools',
    description: 'Authorized phishing awareness & human-factor assessment frameworks.',
    officialOrder: 12,
    iconKey: 'users',
  },
  {
    slug: 'hardware-security',
    name: 'Hardware Security',
    description: 'Firmware extraction and embedded IoT image inspection utilities.',
    officialOrder: 13,
    iconKey: 'hard-drive',
  },
  {
    slug: 'system-services',
    name: 'System Services & Utilities',
    description: 'Core Linux networking helpers, multiplexers, and proxy chaining tools.',
    officialOrder: 14,
    iconKey: 'terminal',
  },
];

interface ToolSeedItem {
  slug: string;
  categorySlug: string;
  name: string;
  summary: string;
  purpose: string;
  installCommand: string;
  supportedOs: string;
  versionNote: string;
  difficulty: string;
  minLevelNumber: number;
  xpReward: number;
  status: 'active' | 'deprecated' | 'optional';
  prerequisitesJson: string[];
  basicCommandsJson: KaliCommandExample[];
  intermediateCommandsJson: KaliCommandExample[];
  advancedCommandsJson: KaliCommandExample[];
  commonErrorsJson: KaliCommonErrorItem[];
  relatedToolSlugsJson: string[];
  officialDocsUrl: string;
  githubUrl: string | null;
  interactiveSupported: boolean;
  lessons?: Array<{
    slug: string;
    title: string;
    stepOrder: number;
    contentMarkdown: string;
    commandPractice: string;
    expectedGoal: string;
    quizQuestion: string;
    quizOptionsJson: string[];
    quizCorrectIndex: number;
    quizExplanation: string;
    xpReward: number;
  }>;
}

const KALI_TOOLS_SEED: ToolSeedItem[] = [
  {
    slug: 'nmap',
    categorySlug: 'information-gathering',
    name: 'Nmap (Network Mapper)',
    summary: 'Industry-standard network discovery, port enumeration, and service/OS fingerprinting scanner.',
    purpose: 'Map reachable hosts, inspect open TCP/UDP ports, detect daemon versions, and run NSE security checks in authorized scopes.',
    installCommand: 'sudo apt update && sudo apt install -y nmap',
    supportedOs: 'Kali Linux, Debian, Ubuntu, macOS, Windows',
    versionNote: '7.9x Kali Rolling',
    difficulty: 'Beginner',
    minLevelNumber: 3,
    xpReward: 100,
    status: 'active',
    prerequisitesJson: ['TCP/IP ports basics', 'IPv4 subnetting (CIDR)'],
    basicCommandsJson: [
      {
        command: 'nmap 192.168.56.10',
        explanation: 'Scans the top 1,000 most common TCP ports on an authorized single lab host.',
        flagBreakdown: [{ flag: '192.168.56.10', meaning: 'Single target host inside the isolated lab subnet' }],
        sampleOutput: 'PORT STATE SERVICE\n22/tcp open ssh\n80/tcp open http',
      },
      {
        command: 'nmap -sV 192.168.56.10',
        explanation: 'Connects to open ports to fingerprint service banners and daemon versions.',
        flagBreakdown: [{ flag: '-sV', meaning: 'Enable service and version detection probes' }],
        sampleOutput: '22/tcp open ssh OpenSSH 9.6p1 Debian\n80/tcp open http nginx 1.24.0',
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'nmap -sV -sC -p 22,80,443 192.168.56.10',
        explanation: 'Runs default NSE reconnaissance scripts alongside version detection on explicit ports.',
        flagBreakdown: [
          { flag: '-sV', meaning: 'Detect service versions' },
          { flag: '-sC', meaning: 'Execute safe default Nmap Scripting Engine (NSE) scripts' },
          { flag: '-p 22,80,443', meaning: 'Restrict scan strictly to ports 22, 80, and 443' },
        ],
      },
    ],
    advancedCommandsJson: [
      {
        command: 'nmap -sS -Pn -T4 --top-ports 100 -oA scan_lab 192.168.56.10',
        explanation: 'Performs a half-open SYN scan bypassing ICMP ping and writes XML/Normal/Grepable logs.',
        flagBreakdown: [
          { flag: '-sS', meaning: 'TCP SYN stealth scan (requires root/CAP_NET_RAW)' },
          { flag: '-Pn', meaning: 'Treat host as online even if ping is firewalled' },
          { flag: '-oA scan_lab', meaning: 'Save output in all formats for audit documentation' },
        ],
      },
    ],
    commonErrorsJson: [
      {
        error: 'You requested a scan type which requires root privileges',
        cause: 'TCP SYN (-sS) and OS detection (-O) craft raw packets requiring root or CAP_NET_RAW.',
        fix: 'Run with sudo or switch to TCP connect scan (-sT).',
      },
      {
        error: 'Note: Host seems down (100% packet loss)',
        cause: 'ICMP echo requests are blocked by target firewall.',
        fix: 'Retry with -Pn after confirming host reachability on TCP.',
      },
    ],
    relatedToolSlugsJson: ['netcat', 'amass', 'gobuster'],
    officialDocsUrl: 'https://nmap.org/book/man.html',
    githubUrl: 'https://github.com/nmap/nmap',
    interactiveSupported: true,
    lessons: [
      {
        slug: 'nmap-service-version-discovery',
        title: 'Understanding Service & Version Fingerprinting (-sV & -sC)',
        stepOrder: 1,
        contentMarkdown:
          'Port numbers alone (like 80 or 8080) do not prove which software or patch level is listening. Nmap `-sV` sends protocol probes to read daemon banners cleanly, while `-sC` checks default safe NSE metadata such as HTTP titles and TLS subjects.',
        commandPractice: 'nmap -sV -sC 192.168.56.10',
        expectedGoal: 'Scan synthetic lab target 192.168.56.10 with -sV and -sC in the interactive terminal.',
        quizQuestion: 'Which Nmap flag instructs Nmap to probe open ports for software names and versions?',
        quizOptionsJson: ['-Pn', '-sV', '-oN', '-F'],
        quizCorrectIndex: 1,
        quizExplanation: '`-sV` activates Nmap service/version detection probes against discovered open ports.',
        xpReward: 70,
      },
    ],
  },
  {
    slug: 'amass',
    categorySlug: 'information-gathering',
    name: 'OWASP Amass',
    summary: 'In-depth attack surface mapping and external asset/subdomain enumeration framework.',
    purpose: 'Collect DNS records, certificate transparency logs, and passive ASN intelligence for authorized organization scopes.',
    installCommand: 'sudo apt update && sudo apt install -y amass',
    supportedOs: 'Kali Linux, Linux, macOS, Windows (Go)',
    versionNote: 'v4.x',
    difficulty: 'Intermediate',
    minLevelNumber: 4,
    xpReward: 90,
    status: 'active',
    prerequisitesJson: ['DNS record types (A, AAAA, CNAME, TXT)'],
    basicCommandsJson: [
      {
        command: 'amass enum -passive -d example.org',
        explanation: 'Enumerates subdomains purely from public OSINT sources without touching target DNS servers.',
        flagBreakdown: [
          { flag: 'enum', meaning: 'Run subdomain enumeration subcommand' },
          { flag: '-passive', meaning: 'Use passive sources only (no direct target packets)' },
          { flag: '-d', meaning: 'Target apex domain inside authorized scope' },
        ],
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'amass intel -asn 64512',
        explanation: 'Discovers CIDR prefixes and domains linked to a known Autonomous System Number.',
        flagBreakdown: [{ flag: '-asn', meaning: 'Query ASN ownership mappings' }],
      },
    ],
    advancedCommandsJson: [
      {
        command: 'amass enum -active -brute -d lab.local -o amass_out.txt',
        explanation: 'Combines active zone transfer/TLS cert inspection with wordlist resolution in authorized scope.',
        flagBreakdown: [
          { flag: '-active', meaning: 'Perform active DNS & certificate probing' },
          { flag: '-brute', meaning: 'Enable subdomain wordlist resolution' },
        ],
      },
    ],
    commonErrorsJson: [
      {
        error: 'Rate-limiting from public DNS resolvers',
        cause: 'Excessive concurrent queries during active brute-force.',
        fix: 'Supply curated trusted resolvers via `-rf resolvers.txt` or use `-passive`.',
      },
    ],
    relatedToolSlugsJson: ['theharvester', 'nmap', 'whois'],
    officialDocsUrl: 'https://www.kali.org/tools/amass/',
    githubUrl: 'https://github.com/owasp-amass/amass',
    interactiveSupported: false,
  },
  {
    slug: 'theharvester',
    categorySlug: 'information-gathering',
    name: 'theHarvester',
    summary: 'OSINT collector for public emails, subdomains, hosts, and banners.',
    purpose: 'Gather defensive awareness around publicly exposed organizational footprint from search & CT logs.',
    installCommand: 'sudo apt update && sudo apt install -y theharvester',
    supportedOs: 'Kali Linux, Linux, Python 3',
    versionNote: '4.x Kali Rolling',
    difficulty: 'Beginner',
    minLevelNumber: 4,
    xpReward: 80,
    status: 'active',
    prerequisitesJson: ['OSINT ethics & scope authorization'],
    basicCommandsJson: [
      {
        command: 'theHarvester -d example.org -b crtsh,duckduckgo',
        explanation: 'Queries Certificate Transparency (crt.sh) and DuckDuckGo for public subdomain exposure.',
        flagBreakdown: [
          { flag: '-d', meaning: 'Target domain' },
          { flag: '-b', meaning: 'Public OSINT data sources to query' },
        ],
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'theHarvester -d example.org -b crtsh -l 200 -f report',
        explanation: 'Limits result count to 200 and saves JSON/XML output report.',
        flagBreakdown: [
          { flag: '-l 200', meaning: 'Cap collected items per source' },
          { flag: '-f report', meaning: 'Save structured output files' },
        ],
      },
    ],
    advancedCommandsJson: [],
    commonErrorsJson: [
      {
        error: 'Missing API key warnings for commercial engines',
        cause: 'Engines like Shodan/SecurityTrails require API keys in `/etc/theHarvester/api-keys.yaml`.',
        fix: 'Select free open sources like `crtsh` or configure read-only OSINT keys.',
      },
    ],
    relatedToolSlugsJson: ['amass', 'whois'],
    officialDocsUrl: 'https://www.kali.org/tools/theharvester/',
    githubUrl: 'https://github.com/laramies/theHarvester',
    interactiveSupported: false,
  },
  {
    slug: 'linux-cli',
    categorySlug: 'system-services',
    name: 'Linux CLI Foundations (ls, cd, cat, grep, find)',
    summary: 'Essential Linux file navigation, permission inspection, and log searching before running offensive security tools.',
    purpose: 'Master terminal navigation, file reading, pattern searching with grep, and SUID auditing with find in a safe Kali shell.',
    installCommand: 'sudo apt update && sudo apt install -y coreutils grep findutils',
    supportedOs: 'Kali Linux, Debian, Ubuntu, all UNIX-like OS',
    versionNote: 'GNU Coreutils',
    difficulty: 'Beginner',
    minLevelNumber: 1,
    xpReward: 60,
    status: 'active',
    prerequisitesJson: ['None — designed for complete beginners'],
    basicCommandsJson: [
      {
        command: 'pwd && ls -la',
        explanation: 'Prints your current directory path and lists every file including permissions and hidden files.',
        flagBreakdown: [
          { flag: 'pwd', meaning: 'Print Working Directory (where you are right now)' },
          { flag: 'ls -la', meaning: 'List all files (-a) in detailed long permission format (-l)' },
        ],
        sampleOutput: '/home/kali\ndrwxr-xr-x 1 kali kali  4096 Nov 15 12:00 ./\n-rw-r--r-- 1 kali kali   420 Nov 15 12:00 README.txt\ndrwxr-xr-x 1 kali kali  4096 Nov 15 12:00 evidence/',
      },
      {
        command: 'grep "Accepted" /home/kali/evidence/auth.log',
        explanation: 'Searches authentication logs for successful SSH logins.',
        flagBreakdown: [
          { flag: '"Accepted"', meaning: 'Text pattern to search inside the file' },
          { flag: '/home/kali/evidence/auth.log', meaning: 'Target log file path' },
        ],
        sampleOutput: 'Nov 15 04:12:19 lab01 sshd[4188]: Accepted password for opsadmin from 203.0.113.77 port 49122 ssh2',
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'mkdir recon_notes && touch recon_notes/target.txt && ls -la recon_notes',
        explanation: 'Creates a dedicated workspace folder and empty note file in one chained line.',
        flagBreakdown: [
          { flag: 'mkdir', meaning: 'Create new directory' },
          { flag: '&&', meaning: 'Run next command only if the previous command succeeded' },
          { flag: 'touch', meaning: 'Create an empty file' },
        ],
        sampleOutput: '-rw-r--r-- 1 kali kali     0 Nov 15 12:00 target.txt',
      },
    ],
    advancedCommandsJson: [
      {
        command: 'find / -perm -4000 2>/dev/null',
        explanation: 'Discovers binaries configured with the SUID bit (run with owner privileges) while silencing permission-denied noise.',
        flagBreakdown: [
          { flag: '-perm -4000', meaning: 'Match POSIX SUID bit' },
          { flag: '2>/dev/null', meaning: 'Redirect permission error messages to null' },
        ],
        sampleOutput: '/usr/bin/sudo\n/usr/bin/passwd\n/usr/local/bin/lab-backup-helper',
      },
    ],
    commonErrorsJson: [
      {
        error: 'cat: auth.log: No such file or directory',
        cause: 'You are in /home/kali while the file lives inside /home/kali/evidence/.',
        fix: 'Run `cd evidence && cat auth.log` or provide the full path `cat /home/kali/evidence/auth.log`.',
      },
    ],
    relatedToolSlugsJson: ['whois', 'nmap', 'tmux'],
    officialDocsUrl: 'https://www.kali.org/docs/introduction/kali-linux-overview/',
    githubUrl: null,
    interactiveSupported: true,
    lessons: [
      {
        slug: 'linux-cli-navigation-and-logs',
        title: 'First Steps in Kali Linux Shell Navigation',
        stepOrder: 1,
        contentMarkdown:
          'Every cybersecurity analyst starts in the Linux shell. `pwd` confirms where you are, `ls -la` reveals files and POSIX permissions, `cat` reads files, and `grep` extracts signal from large logs.',
        commandPractice: 'grep "Accepted" /home/kali/evidence/auth.log',
        expectedGoal: 'Run `grep "Accepted" /home/kali/evidence/auth.log` or `ls -la` in the sandbox terminal.',
        quizQuestion: 'Which Linux command searches inside text files or logs for lines matching a pattern?',
        quizOptionsJson: ['pwd', 'grep', 'chmod', 'mkdir'],
        quizCorrectIndex: 1,
        quizExplanation: '`grep` filters file lines or piped output matching a given pattern.',
        xpReward: 50,
      },
    ],
  },
  {
    slug: 'whois',
    categorySlug: 'information-gathering',
    name: 'WHOIS CLI',
    summary: 'Registration metadata lookup client for domains, IP blocks, and ASNs.',
    purpose: 'Identify registrar ownership, abuse contacts, domain lifecycle dates, and authoritative name servers during passive reconnaissance.',
    installCommand: 'sudo apt update && sudo apt install -y whois',
    supportedOs: 'Kali Linux, Linux, macOS',
    versionNote: 'Standard Debian/Kali',
    difficulty: 'Beginner',
    minLevelNumber: 1,
    xpReward: 50,
    status: 'active',
    prerequisitesJson: ['Domain & IP concepts'],
    basicCommandsJson: [
      {
        command: 'sudo apt update && sudo apt install -y whois',
        explanation: 'Updates the Kali APT package index as root (`sudo`) and installs the `whois` client non-interactively (`-y`).',
        flagBreakdown: [
          { flag: 'sudo', meaning: 'Run command with temporary administrator (root) privileges' },
          { flag: 'apt update', meaning: 'Download fresh package index metadata from repositories' },
          { flag: '&&', meaning: 'Run install only if update succeeded' },
          { flag: 'apt install -y whois', meaning: 'Install the whois package automatically answering Yes (-y)' },
        ],
        sampleOutput: '[sudo] simulated privilege elevation active\nHit:1 http://http.kali.org/kali kali-rolling InRelease\nSetting up whois ... Done.',
      },
      {
        command: 'whois kali.org',
        explanation: 'Retrieves registrar, nameserver, DNSSEC, and domain registration dates from curated educational WHOIS records.',
        flagBreakdown: [{ flag: 'kali.org', meaning: 'Domain name to query' }],
        sampleOutput: 'Domain Name: KALI.ORG\nRegistrar: Gandi SAS / Public Registry Reference\nName Server: ns1.kali.org\nName Server: ns2.kali.org\nDNSSEC: signedDelegation',
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'whois app.lab.local',
        explanation: 'Queries synthetic lab domain metadata inside KALI3977 training scope.',
        flagBreakdown: [{ flag: 'app.lab.local', meaning: 'Synthetic KALI3977 practice domain' }],
        sampleOutput: 'Domain Name: APP.LAB.LOCAL\nRegistrar: KALI3977 Synthetic Internal Registry',
      },
    ],
    advancedCommandsJson: [
      {
        command: 'whois kali.org | grep "Name Server"',
        explanation: 'Pipes WHOIS output directly into grep to isolate only authoritative nameserver lines.',
        flagBreakdown: [
          { flag: '|', meaning: 'Pipe stdout from whois into grep' },
          { flag: 'grep "Name Server"', meaning: 'Show only matching Name Server rows' },
        ],
        sampleOutput: 'Name Server: ns1.kali.org\nName Server: ns2.kali.org',
      },
    ],
    commonErrorsJson: [
      {
        error: "zsh: command not found: whois",
        cause: 'Minimal Kali container images sometimes omit optional CLI recon utilities.',
        fix: 'Install it cleanly with `sudo apt update && sudo apt install -y whois` and re-run `whois kali.org`.',
      },
    ],
    relatedToolSlugsJson: ['linux-cli', 'amass', 'theharvester'],
    officialDocsUrl: 'https://www.kali.org/tools/whois/',
    githubUrl: null,
    interactiveSupported: true,
    lessons: [
      {
        slug: 'whois-package-install-and-lookup',
        title: 'Installing Packages with APT & Inspecting WHOIS Ownership',
        stepOrder: 1,
        contentMarkdown:
          'When setting up a fresh Kali toolkit, you first run `sudo apt update` to refresh package metadata and `sudo apt install -y <package>` to install the utility. Then run `whois kali.org` to inspect registrar ownership, expiry dates, and authoritative name servers without touching target web ports.',
        commandPractice: 'whois kali.org',
        expectedGoal: 'Run `sudo apt update && sudo apt install -y whois` followed by `whois kali.org` in the terminal.',
        quizQuestion: 'Why do Kali users commonly run `sudo apt update` right before `sudo apt install -y whois`?',
        quizOptionsJson: [
          'To delete old log files automatically',
          'To refresh repository package index lists with root permission before installing',
          'To scan open TCP ports on the domain',
          'To bypass DNSSEC checks',
        ],
        quizCorrectIndex: 1,
        quizExplanation: '`sudo` elevates privileges and `apt update` ensures APT fetches the latest package versions before installation.',
        xpReward: 50,
      },
    ],
  },
  {
    slug: 'nikto',
    categorySlug: 'vulnerability-analysis',
    name: 'Nikto',
    summary: 'Open-source web server scanner checking outdated software, dangerous files, and insecure headers.',
    purpose: 'Audit authorized web servers for common misconfigurations, default credentials, and exposed admin paths.',
    installCommand: 'sudo apt update && sudo apt install -y nikto',
    supportedOs: 'Kali Linux, Linux, Perl',
    versionNote: '2.5.x',
    difficulty: 'Beginner',
    minLevelNumber: 5,
    xpReward: 85,
    status: 'active',
    prerequisitesJson: ['HTTP status codes', 'Web server basics'],
    basicCommandsJson: [
      {
        command: 'nikto -h http://app.lab.local',
        explanation: 'Runs standard Nikto vulnerability and header audit against an authorized lab web host.',
        flagBreakdown: [{ flag: '-h', meaning: 'Target host URL or IP' }],
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'nikto -h http://app.lab.local -Tuning 123 -o nikto.html -Format htm',
        explanation: 'Limits tests to interesting files, misconfigurations, and info disclosure while saving HTML.',
        flagBreakdown: [{ flag: '-Tuning', meaning: 'Select specific check categories' }],
      },
    ],
    advancedCommandsJson: [],
    commonErrorsJson: [
      {
        error: 'High noise in web server logs',
        cause: 'Nikto performs thousands of HTTP requests quickly without stealth.',
        fix: 'Use only during authorized vulnerability assessments with `-Pause` if needed.',
      },
    ],
    relatedToolSlugsJson: ['gobuster', 'owasp-zap', 'burpsuite'],
    officialDocsUrl: 'https://www.kali.org/tools/nikto/',
    githubUrl: 'https://github.com/sullo/nikto',
    interactiveSupported: true,
  },
  {
    slug: 'gobuster',
    categorySlug: 'web-application-analysis',
    name: 'Gobuster',
    summary: 'Fast Go-based URI directory, DNS subdomain, and vhost brute-force enumerator.',
    purpose: 'Discover unlinked routes, backup files, and hidden directories on authorized web targets.',
    installCommand: 'sudo apt update && sudo apt install -y gobuster',
    supportedOs: 'Kali Linux, Linux, macOS, Windows',
    versionNote: '3.6+',
    difficulty: 'Beginner',
    minLevelNumber: 5,
    xpReward: 95,
    status: 'active',
    prerequisitesJson: ['HTTP response status codes (200, 301, 403, 404)'],
    basicCommandsJson: [
      {
        command: 'gobuster dir -u http://app.lab.local -w /home/kali/wordlists/common.txt',
        explanation: 'Enumerates directories and routes using a wordlist against a synthetic target.',
        flagBreakdown: [
          { flag: 'dir', meaning: 'Directory/file enumeration mode' },
          { flag: '-u', meaning: 'Target base URL' },
          { flag: '-w', meaning: 'Path to candidate route wordlist' },
        ],
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'gobuster dir -u http://app.lab.local -w common.txt -x php,txt,bak -t 25',
        explanation: 'Appends file extensions and sets 25 concurrent worker goroutines.',
        flagBreakdown: [
          { flag: '-x', meaning: 'Comma-separated extensions to append' },
          { flag: '-t 25', meaning: 'Concurrency thread count' },
        ],
      },
    ],
    advancedCommandsJson: [
      {
        command: 'gobuster vhost -u http://app.lab.local -w subdomains.txt --append-domain',
        explanation: 'Discovers virtual hosts sharing the same IP via the HTTP Host header.',
        flagBreakdown: [{ flag: 'vhost', meaning: 'Virtual Host enumeration mode' }],
      },
    ],
    commonErrorsJson: [
      {
        error: 'Wildcard status 200 returned for non-existent paths',
        cause: 'SPA apps or custom error pages return 200 OK instead of 404.',
        fix: 'Filter wildcard body length via `--exclude-length <bytes>` or `-b 404`.',
      },
    ],
    relatedToolSlugsJson: ['ffuf', 'nikto', 'burpsuite'],
    officialDocsUrl: 'https://www.kali.org/tools/gobuster/',
    githubUrl: 'https://github.com/OJ/gobuster',
    interactiveSupported: true,
    lessons: [
      {
        slug: 'gobuster-dir-discovery',
        title: 'Directory & Hidden Endpoint Enumeration with Gobuster',
        stepOrder: 1,
        contentMarkdown:
          'Web applications frequently leave administrative routes, debug health endpoints, or `.bak` archives unlinked in HTML. Gobuster `dir` mode tests wordlists rapidly against an authorized URL and classifies responses by HTTP status.',
        commandPractice: 'gobuster dir -u http://app.lab.local -w /home/kali/wordlists/common.txt',
        expectedGoal: 'Discover `/robots.txt`, `/api`, `/health`, and `/admin-login` on `http://app.lab.local`.',
        quizQuestion: 'Which Gobuster subcommand tests hidden HTTP directories and files?',
        quizOptionsJson: ['dns', 'vhost', 'dir', 'fuzz'],
        quizCorrectIndex: 2,
        quizExplanation: '`gobuster dir` sends path probes using `-u` and `-w`.',
        xpReward: 70,
      },
    ],
  },
  {
    slug: 'ffuf',
    categorySlug: 'web-application-analysis',
    name: 'ffuf (Fuzz Faster U Fool)',
    summary: 'High-speed web fuzzer for paths, parameters, headers, and virtual hosts.',
    purpose: 'Flexible `FUZZ` placeholder fuzzing with smart response size/word/line auto-calibration.',
    installCommand: 'sudo apt update && sudo apt install -y ffuf',
    supportedOs: 'Kali Linux, Linux, macOS, Windows',
    versionNote: '2.1+',
    difficulty: 'Intermediate',
    minLevelNumber: 5,
    xpReward: 95,
    status: 'active',
    prerequisitesJson: ['HTTP headers & query strings'],
    basicCommandsJson: [
      {
        command: 'ffuf -u http://app.lab.local/FUZZ -w /home/kali/wordlists/common.txt',
        explanation: 'Replaces FUZZ keyword with every line from the wordlist.',
        flagBreakdown: [
          { flag: '-u', meaning: 'Target URL containing FUZZ marker' },
          { flag: '-w', meaning: 'Wordlist file path' },
        ],
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'ffuf -u http://app.lab.local/FUZZ -w common.txt -ac -mc 200,403',
        explanation: 'Auto-calibrates noise baselines (-ac) and matches only 200/403 status codes.',
        flagBreakdown: [
          { flag: '-ac', meaning: 'Automatically filter soft-404 wildcard noise' },
          { flag: '-mc', meaning: 'Match specified HTTP status codes' },
        ],
      },
    ],
    advancedCommandsJson: [],
    commonErrorsJson: [],
    relatedToolSlugsJson: ['gobuster', 'burpsuite'],
    officialDocsUrl: 'https://www.kali.org/tools/ffuf/',
    githubUrl: 'https://github.com/ffuf/ffuf',
    interactiveSupported: true,
  },
  {
    slug: 'burpsuite',
    categorySlug: 'web-application-analysis',
    name: 'Burp Suite Community',
    summary: 'Graphical intercepting HTTP(S) proxy, Repeater, Decoder, and web vulnerability workbench.',
    purpose: 'Intercept browser requests, inspect session tokens, replay modified API payloads, and test BOLA/XSS bugs.',
    installCommand: 'sudo apt update && sudo apt install -y burpsuite',
    supportedOs: 'Kali Linux, Linux, macOS, Windows',
    versionNote: 'Community Edition (Free)',
    difficulty: 'Intermediate',
    minLevelNumber: 5,
    xpReward: 110,
    status: 'active',
    prerequisitesJson: ['Browser proxy settings', 'TLS certificates basics'],
    basicCommandsJson: [
      {
        command: 'burpsuite &',
        explanation: 'Launches Burp Suite GUI and starts its default intercepting proxy on 127.0.0.1:8080.',
        flagBreakdown: [{ flag: '&', meaning: 'Run GUI process in background' }],
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'Proxy -> Intercept -> Send to Repeater (Ctrl+R)',
        explanation: 'Captures an API call and replays mutated JSON/ID parameters cleanly inside Repeater.',
        flagBreakdown: [{ flag: 'Repeater', meaning: 'Manual request crafting & response diffing workspace' }],
      },
    ],
    advancedCommandsJson: [],
    commonErrorsJson: [
      {
        error: 'HTTPS TLS certificate warning in browser',
        cause: 'Browser does not yet trust Burp Proxy root CA for MITM inspection.',
        fix: 'Download the CA cert from http://burp inside your isolated lab browser and import into Authorities.',
      },
    ],
    relatedToolSlugsJson: ['owasp-zap', 'gobuster', 'sqlmap'],
    officialDocsUrl: 'https://portswigger.net/burp/documentation',
    githubUrl: null,
    interactiveSupported: false,
  },
  {
    slug: 'owasp-zap',
    categorySlug: 'web-application-analysis',
    name: 'OWASP ZAP (Zed Attack Proxy)',
    summary: 'Open-source web application security scanner, proxy, and CI/CD DAST automation suite.',
    purpose: 'Perform automated passive/active OWASP testing, API schema fuzzing, and interactive request replay completely free.',
    installCommand: 'sudo apt update && sudo apt install -y zaproxy',
    supportedOs: 'Kali Linux, Linux, macOS, Windows, Docker',
    versionNote: '2.15+',
    difficulty: 'Intermediate',
    minLevelNumber: 5,
    xpReward: 105,
    status: 'active',
    prerequisitesJson: ['OWASP Top 10 overview'],
    basicCommandsJson: [
      {
        command: 'zaproxy -daemon -port 8090',
        explanation: 'Runs ZAP in headless API daemon mode for automated local security scanning.',
        flagBreakdown: [
          { flag: '-daemon', meaning: 'Launch without GUI' },
          { flag: '-port 8090', meaning: 'Listen on local port 8090' },
        ],
      },
    ],
    intermediateCommandsJson: [],
    advancedCommandsJson: [],
    commonErrorsJson: [],
    relatedToolSlugsJson: ['burpsuite', 'nikto', 'sqlmap'],
    officialDocsUrl: 'https://www.zaproxy.org/docs/',
    githubUrl: 'https://github.com/zaproxy/zaproxy',
    interactiveSupported: false,
  },
  {
    slug: 'sqlmap',
    categorySlug: 'database-assessment',
    name: 'SQLmap',
    summary: 'Open-source automated SQL injection detection and database security auditing tool.',
    purpose: 'Verify parameterized query integrity and identify SQLi vulnerabilities in authorized staging targets.',
    installCommand: 'sudo apt update && sudo apt install -y sqlmap',
    supportedOs: 'Kali Linux, Linux, macOS, Windows (Python 3)',
    versionNote: '1.8+',
    difficulty: 'Intermediate',
    minLevelNumber: 5,
    xpReward: 110,
    status: 'active',
    prerequisitesJson: ['SQL SELECT/UNION basics', 'Prepared statements defense'],
    basicCommandsJson: [
      {
        command: 'sqlmap -u "http://app.lab.local/item?id=1" --batch',
        explanation: 'Tests the `id` query parameter for SQL injection using non-interactive safe defaults.',
        flagBreakdown: [
          { flag: '-u', meaning: 'Target URL with test parameter' },
          { flag: '--batch', meaning: 'Never prompt for user input; apply default safe decisions' },
        ],
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'sqlmap -u "http://app.lab.local/item?id=1" --batch --dbs',
        explanation: 'Lists accessible database names when a SQL injection flaw is confirmed.',
        flagBreakdown: [{ flag: '--dbs', meaning: 'Enumerate database schemas' }],
      },
    ],
    advancedCommandsJson: [],
    commonErrorsJson: [
      {
        error: 'Target blocked by WAF or anti-CSRF tokens',
        cause: 'POST forms require fresh anti-CSRF tokens per submission.',
        fix: 'Pass `--csrf-token` and `--csrf-url` in authorized test ranges.',
      },
    ],
    relatedToolSlugsJson: ['burpsuite', 'owasp-zap'],
    officialDocsUrl: 'https://www.kali.org/tools/sqlmap/',
    githubUrl: 'https://github.com/sqlmapproject/sqlmap',
    interactiveSupported: true,
  },
  {
    slug: 'hydra',
    categorySlug: 'password-attacks',
    name: 'THC-Hydra',
    summary: 'Parallel network login cracker supporting SSH, HTTP, FTP, SMB, and 50+ protocols.',
    purpose: 'Demonstrate why rate-limiting, account lockouts, and MFA are mandatory on exposed login services.',
    installCommand: 'sudo apt update && sudo apt install -y hydra',
    supportedOs: 'Kali Linux, Linux, macOS',
    versionNote: '9.5+',
    difficulty: 'Intermediate',
    minLevelNumber: 6,
    xpReward: 95,
    status: 'active',
    prerequisitesJson: ['Authentication rate-limiting concepts'],
    basicCommandsJson: [
      {
        command: 'hydra -l ops -P /home/kali/wordlists/common.txt ssh://192.168.56.10',
        explanation: 'Tests weak password policies for single lab user `ops` over synthetic SSH.',
        flagBreakdown: [
          { flag: '-l', meaning: 'Single username to audit' },
          { flag: '-P', meaning: 'Password wordlist file' },
        ],
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'hydra -L users.txt -P pass.txt -t 4 -V ssh://192.168.56.10',
        explanation: 'Throttles parallel connections (-t 4) with verbose per-attempt output.',
        flagBreakdown: [{ flag: '-t 4', meaning: 'Limit concurrency to 4 threads' }],
      },
    ],
    advancedCommandsJson: [],
    commonErrorsJson: [
      {
        error: 'Service resets connection after 5 attempts',
        cause: 'Fail2ban / sshd MaxAuthTries defense triggered.',
        fix: 'Observe how proper lockout/fail2ban stops brute-force attacks in real deployments.',
      },
    ],
    relatedToolSlugsJson: ['john', 'hashcat'],
    officialDocsUrl: 'https://www.kali.org/tools/hydra/',
    githubUrl: 'https://github.com/vanhauser-thc/thc-hydra',
    interactiveSupported: true,
  },
  {
    slug: 'john',
    categorySlug: 'password-attacks',
    name: 'John the Ripper',
    summary: 'Versatile offline password hash strength auditor for Linux shadow files, ZIPs, and SSH keys.',
    purpose: 'Audit weak user passwords and unencrypted key files offline to enforce stronger hashing & passphrases.',
    installCommand: 'sudo apt update && sudo apt install -y john',
    supportedOs: 'Kali Linux, Linux, macOS, Windows',
    versionNote: 'Jumbo',
    difficulty: 'Beginner',
    minLevelNumber: 6,
    xpReward: 95,
    status: 'active',
    prerequisitesJson: ['Cryptographic hash functions & salting'],
    basicCommandsJson: [
      {
        command: 'john /home/kali/hashes/sample.sha256',
        explanation: 'Audits captured hashes using built-in rules and default dictionary.',
        flagBreakdown: [{ flag: 'sample.sha256', meaning: 'Hash file to audit offline' }],
      },
      {
        command: 'john --show /home/kali/hashes/sample.sha256',
        explanation: 'Displays cracked credentials stored in `~/.john/john.pot`.',
        flagBreakdown: [{ flag: '--show', meaning: 'Print already-recovered hashes from potfile' }],
      },
    ],
    intermediateCommandsJson: [],
    advancedCommandsJson: [],
    commonErrorsJson: [
      {
        error: 'No password hashes loaded',
        cause: 'Ambiguous raw hex format requires explicit `--format`.',
        fix: 'Run `john --list=formats` and specify e.g. `--format=Raw-SHA256`.',
      },
    ],
    relatedToolSlugsJson: ['hashcat', 'hydra'],
    officialDocsUrl: 'https://www.openwall.com/john/doc/',
    githubUrl: 'https://github.com/openwall/john',
    interactiveSupported: true,
  },
  {
    slug: 'hashcat',
    categorySlug: 'password-attacks',
    name: 'Hashcat',
    summary: 'High-performance GPU/CPU offline hash recovery and password complexity auditing engine.',
    purpose: 'Benchmark cracking speeds across MD5/SHA256 vs Argon2id/bcrypt to justify modern password KDFs.',
    installCommand: 'sudo apt update && sudo apt install -y hashcat',
    supportedOs: 'Kali Linux, Linux, macOS, Windows',
    versionNote: '6.2+',
    difficulty: 'Intermediate',
    minLevelNumber: 6,
    xpReward: 100,
    status: 'active',
    prerequisitesJson: ['Hash modes & salt formats'],
    basicCommandsJson: [
      {
        command: 'hashcat -m 1400 -a 0 /home/kali/hashes/sample.sha256 wordlist.txt',
        explanation: 'Runs straight dictionary attack (-a 0) against Raw-SHA256 hashes (-m 1400).',
        flagBreakdown: [
          { flag: '-m 1400', meaning: 'Hash mode 1400 = SHA2-256' },
          { flag: '-a 0', meaning: 'Attack mode 0 = Straight wordlist' },
        ],
      },
    ],
    intermediateCommandsJson: [],
    advancedCommandsJson: [],
    commonErrorsJson: [],
    relatedToolSlugsJson: ['john', 'hydra'],
    officialDocsUrl: 'https://hashcat.net/wiki/',
    githubUrl: 'https://github.com/hashcat/hashcat',
    interactiveSupported: true,
  },
  {
    slug: 'aircrack-ng',
    categorySlug: 'wireless-attacks',
    name: 'Aircrack-ng Suite',
    summary: 'Complete 802.11 Wi-Fi security auditing suite for packet capture and WPA2/PMKID testing.',
    purpose: 'Verify Wi-Fi encryption strength, detect rogue APs, and test WPA2 PSK dictionary resilience in lab setups.',
    installCommand: 'sudo apt update && sudo apt install -y aircrack-ng',
    supportedOs: 'Kali Linux, Linux',
    versionNote: '1.7',
    difficulty: 'Intermediate',
    minLevelNumber: 6,
    xpReward: 110,
    status: 'active',
    prerequisitesJson: ['802.11 monitor mode & WPA2 4-way handshake'],
    basicCommandsJson: [
      {
        command: 'sudo airmon-ng check kill && sudo airmon-ng start wlan0',
        explanation: 'Places wireless adapter into monitor mode cleanly without NetworkManager interference.',
        flagBreakdown: [{ flag: 'start wlan0', meaning: 'Create monitor interface (e.g. wlan0mon)' }],
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'aircrack-ng -w wordlist.txt -b AA:BB:CC:DD:EE:FF capture-01.cap',
        explanation: 'Audits captured 4-way EAPOL handshake against a candidate wordlist.',
        flagBreakdown: [{ flag: '-b', meaning: 'Filter by target BSSID MAC address' }],
      },
    ],
    advancedCommandsJson: [],
    commonErrorsJson: [
      {
        error: 'Adapter does not support monitor mode or packet injection',
        cause: 'Many built-in laptop Wi-Fi chips and VM passthrough lack monitor drivers.',
        fix: 'Use a supported external USB adapter (e.g. Atheros/Realtek with Linux drivers) in physical/USB-passthrough labs.',
      },
    ],
    relatedToolSlugsJson: ['kismet', 'wireshark'],
    officialDocsUrl: 'https://www.aircrack-ng.org/documentation.html',
    githubUrl: 'https://github.com/aircrack-ng/aircrack-ng',
    interactiveSupported: false,
  },
  {
    slug: 'kismet',
    categorySlug: 'wireless-attacks',
    name: 'Kismet',
    summary: 'Passive wireless network & device detector, sniffer, and WIDS framework.',
    purpose: 'Monitor Wi-Fi, Bluetooth, and SDR RF spectrum passively to spot rogue access points.',
    installCommand: 'sudo apt update && sudo apt install -y kismet',
    supportedOs: 'Kali Linux, Linux, macOS',
    versionNote: '2023-07+',
    difficulty: 'Intermediate',
    minLevelNumber: 6,
    xpReward: 90,
    status: 'active',
    prerequisitesJson: ['802.11 frames & monitor interfaces'],
    basicCommandsJson: [
      {
        command: 'kismet -c wlan0mon',
        explanation: 'Starts Kismet web UI (port 2501) listening passively on monitor interface `wlan0mon`.',
        flagBreakdown: [{ flag: '-c wlan0mon', meaning: 'Attach capture data source' }],
      },
    ],
    intermediateCommandsJson: [],
    advancedCommandsJson: [],
    commonErrorsJson: [],
    relatedToolSlugsJson: ['aircrack-ng', 'wireshark'],
    officialDocsUrl: 'https://www.kali.org/tools/kismet/',
    githubUrl: 'https://github.com/kismetwireless/kismet',
    interactiveSupported: false,
  },
  {
    slug: 'ghidra',
    categorySlug: 'reverse-engineering',
    name: 'Ghidra',
    summary: 'NSA open-source software reverse engineering suite with multi-architecture decompiler.',
    purpose: 'Disassemble and decompile ELF/PE binaries to C-like pseudocode for malware analysis and vulnerability research.',
    installCommand: 'sudo apt update && sudo apt install -y ghidra',
    supportedOs: 'Kali Linux, Linux, macOS, Windows (Java 17+)',
    versionNote: '11.x',
    difficulty: 'Advanced',
    minLevelNumber: 8,
    xpReward: 150,
    status: 'active',
    prerequisitesJson: ['C fundamentals', 'x86_64 assembly registers & stack'],
    basicCommandsJson: [
      {
        command: 'ghidraRun',
        explanation: 'Launches the Ghidra Project Manager and CodeBrowser GUI.',
        flagBreakdown: [{ flag: 'CodeBrowser', meaning: 'Interactive disassembly, strings, and C decompiler view' }],
      },
    ],
    intermediateCommandsJson: [],
    advancedCommandsJson: [],
    commonErrorsJson: [],
    relatedToolSlugsJson: ['radare2', 'binwalk'],
    officialDocsUrl: 'https://ghidra-sre.org/',
    githubUrl: 'https://github.com/NationalSecurityAgency/ghidra',
    interactiveSupported: false,
  },
  {
    slug: 'radare2',
    categorySlug: 'reverse-engineering',
    name: 'Radare2 (r2)',
    summary: 'Scriptable command-line hexadecimal editor, disassembler, and binary analysis framework.',
    purpose: 'Inspect ELF sections, strings, symbols, and control-flow graphs straight inside SSH or terminal environments.',
    installCommand: 'sudo apt update && sudo apt install -y radare2',
    supportedOs: 'Kali Linux, Linux, macOS, Windows',
    versionNote: '5.9+',
    difficulty: 'Advanced',
    minLevelNumber: 8,
    xpReward: 130,
    status: 'active',
    prerequisitesJson: ['ELF format & assembly basics'],
    basicCommandsJson: [
      {
        command: 'r2 -A ./target_binary',
        explanation: 'Opens binary and automatically runs full function/string analysis.',
        flagBreakdown: [{ flag: '-A', meaning: 'Run `aaa` automatic analysis at load' }],
      },
      {
        command: 'afl && pdf @ main',
        explanation: 'Inside r2 prompt: lists analyzed functions (`afl`) and disassembles `main` (`pdf @ main`).',
        flagBreakdown: [{ flag: 'pdf @ main', meaning: 'Print Disassembly of Function `main`' }],
      },
    ],
    intermediateCommandsJson: [],
    advancedCommandsJson: [],
    commonErrorsJson: [],
    relatedToolSlugsJson: ['ghidra', 'binwalk'],
    officialDocsUrl: 'https://www.kali.org/tools/radare2/',
    githubUrl: 'https://github.com/radareorg/radare2',
    interactiveSupported: false,
  },
  {
    slug: 'metasploit-framework',
    categorySlug: 'exploitation-tools',
    name: 'Metasploit Framework',
    summary: 'Modular penetration testing platform for vulnerability verification, auxiliary scanning, and payload handling.',
    purpose: 'Validate known vulnerabilities in isolated ranges, check service patch state with `check`, and manage controlled lab sessions.',
    installCommand: 'sudo apt update && sudo apt install -y metasploit-framework',
    supportedOs: 'Kali Linux, Linux, macOS',
    versionNote: '6.4 Kali Rolling',
    difficulty: 'Intermediate',
    minLevelNumber: 6,
    xpReward: 135,
    status: 'active',
    prerequisitesJson: ['Vulnerability validation ethics', 'Networking & reverse shells concepts'],
    basicCommandsJson: [
      {
        command: 'msfdb init && msfconsole -q',
        explanation: 'Initializes PostgreSQL workspace database and opens Metasploit CLI quietly without ASCII banner.',
        flagBreakdown: [
          { flag: 'msfdb init', meaning: 'Prepare local Metasploit workspace PostgreSQL DB' },
          { flag: '-q', meaning: 'Quiet startup' },
        ],
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'search type:auxiliary http_version && use 0 && set RHOSTS 192.168.56.10 && run',
        explanation: 'Selects an auxiliary version scanner module cleanly inside the lab range.',
        flagBreakdown: [{ flag: 'RHOSTS', meaning: 'Target host(s) inside authorized scope' }],
      },
    ],
    advancedCommandsJson: [],
    commonErrorsJson: [
      {
        error: 'Database not connected in msfconsole',
        cause: 'PostgreSQL service stopped or `msfdb init` never executed.',
        fix: 'Run `sudo systemctl start postgresql && sudo msfdb init`.',
      },
    ],
    relatedToolSlugsJson: ['nmap', 'netcat', 'responder'],
    officialDocsUrl: 'https://docs.metasploit.com/',
    githubUrl: 'https://github.com/rapid7/metasploit-framework',
    interactiveSupported: false,
  },
  {
    slug: 'wireshark',
    categorySlug: 'sniffing-and-spoofing',
    name: 'Wireshark',
    summary: 'Graphical deep-packet protocol analyzer across 3,000+ network protocols.',
    purpose: 'Inspect raw TCP streams, diagnose TLS handshakes, spot DNS tunneling, and verify network encryption.',
    installCommand: 'sudo apt update && sudo apt install -y wireshark',
    supportedOs: 'Kali Linux, Linux, macOS, Windows',
    versionNote: '4.2+',
    difficulty: 'Beginner',
    minLevelNumber: 3,
    xpReward: 100,
    status: 'active',
    prerequisitesJson: ['OSI model & TCP/UDP headers'],
    basicCommandsJson: [
      {
        command: 'wireshark capture.pcapng &',
        explanation: 'Opens a packet capture file safely for offline inspection without elevated capture permissions.',
        flagBreakdown: [{ flag: 'capture.pcapng', meaning: 'Saved packet trace file' }],
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'dns.qry.type == 16 || http.request.method == "POST"',
        explanation: 'Display filter highlighting DNS TXT exfiltration queries or HTTP POST submissions.',
        flagBreakdown: [{ flag: 'dns.qry.type == 16', meaning: 'Filter TXT DNS records' }],
      },
    ],
    advancedCommandsJson: [],
    commonErrorsJson: [
      {
        error: 'No interfaces found on which a capture can be done',
        cause: 'Current user lacks `wireshark` capture group permission.',
        fix: 'Run `sudo usermod -aG wireshark $USER` and re-login.',
      },
    ],
    relatedToolSlugsJson: ['tshark', 'bettercap'],
    officialDocsUrl: 'https://www.wireshark.org/docs/',
    githubUrl: 'https://github.com/wireshark/wireshark',
    interactiveSupported: false,
  },
  {
    slug: 'tshark',
    categorySlug: 'sniffing-and-spoofing',
    name: 'TShark',
    summary: 'Terminal-native Wireshark CLI analyzer ideal for headless servers and DFIR pipelines.',
    purpose: 'Filter huge `.pcap` captures, extract specific fields (`-T fields`), and pipe packet anomalies into scripts.',
    installCommand: 'sudo apt update && sudo apt install -y tshark',
    supportedOs: 'Kali Linux, Linux, macOS, Windows',
    versionNote: '4.2+',
    difficulty: 'Intermediate',
    minLevelNumber: 3,
    xpReward: 95,
    status: 'active',
    prerequisitesJson: ['Wireshark display filter syntax'],
    basicCommandsJson: [
      {
        command: 'tshark -r /home/kali/captures/dns_tunnel.pcap',
        explanation: 'Reads packets offline from a saved PCAP capture.',
        flagBreakdown: [{ flag: '-r', meaning: 'Read packet trace file' }],
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'tshark -r dns_tunnel.pcap -Y "dns.qry.type == 16" -T fields -e dns.qry.name',
        explanation: 'Extracts only queried DNS TXT hostnames for clean analysis.',
        flagBreakdown: [
          { flag: '-Y', meaning: 'Wireshark display filter' },
          { flag: '-T fields -e dns.qry.name', meaning: 'Emit exact query field values' },
        ],
      },
    ],
    advancedCommandsJson: [],
    commonErrorsJson: [],
    relatedToolSlugsJson: ['wireshark', 'bettercap'],
    officialDocsUrl: 'https://www.wireshark.org/docs/man-pages/tshark.html',
    githubUrl: 'https://github.com/wireshark/wireshark',
    interactiveSupported: true,
    lessons: [
      {
        slug: 'tshark-dns-triage',
        title: 'Extracting Anomalous DNS TXT Queries with TShark',
        stepOrder: 1,
        contentMarkdown:
          'When analyzing captures on headless servers or inside incident triage pipelines, TShark extracts exact protocol fields in milliseconds without loading a GUI.',
        commandPractice: 'tshark -r /home/kali/captures/dns_tunnel.pcap',
        expectedGoal: 'Inspect the synthetic DNS tunnel capture using `tshark -r /home/kali/captures/dns_tunnel.pcap`.',
        quizQuestion: 'Which TShark flag applies a Wireshark display filter when reading a PCAP file?',
        quizOptionsJson: ['-w', '-Y', '-s', '-c'],
        quizCorrectIndex: 1,
        quizExplanation: '`-Y` applies a Wireshark display filter expression in TShark.',
        xpReward: 70,
      },
    ],
  },
  {
    slug: 'bettercap',
    categorySlug: 'sniffing-and-spoofing',
    name: 'Bettercap',
    summary: 'Modern Go network inspection framework for Ethernet, BLE, and Wi-Fi research labs.',
    purpose: 'Demonstrate ARP/LLMNR/DNS weaknesses in isolated labs and test Zero-Trust network segmentation.',
    installCommand: 'sudo apt update && sudo apt install -y bettercap',
    supportedOs: 'Kali Linux, Linux, macOS',
    versionNote: '2.32+',
    difficulty: 'Advanced',
    minLevelNumber: 6,
    xpReward: 115,
    status: 'active',
    prerequisitesJson: ['Layer 2 ARP & switch security (DAI)'],
    basicCommandsJson: [
      {
        command: 'sudo bettercap -iface eth0',
        explanation: 'Starts interactive network monitor session on interface `eth0`.',
        flagBreakdown: [{ flag: '-iface eth0', meaning: 'Bind to lab Ethernet interface' }],
      },
    ],
    intermediateCommandsJson: [],
    advancedCommandsJson: [],
    commonErrorsJson: [],
    relatedToolSlugsJson: ['responder', 'wireshark'],
    officialDocsUrl: 'https://www.bettercap.org/',
    githubUrl: 'https://github.com/bettercap/bettercap',
    interactiveSupported: false,
  },
  {
    slug: 'responder',
    categorySlug: 'sniffing-and-spoofing',
    name: 'Responder',
    summary: 'LLMNR, NBT-NS, and mDNS auditor demonstrating Windows/internal name resolution risks.',
    purpose: 'Prove legacy multicast broadcast protocol risks in isolated AD labs (and why disabling LLMNR/NBT-NS matters).',
    installCommand: 'sudo apt update && sudo apt install -y responder',
    supportedOs: 'Kali Linux, Linux',
    versionNote: '3.1+',
    difficulty: 'Advanced',
    minLevelNumber: 6,
    xpReward: 110,
    status: 'active',
    prerequisitesJson: ['Windows NetBIOS/LLMNR name resolution'],
    basicCommandsJson: [
      {
        command: 'sudo responder -I eth0 -A',
        explanation: 'Runs Responder in strict Analyze (-A) passive mode without sending spoofed replies.',
        flagBreakdown: [{ flag: '-A', meaning: 'Analyze mode (listen-only, zero active poisoning)' }],
      },
    ],
    intermediateCommandsJson: [],
    advancedCommandsJson: [],
    commonErrorsJson: [],
    relatedToolSlugsJson: ['bettercap', 'hashcat'],
    officialDocsUrl: 'https://www.kali.org/tools/responder/',
    githubUrl: 'https://github.com/lgandx/Responder',
    interactiveSupported: false,
  },
  {
    slug: 'autopsy',
    categorySlug: 'digital-forensics',
    name: 'Autopsy (Sleuth Kit GUI)',
    summary: 'Graphical digital forensics platform for disk image timeline reconstruction and artifact analysis.',
    purpose: 'Examine deleted files, browser artifacts, registry hives, and EXIF metadata in forensic acquisitions.',
    installCommand: 'sudo apt update && sudo apt install -y autopsy',
    supportedOs: 'Kali Linux, Linux, Windows, macOS',
    versionNote: '4.x',
    difficulty: 'Intermediate',
    minLevelNumber: 7,
    xpReward: 120,
    status: 'active',
    prerequisitesJson: ['Filesystems (NTFS, ext4) & SHA-256 integrity'],
    basicCommandsJson: [
      {
        command: 'autopsy',
        explanation: 'Starts local Autopsy forensic workbench for importing E01/raw disk images.',
        flagBreakdown: [{ flag: 'Ingest Modules', meaning: 'Hash lookup, keyword search, and timeline modules' }],
      },
    ],
    intermediateCommandsJson: [],
    advancedCommandsJson: [],
    commonErrorsJson: [],
    relatedToolSlugsJson: ['volatility3', 'binwalk'],
    officialDocsUrl: 'https://www.autopsy.com/support/',
    githubUrl: 'https://github.com/sleuthkit/autopsy',
    interactiveSupported: false,
  },
  {
    slug: 'volatility3',
    categorySlug: 'digital-forensics',
    name: 'Volatility 3',
    summary: 'Leading open-source framework for volatile RAM dump forensics and malware process analysis.',
    purpose: 'Detect process hollowing, inspect open sockets, recover injected DLLs/command lines from RAM captures.',
    installCommand: 'sudo apt update && sudo apt install -y volatility3',
    supportedOs: 'Kali Linux, Linux, macOS, Windows (Python 3)',
    versionNote: '2.x+',
    difficulty: 'Advanced',
    minLevelNumber: 7,
    xpReward: 140,
    status: 'active',
    prerequisitesJson: ['Virtual memory, OS process tables, and PID hierarchy'],
    basicCommandsJson: [
      {
        command: 'vol -f memdump.raw windows.pslist',
        explanation: 'Lists active OS processes by walking kernel EPROCESS linked list.',
        flagBreakdown: [
          { flag: '-f memdump.raw', meaning: 'Target RAM dump image' },
          { flag: 'windows.pslist', meaning: 'Process list inspection plugin' },
        ],
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'vol -f memdump.raw windows.malfind',
        explanation: 'Locates suspicious executable/RWX private memory pages indicating code injection.',
        flagBreakdown: [{ flag: 'windows.malfind', meaning: 'Detect unbacked injected shellcode memory regions' }],
      },
    ],
    advancedCommandsJson: [],
    commonErrorsJson: [
      {
        error: 'Unable to satisfy symbol table requirements',
        cause: 'Offline Volatility environment missing OS ISF symbol tables.',
        fix: 'Supply pre-downloaded ISF symbol packs under `volatility3/symbols`.',
      },
    ],
    relatedToolSlugsJson: ['autopsy', 'binwalk'],
    officialDocsUrl: 'https://volatility3.readthedocs.io/',
    githubUrl: 'https://github.com/volatilityfoundation/volatility3',
    interactiveSupported: false,
  },
  {
    slug: 'binwalk',
    categorySlug: 'hardware-security',
    name: 'Binwalk',
    summary: 'Firmware & embedded binary analysis tool for locating compressed filesystems and signatures.',
    purpose: 'Inspect router/IoT firmware blobs for SquashFS filesystems, hardcoded keys, or JFFS2 partitions.',
    installCommand: 'sudo apt update && sudo apt install -y binwalk',
    supportedOs: 'Kali Linux, Linux',
    versionNote: '2.3 / 3.x',
    difficulty: 'Intermediate',
    minLevelNumber: 7,
    xpReward: 95,
    status: 'active',
    prerequisitesJson: ['File magic headers & SquashFS concepts'],
    basicCommandsJson: [
      {
        command: 'binwalk -e firmware.bin',
        explanation: 'Scans firmware image signatures and automatically extracts embedded filesystems (-e).',
        flagBreakdown: [{ flag: '-e', meaning: 'Auto-extract known archive/filesystem offsets' }],
      },
    ],
    intermediateCommandsJson: [],
    advancedCommandsJson: [],
    commonErrorsJson: [],
    relatedToolSlugsJson: ['ghidra', 'radare2', 'autopsy'],
    officialDocsUrl: 'https://www.kali.org/tools/binwalk/',
    githubUrl: 'https://github.com/ReFirmLabs/binwalk',
    interactiveSupported: false,
  },
  {
    slug: 'cherrytree',
    categorySlug: 'reporting-tools',
    name: 'CherryTree',
    summary: 'Hierarchical rich-text & syntax-highlighted note-taking application bundled in Kali.',
    purpose: 'Organize scan outputs, target scopes, screenshots, and remediation evidence cleanly during engagements.',
    installCommand: 'sudo apt update && sudo apt install -y cherrytree',
    supportedOs: 'Kali Linux, Linux, macOS, Windows',
    versionNote: '1.1+',
    difficulty: 'Beginner',
    minLevelNumber: 4,
    xpReward: 60,
    status: 'active',
    prerequisitesJson: ['Structured penetration test documentation'],
    basicCommandsJson: [
      {
        command: 'cherrytree assessment_notes.ctd &',
        explanation: 'Opens an encrypted/compressed SQLite CherryTree notebook for structured recon logs.',
        flagBreakdown: [{ flag: '.ctd/.ctb', meaning: 'CherryTree XML or SQLite notebook database' }],
      },
    ],
    intermediateCommandsJson: [],
    advancedCommandsJson: [],
    commonErrorsJson: [],
    relatedToolSlugsJson: ['nmap', 'gobuster'],
    officialDocsUrl: 'https://www.kali.org/tools/cherrytree/',
    githubUrl: 'https://github.com/giuspen/cherrytree',
    interactiveSupported: false,
  },
  {
    slug: 'setoolkit',
    categorySlug: 'social-engineering-tools',
    name: 'Social-Engineer Toolkit (SET)',
    summary: 'Authorized enterprise awareness testing framework for human-factor phishing simulations.',
    purpose: 'Educate teams on credential-harvesting patterns strictly within signed corporate awareness engagements.',
    installCommand: 'sudo apt update && sudo apt install -y set',
    supportedOs: 'Kali Linux, Linux',
    versionNote: '8.x',
    difficulty: 'Intermediate',
    minLevelNumber: 6,
    xpReward: 85,
    status: 'active',
    prerequisitesJson: ['Signed authorization & scope governance'],
    basicCommandsJson: [
      {
        command: 'sudo setoolkit',
        explanation: 'Starts the menu-driven awareness simulation console (always ensure signed written scope).',
        flagBreakdown: [{ flag: 'setoolkit', meaning: 'Interactive awareness scenario menu' }],
      },
    ],
    intermediateCommandsJson: [],
    advancedCommandsJson: [],
    commonErrorsJson: [],
    relatedToolSlugsJson: ['cherrytree'],
    officialDocsUrl: 'https://www.kali.org/tools/set/',
    githubUrl: 'https://github.com/trustedsec/social-engineer-toolkit',
    interactiveSupported: false,
  },
  {
    slug: 'netcat',
    categorySlug: 'system-services',
    name: 'Netcat (nc)',
    summary: 'The TCP/IP Swiss Army knife for socket debugging, banner grabbing, and authorized lab listeners.',
    purpose: 'Test open TCP/UDP connectivity manually, inspect raw banners, and debug firewall rules cleanly.',
    installCommand: 'sudo apt update && sudo apt install -y netcat-traditional',
    supportedOs: 'Kali Linux, Linux, macOS',
    versionNote: 'Traditional / OpenBSD',
    difficulty: 'Beginner',
    minLevelNumber: 3,
    xpReward: 80,
    status: 'active',
    prerequisitesJson: ['TCP sockets & ports'],
    basicCommandsJson: [
      {
        command: 'nc -zv 192.168.56.10 22 80',
        explanation: 'Zero-I/O mode port connectivity test on ports 22 and 80 without sending payload data.',
        flagBreakdown: [
          { flag: '-z', meaning: 'Zero-I/O port scan/check mode' },
          { flag: '-v', meaning: 'Verbose connection output' },
        ],
      },
    ],
    intermediateCommandsJson: [
      {
        command: 'nc -lvnp 4444',
        explanation: 'Opens a local TCP listener on port 4444 without DNS resolution inside an authorized lab.',
        flagBreakdown: [
          { flag: '-l', meaning: 'Listen mode' },
          { flag: '-v', meaning: 'Verbose output' },
          { flag: '-n', meaning: 'Skip DNS lookups' },
          { flag: '-p 4444', meaning: 'Bind port 4444' },
        ],
      },
    ],
    advancedCommandsJson: [],
    commonErrorsJson: [],
    relatedToolSlugsJson: ['nmap', 'proxychains4'],
    officialDocsUrl: 'https://www.kali.org/tools/netcat/',
    githubUrl: null,
    interactiveSupported: true,
    lessons: [
      {
        slug: 'netcat-listener-flags',
        title: 'Understanding Netcat Sockets & -lvnp Flags',
        stepOrder: 1,
        contentMarkdown:
          'Netcat opens raw TCP or UDP connections directly from your terminal. Defenders use `-zv` to test firewall reachability cleanly, while isolated lab tests rely on `-lvnp` for deterministic socket listeners.',
        commandPractice: 'nc -zv 192.168.56.10 22',
        expectedGoal: 'Verify TCP socket connectivity toward `192.168.56.10` using `nc`.',
        quizQuestion: 'What does the `-n` flag instruct Netcat (`nc -lvnp`) to do?',
        quizOptionsJson: [
          'Encrypt the stream with TLS',
          'Skip DNS name resolution on IP addresses',
          'Run stealth SYN packets',
          'Limit bandwidth to 10KB/s',
        ],
        quizCorrectIndex: 1,
        quizExplanation: '`-n` skips DNS lookups, preventing delays and unintended outbound DNS queries.',
        xpReward: 60,
      },
    ],
  },
  {
    slug: 'proxychains4',
    categorySlug: 'system-services',
    name: 'ProxyChains-NG',
    summary: 'Forces TCP connections from standard CLI tools cleanly through SOCKS4/SOCKS5/HTTP tunnels.',
    purpose: 'Route authorized pentest traffic transparently over SSH dynamic SOCKS tunnels inside segmented lab ranges.',
    installCommand: 'sudo apt update && sudo apt install -y proxychains4',
    supportedOs: 'Kali Linux, Linux, macOS',
    versionNote: '4.17+',
    difficulty: 'Intermediate',
    minLevelNumber: 8,
    xpReward: 90,
    status: 'active',
    prerequisitesJson: ['SSH `-D` dynamic port forwarding', 'SOCKS5 proxies'],
    basicCommandsJson: [
      {
        command: 'proxychains4 -q nmap -sT -Pn 192.168.56.20',
        explanation: 'Routes a TCP Connect scan (-sT) through configured SOCKS5 tunnel quietly.',
        flagBreakdown: [
          { flag: '-q', meaning: 'Suppress verbose chain handshake logs' },
          { flag: '-sT', meaning: 'Required because raw SYN (-sS) packets cannot traverse SOCKS proxies' },
        ],
      },
    ],
    intermediateCommandsJson: [],
    advancedCommandsJson: [],
    commonErrorsJson: [
      {
        error: 'ICMP ping or Nmap -sS hangs or bypasses tunnel',
        cause: 'SOCKS proxies only relay full TCP streams, never ICMP or raw SYN sockets.',
        fix: 'Always pass `-sT -Pn` when running Nmap via proxychains4.',
      },
    ],
    relatedToolSlugsJson: ['nmap', 'netcat'],
    officialDocsUrl: 'https://www.kali.org/tools/proxychains-ng/',
    githubUrl: 'https://github.com/rofl0r/proxychains-ng',
    interactiveSupported: false,
  },
  {
    slug: 'tmux',
    categorySlug: 'system-services',
    name: 'Tmux (Terminal Multiplexer)',
    summary: 'Persistent split-pane terminal workspace manager essential for multi-tool operations.',
    purpose: 'Keep listeners, scans, and logs alive cleanly across split panes and resilient SSH sessions.',
    installCommand: 'sudo apt update && sudo apt install -y tmux',
    supportedOs: 'Kali Linux, Linux, macOS',
    versionNote: '3.4+',
    difficulty: 'Beginner',
    minLevelNumber: 2,
    xpReward: 70,
    status: 'active',
    prerequisitesJson: ['Basic Linux shell proficiency'],
    basicCommandsJson: [
      {
        command: 'tmux new -s ops_lab',
        explanation: 'Creates a named persistent session `ops_lab` that survives SSH disconnects.',
        flagBreakdown: [{ flag: 'new -s ops_lab', meaning: 'Create named multiplexer session' }],
      },
    ],
    intermediateCommandsJson: [],
    advancedCommandsJson: [],
    commonErrorsJson: [],
    relatedToolSlugsJson: ['netcat', 'cherrytree'],
    officialDocsUrl: 'https://www.kali.org/tools/tmux/',
    githubUrl: 'https://github.com/tmux/tmux',
    interactiveSupported: false,
    lessons: [
      {
        slug: 'tmux-session-persistence',
        title: 'Multi-Pane Operations & Persistent Sessions with Tmux',
        stepOrder: 1,
        contentMarkdown:
          'Security operators rarely run a single terminal. Tmux lets you split panes (`Ctrl+B %` / `Ctrl+B "`), detach cleanly (`Ctrl+B d`), and re-attach (`tmux attach -t ops_lab`) without losing running log tails or listeners.',
        commandPractice: 'ps aux',
        expectedGoal: 'Inspect active simulated terminal processes using `ps aux` or `ls -la`.',
        quizQuestion: 'Why is running long tasks inside a `tmux` session considered standard operator practice?',
        quizOptionsJson: [
          'It bypasses sudo authentication',
          'Sessions keep running in the background if SSH disconnects',
          'It encrypts disk partitions automatically',
          'It installs missing apt packages',
        ],
        quizCorrectIndex: 1,
        quizExplanation: 'Tmux decouples processes from your transient SSH TTY so work survives disconnects.',
        xpReward: 60,
      },
    ],
  },
];

const KALI_MISSIONS_SEED = [
  {
    slug: 'daily-ssh-log-hunt',
    title: 'Daily Challenge: SSH Compromise Triage',
    missionType: 'daily',
    categorySlug: 'digital-forensics',
    levelNumber: 1,
    difficulty: 'Beginner',
    description:
      'Filter `/home/kali/evidence/auth.log` to isolate successful attacker access amidst SSH brute-force noise.',
    scenarioBrief:
      'SOC alerts fired for multiple failed SSH logins on `lab01`. Use your safe simulated terminal to pinpoint which account was ACTUALLY compromised and what backdoor user was created.',
    objectivesJson: [
      'Inspect `/home/kali/evidence/auth.log` using `grep`',
      'Identify the single IP that received `Accepted password`',
      'Confirm the persistence username created via `sudo`',
    ],
    requiredToolSlugsJson: ['whois'],
    terminalChallengeJson: {
      startingDir: '/home/kali',
      simulatedPrompt: 'kali@kali3977:~/evidence$',
      steps: [
        {
          id: 'step-grep-accepted',
          instruction: 'Run grep to filter lines containing `Accepted` in `/home/kali/evidence/auth.log`.',
          expectedPattern: 'grep.*Accepted.*auth\\.log',
          hint: 'Try: grep "Accepted" /home/kali/evidence/auth.log',
          explanation: 'Filtering positive logins separates noise scanners from actual compromises.',
        },
      ],
    },
    assessmentJson: {
      question: 'Which IP address succeeded in logging in as `opsadmin`?',
      options: ['198.51.100.44', '203.0.113.77', '192.168.56.10', '127.0.0.1'],
      correctIndex: 1,
      explanation: '198.51.100.44 failed every attempt; 203.0.113.77 succeeded and added `svc_backup_adm`.',
    },
    relatedLabSlug: 'lab-interactive-auth-log-triage',
    xpReward: 160,
    achievementCode: 'KALI_ROOKIE',
  },
  {
    slug: 'quest-network-hunter-nmap',
    title: 'Quest: Perimeter Service Fingerprinting',
    missionType: 'quest',
    categorySlug: 'information-gathering',
    levelNumber: 3,
    difficulty: 'Beginner',
    description: 'Fingerprint listening services and default NSE metadata on synthetic lab host `192.168.56.10`.',
    scenarioBrief:
      'An authorized internal range host (`192.168.56.10`) has unknown services active. Perform safe service version discovery in the educational terminal.',
    objectivesJson: [
      'Execute `nmap -sV 192.168.56.10` in the terminal simulator',
      'Identify the web server software & PostgreSQL port state',
    ],
    requiredToolSlugsJson: ['nmap', 'netcat'],
    terminalChallengeJson: {
      startingDir: '/home/kali',
      simulatedPrompt: 'kali@kali3977:~$',
      steps: [
        {
          id: 'step-nmap-sv',
          instruction: 'Scan `192.168.56.10` with service version detection (`-sV`).',
          expectedPattern: 'nmap\\s+.*(-sV|-A).*192\\.168\\.56\\.10',
          hint: 'Run: nmap -sV -sC 192.168.56.10',
          explanation: '`-sV` accurately fingerprints OpenSSH 9.6p1 and nginx 1.24.0.',
        },
      ],
    },
    assessmentJson: {
      question: 'What port state did Nmap report for PostgreSQL (`5432/tcp`) on `192.168.56.10`?',
      options: ['open', 'closed', 'filtered', 'unfiltered'],
      correctIndex: 2,
      explanation: '5432/tcp reported `filtered`, meaning a firewall drops external probes cleanly.',
    },
    relatedLabSlug: null,
    xpReward: 200,
    achievementCode: 'KALI_NETWORK_HUNTER',
  },
  {
    slug: 'mission-web-recon-gobuster',
    title: 'Web Recon Mission: Unlinked Routes & Header Hardening',
    missionType: 'mission',
    categorySlug: 'web-application-analysis',
    levelNumber: 5,
    difficulty: 'Intermediate',
    description: 'Enumerate hidden endpoints on `http://app.lab.local` and audit HTTP cookie security headers.',
    scenarioBrief:
      'Before deploying `app.lab.local`, discover exposed administrative paths and confirm session headers.',
    objectivesJson: [
      'Run `gobuster dir -u http://app.lab.local -w /home/kali/wordlists/common.txt`',
      'Inspect HTTP headers with `curl -I http://app.lab.local`',
    ],
    requiredToolSlugsJson: ['gobuster', 'burpsuite', 'nikto'],
    terminalChallengeJson: {
      startingDir: '/home/kali',
      simulatedPrompt: 'kali@kali3977:~$',
      steps: [
        {
          id: 'step-gobuster-dir',
          instruction: 'Enumerate directories on `http://app.lab.local` using Gobuster.',
          expectedPattern: 'gobuster\\s+dir.*app\\.lab\\.local',
          hint: 'Run: gobuster dir -u http://app.lab.local -w /home/kali/wordlists/common.txt',
          explanation: 'Directory enumeration uncovers `/admin-login` (403) and `/robots.txt` (200).',
        },
      ],
    },
    assessmentJson: {
      question: 'Which HTTP status code did `/admin-login` return during Gobuster enumeration?',
      options: ['200 OK', '301 Moved Permanently', '403 Forbidden', '500 Internal Server Error'],
      correctIndex: 2,
      explanation: '`/admin-login` returned 403 Forbidden, confirming access controls restrict anonymous users.',
    },
    relatedLabSlug: 'lab-interactive-http-header-hardening',
    xpReward: 240,
    achievementCode: 'KALI_WEB_AGENT',
  },
  {
    slug: 'mission-dns-pcap-tshark',
    title: 'Traffic Analysis Mission: DNS Tunnel Investigation',
    missionType: 'mission',
    categorySlug: 'sniffing-and-spoofing',
    levelNumber: 4,
    difficulty: 'Intermediate',
    description: 'Analyze synthetic capture `/home/kali/captures/dns_tunnel.pcap` using `tshark`.',
    scenarioBrief:
      'An anomaly sensor flagged unusual outbound DNS TXT queries. Inspect the capture safely without opening untrusted hosts.',
    objectivesJson: ['Run `tshark -r /home/kali/captures/dns_tunnel.pcap`'],
    requiredToolSlugsJson: ['tshark', 'wireshark'],
    terminalChallengeJson: {
      startingDir: '/home/kali',
      simulatedPrompt: 'kali@kali3977:~$',
      steps: [
        {
          id: 'step-tshark-read',
          instruction: 'Read the synthetic DNS tunnel PCAP with `tshark -r`.',
          expectedPattern: 'tshark\\s+.*-r.*dns_tunnel\\.pcap',
          hint: 'Run: tshark -r /home/kali/captures/dns_tunnel.pcap',
          explanation: 'TShark extracts long Base64-like subdomain prefixes targeting `exfil.lab.local`.',
        },
      ],
    },
    assessmentJson: {
      question: 'Which DNS record type was abused for data exfiltration inside `dns_tunnel.pcap`?',
      options: ['MX', 'TXT', 'PTR', 'SOA'],
      correctIndex: 1,
      explanation: 'Attackers encode arbitrary payload chunks inside TXT queries (`dns.qry.type == 16`).',
    },
    relatedLabSlug: 'lab-network-pcap-triage',
    xpReward: 220,
    achievementCode: null,
  },
  {
    slug: 'hidden-suid-escalation-audit',
    title: 'Hidden Challenge: Rogue SUID Binary Hunt',
    missionType: 'hidden',
    categorySlug: 'system-services',
    levelNumber: 2,
    difficulty: 'Intermediate',
    description: 'Uncover an anomalous custom SUID binary lurking outside standard Debian packages.',
    scenarioBrief:
      'Hidden audit challenge! Use `find` with octal permission mask `-4000` in the simulated host to spot a non-standard SUID executable.',
    objectivesJson: ['Search the virtual filesystem for SUID binaries (`find / -perm -4000`)'],
    requiredToolSlugsJson: ['tmux'],
    terminalChallengeJson: {
      startingDir: '/home/kali',
      simulatedPrompt: 'kali@kali3977:~$',
      steps: [
        {
          id: 'step-find-suid',
          instruction: 'Enumerate SUID executables using `find / -perm -4000`.',
          expectedPattern: 'find\\s+.*-perm\\s+-4000',
          hint: 'Run: find / -perm -4000 2>/dev/null',
          explanation: '`/usr/local/bin/lab-backup-helper` stands out outside normal `/usr/bin/sudo` & `passwd`.',
        },
      ],
    },
    assessmentJson: {
      question: 'Which custom binary outside `/usr/bin` appeared with the SUID bit set?',
      options: [
        '/usr/bin/passwd',
        '/usr/local/bin/lab-backup-helper',
        '/home/kali/README.txt',
        '/etc/passwd',
      ],
      correctIndex: 1,
      explanation: 'Custom SUID binaries in `/usr/local/bin` are high-priority privilege-escalation audit targets.',
    },
    relatedLabSlug: 'lab-interactive-linux-permissions-walkthrough',
    xpReward: 260,
    achievementCode: 'KALI_HIDDEN_SEEKER',
  },
  {
    slug: 'boss-perimeter-breach-triage',
    title: 'Boss Mission: Operation Shadow Gateway',
    missionType: 'boss',
    categorySlug: 'exploitation-tools',
    levelNumber: 6,
    difficulty: 'Hard',
    description:
      'Chain Nmap scanning, web directory discovery, and offline hash auditing in one end-to-end Boss Operation.',
    scenarioBrief:
      'An internal staging host (`192.168.56.10` / `app.lab.local`) suffered credential reuse. Validate the exposed attack surface, audit `sample.sha256`, and deliver the security recommendation.',
    objectivesJson: [
      'Scan `192.168.56.10` with Nmap `-sV`',
      'Audit `/home/kali/hashes/sample.sha256` with `john` or `hashcat`',
      'Pass the defensive architecture review',
    ],
    requiredToolSlugsJson: ['nmap', 'gobuster', 'john', 'metasploit-framework'],
    terminalChallengeJson: {
      startingDir: '/home/kali',
      simulatedPrompt: 'kali@kali3977:~$',
      steps: [
        {
          id: 'boss-nmap',
          instruction: 'Fingerprint open services on `192.168.56.10`.',
          expectedPattern: 'nmap\\s+.*-sV.*192\\.168\\.56\\.10',
          hint: 'nmap -sV 192.168.56.10',
          explanation: 'Confirmed exposed SSH & Nginx versions.',
        },
        {
          id: 'boss-john',
          instruction: 'Audit `/home/kali/hashes/sample.sha256` using `john` or `hashcat`.',
          expectedPattern: '(john|hashcat).*sample\\.sha256',
          hint: 'john /home/kali/hashes/sample.sha256',
          explanation: 'Confirmed unsalted raw SHA-256 weak digest risk.',
        },
      ],
    },
    assessmentJson: {
      question: 'Which password storage upgrade fixes the vulnerability demonstrated in `sample.sha256`?',
      options: [
        'Encode passwords with Base64',
        'Switch to raw MD5 twice',
        'Migrate to Argon2id with unique per-user cryptographic salts',
        'Hide `/etc/passwd` permissions without hashing',
      ],
      correctIndex: 2,
      explanation: 'Memory-hard slow KDFs like Argon2id with unique random salts defeat GPU cracking.',
    },
    relatedLabSlug: null,
    xpReward: 400,
    achievementCode: 'KALI_BOSS_SLAYER',
  },
  {
    slug: 'capstone-elite-operator',
    title: 'Final Capstone: Full-Spectrum Red & Blue Assessment',
    missionType: 'capstone',
    categorySlug: 'reverse-engineering',
    levelNumber: 8,
    difficulty: 'Expert',
    description:
      'Synthesize Recon, Web Enumeration, DFIR Packet Triage, and Least-Privilege Remediation in the Level 8 Capstone.',
    scenarioBrief:
      'Prove mastery across the Kali Linux toolchain by tracing every stage of an incident from network discovery (`192.168.56.10`), PCAP exfiltration, to privilege auditing.',
    objectivesJson: [
      'Complete `nmap -sV -sC 192.168.56.10` scan verification',
      'Inspect `dns_tunnel.pcap` with `tshark`',
      'Pass the Elite Operator security engineering evaluation',
    ],
    requiredToolSlugsJson: ['nmap', 'tshark', 'ghidra', 'volatility3', 'proxychains4'],
    terminalChallengeJson: {
      startingDir: '/home/kali',
      simulatedPrompt: 'kali@kali3977:~$',
      steps: [
        {
          id: 'cap-nmap',
          instruction: 'Run `nmap -sV -sC 192.168.56.10` to record baseline services.',
          expectedPattern: 'nmap\\s+.*-sV.*192\\.168\\.56\\.10',
          hint: 'nmap -sV -sC 192.168.56.10',
          explanation: 'Baseline service map verified.',
        },
        {
          id: 'cap-tshark',
          instruction: 'Inspect `/home/kali/captures/dns_tunnel.pcap` with `tshark`.',
          expectedPattern: 'tshark\\s+.*dns_tunnel\\.pcap',
          hint: 'tshark -r /home/kali/captures/dns_tunnel.pcap',
          explanation: 'Exfiltration TXT stream confirmed.',
        },
      ],
    },
    assessmentJson: {
      question: 'When tunneling Nmap through `proxychains4` over an SSH SOCKS5 pivot, which scan type is required?',
      options: [
        '-sS (TCP SYN stealth scan)',
        '-sU (Raw UDP scan)',
        '-sT (Full TCP Connect scan)',
        '-O (Raw OS fingerprinting)',
      ],
      correctIndex: 2,
      explanation: 'SOCKS proxies operate at socket layer 5 and only relay full TCP Connect (`-sT`) streams.',
    },
    relatedLabSlug: 'lab-dfir-memory-forensics',
    xpReward: 600,
    achievementCode: 'KALI_CAPSTONE_MASTER',
  },
];

const KALI_ACHIEVEMENTS = [
  {
    code: 'KALI_ROOKIE',
    title: 'Kali Linux Initiate',
    description: 'Completed your first Learn KALI interactive exercise or mission.',
    category: 'Learn KALI',
    xpBonus: 75,
  },
  {
    code: 'KALI_NETWORK_HUNTER',
    title: 'Network Hunter',
    description: 'Mastered Nmap service discovery inside the Learn KALI simulator.',
    category: 'Learn KALI',
    xpBonus: 120,
  },
  {
    code: 'KALI_WEB_AGENT',
    title: 'Web Security Agent',
    description: 'Completed web route enumeration and header security assessment.',
    category: 'Learn KALI',
    xpBonus: 140,
  },
  {
    code: 'KALI_HIDDEN_SEEKER',
    title: 'Hidden Vector Hunter',
    description: 'Discovered and solved a hidden Learn KALI SUID challenge.',
    category: 'Learn KALI',
    xpBonus: 150,
  },
  {
    code: 'KALI_BOSS_SLAYER',
    title: 'Operation Boss Victor',
    description: 'Defeated the Learn KALI multi-tool Boss Mission.',
    category: 'Learn KALI',
    xpBonus: 200,
  },
  {
    code: 'KALI_CAPSTONE_MASTER',
    title: 'Elite Security Operator',
    description: 'Completed the Final Learn KALI Capstone Investigation.',
    category: 'Learn KALI',
    xpBonus: 300,
  },
];

export async function syncLearnKaliSeed(): Promise<void> {
  // 1. Levels 1-8
  for (const lvl of LEARN_KALI_LEVELS) {
    const [existing] = await db
      .select()
      .from(kaliLevels)
      .where(eq(kaliLevels.levelNumber, lvl.levelNumber))
      .limit(1);
    if (!existing) {
      await db.insert(kaliLevels).values(lvl);
    }
  }

  // 2. Official Categories
  const categoryIdMap = new Map<string, number>();
  for (const cat of KALI_CATEGORIES_SEED) {
    const [existing] = await db
      .select()
      .from(kaliCategories)
      .where(eq(kaliCategories.slug, cat.slug))
      .limit(1);
    if (!existing) {
      const [inserted] = await db.insert(kaliCategories).values(cat).returning();
      categoryIdMap.set(cat.slug, inserted.id);
    } else {
      categoryIdMap.set(cat.slug, existing.id);
    }
  }

  // 3. Tools + Lessons
  for (const toolItem of KALI_TOOLS_SEED) {
    const catId = categoryIdMap.get(toolItem.categorySlug);
    if (!catId) continue;

    let toolId: number;
    const [existing] = await db
      .select()
      .from(kaliTools)
      .where(eq(kaliTools.slug, toolItem.slug))
      .limit(1);
    if (!existing) {
      const { lessons: _lessons, ...toolValues } = toolItem;
      const [inserted] = await db
        .insert(kaliTools)
        .values({ ...toolValues, categoryId: catId })
        .returning();
      toolId = inserted.id;
    } else {
      toolId = existing.id;
      if (toolItem.slug === 'whois' && existing.commonErrorsJson.length === 0) {
        await db
          .update(kaliTools)
          .set({
            purpose: toolItem.purpose,
            basicCommandsJson: toolItem.basicCommandsJson,
            intermediateCommandsJson: toolItem.intermediateCommandsJson,
            advancedCommandsJson: toolItem.advancedCommandsJson,
            commonErrorsJson: toolItem.commonErrorsJson,
            relatedToolSlugsJson: toolItem.relatedToolSlugsJson,
            updatedAt: new Date(),
          })
          .where(eq(kaliTools.id, existing.id));
      }
    }

    if (toolItem.lessons) {
      for (const lsn of toolItem.lessons) {
        const [existingLesson] = await db
          .select()
          .from(kaliToolLessons)
          .where(eq(kaliToolLessons.slug, lsn.slug))
          .limit(1);
        if (!existingLesson) {
          await db.insert(kaliToolLessons).values({
            ...lsn,
            toolId,
          });
        }
      }
    }
  }

  // 4. Missions
  for (const mission of KALI_MISSIONS_SEED) {
    const [existing] = await db
      .select()
      .from(kaliMissions)
      .where(eq(kaliMissions.slug, mission.slug))
      .limit(1);
    if (!existing) {
      await db.insert(kaliMissions).values(mission);
    }
  }

  // 5. Achievements
  for (const ach of KALI_ACHIEVEMENTS) {
    const [existing] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.code, ach.code))
      .limit(1);
    if (!existing) {
      await db.insert(achievements).values(ach).onConflictDoNothing();
    }
  }
}
