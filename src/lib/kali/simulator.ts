export interface SimulatorState {
  cwd: string;
  history: string[];
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
}

const VIRTUAL_FILES: Record<string, string> = {
  '/etc/os-release': `PRETTY_NAME="Kali GNU/Linux Rolling (KALI3977 Simulated Lab)"\nNAME="Kali GNU/Linux"\nID=kali\nID_LIKE=debian\nVERSION_ID="2026.1"`,
  '/etc/passwd': `root:x:0:0:root:/root:/bin/bash\nkali:x:1000:1000:Kali Learner:/home/kali:/usr/bin/zsh\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\npostgres:x:114:120:PostgreSQL administrator:/var/lib/postgresql:/bin/bash`,
  '/home/kali/README.txt': `Welcome to KALI3977 Simulated Interactive Terminal!\nNOTE: This is an educational Linux/Kali simulation — zero commands touch the real backend host.\nAuthorized synthetic targets available:\n  - 192.168.56.10 (VulnWeb Synthetic Host)\n  - 192.168.56.20 (Internal API Gateway)\n  - app.lab.local (Simulated Web Target)\n\nPractice folders:\n  ~/evidence/auth.log\n  ~/captures/dns_tunnel.pcap\n  ~/hashes/sample.sha256\n  ~/wordlists/common.txt`,
  '/home/kali/evidence/auth.log': `Nov 15 04:11:02 lab01 sshd[4102]: Failed password for root from 198.51.100.44 port 55210 ssh2\nNov 15 04:11:04 lab01 sshd[4102]: Failed password for root from 198.51.100.44 port 55210 ssh2\nNov 15 04:12:19 lab01 sshd[4188]: Accepted password for opsadmin from 203.0.113.77 port 49122 ssh2\nNov 15 04:12:41 lab01 sudo[4205]: opsadmin : USER=root ; COMMAND=/usr/sbin/useradd -m svc_backup_adm\nNov 15 04:12:46 lab01 sudo[4211]: opsadmin : USER=root ; COMMAND=/usr/sbin/usermod -aG sudo svc_backup_adm`,
  '/home/kali/captures/dns_tunnel.pcap': `[PCAP SYNTHETIC SUMMARY]\nFrame 12: DNS Query TXT aGVsbG8ta2FsaTM5Nzc.exfil.lab.local (42 bytes)\nFrame 19: DNS Query TXT c2Vzc2lvbi1rZXktbGVhaw.exfil.lab.local (45 bytes)\nFrame 24: HTTP GET /api/health -> 200 OK`,
  '/home/kali/hashes/sample.sha256': `5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8:synthetic_demo_user\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855:empty_file_digest`,
  '/home/kali/wordlists/common.txt': `robots.txt\nadmin-login\napi\nhealth\nassets\ndashboard`,
  '/var/log/syslog': `Nov 15 08:00:01 lab01 systemd[1]: Started OpenSSH Daemon.\nNov 15 08:00:02 lab01 nginx[912]: Listening on 192.168.56.10:80\nNov 15 08:00:05 lab01 kernel: [UFW BLOCK] IN=eth0 OUT= SRC=198.51.100.99 DST=192.168.56.10 PROTO=TCP DPT=3306`,
};

const VIRTUAL_DIRS: Record<string, string[]> = {
  '/': ['etc', 'home', 'usr', 'var'],
  '/etc': ['os-release', 'passwd'],
  '/home': ['kali'],
  '/home/kali': ['README.txt', 'evidence', 'captures', 'hashes', 'wordlists'],
  '/home/kali/evidence': ['auth.log'],
  '/home/kali/captures': ['dns_tunnel.pcap'],
  '/home/kali/hashes': ['sample.sha256'],
  '/home/kali/wordlists': ['common.txt'],
  '/usr': ['bin'],
  '/usr/bin': ['nmap', 'gobuster', 'tshark', 'john', 'hashcat', 'hydra', 'sqlmap', 'nc', 'nikto'],
  '/var': ['log'],
  '/var/log': ['syslog'],
};

const AUTHORIZED_TARGETS = new Set([
  '192.168.56.10',
  '192.168.56.20',
  '192.168.56.0/24',
  '127.0.0.1',
  'localhost',
  'app.lab.local',
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
  return `/${parts.join('/')}`;
}

function isAuthorizedLabTarget(rawTarget: string): boolean {
  const cleaned = rawTarget
    .replace(/^https?:\/\//i, '')
    .replace(/^ssh:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .split('?')[0]
    .toLowerCase()
    .trim();
  if (!cleaned) return false;
  if (AUTHORIZED_TARGETS.has(cleaned)) return true;
  if (cleaned.startsWith('192.168.56.') || cleaned.endsWith('.lab.local')) return true;
  return false;
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

const FLAG_DICTIONARY: Record<string, Record<string, string>> = {
  nmap: {
    '-sV': 'Probe open ports to determine service and version info',
    '-sS': 'TCP SYN stealth scan (half-open)',
    '-sC': 'Run default NSE reconnaissance scripts',
    '-Pn': 'Skip host discovery ping (treat host as online)',
    '-A': 'Enable OS detection, version detection, script scanning, and traceroute',
    '-p': 'Specify target port numbers or ranges',
    '-F': 'Fast scan (top 100 common ports)',
  },
  gobuster: {
    dir: 'Directory and file brute-forcing mode',
    dns: 'DNS subdomain enumeration mode',
    '-u': 'Target synthetic base URL',
    '-w': 'Path to wordlist file',
    '-x': 'File extensions to check (e.g. php,txt,html)',
  },
  tshark: {
    '-r': 'Read packets from a captured .pcap/.pcapng file',
    '-Y': 'Apply Wireshark display filter expression',
    '-T': 'Set output field formatting (e.g. fields)',
    '-e': 'Specific protocol field to extract',
  },
  hydra: {
    '-l': 'Specify single synthetic test username',
    '-P': 'Specify password wordlist path',
    '-t': 'Number of parallel authentication tasks',
  },
  sqlmap: {
    '-u': 'Specify authorized target URL with query parameter',
    '--batch': 'Run non-interactively using default safe prompts',
    '--dbs': 'Enumerate database schema names in lab target',
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

export function executeSimulatedCommand(
  rawCommand: string,
  state: SimulatorState = { cwd: '/home/kali', history: [] },
): SimulatedCommandResult {
  const command = rawCommand.trim();
  const cwd = state.cwd || '/home/kali';

  if (!command) {
    return {
      command: '',
      output: '',
      exitCode: 0,
      nextCwd: cwd,
      commandBreakdown: [],
      coachingHint: null,
    };
  }

  // Strip benign stderr redirection like 2>/dev/null for guided Linux examples
  const cleanedLine = command.replace(/\s+2>\/dev\/null/g, '').trim();
  const tokens = tokenizeArgs(cleanedLine);
  const bin = (tokens[0] || '').toLowerCase();
  const args = tokens.slice(1);
  const breakdown = explainFlags(bin, args);

  switch (bin) {
    case 'clear':
      return {
        command,
        output: '',
        exitCode: 0,
        nextCwd: cwd,
        clearScreen: true,
        commandBreakdown: [{ token: 'clear', meaning: 'Clear visible simulated terminal buffer' }],
        coachingHint: null,
      };

    case 'help':
      return {
        command,
        output: [
          'KALI3977 Educational Terminal (Safe Browser Simulation — Zero Host Execution)',
          'Linux basics : pwd, ls [-la], cd <dir>, cat <file>, grep <pat> <file>, find <path> -perm -4000',
          'Identity/Net : id, whoami, uname -a, ip a, ss -tulnp, ps aux, dig app.lab.local, curl -I http://app.lab.local',
          'Kali Tools   : nmap, gobuster, tshark, nikto, sqlmap, hydra, john, hashcat, nc, whatweb, whois',
          'Lab Targets  : 192.168.56.10, 192.168.56.20, app.lab.local, scanme.kali3977.local',
        ].join('\n'),
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'help', meaning: 'Display supported educational simulator commands' }],
        coachingHint: 'Try `cat README.txt` or `nmap -sV 192.168.56.10` to explore safely.',
      };

    case 'pwd':
      return {
        command,
        output: cwd,
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'pwd', meaning: 'Print Working Directory' }],
        coachingHint: null,
      };

    case 'whoami':
      return {
        command,
        output: 'kali',
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'whoami', meaning: 'Print effective simulated user name' }],
        coachingHint: null,
      };

    case 'id':
      return {
        command,
        output: 'uid=1000(kali) gid=1000(kali) groups=1000(kali),27(sudo),132(wireshark)',
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'id', meaning: 'Display user UID, primary GID, and supplementary groups' }],
        coachingHint: 'Membership in `wireshark` allows non-root packet capture in real Kali.',
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
      };

    case 'ls': {
      const targetArg = args.find((a) => !a.startsWith('-'));
      const targetPath = targetArg ? normalizePath(targetArg, cwd) : cwd;
      const entries = VIRTUAL_DIRS[targetPath];
      if (!entries) {
        if (VIRTUAL_FILES[targetPath]) {
          return {
            command,
            output: targetPath,
            exitCode: 0,
            nextCwd: cwd,
            commandBreakdown: [{ token: 'ls', meaning: 'List file details' }, ...breakdown],
            coachingHint: null,
          };
        }
        return {
          command,
          output: `ls: cannot access '${targetArg}': No such file or directory`,
          exitCode: 2,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'ls', meaning: 'List directory contents' }, ...breakdown],
          coachingHint: 'Run `ls` inside `/home/kali` or use `pwd` to confirm your location.',
        };
      }
      const longMode = args.some((a) => a.includes('l'));
      const showHidden = args.some((a) => a.includes('a'));
      const lines = entries.map((entry) => {
        const full = targetPath === '/' ? `/${entry}` : `${targetPath}/${entry}`;
        const isDir = Boolean(VIRTUAL_DIRS[full]);
        if (!longMode) return isDir ? `${entry}/` : entry;
        const mode = isDir ? 'drwxr-xr-x' : entry.endsWith('.sh') ? '-rwxr-xr-x' : '-rw-r--r--';
        const size = VIRTUAL_FILES[full]?.length ?? 4096;
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
      };
    }

    case 'cd': {
      const target = args[0] || '/home/kali';
      const next = normalizePath(target, cwd);
      if (!VIRTUAL_DIRS[next]) {
        return {
          command,
          output: `cd: no such directory: ${target}`,
          exitCode: 1,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'cd', meaning: 'Change current directory' }],
          coachingHint: 'Use `ls` to view valid subdirectories before `cd`.',
        };
      }
      return {
        command,
        output: '',
        exitCode: 0,
        nextCwd: next,
        commandBreakdown: [{ token: 'cd', meaning: `Change working directory to ${next}` }],
        coachingHint: null,
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
        };
      }
      const targetPath = normalizePath(targetArg, cwd);
      const content = VIRTUAL_FILES[targetPath];
      if (!content) {
        return {
          command,
          output: `${bin}: ${targetArg}: No such file in educational sandbox`,
          exitCode: 1,
          nextCwd: cwd,
          commandBreakdown: [{ token: bin, meaning: 'Inspect file content' }],
          coachingHint: 'Try `cat /home/kali/evidence/auth.log` or `cat README.txt`.',
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
        };
      }
      const filePath = normalizePath(fileArg, cwd);
      const fileContent = VIRTUAL_FILES[filePath];
      if (!fileContent) {
        return {
          command,
          output: `grep: ${fileArg}: No such file`,
          exitCode: 2,
          nextCwd: cwd,
          commandBreakdown: [{ token: 'grep', meaning: 'Pattern search' }, ...breakdown],
          coachingHint: null,
        };
      }
      const insensitive = args.includes('-i');
      const regex = new RegExp(pattern, insensitive ? 'i' : '');
      const matches = fileContent.split('\n').filter((line) => regex.test(line));
      return {
        command,
        output: matches.length > 0 ? matches.join('\n') : '(no matching lines)',
        exitCode: matches.length > 0 ? 0 : 1,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'grep', meaning: `Filter ${filePath} for "${pattern}"` }, ...breakdown],
        coachingHint: null,
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
      };

    case 'ss':
      return {
        command,
        output: `Netid State  Local Address:Port   Process\ntcp   LISTEN 127.0.0.1:5432      users:(("postgres",pid=412))\ntcp   LISTEN 0.0.0.0:22          users:(("sshd",pid=501))\ntcp   LISTEN 0.0.0.0:80          users:(("nginx",pid=912))`,
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'ss', meaning: 'Inspect listening TCP/UDP sockets' }],
        coachingHint: null,
      };

    case 'ps':
      return {
        command,
        output: `USER       PID %CPU %MEM COMMAND\nroot         1  0.0  0.2 /sbin/init\nkali      1042  0.1  0.4 -zsh\nwww-data   912  0.0  0.5 nginx: worker process`,
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'ps', meaning: 'List running simulated processes' }],
        coachingHint: null,
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
        };
      }
      return {
        command,
        output: `HTTP/1.1 200 OK\nServer: nginx/1.24.0\nX-Content-Type-Options: nosniff\nSet-Cookie: kali_sid=demo_99; Path=/; HttpOnly; SameSite=Strict\nContent-Type: text/html`,
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: 'curl', meaning: 'Fetch HTTP headers from synthetic lab host' }, ...breakdown],
        coachingHint: null,
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
      };
    }

    case 'gobuster':
    case 'ffuf': {
      const target = args.find((a) => a.startsWith('http')) || (cleanedLine.includes('app.lab.local') ? 'http://app.lab.local' : '');
      if (!target || !isAuthorizedLabTarget(target)) {
        return {
          command,
          output: `SAFETY POLICY: ${bin} requires an authorized lab URL (e.g. http://app.lab.local or http://192.168.56.10).`,
          exitCode: 126,
          nextCwd: cwd,
          safetyBlocked: Boolean(target),
          commandBreakdown: [{ token: bin, meaning: 'Web content & route discovery tool' }, ...breakdown],
          coachingHint: `Example: \`${bin === 'gobuster' ? 'gobuster dir -u http://app.lab.local -w /home/kali/wordlists/common.txt' : 'ffuf -u http://app.lab.local/FUZZ -w /home/kali/wordlists/common.txt'}\``,
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
      };
    }

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
        };
      }
      return {
        command,
        output: `[SIMULATED ${bin.toUpperCase()} EXERCISE] Executed safely against authorized lab target.\nResult: Synthetic target telemetry recorded cleanly with zero external network traffic.`,
        exitCode: 0,
        nextCwd: cwd,
        commandBreakdown: [{ token: bin, meaning: `Run simulated ${bin} exercise on lab target` }, ...breakdown],
        coachingHint: 'Compare this safe simulation with full MicroVM execution when external runners are enabled.',
      };
    }

    default:
      return {
        command,
        output: `zsh: command not found or not enabled in browser simulator: ${bin}\nType 'help' to see supported Linux & Kali educational commands.`,
        exitCode: 127,
        nextCwd: cwd,
        commandBreakdown: [],
        coachingHint: 'Remember this browser terminal simulates key Linux/Kali exercises without executing arbitrary host binaries.',
      };
  }
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
