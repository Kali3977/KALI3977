export interface SimulatorState {
  cwd: string;
  history: string[];
  installedPackages?: string[];
  customFiles?: Record<string, string>;
  deletedFiles?: string[];
  customDirs?: Record<string, string[]>;
  isRootContext?: boolean;
}

export interface FlagExplanation {
  token: string;
  meaning: string;
}

export interface SimulatedCommandResult {
  command: string;
  output: string;
  exitCode: number;
  nextCwd: string;
  clearScreen?: boolean;
  commandBreakdown: FlagExplanation[];
  coachingHint: string | null;
  safetyBlocked?: boolean;
  nextState?: SimulatorState;
}

export const DEFAULT_INSTALLED_PACKAGES = [
  'bash',
  'zsh',
  'coreutils',
  'grep',
  'findutils',
  'iproute2',
  'curl',
  'dnsutils',
  'nmap',
  'gobuster',
  'tshark',
  'john',
  'hashcat',
  'hydra',
  'sqlmap',
  'nikto',
  'ffuf',
  'netcat-traditional',
  'tmux',
];

export const SUPPORTED_SIMULATOR_COMMANDS: ReadonlyArray<{
  command: string;
  category: string;
  summary: string;
}> = [
  { command: 'help', category: 'Core', summary: 'List supported simulated Linux & Kali commands' },
  { command: 'clear', category: 'Core', summary: 'Clear visible terminal buffer' },
  { command: 'pwd', category: 'Linux', summary: 'Print current working directory' },
  { command: 'ls', category: 'Linux', summary: 'List files and directories (-l, -a, -la)' },
  { command: 'cd', category: 'Linux', summary: 'Change directory inside virtual sandbox' },
  { command: 'cat / head / tail', category: 'Linux', summary: 'Read synthetic logs, wordlists, and notes' },
  { command: 'grep', category: 'Linux', summary: 'Filter lines matching a pattern (-i, -E, -n)' },
  { command: 'find', category: 'Linux', summary: 'Search files & SUID binaries (-perm -4000)' },
  { command: 'mkdir / touch / echo / rm', category: 'Linux', summary: 'Create directories, files, text, or remove files' },
  { command: 'chmod', category: 'Linux', summary: 'Modify virtual POSIX permissions (+x, 755)' },
  { command: 'which / man / history / env', category: 'Linux', summary: 'Locate binaries, inspect manual summaries, check history' },
  { command: 'sudo / apt / apt-get', category: 'Admin', summary: 'Simulate privileged commands & apt package installation' },
  { command: 'id / whoami / uname / ps', category: 'System', summary: 'Inspect user context, kernel, and processes' },
  { command: 'ip / ss / dig / curl', category: 'Network', summary: 'Inspect lab subnet interfaces, sockets, DNS, and HTTP headers' },
  { command: 'whois', category: 'Recon', summary: 'Query static educational WHOIS records (kali.org, app.lab.local)' },
  { command: 'nmap / amass / theHarvester', category: 'Recon', summary: 'Scan and enumerate authorized synthetic lab targets' },
  { command: 'gobuster / ffuf / nikto / sqlmap / whatweb', category: 'Web', summary: 'Enumerate routes, headers, and parameters on app.lab.local' },
  { command: 'tshark / wireshark', category: 'Sniffing', summary: 'Inspect synthetic PCAP traffic captures' },
  { command: 'john / hashcat / hydra', category: 'Passwords', summary: 'Audit weak synthetic hashes & test accounts' },
  { command: 'nc / netcat / proxychains4 / tmux', category: 'Utility', summary: 'Socket checks, proxy chains, and terminal sessions' },
  { command: 'airmon-ng / aircrack-ng / kismet', category: 'Wireless', summary: 'Simulated wireless audit demonstrations' },
  { command: 'r2 / binwalk / strings / exiftool / vol', category: 'Forensics & RE', summary: 'Binary, firmware, and memory triage demos' },
  { command: 'msfdb / msfconsole / bettercap / responder / setoolkit', category: 'Security Suites', summary: 'Guided educational simulations (no host/external impact)' },
];

export function createDefaultSimulatorState(): SimulatorState {
  return {
    cwd: '/home/kali',
    history: [],
    installedPackages: [...DEFAULT_INSTALLED_PACKAGES],
    customFiles: {},
    deletedFiles: [],
    customDirs: {},
  };
}

const BASE_VIRTUAL_FILES: Record<string, string> = {
  '/etc/os-release': `PRETTY_NAME="Kali GNU/Linux Rolling (KALI3977 Simulated Lab)"\nNAME="Kali GNU/Linux"\nID=kali\nID_LIKE=debian\nVERSION_ID="2026.1"`,
  '/etc/passwd': `root:x:0:0:root:/root:/bin/bash\nkali:x:1000:1000:Kali Learner:/home/kali:/usr/bin/zsh\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\npostgres:x:114:120:PostgreSQL administrator:/var/lib/postgresql:/bin/bash`,
  '/home/kali/README.txt': `Welcome to KALI3977 Simulated Interactive Terminal!\nNOTE: This is an educational Linux/Kali simulation — zero commands touch the real backend host.\nAuthorized synthetic targets available:\n  - 192.168.56.10 (VulnWeb Synthetic Host)\n  - 192.168.56.20 (Internal API Gateway)\n  - app.lab.local (Simulated Web Target)\n  - kali.org / example.org (Static Educational WHOIS & OSINT Records)\n\nPractice folders:\n  ~/evidence/auth.log\n  ~/captures/dns_tunnel.pcap\n  ~/hashes/sample.sha256\n  ~/wordlists/common.txt`,
  '/home/kali/evidence/auth.log': `Nov 15 04:11:02 lab01 sshd[4102]: Failed password for root from 198.51.100.44 port 55210 ssh2\nNov 15 04:11:04 lab01 sshd[4102]: Failed password for root from 198.51.100.44 port 55210 ssh2\nNov 15 04:12:19 lab01 sshd[4188]: Accepted password for opsadmin from 203.0.113.77 port 49122 ssh2\nNov 15 04:12:41 lab01 sudo[4205]: opsadmin : USER=root ; COMMAND=/usr/sbin/useradd -m svc_backup_adm\nNov 15 04:12:46 lab01 sudo[4211]: opsadmin : USER=root ; COMMAND=/usr/sbin/usermod -aG sudo svc_backup_adm`,
  '/home/kali/captures/dns_tunnel.pcap': `[PCAP SYNTHETIC SUMMARY]\nFrame 12: DNS Query TXT aGVsbG8ta2FsaTM5Nzc.exfil.lab.local (42 bytes)\nFrame 19: DNS Query TXT c2Vzc2lvbi1rZXktbGVhaw.exfil.lab.local (45 bytes)\nFrame 24: HTTP GET /api/health -> 200 OK`,
  '/home/kali/hashes/sample.sha256': `5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8:synthetic_demo_user\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855:empty_file_digest`,
  '/home/kali/wordlists/common.txt': `robots.txt\nadmin-login\napi\nhealth\nassets\ndashboard`,
  '/var/log/syslog': `Nov 15 08:00:01 lab01 systemd[1]: Started OpenSSH Daemon.\nNov 15 08:00:02 lab01 nginx[912]: Listening on 192.168.56.10:80\nNov 15 08:00:05 lab01 kernel: [UFW BLOCK] IN=eth0 OUT= SRC=198.51.100.99 DST=192.168.56.10 PROTO=TCP DPT=3306`,
};

const BASE_VIRTUAL_DIRS: Record<string, string[]> = {
  '/': ['etc', 'home', 'usr', 'var'],
  '/etc': ['os-release', 'passwd'],
  '/home': ['kali'],
  '/home/kali': ['README.txt', 'evidence', 'captures', 'hashes', 'wordlists'],
  '/home/kali/evidence': ['auth.log'],
  '/home/kali/captures': ['dns_tunnel.pcap'],
  '/home/kali/hashes': ['sample.sha256'],
  '/home/kali/wordlists': ['common.txt'],
  '/usr': ['bin'],
  '/usr/bin': ['nmap', 'gobuster', 'tshark', 'john', 'hashcat', 'hydra', 'sqlmap', 'nc', 'nikto', 'sudo', 'apt'],
  '/var': ['log'],
  '/var/log': ['syslog'],
};

const AUTHORIZED_LAB_HOSTS = new Set([
  '192.168.56.10',
  '192.168.56.20',
  '192.168.56.0/24',
  '127.0.0.1',
  'localhost',
  'app.lab.local',
  'lab.local',
  'scanme.kali3977.local',
]);

const EDUCATIONAL_STATIC_DOMAINS = new Set([
  'kali.org',
  'example.org',
  'example.com',
  'app.lab.local',
  'lab.local',
  'kali3977.lab',
  'scanme.kali3977.local',
]);

function normalizePath(inputPath: string, cwd: string): string {
  let raw = inputPath.trim();
  if (raw === '~') raw = '/home/kali';
  if (raw.startsWith('~/')) raw = `/home/kali/${raw.slice(2)}`;
  const combined = raw.startsWith('/') ? raw : `${cwd === '/' ? '' : cwd}/${raw}`;
  const parts: string[] = [];
  for (const segment of combined.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      parts.pop();
    } else {
      parts.push(segment);
    }
  }
  return `/${parts.join('/')}` || '/';
}

function getParentDir(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx <= 0 ? '/' : filePath.slice(0, idx);
}

function getBaseName(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx < 0 ? filePath : filePath.slice(idx + 1);
}

function getFileContent(path: string, state: SimulatorState): string | undefined {
  if (state.deletedFiles?.includes(path)) return undefined;
  if (state.customFiles && path in state.customFiles) return state.customFiles[path];
  return BASE_VIRTUAL_FILES[path];
}

function getDirEntries(dirPath: string, state: SimulatorState): string[] | undefined {
  const base = BASE_VIRTUAL_DIRS[dirPath];
  const custom = state.customDirs?.[dirPath];
  if (!base && !custom) return undefined;
  const set = new Set<string>([...(base || []), ...(custom || [])]);
  for (const fullFile of Object.keys(state.customFiles || {})) {
    if (getParentDir(fullFile) === dirPath) {
      set.add(getBaseName(fullFile));
    }
  }
  for (const delPath of state.deletedFiles || []) {
    if (getParentDir(delPath) === dirPath) {
      set.delete(getBaseName(delPath));
    }
  }
  return Array.from(set);
}

function isVirtualDir(dirPath: string, state: SimulatorState): boolean {
  return Boolean(BASE_VIRTUAL_DIRS[dirPath] || state.customDirs?.[dirPath]);
}

function cleanTargetHost(rawTarget: string): string {
  return rawTarget
    .replace(/^https?:\/\//i, '')
    .replace(/^ssh:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .split('?')[0]
    .toLowerCase()
    .trim();
}

function isAuthorizedLabTarget(rawTarget: string): boolean {
  const cleaned = cleanTargetHost(rawTarget);
  if (!cleaned) return false;
  if (AUTHORIZED_LAB_HOSTS.has(cleaned)) return true;
  if (cleaned.startsWith('192.168.56.') || cleaned.endsWith('.lab.local')) return true;
  return false;
}

function isEducationalStaticDomain(rawTarget: string): boolean {
  const cleaned = cleanTargetHost(rawTarget);
  if (!cleaned) return false;
  return EDUCATIONAL_STATIC_DOMAINS.has(cleaned) || cleaned.endsWith('.lab.local') || cleaned.endsWith('.kali3977.lab');
}

function tokenizeArgs(line: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

function splitChainedSegments(line: string): Array<{ segment: string; op: '&&' | ';' | null }> {
  const segments: Array<{ segment: string; op: '&&' | ';' | null }> = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '&' && line[i + 1] === '&') {
      segments.push({ segment: current.trim(), op: '&&' });
      current = '';
      i += 1;
      continue;
    }
    if (ch === ';') {
      segments.push({ segment: current.trim(), op: ';' });
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) {
    segments.push({ segment: current.trim(), op: null });
  }
  return segments;
}

function splitTopLevelPipe(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '|') {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const FLAG_DICTIONARY: Record<string, Record<string, string>> = {
  sudo: {
    '-u': 'Run command as specified user',
  },
  apt: {
    update: 'Refresh simulated Debian/Kali package index metadata',
    install: 'Install or verify a simulated Kali/Linux package',
    search: 'Search simulated package repository catalog',
    '-y': 'Automatically confirm installation prompt without pausing',
  },
  'apt-get': {
    update: 'Refresh simulated package index metadata',
    install: 'Install or verify a simulated package',
    '-y': 'Automatically confirm prompts',
  },
  whois: {
    '-h': 'Specify alternative WHOIS server host',
  },
  nmap: {
    '-sV': 'Probe open ports to determine service and version info',
    '-sS': 'TCP SYN stealth scan (half-open)',
    '-sC': 'Run default NSE reconnaissance scripts',
    '-Pn': 'Skip host discovery ping (treat host as online)',
    '-A': 'Enable OS detection, version detection, script scanning, and traceroute',
    '-p': 'Specify target port numbers or ranges',
    '-F': 'Fast scan (top 100 common ports)',
    '-T4': 'Aggressive timing template for faster lab scans',
    '-oA': 'Save scan results in Normal, XML, and Grepable formats',
  },
  gobuster: {
    dir: 'Directory and file brute-forcing mode',
    dns: 'DNS subdomain enumeration mode',
    vhost: 'Virtual host enumeration mode',
    '-u': 'Target synthetic base URL',
    '-w': 'Path to wordlist file',
    '-x': 'File extensions to check (e.g. php,txt,html)',
    '-t': 'Number of concurrent threads',
  },
  ffuf: {
    '-u': 'Target URL containing FUZZ keyword',
    '-w': 'Wordlist path for fuzzing',
    '-ac': 'Automatically calibrate baseline false-positive filtering',
    '-mc': 'Match specific HTTP status codes (e.g. 200,403)',
  },
  tshark: {
    '-r': 'Read packets from a captured .pcap/.pcapng file',
    '-Y': 'Apply Wireshark display filter expression',
    '-T': 'Set output field formatting (e.g. fields)',
    '-e': 'Specific protocol field to extract',
  },
  hydra: {
    '-l': 'Specify single synthetic test username',
    '-L': 'Specify username list file',
    '-P': 'Specify password wordlist path',
    '-t': 'Number of parallel authentication tasks',
    '-V': 'Verbose attempt logging',
  },
  sqlmap: {
    '-u': 'Specify authorized target URL with query parameter',
    '--batch': 'Run non-interactively using default safe prompts',
    '--dbs': 'Enumerate database schema names in lab target',
  },
  nikto: {
    '-h': 'Target host URL or IP',
    '-Tuning': 'Select specific Nikto vulnerability test classes',
    '-o': 'Output report file path',
    '-Format': 'Report output format (htm, csv, txt)',
  },
  ls: {
    '-l': 'Long listing showing permissions, owner, size, and timestamps',
    '-a': 'Include hidden dotfiles (starting with .)',
    '-la': 'Long listing including hidden files',
  },
  find: {
    '-perm': 'Filter files matching specific POSIX permission bits (e.g. -4000 for SUID)',
    '-type': 'Filter by entry type (f = regular file, d = directory)',
    '-name': 'Match filename pattern',
  },
  grep: {
    '-i': 'Case-insensitive pattern match',
    '-E': 'Extended regular expression syntax',
    '-n': 'Prefix output lines with line numbers',
  },
  nc: {
    '-z': 'Zero-I/O port scanning mode (check listening state without sending payload)',
    '-v': 'Verbose connection output',
    '-zv': 'Zero-I/O verbose port check',
    '-l': 'Listen mode for inbound connection testing',
    '-n': 'Skip DNS resolution (numeric IPs only)',
    '-p': 'Specify local listening port',
    '-lvnp': 'Listen verbosely on numeric port without DNS lookup',
  },
};

function explainFlags(cmd: string, args: string[]): FlagExplanation[] {
  const dict = FLAG_DICTIONARY[cmd] || {};
  const breakdown: FlagExplanation[] = [];
  for (const tok of args) {
    if (dict[tok]) {
      breakdown.push({ token: tok, meaning: dict[tok] });
    } else if (tok.startsWith('-')) {
      breakdown.push({ token: tok, meaning: `Option/flag passed to ${cmd}` });
    }
  }
  return breakdown;
}

function ensureInstalledPackage(state: SimulatorState, pkg: string): SimulatorState {
  const current = new Set(state.installedPackages || DEFAULT_INSTALLED_PACKAGES);
  current.add(pkg.toLowerCase());
  return { ...state, installedPackages: Array.from(current) };
}

function executeSingleCommand(
  rawSegment: string,
  state: SimulatorState,
): SimulatedCommandResult {
  const command = rawSegment.trim().replace(/\s*&\s*$/, '');
  const cwd = state.cwd || '/home/kali';

  if (!command) {
    return {
      command: '',
      output: '',
      exitCode: 0,
      nextCwd: cwd,
      commandBreakdown: [],
      coachingHint: null,
      nextState: state,
    };
  }

  // Strip benign stderr redirection like 2>/dev/null for guided Linux examples
  const cleanedLine = command.replace(/\s+2>\/dev\/null/g, '').trim();
  const tokens = tokenizeArgs(cleanedLine);
  const bin = (tokens[0] || '').toLowerCase();
  const args = tokens.slice(1);
  const breakdown = explainFlags(bin, args);

  switch (bin) {
    case 'sudo': {
      if (args.length === 0) {
        return {
          command,
          output: 'usage: sudo <command> [args...]',
          exitCode: 1,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'sudo', meaning: 'Execute simulated command with root privileges' }],
          coachingHint: 'Try `sudo apt update && sudo apt install -y whois` or `sudo id`.',
          nextState: state,
        };
      }
      const innerLine = args.join(' ');
      const innerResult = executeSingleCommand(innerLine, { ...state, isRootContext: true });
      return {
        ...innerResult,
        command,
        output: innerResult.output
          ? `[sudo] simulated privilege elevation (kali -> root) active\n${innerResult.output}`
          : `[sudo] simulated privilege elevation (kali -> root) active`,
        commandBreakdown: [
          { token: 'sudo', meaning: 'Elevate command to simulated root context (no host privilege change)' },
          ...innerResult.commandBreakdown,
        ],
        coachingHint:
          innerResult.coachingHint ||
          'In Kali Linux, `sudo` grants temporary administrative rights for package installs and low-level network tools.',
      };
    }

    case 'apt':
    case 'apt-get': {
      const sub = (args.find((a) => !a.startsWith('-')) || '').toLowerCase();
      if (sub === 'update') {
        return {
          command,
          output: [
            'Hit:1 http://http.kali.org/kali kali-rolling InRelease [Simulated Cache]',
            'Reading package lists... Done',
            'Building dependency tree... Done',
            'All simulated packages index metadata updated.',
          ].join('\n'),
          exitCode: 0,
          nextCwd: cwd,
          commandBreakdown: [
            { token: bin, meaning: 'Debian/Kali package manager' },
            { token: 'update', meaning: 'Sync simulated repository index metadata' },
          ],
          coachingHint: 'Run `sudo apt install -y whois` next to add or verify a package.',
          nextState: state,
        };
      }
      if (sub === 'install') {
        const subIdx = args.findIndex((a) => a.toLowerCase() === 'install');
        const pkgArgs = args.slice(subIdx + 1).filter((a) => !a.startsWith('-'));
        if (pkgArgs.length === 0) {
          return {
            command,
            output: `${bin}: specify a package name, e.g. \`sudo apt install -y whois\``,
            exitCode: 1,
            nextCwd: cwd,
            commandBreakdown: [{ token: bin, meaning: 'Package installer' }, ...breakdown],
            coachingHint: 'Example: `sudo apt update && sudo apt install -y whois`.',
            nextState: state,
          };
        }
        let nextState = state;
        for (const p of pkgArgs) {
          nextState = ensureInstalledPackage(nextState, p);
        }
        const pkgListText = pkgArgs.join(', ');
        return {
          command,
          output: [
            `Reading package lists... Done`,
            `Building dependency tree... Done`,
            `The following NEW simulated packages will be installed: ${pkgListText}`,
            `Unpacking ${pkgListText} (simulated educational sandbox package)...`,
            `Setting up ${pkgListText} ... Done.`,
            `${pkgListText} is now ready in this sandbox session.`,
          ].join('\n'),
          exitCode: 0,
          nextCwd: cwd,
          commandBreakdown: [
            { token: bin, meaning: 'Debian/Kali package manager' },
            { token: 'install', meaning: `Install simulated package(s): ${pkgListText}` },
            ...breakdown,
          ],
          coachingHint: `Package installed in virtual session! Now run \`${pkgArgs[0]} --help\` or try \`whois kali.org\`.`,
          nextState,
        };
      }
      if (sub === 'search' || sub === 'list') {
        const query = (args.slice(1).find((a) => !a.startsWith('-')) || '').toLowerCase();
        const installed = state.installedPackages || DEFAULT_INSTALLED_PACKAGES;
        const matched = query ? installed.filter((p) => p.includes(query)) : installed;
        return {
          command,
          output:
            matched.length > 0
              ? matched.map((p) => `${p}/kali-rolling [simulated,installed]`).join('\n')
              : `No simulated package matching "${query}" currently listed.`,
          exitCode: 0,
          nextCwd: cwd,
          commandBreakdown: [{ token: bin, meaning: 'Search or list simulated Kali packages' }],
          coachingHint: null,
          nextState: state,
        };
      }
      return {
        command,
        output: `Usage: ${bin} update | ${bin} install -y <package> | ${bin} search <term>`,
        exitCode: 1,
        nextCwd: cwd,
        commandBreakdown: [{ token: bin, meaning: 'APT package management simulation' }],
        coachingHint: 'Try `sudo apt update && sudo apt install -y whois`.',
        nextState: state,
      };
    }

    case 'whois': {
      const target = args.find((a) => !a.startsWith('-'));
      if (!target || target === '--help' || target === '-h') {
        return {
          command,
          output: 'Usage: whois <domain>\nAuthorized educational WHOIS records: kali.org, example.org, app.lab.local, kali3977.lab',
          exitCode: target ? 0 : 1,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'whois', meaning: 'Query domain registration & nameserver directory metadata' }],
          coachingHint: 'Try `whois kali.org` or `whois app.lab.local`.',
          nextState: state,
        };
      }
      const cleanedTarget = cleanTargetHost(target);
      if (!isEducationalStaticDomain(cleanedTarget)) {
        return {
          command,
          output: `SAFETY POLICY: Live internet WHOIS lookups are disabled in the browser simulator. Practice with curated static records: kali.org, example.org, example.com, app.lab.local, or kali3977.lab.`,
          exitCode: 126,
          nextCwd: cwd,
          safetyBlocked: true,
          commandBreakdown: [{ token: 'whois', meaning: 'WHOIS domain registration client (static sandbox records)' }, ...breakdown],
          coachingHint: 'Run `whois kali.org` to inspect realistic registrar, dates, DNSSEC, and nameserver fields.',
          nextState: state,
        };
      }
      const isInternalLab = cleanedTarget.endsWith('.lab.local') || cleanedTarget.endsWith('.kali3977.lab');
      return {
        command,
        output: [
          `[SIMULATED WHOIS RECORD — Static Educational Training Data, No Live Network Query]`,
          `Domain Name: ${cleanedTarget.toUpperCase()}`,
          `Registry Domain ID: ${isInternalLab ? 'LAB-3977-LOCAL' : 'D17492014-LROR'}`,
          `Registrar: ${isInternalLab ? 'KALI3977 Synthetic Internal Registry' : 'Gandi SAS / Public Registry Reference'}`,
          `Creation Date: ${isInternalLab ? '2026-01-01T00:00:00Z' : '2012-09-14T11:22:00Z'}`,
          `Registry Expiry Date: ${isInternalLab ? '2028-01-01T00:00:00Z' : '2029-09-14T11:22:00Z'}`,
          `Domain Status: clientTransferProhibited`,
          `Name Server: ns1.${cleanedTarget}`,
          `Name Server: ns2.${cleanedTarget}`,
          `DNSSEC: signedDelegation`,
        ].join('\n'),
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [
          { token: 'whois', meaning: 'Inspect registrar ownership, registration lifecycle, and nameservers' },
          { token: cleanedTarget, meaning: 'Target domain queried from static training records' },
          ...breakdown,
        ],
        coachingHint: 'Notice Registrar, Creation/Expiry dates, and Name Servers — recon analysts pivot from nameservers into DNS checks (`dig`).',
        nextState: ensureInstalledPackage(state, 'whois'),
      };
    }

    case 'clear':
      return {
        command,
        output: '',
        exitCode: 0,
        nextCwd: cwd,
        clearScreen: true,
        commandBreakdown: [{ token: 'clear', meaning: 'Clear visible simulated terminal buffer' }],
        coachingHint: null,
        nextState: state,
      };

    case 'help':
      return {
        command,
        output: [
          'KALI3977 Educational Terminal (Safe Browser Simulation — Zero Host Execution)',
          'Linux basics : pwd, ls [-la], cd <dir>, cat/head/tail <file>, grep, find, mkdir, touch, echo, chmod, rm',
          'Packages/Priv: sudo <cmd>, apt update, apt install -y <pkg>, which <cmd>, man <cmd>, history, env',
          'Identity/Net : id, whoami, uname -a, ip a, ss -tulnp, ps aux, dig app.lab.local, curl -I http://app.lab.local',
          'Kali Recon   : nmap, whois, amass, theHarvester, gobuster, ffuf, nikto, sqlmap, whatweb',
          'Sniff & Crack: tshark, wireshark, john, hashcat, hydra, nc, aircrack-ng, airmon-ng, r2, binwalk, vol',
          'Lab Targets  : 192.168.56.10, 192.168.56.20, app.lab.local, scanme.kali3977.local, kali.org (WHOIS)',
        ].join('\n'),
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'help', meaning: 'Display all supported educational simulator commands' }],
        coachingHint: 'Try `sudo apt update && sudo apt install -y whois` then `whois kali.org`.',
        nextState: state,
      };

    case 'pwd':
      return {
        command,
        output: cwd,
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'pwd', meaning: 'Print Working Directory' }],
        coachingHint: null,
        nextState: state,
      };

    case 'whoami':
      return {
        command,
        output: state.isRootContext ? 'root' : 'kali',
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'whoami', meaning: 'Print effective simulated user name' }],
        coachingHint: null,
        nextState: state,
      };

    case 'id':
      return {
        command,
        output: state.isRootContext
          ? 'uid=0(root) gid=0(root) groups=0(root)'
          : 'uid=1000(kali) gid=1000(kali) groups=1000(kali),27(sudo),132(wireshark)',
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'id', meaning: 'Display user UID, primary GID, and supplementary groups' }],
        coachingHint: 'Membership in `wireshark` allows non-root packet capture in real Kali.',
        nextState: state,
      };

    case 'uname':
      return {
        command,
        output: args.includes('-a')
          ? 'Linux kali3977-sim 6.11.2-kali1-amd64 #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux'
          : 'Linux',
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'uname', meaning: 'Display simulated OS kernel version' }],
        coachingHint: null,
        nextState: state,
      };

    case 'history': {
      const list = state.history || [];
      return {
        command,
        output:
          list.length === 0
            ? '(no previous commands in current session)'
            : [...list]
                .reverse()
                .map((cmd, idx) => `${String(idx + 1).padStart(4, ' ')}  ${cmd}`)
                .join('\n'),
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'history', meaning: 'Show previously executed simulated commands' }],
        coachingHint: 'Use Up/Down arrow keys at the prompt to recall previous commands quickly.',
        nextState: state,
      };
    }

    case 'env':
      return {
        command,
        output: [
          `USER=${state.isRootContext ? 'root' : 'kali'}`,
          `HOME=/home/kali`,
          `PWD=${cwd}`,
          `SHELL=/usr/bin/zsh`,
          `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
          `KALI3977_ENV=browser_educational_sandbox`,
        ].join('\n'),
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'env', meaning: 'Display simulated shell environment variables' }],
        coachingHint: null,
        nextState: state,
      };

    case 'which': {
      const target = (args[0] || '').toLowerCase();
      if (!target) {
        return {
          command,
          output: 'Usage: which <command>',
          exitCode: 1,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'which', meaning: 'Locate a command binary in PATH' }],
          coachingHint: null,
          nextState: state,
        };
      }
      const installed = state.installedPackages || DEFAULT_INSTALLED_PACKAGES;
      const isKnown = installed.includes(target) || ['nmap', 'gobuster', 'tshark', 'whois', 'sudo', 'apt', 'ls', 'grep'].includes(target);
      return {
        command,
        output: isKnown ? `/usr/bin/${target}` : `${target} not found`,
        exitCode: isKnown ? 0 : 1,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'which', meaning: `Resolve PATH binary location for ${target}` }],
        coachingHint: null,
        nextState: state,
      };
    }

    case 'man': {
      const topic = (args[0] || '').toLowerCase();
      if (!topic) {
        return {
          command,
          output: 'What manual page do you want? Try `man nmap` or `man whois`.',
          exitCode: 1,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'man', meaning: 'Display educational manual summary' }],
          coachingHint: null,
          nextState: state,
        };
      }
      const doc = SUPPORTED_SIMULATOR_COMMANDS.find((c) => c.command.toLowerCase().includes(topic));
      return {
        command,
        output: doc
          ? `NAME\n    ${topic} — ${doc.summary}\n\nCATEGORY\n    ${doc.category}\n\nSYNTAX\n    Run \`${topic} --help\` or open the Learn KALI Tool Library for flag-by-flag guides.`
          : `No simulated manual entry for "${topic}". Type \`help\` or check the Learn KALI Tool Library.`,
        exitCode: doc ? 0 : 1,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'man', meaning: `Show manual summary for ${topic}` }],
        coachingHint: null,
        nextState: state,
      };
    }

    case 'mkdir': {
      const targetArg = args.find((a) => !a.startsWith('-'));
      if (!targetArg) {
        return {
          command,
          output: 'mkdir: missing operand',
          exitCode: 1,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'mkdir', meaning: 'Create a directory inside the sandbox' }],
          coachingHint: 'Example: `mkdir notes`',
          nextState: state,
        };
      }
      const newDir = normalizePath(targetArg, cwd);
      const parent = getParentDir(newDir);
      if (!isVirtualDir(parent, state)) {
        return {
          command,
          output: `mkdir: cannot create directory '${targetArg}': No such parent directory`,
          exitCode: 1,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'mkdir', meaning: 'Create directory' }],
          coachingHint: null,
          nextState: state,
        };
      }
      const nextCustomDirs = { ...(state.customDirs || {}) };
      nextCustomDirs[newDir] = nextCustomDirs[newDir] || [];
      nextCustomDirs[parent] = Array.from(new Set([...(nextCustomDirs[parent] || []), getBaseName(newDir)]));
      return {
        command,
        output: '',
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'mkdir', meaning: `Created sandbox directory ${newDir}` }],
        coachingHint: `Use \`ls\` or \`cd ${targetArg}\` to open your new directory.`,
        nextState: { ...state, customDirs: nextCustomDirs },
      };
    }

    case 'touch': {
      const targetArg = args.find((a) => !a.startsWith('-'));
      if (!targetArg) {
        return {
          command,
          output: 'touch: missing file operand',
          exitCode: 1,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'touch', meaning: 'Create an empty file' }],
          coachingHint: 'Example: `touch scan_notes.txt`',
          nextState: state,
        };
      }
      const newFile = normalizePath(targetArg, cwd);
      const nextFiles = { ...(state.customFiles || {}), [newFile]: state.customFiles?.[newFile] ?? '' };
      const nextDeleted = (state.deletedFiles || []).filter((p) => p !== newFile);
      return {
        command,
        output: '',
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'touch', meaning: `Created empty file ${newFile}` }],
        coachingHint: null,
        nextState: { ...state, customFiles: nextFiles, deletedFiles: nextDeleted },
      };
    }

    case 'echo': {
      const redirectIdx = args.indexOf('>');
      if (redirectIdx >= 0 && args[redirectIdx + 1]) {
        const text = args.slice(0, redirectIdx).join(' ');
        const filePath = normalizePath(args[redirectIdx + 1], cwd);
        const nextFiles = { ...(state.customFiles || {}), [filePath]: text };
        const nextDeleted = (state.deletedFiles || []).filter((p) => p !== filePath);
        return {
          command,
          output: '',
          exitCode: 0,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'echo', meaning: `Write "${text}" to ${filePath}` }],
          coachingHint: `Read it back with \`cat ${args[redirectIdx + 1]}\`.`,
          nextState: { ...state, customFiles: nextFiles, deletedFiles: nextDeleted },
        };
      }
      return {
        command,
        output: args.join(' '),
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'echo', meaning: 'Print text string to terminal output' }],
        coachingHint: null,
        nextState: state,
      };
    }

    case 'chmod': {
      const modeArg = args[0];
      const targetArg = args[1];
      if (!modeArg || !targetArg) {
        return {
          command,
          output: 'Usage: chmod <mode> <file> (e.g. chmod +x script.sh)',
          exitCode: 1,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'chmod', meaning: 'Change POSIX file permissions' }],
          coachingHint: null,
          nextState: state,
        };
      }
      const filePath = normalizePath(targetArg, cwd);
      const exists = getFileContent(filePath, state) !== undefined || isVirtualDir(filePath, state);
      return {
        command,
        output: exists ? '' : `chmod: cannot access '${targetArg}': No such file or directory`,
        exitCode: exists ? 0 : 1,
        nextCwd: cwd,
        commandBreakdown: [
          { token: 'chmod', meaning: 'Update simulated file permissions' },
          { token: modeArg, meaning: `Permission mode (${modeArg})` },
        ],
        coachingHint: null,
        nextState: state,
      };
    }

    case 'rm': {
      const targetArg = args.find((a) => !a.startsWith('-'));
      if (!targetArg) {
        return {
          command,
          output: 'rm: missing operand',
          exitCode: 1,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'rm', meaning: 'Remove simulated file' }],
          coachingHint: null,
          nextState: state,
        };
      }
      const targetPath = normalizePath(targetArg, cwd);
      if (targetPath === '/' || targetPath === '/home/kali') {
        return {
          command,
          output: 'SAFETY GUARD: Protected root/home virtual directories cannot be deleted.',
          exitCode: 126,
          nextCwd: cwd,
          safetyBlocked: true,
          commandBreakdown: [],
          coachingHint: 'Use "Reset Environment" to restore original sandbox files cleanly.',
          nextState: state,
        };
      }
      if (getFileContent(targetPath, state) === undefined) {
        return {
          command,
          output: `rm: cannot remove '${targetArg}': No such file`,
          exitCode: 1,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'rm', meaning: 'Delete file' }],
          coachingHint: null,
          nextState: state,
        };
      }
      return {
        command,
        output: '',
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'rm', meaning: `Removed ${targetPath}` }],
        coachingHint: 'You can restore deleted default files anytime using Reset Environment.',
        nextState: {
          ...state,
          deletedFiles: Array.from(new Set([...(state.deletedFiles || []), targetPath])),
        },
      };
    }

    case 'ls': {
      const targetArg = args.find((a) => !a.startsWith('-'));
      const targetPath = targetArg ? normalizePath(targetArg, cwd) : cwd;
      const entries = getDirEntries(targetPath, state);
      if (!entries) {
        if (getFileContent(targetPath, state) !== undefined) {
          return {
            command,
            output: targetPath,
            exitCode: 0,
            nextCwd: cwd,
            commandBreakdown: [{ token: 'ls', meaning: 'List file details' }, ...breakdown],
            coachingHint: null,
            nextState: state,
          };
        }
        return {
          command,
          output: `ls: cannot access '${targetArg}': No such file or directory`,
          exitCode: 2,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'ls', meaning: 'List directory contents' }, ...breakdown],
          coachingHint: 'Run `ls` inside `/home/kali` or use `pwd` to confirm your location.',
          nextState: state,
        };
      }
      const longMode = args.some((a) => a.includes('l'));
      const showHidden = args.some((a) => a.includes('a'));
      const lines = entries.map((entry) => {
        const full = targetPath === '/' ? `/${entry}` : `${targetPath}/${entry}`;
        const isDir = isVirtualDir(full, state);
        if (!longMode) return isDir ? `${entry}/` : entry;
        const mode = isDir ? 'drwxr-xr-x' : entry.endsWith('.sh') ? '-rwxr-xr-x' : '-rw-r--r--';
        const size = getFileContent(full, state)?.length ?? 4096;
        return `${mode} 1 kali kali ${String(size).padStart(5, ' ')} Nov 15 12:00 ${entry}${isDir ? '/' : ''}`;
      });
      if (showHidden && longMode) {
        lines.unshift('drwxr-xr-x 1 kali kali  4096 Nov 15 12:00 ./');
        lines.unshift('drwxr-xr-x 1 root root  4096 Nov 15 12:00 ../');
      }
      return {
        command,
        output: lines.join('\n'),
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'ls', meaning: 'List files and directories' }, ...breakdown],
        coachingHint: null,
        nextState: state,
      };
    }

    case 'cd': {
      const target = args[0] || '/home/kali';
      const next = normalizePath(target, cwd);
      if (!isVirtualDir(next, state)) {
        return {
          command,
          output: `cd: no such directory: ${target}`,
          exitCode: 1,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'cd', meaning: 'Change current directory' }],
          coachingHint: 'Use `ls` to view valid subdirectories before `cd`.',
          nextState: state,
        };
      }
      return {
        command,
        output: '',
        exitCode: 0,
        nextCwd: next,
        commandBreakdown: [{ token: 'cd', meaning: `Change working directory to ${next}` }],
        coachingHint: null,
        nextState: { ...state, cwd: next },
      };
    }

    case 'cat':
    case 'head':
    case 'tail': {
      const targetArg = args.find((a) => !a.startsWith('-'));
      if (!targetArg) {
        return {
          command,
          output: `${bin}: missing file operand`,
          exitCode: 1,
          nextCwd: cwd,
          commandBreakdown: [{ token: bin, meaning: 'Read simulated file content' }],
          coachingHint: `Specify a file path, e.g. \`${bin} /home/kali/README.txt\`.`,
          nextState: state,
        };
      }
      const targetPath = normalizePath(targetArg, cwd);
      const content = getFileContent(targetPath, state);
      if (content === undefined) {
        return {
          command,
          output: `${bin}: ${targetArg}: No such file in educational sandbox`,
          exitCode: 1,
          nextCwd: cwd,
          commandBreakdown: [{ token: bin, meaning: 'Inspect file content' }],
          coachingHint: 'Try `cat /home/kali/evidence/auth.log` or `cat README.txt`.',
          nextState: state,
        };
      }
      const lines = content.split('\n');
      const sliced =
        bin === 'head'
          ? lines.slice(0, 5).join('\n')
          : bin === 'tail'
            ? lines.slice(-5).join('\n')
            : content;
      return {
        command,
        output: sliced,
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: bin, meaning: `Display contents of ${targetPath}` }],
        coachingHint: null,
        nextState: state,
      };
    }

    case 'grep': {
      const nonFlags = args.filter((a) => !a.startsWith('-'));
      const pattern = nonFlags[0];
      const fileArg = nonFlags[1];
      if (!pattern || !fileArg) {
        return {
          command,
          output: 'Usage: grep [-i|-E] <pattern> <file>',
          exitCode: 2,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'grep', meaning: 'Search text lines matching a pattern' }, ...breakdown],
          coachingHint: 'Example: `grep "Accepted" /home/kali/evidence/auth.log`',
          nextState: state,
        };
      }
      const filePath = normalizePath(fileArg, cwd);
      const fileContent = getFileContent(filePath, state);
      if (fileContent === undefined) {
        return {
          command,
          output: `grep: ${fileArg}: No such file`,
          exitCode: 2,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'grep', meaning: 'Pattern search' }, ...breakdown],
          coachingHint: null,
          nextState: state,
        };
      }
      const insensitive = args.includes('-i');
      let matches: string[] = [];
      try {
        const regex = new RegExp(pattern, insensitive ? 'i' : '');
        matches = fileContent.split('\n').filter((line) => regex.test(line));
      } catch {
        const needle = insensitive ? pattern.toLowerCase() : pattern;
        matches = fileContent
          .split('\n')
          .filter((line) => (insensitive ? line.toLowerCase().includes(needle) : line.includes(needle)));
      }
      return {
        command,
        output: matches.length > 0 ? matches.join('\n') : '(no matching lines)',
        exitCode: matches.length > 0 ? 0 : 1,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'grep', meaning: `Filter ${filePath} for "${pattern}"` }, ...breakdown],
        coachingHint: null,
        nextState: state,
      };
    }

    case 'find': {
      const hasSuidCheck = cleanedLine.includes('-4000');
      return {
        command,
        output: hasSuidCheck
          ? '/usr/bin/sudo\n/usr/bin/passwd\n/usr/bin/su\n/usr/local/bin/lab-backup-helper (Audit Note: custom SUID helper)'
          : '/home/kali/README.txt\n/home/kali/evidence/auth.log\n/home/kali/captures/dns_tunnel.pcap\n/home/kali/hashes/sample.sha256',
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'find', meaning: 'Traverse virtual directory hierarchy' }, ...breakdown],
        coachingHint: hasSuidCheck
          ? 'Notice `/usr/local/bin/lab-backup-helper` is non-standard and deserves manual audit.'
          : null,
        nextState: state,
      };
    }

    case 'ip':
      return {
        command,
        output: `1: lo: <LOOPBACK,UP> mtu 65536\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP> mtu 1500\n    inet 192.168.56.5/24 brd 192.168.56.255 scope global eth0`,
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'ip', meaning: 'Show network interfaces and synthetic lab subnet 192.168.56.0/24' }],
        coachingHint: null,
        nextState: state,
      };

    case 'ss':
      return {
        command,
        output: `Netid State  Local Address:Port   Process\ntcp   LISTEN 127.0.0.1:5432      users:(("postgres",pid=412))\ntcp   LISTEN 0.0.0.0:22          users:(("sshd",pid=501))\ntcp   LISTEN 0.0.0.0:80          users:(("nginx",pid=912))`,
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'ss', meaning: 'Inspect listening TCP/UDP sockets' }],
        coachingHint: null,
        nextState: state,
      };

    case 'ps':
      return {
        command,
        output: `USER       PID %CPU %MEM COMMAND\nroot         1  0.0  0.2 /sbin/init\nkali      1042  0.1  0.4 -zsh\nwww-data   912  0.0  0.5 nginx: worker process`,
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'ps', meaning: 'List running simulated processes' }],
        coachingHint: null,
        nextState: state,
      };

    case 'dig': {
      const host = args.find((a) => !a.startsWith('-')) || 'app.lab.local';
      return {
        command,
        output: `; <<>> DiG 9.20 <<>> ${host}\n;; ANSWER SECTION:\n${host}.   300   IN   A   ${isAuthorizedLabTarget(host) ? '192.168.56.10' : '192.0.2.10'}\n;; SERVER: 192.168.56.2#53`,
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'dig', meaning: `Query simulated DNS record for ${host}` }],
        coachingHint: null,
        nextState: state,
      };
    }

    case 'curl': {
      const urlArg = args.find((a) => a.startsWith('http'));
      if (!urlArg) {
        return {
          command,
          output: 'curl: try `curl -I http://app.lab.local` inside the educational lab',
          exitCode: 2,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'curl', meaning: 'Inspect HTTP response headers from lab app' }],
          coachingHint: 'Add an authorized lab URL such as `http://app.lab.local`.',
          nextState: state,
        };
      }
      if (!isAuthorizedLabTarget(urlArg)) {
        return {
          command,
          output: `SAFETY POLICY BLOCK: External URL "${urlArg}" is disallowed in the educational simulator. Use synthetic target http://app.lab.local or http://192.168.56.10.`,
          exitCode: 126,
          nextCwd: cwd,
          safetyBlocked: true,
          commandBreakdown: [{ token: 'curl', meaning: 'HTTP client restricted to lab targets' }],
          coachingHint: 'Always scope offensive/recon commands strictly to authorized lab targets.',
          nextState: state,
        };
      }
      return {
        command,
        output: `HTTP/1.1 200 OK\nServer: nginx/1.24.0\nX-Content-Type-Options: nosniff\nSet-Cookie: kali_sid=demo_99; Path=/; HttpOnly; SameSite=Strict\nContent-Type: text/html`,
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'curl', meaning: 'Fetch HTTP headers from synthetic lab host' }, ...breakdown],
        coachingHint: null,
        nextState: state,
      };
    }

    case 'nmap': {
      const target = args.filter((a) => !a.startsWith('-')).pop();
      if (!target) {
        return {
          command,
          output: 'Nmap educational syntax: nmap [flags] <target>\nExample: nmap -sV -sC 192.168.56.10',
          exitCode: 1,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'nmap', meaning: 'Network exploration and service discovery scanner' }, ...breakdown],
          coachingHint: 'Provide an authorized lab target IP such as `192.168.56.10` or `app.lab.local`.',
          nextState: state,
        };
      }
      if (!isAuthorizedLabTarget(target)) {
        return {
          command,
          output: `AUTHORIZED TARGET POLICY BLOCKED: "${target}" is outside the KALI3977 synthetic lab subnet.\nPermitted simulated targets: 192.168.56.10, 192.168.56.20, app.lab.local, scanme.kali3977.local.`,
          exitCode: 126,
          nextCwd: cwd,
          safetyBlocked: true,
          commandBreakdown: [{ token: 'nmap', meaning: 'Network scanner (restricted to synthetic targets)' }, ...breakdown],
          coachingHint: 'Never scan unauthorized internet hosts. Practice with `nmap -sV 192.168.56.10`.',
          nextState: state,
        };
      }
      const versionScan = args.some((a) => a.includes('V') || a === '-A');
      const scripts = args.some((a) => a.includes('C') || a === '-A');
      return {
        command,
        output: [
          `Starting Nmap 7.95 ( https://nmap.org ) [SIMULATED LAB SCAN]`,
          `Nmap scan report for ${target} (192.168.56.10)`,
          `Host is up (0.00042s latency).`,
          `PORT     STATE    SERVICE    ${versionScan ? 'VERSION' : ''}`,
          `22/tcp   open     ssh        ${versionScan ? 'OpenSSH 9.6p1 Debian (protocol 2.0)' : ''}`,
          `80/tcp   open     http       ${versionScan ? 'nginx 1.24.0 (KALI3977 Synthetic WebApp)' : ''}`,
          scripts ? `|_http-title: VulnWeb Synthetic Portal` : '',
          `5432/tcp filtered postgresql`,
          `Nmap done: 1 IP address (1 host up) scanned in 0.42 seconds (simulated)`,
        ]
          .filter(Boolean)
          .join('\n'),
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'nmap', meaning: 'Network discovery & port scanner' }, ...breakdown],
        coachingHint: !versionScan
          ? 'Tip: Add `-sV` to fingerprint exact service versions on open ports.'
          : null,
        nextState: state,
      };
    }

    case 'gobuster':
    case 'ffuf': {
      const target =
        args.find((a) => a.startsWith('http')) || (cleanedLine.includes('app.lab.local') ? 'http://app.lab.local' : '');
      if (!target || !isAuthorizedLabTarget(target)) {
        return {
          command,
          output: `SAFETY POLICY: ${bin} requires an authorized lab URL (e.g. http://app.lab.local or http://192.168.56.10).`,
          exitCode: 126,
          nextCwd: cwd,
          safetyBlocked: Boolean(target),
          commandBreakdown: [{ token: bin, meaning: 'Web content & route discovery tool' }, ...breakdown],
          coachingHint: `Example: \`${
            bin === 'gobuster'
              ? 'gobuster dir -u http://app.lab.local -w /home/kali/wordlists/common.txt'
              : 'ffuf -u http://app.lab.local/FUZZ -w /home/kali/wordlists/common.txt'
          }\``,
          nextState: state,
        };
      }
      return {
        command,
        output: [
          `[${bin.toUpperCase()} SIMULATED LAB DISCOVERY] Target: ${target}`,
          `/robots.txt           (Status: 200) [Size: 64]`,
          `/api                  (Status: 301) [Size: 169]`,
          `/health               (Status: 200) [Size: 42]`,
          `/admin-login          (Status: 403) [Size: 148]`,
        ].join('\n'),
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: bin, meaning: 'Web path enumeration against synthetic host' }, ...breakdown],
        coachingHint: 'Review 301/403 status codes carefully during authorized web audits.',
        nextState: state,
      };
    }

    case 'tshark': {
      const hasFile = cleanedLine.includes('dns_tunnel.pcap');
      return {
        command,
        output: hasFile
          ? `  12   0.041201 192.168.56.10 -> 192.168.56.2 DNS 98 Standard query TXT aGVsbG8ta2FsaTM5Nzc.exfil.lab.local\n  19   0.089112 192.168.56.10 -> 192.168.56.2 DNS 101 Standard query TXT c2Vzc2lvbi1rZXktbGVhaw.exfil.lab.local`
          : `tshark: specify capture file, e.g. \`tshark -r /home/kali/captures/dns_tunnel.pcap\``,
        exitCode: hasFile ? 0 : 1,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'tshark', meaning: 'Terminal-based Wireshark packet analyzer' }, ...breakdown],
        coachingHint: hasFile
          ? 'Decoded Base64 hint in query prefix: DNS TXT records can exfiltrate encoded chunks.'
          : 'Point `-r` to `/home/kali/captures/dns_tunnel.pcap`.',
        nextState: state,
      };
    }

    case 'john':
    case 'hashcat': {
      const hasSample = cleanedLine.includes('sample.sha256') || cleanedLine.includes('--show');
      return {
        command,
        output: hasSample
          ? `[OFFLINE HASH AUDIT SIMULATION]\nsynthetic_demo_user:password  (Weak SHA-256 without salt detected — recommend Argon2id / bcrypt)\n1 password hash audited (simulated dataset only)`
          : `Usage: ${bin} /home/kali/hashes/sample.sha256`,
        exitCode: hasSample ? 0 : 1,
        nextCwd: cwd,
        commandBreakdown: [{ token: bin, meaning: 'Offline password strength & hash resilience auditing tool' }, ...breakdown],
        coachingHint: 'Notice how unsalted fast hashes like raw SHA-256 crack instantly compared to salted Argon2id.',
        nextState: state,
      };
    }

    case 'amass':
    case 'theharvester': {
      const domainArg = args.find((a) => a.includes('.') && !a.startsWith('-')) || 'example.org';
      if (!isEducationalStaticDomain(domainArg)) {
        return {
          command,
          output: `SAFETY POLICY: ${bin} uses static educational datasets for example.org, lab.local, and app.lab.local only.`,
          exitCode: 126,
          nextCwd: cwd,
          safetyBlocked: true,
          commandBreakdown: [{ token: bin, meaning: 'Passive OSINT & subdomain enumeration simulator' }, ...breakdown],
          coachingHint: `Try \`${bin} -d example.org\` or \`lab.local\`.`,
          nextState: state,
        };
      }
      return {
        command,
        output: [
          `[${bin.toUpperCase()} SIMULATED OSINT OUTPUT — Static Lab Dataset]`,
          `api.${cleanTargetHost(domainArg)} -> 192.168.56.20`,
          `portal.${cleanTargetHost(domainArg)} -> 192.168.56.10`,
          `docs.${cleanTargetHost(domainArg)} -> 192.168.56.10`,
        ].join('\n'),
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: bin, meaning: `Simulate OSINT discovery for ${domainArg}` }, ...breakdown],
        coachingHint: 'Passive OSINT maps exposed subdomains before touching target servers.',
        nextState: state,
      };
    }

    case 'airmon-ng':
    case 'aircrack-ng':
    case 'kismet':
    case 'r2':
    case 'binwalk':
    case 'strings':
    case 'exiftool':
    case 'vol':
    case 'msfdb':
    case 'msfconsole':
    case 'bettercap':
    case 'responder':
    case 'setoolkit':
    case 'proxychains4':
    case 'tmux':
    case 'burpsuite':
    case 'zaproxy':
    case 'wireshark':
    case 'ghidrarun':
    case 'autopsy':
    case 'cherrytree':
      return {
        command,
        output: [
          `[SIMULATED EDUCATIONAL WORKFLOW: ${bin}]`,
          `Command parsed cleanly inside KALI3977 Browser Sandbox (no host OS process spawned).`,
          `Demonstrated action: \`${command}\``,
          `Key lesson: GUI apps and hardware/kernel capture drivers execute interactively in dedicated Kali MicroVM labs when connected; use this sandbox to practice syntax, flags, and sequence.`,
        ].join('\n'),
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: bin, meaning: `Guided educational simulation for ${bin}` }, ...breakdown],
        coachingHint: `Open "${bin}" in the Tool Library for expected outputs, common errors, and troubleshooting notes.`,
        nextState: state,
      };

    case 'sqlmap':
    case 'nikto':
    case 'hydra':
    case 'whatweb':
    case 'nc':
    case 'netcat': {
      const hasSafeTarget =
        args.some((a) => isAuthorizedLabTarget(a)) ||
        cleanedLine.includes('192.168.56.') ||
        cleanedLine.includes('app.lab.local');
      if (!hasSafeTarget) {
        return {
          command,
          output: `SAFETY POLICY: ${bin} only executes in this simulator against authorized lab targets (192.168.56.10 or app.lab.local).`,
          exitCode: 126,
          nextCwd: cwd,
          safetyBlocked: true,
          commandBreakdown: [{ token: bin, meaning: 'Authorized security assessment utility' }, ...breakdown],
          coachingHint: `Include \`192.168.56.10\` or \`http://app.lab.local\` in your ${bin} command.`,
          nextState: state,
        };
      }
      return {
        command,
        output: `[SIMULATED ${bin.toUpperCase()} EXERCISE] Executed safely against authorized lab target.\nResult: Synthetic target telemetry recorded cleanly with zero external network traffic.`,
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: bin, meaning: `Run simulated ${bin} exercise on lab target` }, ...breakdown],
        coachingHint: 'Inspect open services and headers carefully; verify findings manually before reporting.',
        nextState: state,
      };
    }

    default:
      return {
        command,
        output: `zsh: command not found or not enabled in browser simulator: ${bin}\nType 'help' or click Supported Commands to see available educational commands.`,
        exitCode: 127,
        nextCwd: cwd,
        commandBreakdown: [],
        coachingHint: 'Remember this browser terminal simulates key Linux/Kali exercises without executing arbitrary host binaries.',
        nextState: state,
      };
  }
}

function applyPipeFilters(initialOutput: string, pipeStages: string[]): string {
  let text = initialOutput;
  for (const stage of pipeStages) {
    const tokens = tokenizeArgs(stage);
    const filterBin = (tokens[0] || '').toLowerCase();
    const filterArgs = tokens.slice(1);
    const lines = text.split('\n');
    if (filterBin === 'grep') {
      const insensitive = filterArgs.includes('-i');
      const pat = filterArgs.find((a) => !a.startsWith('-'));
      if (pat) {
        try {
          const re = new RegExp(pat, insensitive ? 'i' : '');
          text = lines.filter((l) => re.test(l)).join('\n');
        } catch {
          const needle = insensitive ? pat.toLowerCase() : pat;
          text = lines
            .filter((l) => (insensitive ? l.toLowerCase().includes(needle) : l.includes(needle)))
            .join('\n');
        }
      }
    } else if (filterBin === 'head') {
      const nIdx = filterArgs.indexOf('-n');
      const count = nIdx >= 0 ? Math.max(1, Number(filterArgs[nIdx + 1] || 5)) : 5;
      text = lines.slice(0, count).join('\n');
    } else if (filterBin === 'tail') {
      const nIdx = filterArgs.indexOf('-n');
      const count = nIdx >= 0 ? Math.max(1, Number(filterArgs[nIdx + 1] || 5)) : 5;
      text = lines.slice(-count).join('\n');
    } else if (filterBin === 'wc' && filterArgs.includes('-l')) {
      text = String(text ? lines.length : 0);
    }
  }
  return text;
}

export function executeSimulatedCommand(
  rawCommand: string,
  state: SimulatorState = createDefaultSimulatorState(),
): SimulatedCommandResult {
  const command = rawCommand.trim();
  let workingState: SimulatorState = {
    cwd: state.cwd || '/home/kali',
    history: state.history || [],
    installedPackages: state.installedPackages || [...DEFAULT_INSTALLED_PACKAGES],
    customFiles: state.customFiles || {},
    deletedFiles: state.deletedFiles || [],
    customDirs: state.customDirs || {},
  };

  if (!command) {
    return {
      command: '',
      output: '',
      exitCode: 0,
      nextCwd: workingState.cwd,
      commandBreakdown: [],
      coachingHint: null,
      nextState: workingState,
    };
  }

  const segments = splitChainedSegments(command);
  if (segments.length === 0) {
    return {
      command,
      output: '',
      exitCode: 0,
      nextCwd: workingState.cwd,
      commandBreakdown: [],
      coachingHint: null,
      nextState: workingState,
    };
  }

  const combinedOutputs: string[] = [];
  const combinedBreakdowns: FlagExplanation[] = [];
  let lastResult: SimulatedCommandResult = {
    command,
    output: '',
    exitCode: 0,
    nextCwd: workingState.cwd,
    commandBreakdown: [],
    coachingHint: null,
    nextState: workingState,
  };

  for (let i = 0; i < segments.length; i++) {
    const { segment, op } = segments[i];
    const pipeParts = splitTopLevelPipe(segment);
    const primarySegment = pipeParts[0] || '';
    const pipeFilters = pipeParts.slice(1);

    const res = executeSingleCommand(primarySegment, workingState);
    if (res.clearScreen) {
      return {
        ...res,
        command,
        nextState: { ...(res.nextState || workingState), cwd: res.nextCwd },
      };
    }

    const filteredOutput = pipeFilters.length > 0 && res.output ? applyPipeFilters(res.output, pipeFilters) : res.output;
    if (filteredOutput) {
      combinedOutputs.push(filteredOutput);
    }
    for (const item of res.commandBreakdown) {
      combinedBreakdowns.push(item);
    }

    workingState = res.nextState ? { ...res.nextState, cwd: res.nextCwd } : { ...workingState, cwd: res.nextCwd };
    lastResult = {
      ...res,
      output: combinedOutputs.join('\n'),
      commandBreakdown: combinedBreakdowns,
      nextState: workingState,
    };

    if (op === '&&' && res.exitCode !== 0) {
      break;
    }
  }

  return {
    ...lastResult,
    command,
    output: combinedOutputs.join('\n'),
    commandBreakdown: combinedBreakdowns,
    nextState: workingState,
  };
}

export function validateSimulatorExerciseSubmission(
  submittedCommand: string,
  expectedPattern: string,
): { matched: boolean; result: SimulatedCommandResult } {
  const result = executeSimulatedCommand(submittedCommand);
  if (result.exitCode !== 0 || result.safetyBlocked) {
    return { matched: false, result };
  }
  const regex = new RegExp(expectedPattern, 'i');
  const matched = regex.test(submittedCommand.trim());
  return { matched, result };
}

export interface MissionStepRequirement {
  id: string;
  instruction: string;
  expectedPattern: string;
}

export function validateMissionCommandSequence(
  commandsRun: string[],
  steps: MissionStepRequirement[],
  previouslyPassedStepIds: string[] = [],
): {
  passedStepIds: string[];
  missingSteps: MissionStepRequirement[];
  lastError: string | null;
} {
  const passedSet = new Set<string>(previouslyPassedStepIds);
  let state = createDefaultSimulatorState();
  let lastError: string | null = null;

  const stepRegexes = steps.map((s) => {
    try {
      return { step: s, regex: new RegExp(s.expectedPattern, 'i') };
    } catch {
      return { step: s, regex: null };
    }
  });

  for (const rawCmd of commandsRun) {
    const trimmed = String(rawCmd || '').trim();
    if (!trimmed) continue;
    const res = executeSimulatedCommand(trimmed, state);
    state = res.nextState ? { ...res.nextState, cwd: res.nextCwd } : { ...state, cwd: res.nextCwd };

    if (res.exitCode !== 0 || res.safetyBlocked) {
      lastError = res.coachingHint || res.output || `Command exited with status ${res.exitCode}`;
      continue;
    }

    for (const { step, regex } of stepRegexes) {
      if (passedSet.has(step.id)) continue;
      if (regex && regex.test(trimmed)) {
        passedSet.add(step.id);
      }
    }
  }

  const missingSteps = steps.filter((s) => !passedSet.has(s.id));
  return {
    passedStepIds: Array.from(passedSet),
    missingSteps,
    lastError,
  };
}
