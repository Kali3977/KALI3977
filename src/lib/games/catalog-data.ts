export type GameEngineType =
  | 'social_deduction'
  | 'cyber_battle'
  | 'investigation'
  | 'strategy_survival'
  | 'adventure_puzzle';

export type GameModeType =
  | 'solo'
  | '1v1'
  | 'team_vs_team'
  | 'free_for_all'
  | 'campus_vs_campus'
  | 'tournament'
  | 'coop';

export interface GameCategorySeed {
  code: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  slug: string;
  name: string;
  description: string;
  accentColor: 'emerald' | 'cyan' | 'violet' | 'amber' | 'rose' | 'blue';
  orderIndex: number;
}

export interface GameSeed {
  slug: string;
  categoryCode: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  title: string;
  tagline: string;
  description: string;
  instructions: string;
  engineType: GameEngineType;
  difficulty: 'Beginner' | 'Easy' | 'Medium' | 'Hard' | 'Expert';
  minPlayers: number;
  maxPlayers: number;
  supportedModes: GameModeType[];
  durationSeconds: number;
  isFeatured: boolean;
  scoringConfig: {
    baseXp: number;
    winXpBonus: number;
    baseCoins: number;
    winCoinsBonus: number;
    timeBonusMax: number;
  };
}

export const GAME_CATEGORIES_SEED: GameCategorySeed[] = [
  {
    code: 'A',
    slug: 'cybersecurity-battles',
    name: 'Cybersecurity Battles',
    description: 'Head-to-head red vs blue drills, dynamic CTF sprints, credential cracking, and packet defense.',
    accentColor: 'emerald',
    orderIndex: 1,
  },
  {
    code: 'B',
    slug: 'mystery-investigation',
    name: 'Mystery & Investigation',
    description: 'Forensic log reconstruction, intrusion timeline tracing, and suspect attribution cases.',
    accentColor: 'cyan',
    orderIndex: 2,
  },
  {
    code: 'C',
    slug: 'social-party',
    name: 'Social & Party Games',
    description: 'Hidden-role deduction, insider threat detection, and tactical bluffing across lobbies.',
    accentColor: 'violet',
    orderIndex: 3,
  },
  {
    code: 'D',
    slug: 'strategy-survival',
    name: 'Strategy & Survival',
    description: 'Wave-based firewall engineering, threat allocation, and resilient network governance.',
    accentColor: 'amber',
    orderIndex: 4,
  },
  {
    code: 'E',
    slug: 'adventure-puzzle',
    name: 'Adventure & Puzzle',
    description: 'Multi-lock cyber escape rooms, classical/modern cipher vaults, and logic labyrinths.',
    accentColor: 'blue',
    orderIndex: 5,
  },
  {
    code: 'F',
    slug: 'skill-speed',
    name: 'Skill & Speed Challenges',
    description: 'Timed Linux command mastery, regex precision, code auditing, and subnetting sprints.',
    accentColor: 'rose',
    orderIndex: 6,
  },
];

export const GAMES_SEED: GameSeed[] = [
  // Category A: Cybersecurity Battles (1-5)
  {
    slug: 'cyber-ctf-battle',
    categoryCode: 'A',
    title: 'Cyber CTF Battle',
    tagline: 'Multi-round real-time Capture The Flag showdown',
    description:
      'Compete solo, 1v1, or squad-vs-squad solving server-verified web, crypto, forensics, and privilege-escalation mini-challenges under a shared match clock.',
    instructions:
      '1. Inspect each round artifact in the tactical terminal. 2. Submit valid KALI3977{...} flags or exact remediations. 3. First solves and high accuracy earn dynamic speed multipliers. 4. Hints deduct a minor point modifier.',
    engineType: 'cyber_battle',
    difficulty: 'Medium',
    minPlayers: 1,
    maxPlayers: 16,
    supportedModes: ['solo', '1v1', 'team_vs_team', 'free_for_all', 'campus_vs_campus', 'tournament'],
    durationSeconds: 420,
    isFeatured: true,
    scoringConfig: { baseXp: 90, winXpBonus: 110, baseCoins: 45, winCoinsBonus: 65, timeBonusMax: 120 },
  },
  {
    slug: 'hack-or-defend',
    categoryCode: 'A',
    title: 'Hack or Defend',
    tagline: 'Red vs Blue attack-vector & patch duel',
    description:
      'Analyze exposed endpoints, pick the precise exploit payload or hardened defense patch across five live threat scenarios.',
    instructions:
      '1. Review the service configuration snippet. 2. Execute either exploit audit or defensive rule selection. 3. Score points for precision without collateral downtime.',
    engineType: 'cyber_battle',
    difficulty: 'Medium',
    minPlayers: 1,
    maxPlayers: 10,
    supportedModes: ['solo', '1v1', 'team_vs_team', 'campus_vs_campus'],
    durationSeconds: 300,
    isFeatured: false,
    scoringConfig: { baseXp: 75, winXpBonus: 90, baseCoins: 35, winCoinsBonus: 55, timeBonusMax: 90 },
  },
  {
    slug: 'terminal-rush',
    categoryCode: 'A',
    title: 'Terminal Rush',
    tagline: 'Rapid CLI incident containment sprint',
    description:
      'Execute exact shell diagnostic and containment commands to isolate rogue listeners, fix permissions, and inspect logs faster than opponents.',
    instructions:
      '1. Read the incident prompt carefully. 2. Type the exact POSIX/Linux command in the simulated shell. 3. Server validates command syntax and semantics instantly.',
    engineType: 'cyber_battle',
    difficulty: 'Easy',
    minPlayers: 1,
    maxPlayers: 12,
    supportedModes: ['solo', '1v1', 'free_for_all', 'tournament'],
    durationSeconds: 240,
    isFeatured: false,
    scoringConfig: { baseXp: 70, winXpBonus: 80, baseCoins: 35, winCoinsBonus: 50, timeBonusMax: 100 },
  },
  {
    slug: 'password-cracking-challenge',
    categoryCode: 'A',
    title: 'Password Cracking Challenge',
    tagline: 'Hash identification & entropy audit race',
    description:
      'Identify hash algorithms, decode salted/unsalted digests, detect weak key derivation configs, and audit credential strength.',
    instructions:
      '1. Examine each leaked digest or hash format. 2. Crack weak tokens or select secure KDF remediations. 3. Avoid incorrect guesses to preserve 100% accuracy bonus.',
    engineType: 'cyber_battle',
    difficulty: 'Medium',
    minPlayers: 1,
    maxPlayers: 12,
    supportedModes: ['solo', '1v1', 'free_for_all'],
    durationSeconds: 300,
    isFeatured: false,
    scoringConfig: { baseXp: 75, winXpBonus: 85, baseCoins: 35, winCoinsBonus: 50, timeBonusMax: 95 },
  },
  {
    slug: 'network-defense',
    categoryCode: 'A',
    title: 'Network Defense',
    tagline: 'Packet inspection & perimeter hardening',
    description:
      'Inspect suspicious traffic captures, pinpoint C2 beacons and port scans, and deploy strict iptables/CIDR filtering rules.',
    instructions:
      '1. Inspect packet metadata and anomaly alerts. 2. Supply the malicious IP, port, or firewall rule. 3. Maximize uptime while blocking lateral movement.',
    engineType: 'cyber_battle',
    difficulty: 'Hard',
    minPlayers: 1,
    maxPlayers: 10,
    supportedModes: ['solo', '1v1', 'team_vs_team', 'coop'],
    durationSeconds: 360,
    isFeatured: false,
    scoringConfig: { baseXp: 95, winXpBonus: 110, baseCoins: 45, winCoinsBonus: 65, timeBonusMax: 110 },
  },

  // Category B: Mystery & Investigation (6-10)
  {
    slug: 'cyber-detective',
    categoryCode: 'B',
    title: 'Cyber Detective',
    tagline: 'Case-based digital forensics & culprit attribution',
    description:
      'Investigate a multi-layer corporate data exfiltration case using server auth logs, DNS telemetry, and suspect dossiers to uncover who breached the vault.',
    instructions:
      '1. Examine available forensic evidence files. 2. Unlock deeper telemetry clues and link artifacts to suspects. 3. Submit your final culprit, attack vector, and containment verdict.',
    engineType: 'investigation',
    difficulty: 'Medium',
    minPlayers: 1,
    maxPlayers: 8,
    supportedModes: ['solo', 'coop', 'free_for_all', 'team_vs_team'],
    durationSeconds: 420,
    isFeatured: true,
    scoringConfig: { baseXp: 95, winXpBonus: 105, baseCoins: 50, winCoinsBonus: 65, timeBonusMax: 100 },
  },
  {
    slug: 'digital-evidence-hunt',
    categoryCode: 'B',
    title: 'Digital Evidence Hunt',
    tagline: 'Volatile artifact & file-metadata recovery',
    description:
      'Sift through disk directory listings, EXIF/hash anomalies, and deleted journal entries to prove chain-of-custody tampering.',
    instructions:
      '1. Inspect each evidence exhibit on the forensic board. 2. Flag tampered artifacts and extract indicators of compromise. 3. File the final forensic determination.',
    engineType: 'investigation',
    difficulty: 'Easy',
    minPlayers: 1,
    maxPlayers: 8,
    supportedModes: ['solo', 'coop', 'free_for_all'],
    durationSeconds: 360,
    isFeatured: false,
    scoringConfig: { baseXp: 75, winXpBonus: 85, baseCoins: 40, winCoinsBonus: 50, timeBonusMax: 85 },
  },
  {
    slug: 'who-is-the-hacker',
    categoryCode: 'B',
    title: 'Who Is The Hacker?',
    tagline: 'Insider-threat audit across employee logs',
    description:
      'Cross-reference VPN sign-ins, badge swipes, and Git commit timestamps to pinpoint which contractor misused privileged tokens.',
    instructions:
      '1. Compare timestamps across all exhibits. 2. Rule out false alibis using IP geolocation clues. 3. Submit the guilty suspect and stolen asset.',
    engineType: 'investigation',
    difficulty: 'Medium',
    minPlayers: 1,
    maxPlayers: 8,
    supportedModes: ['solo', '1v1', 'coop'],
    durationSeconds: 330,
    isFeatured: false,
    scoringConfig: { baseXp: 80, winXpBonus: 90, baseCoins: 40, winCoinsBonus: 55, timeBonusMax: 90 },
  },
  {
    slug: 'trace-the-attack',
    categoryCode: 'B',
    title: 'Trace The Attack',
    tagline: 'Kill-chain reconstruction from SIEM alerts',
    description:
      'Reconstruct the exact MITRE ATT&CK kill-chain sequence from phishing foothold through privilege escalation and C2 staging.',
    instructions:
      '1. Review SIEM timestamps and process trees. 2. Identify initial access, persistence mechanism, and C2 host. 3. Submit the complete trace verdict.',
    engineType: 'investigation',
    difficulty: 'Hard',
    minPlayers: 1,
    maxPlayers: 8,
    supportedModes: ['solo', 'coop', 'team_vs_team'],
    durationSeconds: 390,
    isFeatured: false,
    scoringConfig: { baseXp: 95, winXpBonus: 110, baseCoins: 45, winCoinsBonus: 65, timeBonusMax: 100 },
  },
  {
    slug: 'missing-data-case',
    categoryCode: 'B',
    title: 'Missing Data Case',
    tagline: 'SQL audit & shadow backup recovery',
    description:
      'Audit database query logs and cloud storage snapshots to discover how 40,000 research records disappeared overnight.',
    instructions:
      '1. Inspect SQL audit trails and S3/bucket access logs. 2. Pinpoint the misconfigured role and exfiltration window. 3. Lock in your forensic conclusion.',
    engineType: 'investigation',
    difficulty: 'Medium',
    minPlayers: 1,
    maxPlayers: 8,
    supportedModes: ['solo', 'coop', 'free_for_all'],
    durationSeconds: 360,
    isFeatured: false,
    scoringConfig: { baseXp: 80, winXpBonus: 95, baseCoins: 40, winCoinsBonus: 55, timeBonusMax: 90 },
  },

  // Category C: Social & Party Games (11-15)
  {
    slug: 'hacker-among-us',
    categoryCode: 'C',
    title: 'Hacker Among Us',
    tagline: 'Hidden-role SOC sabotage & social deduction',
    description:
      'Defenders race to complete critical security hardening tasks across the cluster while hidden Hackers secretly inject sabotages and blend in during emergency meetings.',
    instructions:
      '1. Roles are assigned secretly by the server (never leaked to other players). 2. Defenders verify security tasks; Hackers trigger system sabotages. 3. Call Emergency Meetings, discuss clues in chat, and vote to eject suspects.',
    engineType: 'social_deduction',
    difficulty: 'Easy',
    minPlayers: 1,
    maxPlayers: 12,
    supportedModes: ['free_for_all', 'coop', 'campus_vs_campus', 'solo'],
    durationSeconds: 480,
    isFeatured: true,
    scoringConfig: { baseXp: 95, winXpBonus: 120, baseCoins: 50, winCoinsBonus: 75, timeBonusMax: 80 },
  },
  {
    slug: 'spy-network',
    categoryCode: 'C',
    title: 'Spy Network',
    tagline: 'Double-agent relay & encrypted dead-drop deduction',
    description:
      'Identify compromised operatives inside a multi-node intelligence cell before secret relay nodes are compromised.',
    instructions:
      '1. Complete node integrity checks or execute covert signal disruptions. 2. Debate anomalies in tribunal meetings. 3. Vote decisively to neutralize moles.',
    engineType: 'social_deduction',
    difficulty: 'Medium',
    minPlayers: 1,
    maxPlayers: 10,
    supportedModes: ['free_for_all', 'solo', 'team_vs_team'],
    durationSeconds: 420,
    isFeatured: false,
    scoringConfig: { baseXp: 85, winXpBonus: 105, baseCoins: 45, winCoinsBonus: 65, timeBonusMax: 75 },
  },
  {
    slug: 'bluff-and-betray',
    categoryCode: 'C',
    title: 'Bluff and Betray',
    tagline: 'High-stakes zero-trust alliance negotiation',
    description:
      'Players hold secret threat advisories and must bluff, verify claims, and vote out rogue operators manipulating alert feeds.',
    instructions:
      '1. Perform your assigned role operations. 2. Spot contradictions during meeting debates. 3. Cast strategic ejection votes.',
    engineType: 'social_deduction',
    difficulty: 'Easy',
    minPlayers: 1,
    maxPlayers: 10,
    supportedModes: ['free_for_all', 'solo'],
    durationSeconds: 360,
    isFeatured: false,
    scoringConfig: { baseXp: 80, winXpBonus: 95, baseCoins: 40, winCoinsBonus: 60, timeBonusMax: 70 },
  },
  {
    slug: 'secret-identity',
    categoryCode: 'C',
    title: 'Secret Identity',
    tagline: 'Covert credential verification party challenge',
    description:
      'Protect your assigned operational cover while auditing peer behavior for forged signatures and sabotage traces.',
    instructions:
      '1. Complete assigned defense tasks or stealth disruptions. 2. Deduce suspicious timing patterns. 3. Vote out forged identities.',
    engineType: 'social_deduction',
    difficulty: 'Easy',
    minPlayers: 1,
    maxPlayers: 12,
    supportedModes: ['free_for_all', 'solo'],
    durationSeconds: 360,
    isFeatured: false,
    scoringConfig: { baseXp: 80, winXpBonus: 95, baseCoins: 40, winCoinsBonus: 60, timeBonusMax: 70 },
  },
  {
    slug: 'campus-mafia',
    categoryCode: 'C',
    title: 'Campus Mafia',
    tagline: 'Inter-campus late-night cyber syndicate deduction',
    description:
      'A classic cybersecurity twist on Mafia: Campus Security Analysts hunt hidden Syndicate Intrusionists before the lab grid goes dark.',
    instructions:
      '1. Analysts secure campus workstations; Syndicate members inject stealth exploits. 2. Meet in tribunal chat to cross-examine suspects. 3. Outvote the opposition.',
    engineType: 'social_deduction',
    difficulty: 'Easy',
    minPlayers: 1,
    maxPlayers: 12,
    supportedModes: ['free_for_all', 'campus_vs_campus', 'solo'],
    durationSeconds: 450,
    isFeatured: false,
    scoringConfig: { baseXp: 85, winXpBonus: 105, baseCoins: 45, winCoinsBonus: 65, timeBonusMax: 75 },
  },

  // Category D: Strategy & Survival (16-20)
  {
    slug: 'cyber-war',
    categoryCode: 'D',
    title: 'Cyber War',
    tagline: 'Theater-scale grid defense & counter-measure waves',
    description:
      'Command energy, compute, and incident response budgets across 4 escalating threat waves including ransomware bursts and BGP hijacks.',
    instructions:
      '1. Allocate your defense resources across Firewall, IDS, Patching, and Deception sectors each wave. 2. Resolve incoming attack vectors on the server. 3. Survive all waves with >= 1% system integrity.',
    engineType: 'strategy_survival',
    difficulty: 'Hard',
    minPlayers: 1,
    maxPlayers: 8,
    supportedModes: ['solo', '1v1', 'team_vs_team', 'coop'],
    durationSeconds: 360,
    isFeatured: false,
    scoringConfig: { baseXp: 90, winXpBonus: 110, baseCoins: 45, winCoinsBonus: 65, timeBonusMax: 90 },
  },
  {
    slug: 'build-your-firewall',
    categoryCode: 'D',
    title: 'Build Your Firewall',
    tagline: 'Layered perimeter defense & packet survival',
    description:
      'Construct resilient firewall posture wave after wave while balancing legitimate user throughput against DDoS and SQLi floods.',
    instructions:
      '1. Choose optimal defense deployments using limited energy credits. 2. Trigger wave simulation and observe server mitigation outcomes. 3. Maximize integrity score.',
    engineType: 'strategy_survival',
    difficulty: 'Easy',
    minPlayers: 1,
    maxPlayers: 8,
    supportedModes: ['solo', 'free_for_all', 'coop'],
    durationSeconds: 300,
    isFeatured: false,
    scoringConfig: { baseXp: 70, winXpBonus: 85, baseCoins: 35, winCoinsBonus: 50, timeBonusMax: 80 },
  },
  {
    slug: 'network-empire',
    categoryCode: 'D',
    title: 'Network Empire',
    tagline: 'Global backbone resilience & zero-trust routing',
    description:
      'Scale global Points of Presence while defending against botnets, credential stuffing, and supply-chain worms.',
    instructions:
      '1. Invest compute credits across telemetry, segmentation, and redundancy each round. 2. Outlast adversary campaigns to finish with top network score.',
    engineType: 'strategy_survival',
    difficulty: 'Medium',
    minPlayers: 1,
    maxPlayers: 8,
    supportedModes: ['solo', 'free_for_all', 'campus_vs_campus'],
    durationSeconds: 360,
    isFeatured: false,
    scoringConfig: { baseXp: 85, winXpBonus: 100, baseCoins: 40, winCoinsBonus: 60, timeBonusMax: 85 },
  },
  {
    slug: 'resource-survival',
    categoryCode: 'D',
    title: 'Resource Survival',
    tagline: 'Under-siege SOC uptime & triage conservation',
    description:
      'Maintain critical hospital & university infrastructure uptime with severely constrained incident responders and power reserves.',
    instructions:
      '1. Prioritize the highest-impact mitigations per wave. 2. Avoid over-spending energy early before apex threats arrive. 3. Survive all waves.',
    engineType: 'strategy_survival',
    difficulty: 'Hard',
    minPlayers: 1,
    maxPlayers: 6,
    supportedModes: ['solo', 'coop'],
    durationSeconds: 330,
    isFeatured: false,
    scoringConfig: { baseXp: 85, winXpBonus: 100, baseCoins: 45, winCoinsBonus: 60, timeBonusMax: 85 },
  },
  {
    slug: 'digital-kingdom',
    categoryCode: 'D',
    title: 'Digital Kingdom',
    tagline: 'Sovereign cyber-citadel fortification strategy',
    description:
      'Fortify data vaults, cryptographic citadels, and citizen identity gateways against relentless APT sieges.',
    instructions:
      '1. Deploy defensive investments each wave. 2. Counter specialized APT tactics using matched mitigations. 3. Preserve citadel integrity.',
    engineType: 'strategy_survival',
    difficulty: 'Medium',
    minPlayers: 1,
    maxPlayers: 8,
    supportedModes: ['solo', '1v1', 'team_vs_team'],
    durationSeconds: 360,
    isFeatured: false,
    scoringConfig: { baseXp: 80, winXpBonus: 95, baseCoins: 40, winCoinsBonus: 60, timeBonusMax: 85 },
  },

  // Category E: Adventure & Puzzle (21-25)
  {
    slug: 'cyber-escape-room',
    categoryCode: 'E',
    title: 'Cyber Escape Room',
    tagline: '4-stage cryptographic & logic airgap breakout',
    description:
      'Locked inside a compromised SCIF telemetry vault, crack 4 sequential digital locks—Base64/Hex decoding, Caesar cipher, binary logic, and token verification—before lockdown.',
    instructions:
      '1. Solve each sequential lock in order. 2. Server unlocks the next chamber stage immediately upon valid input. 3. Cooperative rooms share chamber progression!',
    engineType: 'adventure_puzzle',
    difficulty: 'Medium',
    minPlayers: 1,
    maxPlayers: 6,
    supportedModes: ['solo', 'coop', 'free_for_all', '1v1'],
    durationSeconds: 420,
    isFeatured: false,
    scoringConfig: { baseXp: 85, winXpBonus: 105, baseCoins: 45, winCoinsBonus: 60, timeBonusMax: 100 },
  },
  {
    slug: 'decode-the-message',
    categoryCode: 'E',
    title: 'Decode The Message',
    tagline: 'Layered cipher & encoding decryption trail',
    description:
      'Peel away multi-encoding layers (ROT13, Hex, Base64, XOR) on intercepted field transmissions to recover hidden coordinates.',
    instructions:
      '1. Analyze the encoded transmission for each lock. 2. Decode cleanly without relying on hints for maximum points. 3. Unlock all 4 transmissions.',
    engineType: 'adventure_puzzle',
    difficulty: 'Easy',
    minPlayers: 1,
    maxPlayers: 8,
    supportedModes: ['solo', '1v1', 'free_for_all'],
    durationSeconds: 300,
    isFeatured: false,
    scoringConfig: { baseXp: 70, winXpBonus: 85, baseCoins: 35, winCoinsBonus: 50, timeBonusMax: 90 },
  },
  {
    slug: 'encrypted-vault',
    categoryCode: 'E',
    title: 'Encrypted Vault',
    tagline: 'Zero-knowledge PIN & key-derivation heist',
    description:
      'Bypass four mathematical vault barriers using modular arithmetic, checksum validation, and RSA exponent puzzles.',
    instructions:
      '1. Compute the exact vault key for each barrier. 2. Advance sequentially through all 4 security layers. 3. Beat the room clock.',
    engineType: 'adventure_puzzle',
    difficulty: 'Hard',
    minPlayers: 1,
    maxPlayers: 6,
    supportedModes: ['solo', 'coop', '1v1'],
    durationSeconds: 360,
    isFeatured: false,
    scoringConfig: { baseXp: 95, winXpBonus: 115, baseCoins: 45, winCoinsBonus: 65, timeBonusMax: 100 },
  },
  {
    slug: 'logic-labyrinth',
    categoryCode: 'E',
    title: 'Logic Labyrinth',
    tagline: 'Boolean gates, bitwise masks & state-machine maze',
    description:
      'Navigate a digital labyrinth where every gate opens only when you evaluate bitwise AND/OR/XOR expressions and state transitions accurately.',
    instructions:
      '1. Evaluate the bitwise or boolean logic riddle at each gate. 2. Enter the exact output value to advance. 3. Reach the exit chamber.',
    engineType: 'adventure_puzzle',
    difficulty: 'Medium',
    minPlayers: 1,
    maxPlayers: 8,
    supportedModes: ['solo', 'free_for_all', 'coop'],
    durationSeconds: 300,
    isFeatured: false,
    scoringConfig: { baseXp: 75, winXpBonus: 90, baseCoins: 40, winCoinsBonus: 55, timeBonusMax: 90 },
  },
  {
    slug: 'mission-impossible',
    categoryCode: 'E',
    title: 'Mission Impossible',
    tagline: 'Covert exfiltration prevention & hardware lock override',
    description:
      'Disarm a ticking rogue payload by reversing firmware pins, port-knock sequences, and HMAC signature verifications.',
    instructions:
      '1. Follow the tactical mission briefing for each chamber. 2. Neutralize all 4 security locks before timer expiry.',
    engineType: 'adventure_puzzle',
    difficulty: 'Expert',
    minPlayers: 1,
    maxPlayers: 6,
    supportedModes: ['solo', 'coop', 'team_vs_team'],
    durationSeconds: 420,
    isFeatured: false,
    scoringConfig: { baseXp: 105, winXpBonus: 125, baseCoins: 55, winCoinsBonus: 75, timeBonusMax: 110 },
  },

  // Category F: Skill & Speed Challenges (26-30)
  {
    slug: 'linux-command-race',
    categoryCode: 'F',
    title: 'Linux Command Race',
    tagline: 'High-speed POSIX & GNU utility precision sprint',
    description:
      'Race the clock to produce exact Linux commands for SUID audits, systemd triage, socket checks, and text filtering.',
    instructions:
      '1. Read each sysadmin/security task. 2. Submit the exact command string. 3. Fast, accurate solves score speed multipliers.',
    engineType: 'cyber_battle',
    difficulty: 'Easy',
    minPlayers: 1,
    maxPlayers: 16,
    supportedModes: ['solo', '1v1', 'free_for_all', 'tournament'],
    durationSeconds: 240,
    isFeatured: false,
    scoringConfig: { baseXp: 70, winXpBonus: 85, baseCoins: 35, winCoinsBonus: 50, timeBonusMax: 110 },
  },
  {
    slug: 'regex-challenge',
    categoryCode: 'F',
    title: 'Regex Challenge',
    tagline: 'Log-parsing regular expression speedrun',
    description:
      'Craft compact, safe regular expressions to match IPv4 addresses, JWT prefixes, CVE identifiers, and malicious URI patterns.',
    instructions:
      '1. Inspect target test strings and negative examples. 2. Enter a valid pattern or match selector. 3. Complete all rounds before opponents.',
    engineType: 'cyber_battle',
    difficulty: 'Medium',
    minPlayers: 1,
    maxPlayers: 12,
    supportedModes: ['solo', '1v1', 'free_for_all'],
    durationSeconds: 270,
    isFeatured: false,
    scoringConfig: { baseXp: 75, winXpBonus: 90, baseCoins: 35, winCoinsBonus: 55, timeBonusMax: 100 },
  },
  {
    slug: 'code-debugging',
    categoryCode: 'F',
    title: 'Code Debugging',
    tagline: 'Secure code review & vulnerability fix sprint',
    description:
      'Spot insecure SQL concatenation, command injection, prototype pollution, and auth bypass bugs across TypeScript & Python snippets.',
    instructions:
      '1. Read each vulnerable snippet carefully. 2. Identify the flaw line or select the secure patch. 3. Advance cleanly through all rounds.',
    engineType: 'cyber_battle',
    difficulty: 'Medium',
    minPlayers: 1,
    maxPlayers: 12,
    supportedModes: ['solo', '1v1', 'free_for_all', 'campus_vs_campus'],
    durationSeconds: 300,
    isFeatured: false,
    scoringConfig: { baseXp: 80, winXpBonus: 95, baseCoins: 40, winCoinsBonus: 55, timeBonusMax: 100 },
  },
  {
    slug: 'spot-the-vulnerability',
    categoryCode: 'F',
    title: 'Spot The Vulnerability',
    tagline: 'OWASP Top 10 & cloud misconfig rapid triage',
    description:
      'Rapid-fire inspection of IAM policies, CORS headers, JWT payloads, and CSP directives to pinpoint critical security flaws.',
    instructions:
      '1. Audit the displayed configuration block. 2. Pinpoint the exact CWE/OWASP flaw or unsafe directive. 3. Score high accuracy streaks.',
    engineType: 'cyber_battle',
    difficulty: 'Easy',
    minPlayers: 1,
    maxPlayers: 16,
    supportedModes: ['solo', '1v1', 'free_for_all'],
    durationSeconds: 240,
    isFeatured: false,
    scoringConfig: { baseXp: 70, winXpBonus: 85, baseCoins: 35, winCoinsBonus: 50, timeBonusMax: 105 },
  },
  {
    slug: 'networking-speed-test',
    categoryCode: 'F',
    title: 'Networking Speed Test',
    tagline: 'CIDR subnetting, OSI & TCP/UDP port reflex drill',
    description:
      'Calculate CIDR broadcast addresses, subnet host counts, well-known service ports, and TLS handshake stages at tournament speed.',
    instructions:
      '1. Solve each networking calculation or protocol prompt. 2. Type the exact answer (CIDR/IP/port). 3. Beat the speed par.',
    engineType: 'cyber_battle',
    difficulty: 'Easy',
    minPlayers: 1,
    maxPlayers: 16,
    supportedModes: ['solo', '1v1', 'free_for_all', 'tournament'],
    durationSeconds: 240,
    isFeatured: false,
    scoringConfig: { baseXp: 70, winXpBonus: 85, baseCoins: 35, winCoinsBonus: 50, timeBonusMax: 110 },
  },
];

export interface GameAchievementSeed {
  code: string;
  title: string;
  description: string;
  category: string;
  xpBonus: number;
  coinsBonus: number;
  badgeTier: 'bronze' | 'silver' | 'gold' | 'emerald';
}

export const GAME_ACHIEVEMENTS_SEED: GameAchievementSeed[] = [
  {
    code: 'FIRST_ARENA_MATCH',
    title: 'Arena Initiate',
    description: 'Completed your first official match in KALI3977 Games Arena.',
    category: 'General',
    xpBonus: 75,
    coinsBonus: 50,
    badgeTier: 'bronze',
  },
  {
    code: 'FIRST_VICTORY',
    title: 'Tactical Victor',
    description: 'Secured 1st place or team victory in a Games Arena match.',
    category: 'Combat',
    xpBonus: 120,
    coinsBonus: 80,
    badgeTier: 'silver',
  },
  {
    code: 'SHARP_DETECTIVE',
    title: 'Forensic Sleuth',
    description: 'Solved a Mystery & Investigation case with 80%+ accuracy.',
    category: 'Investigation',
    xpBonus: 150,
    coinsBonus: 100,
    badgeTier: 'silver',
  },
  {
    code: 'WIN_STREAK_3',
    title: 'Unbroken Momentum',
    description: 'Achieved a 3-match winning streak across Games Arena.',
    category: 'Streak',
    xpBonus: 200,
    coinsBonus: 150,
    badgeTier: 'gold',
  },
  {
    code: 'SOCIAL_SLEUTH',
    title: 'Zero-Trust Tribunal',
    description: 'Won a Social & Party deduction match.',
    category: 'Social',
    xpBonus: 140,
    coinsBonus: 95,
    badgeTier: 'emerald',
  },
  {
    code: 'MULTIPLAYER_TEAM_PLAY',
    title: 'Squad Operator',
    description: 'Entered and completed a live multiplayer or team-coded match.',
    category: 'Multiplayer',
    xpBonus: 130,
    coinsBonus: 85,
    badgeTier: 'silver',
  },
];

export interface GameMissionSeed {
  code: string;
  cadence: 'daily' | 'weekly';
  title: string;
  description: string;
  targetMetric: 'matches_played' | 'matches_won' | 'high_accuracy_matches' | 'categories_explored';
  targetValue: number;
  xpReward: number;
  coinsReward: number;
}

export const GAME_MISSIONS_SEED: GameMissionSeed[] = [
  {
    code: 'DAILY_FIRST_DEPLOYMENT',
    cadence: 'daily',
    title: 'Daily Arena Deployment',
    description: 'Complete 1 match in any Games Arena title today.',
    targetMetric: 'matches_played',
    targetValue: 1,
    xpReward: 60,
    coinsReward: 40,
  },
  {
    code: 'DAILY_PRECISION_VICTORY',
    cadence: 'daily',
    title: 'Tactical Victory',
    description: 'Win 1 Games Arena match today.',
    targetMetric: 'matches_won',
    targetValue: 1,
    xpReward: 95,
    coinsReward: 65,
  },
  {
    code: 'WEEKLY_FIVE_BATTLES',
    cadence: 'weekly',
    title: 'Weekly Veteran Campaign',
    description: 'Complete 5 matches across Games Arena this week.',
    targetMetric: 'matches_played',
    targetValue: 5,
    xpReward: 220,
    coinsReward: 160,
  },
  {
    code: 'WEEKLY_SHARPSHOOTER',
    cadence: 'weekly',
    title: 'High-Precision Specialist',
    description: 'Finish 3 matches with >= 80% accuracy this week.',
    targetMetric: 'high_accuracy_matches',
    targetValue: 3,
    xpReward: 260,
    coinsReward: 190,
  },
];

export interface CosmeticItem {
  id: string;
  name: string;
  type: 'theme' | 'badge';
  costCoins: number;
  description: string;
  accentClass: string;
}

export const GAME_COSMETICS_CATALOG: CosmeticItem[] = [
  {
    id: 'emerald-grid',
    name: 'Emerald Matrix Frame',
    type: 'theme',
    costCoins: 0,
    description: 'Standard KALI3977 tactical emerald operator frame.',
    accentClass: 'border-emerald-500/40 text-emerald-400',
  },
  {
    id: 'cyan-telemetry',
    name: 'Cyan Telemetry Pulse',
    type: 'theme',
    costCoins: 120,
    description: 'High-contrast SOC cyan perimeter profile trim.',
    accentClass: 'border-cyan-500/50 text-cyan-400',
  },
  {
    id: 'violet-phantom',
    name: 'Phantom Zero-Day Frame',
    type: 'theme',
    costCoins: 240,
    description: 'Deep violet specialist accent for top deduction operators.',
    accentClass: 'border-violet-500/50 text-violet-400',
  },
  {
    id: 'amber-vanguard',
    name: 'Vanguard Gold Crest',
    type: 'badge',
    costCoins: 350,
    description: 'Display title: Vanguard Operator (purely cosmetic, earned via Game Coins).',
    accentClass: 'border-amber-500/50 text-amber-400',
  },
  {
    id: 'sentinel-elite',
    name: 'Cyber Sentinel Emblem',
    type: 'badge',
    costCoins: 500,
    description: 'Display title: Cyber Sentinel (purely cosmetic, non-academic).',
    accentClass: 'border-rose-500/50 text-rose-400',
  },
];
