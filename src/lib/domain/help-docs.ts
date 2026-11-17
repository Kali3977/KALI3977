import type { NavSection } from '../../types/kali';

export interface GlossaryEntry {
  term: string;
  shortMeaning: string;
  example: string;
  category: 'Basics' | 'Linux & Terminal' | 'Networking' | 'Practice & Play' | 'Platform';
}

export interface HelpArticle {
  id: string;
  title: string;
  audience: 'Beginner' | 'All Learners' | 'Competitors';
  summary: string;
  steps: string[];
  targetSection: NavSection;
  ctaLabel: string;
}

export const CYBER_GLOSSARY: readonly GlossaryEntry[] = [
  {
    term: 'Virtual Machine (VM)',
    shortMeaning: 'A simulated computer running inside another computer so you can practice security safely without risking your real device.',
    example: 'Think of a VM like a flight simulator for pilots.',
    category: 'Basics',
  },
  {
    term: 'Browser Simulator vs Live MicroVM',
    shortMeaning: 'The Browser Simulator runs safe pre-modeled Linux/Kali commands instantly in your browser. A Live MicroVM connects to an isolated Linux kernel container when provisioned.',
    example: 'Use the Browser Simulator in Learn KALI right away; check Cyber Labs for MicroVM runner status.',
    category: 'Platform',
  },
  {
    term: 'IP Address',
    shortMeaning: 'A unique numerical address (like 192.168.56.10) that identifies a device on a network so packets know where to go.',
    example: '192.168.56.10 is the authorized practice target inside KALI3977 simulated terminals.',
    category: 'Networking',
  },
  {
    term: 'Port & Service',
    shortMeaning: 'A numbered doorway on a computer (for example port 22 for SSH, port 80 for HTTP web servers).',
    example: 'nmap -sV 192.168.56.10 discovers open ports and running service versions.',
    category: 'Networking',
  },
  {
    term: 'WHOIS Lookup',
    shortMeaning: 'A public directory query that shows who registered a domain name, its registrar, and name servers.',
    example: 'whois kali.org shows domain registration metadata and name servers.',
    category: 'Networking',
  },
  {
    term: 'sudo & apt',
    shortMeaning: 'sudo runs a command with administrator (root) privileges; apt updates package lists and installs software tools on Debian/Kali Linux.',
    example: 'sudo apt update && sudo apt install -y whois',
    category: 'Linux & Terminal',
  },
  {
    term: 'CTF Flag',
    shortMeaning: 'A secret proof string (usually formatted like KALI3977{...}) that you find by solving a cybersecurity puzzle and submit for points.',
    example: 'Submit KALI3977{example_flag} inside the CTF Arena challenge drawer.',
    category: 'Practice & Play',
  },
  {
    term: 'Room Code vs Team Code',
    shortMeaning: 'A Room Code opens a multiplayer lobby or competition room. A Team Code assigns you to a specific squad or campus team inside that room.',
    example: 'Enter your Room Code first, then add a Team Code only if joining a team battle.',
    category: 'Practice & Play',
  },
  {
    term: 'Appearance Theme vs Learning Experience',
    shortMeaning: 'Appearance (Dark/Light) changes colors only. Learning Experience (Beginner/Intermediate/Expert) adjusts guidance, hints, and density without ever locking courses or tools.',
    example: 'You can use Light Mode + Expert Experience, or Dark Mode + Beginner Experience.',
    category: 'Platform',
  },
];

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    id: 'getting-started',
    title: 'Where to Start on KALI3977 (Zero Experience)',
    audience: 'Beginner',
    summary: 'Follow a clear 4-step path from your first Linux command to solving real security labs and games.',
    steps: [
      'Start in Learn -> Learning Academy (Stage 1) to learn computing, OS, and networking basics in English or Hindi.',
      'Open Learn -> Learn KALI and try `ls -la`, `cat README.txt`, and `whois kali.org` inside the safe practice terminal.',
      'Move to Practice -> Cyber Labs for guided walkthroughs and verification exercises.',
      'Join Practice -> CTF Arena or Play -> Games Arena when ready to test your speed and accuracy.',
    ],
    targetSection: 'academy',
    ctaLabel: 'Open Learning Academy',
  },
  {
    id: 'learn-kali-terminal',
    title: 'How the Learn KALI Terminal Simulator Works',
    audience: 'Beginner',
    summary: 'Practice Linux and security commands instantly in-browser with flag-by-flag explanations and zero risk.',
    steps: [
      'Click any suggested command chip or type your own command and press Enter or Run.',
      'Chained commands like `sudo apt update && sudo apt install -y whois` work directly in the virtual session.',
      'Every command shows a Command & Flag Breakdown explaining each switch.',
      'External internet targets (like 8.8.8.8 or google.com) are blocked automatically for ethical training safety.',
    ],
    targetSection: 'learn-kali',
    ctaLabel: 'Open Learn KALI',
  },
  {
    id: 'cyber-labs-ctf',
    title: 'How Cyber Labs & CTF Challenges Work',
    audience: 'All Learners',
    summary: 'Understand guided walkthroughs, proof tokens, and dynamic CTF flag scoring.',
    steps: [
      'In Cyber Labs, pick a lab, read its learning objectives, and follow the step-by-step walkthrough.',
      'Complete the inspection check or verification prompt to unlock XP.',
      'In CTF Arena, download or read the challenge briefing, inspect artifacts, and submit the flag matching KALI3977{...}.',
    ],
    targetSection: 'labs',
    ctaLabel: 'Open Cyber Labs',
  },
  {
    id: 'games-multiplayer',
    title: 'How Games, Room Codes & Team Codes Work',
    audience: 'Competitors',
    summary: 'Play solo immediately or join live multiplayer rooms and inter-campus tournaments.',
    steps: [
      'Open Play -> Games Arena and click Play Solo on any of the 30 games to start without waiting.',
      'To play with friends or classmates, create a room and share its Room Code.',
      'For Team vs Team or Campus battles, also enter the separate Team Code to lock into your squad.',
    ],
    targetSection: 'games',
    ctaLabel: 'Open Games Arena',
  },
  {
    id: 'themes-progression',
    title: 'How Adaptive Themes & Automatic Progression Work',
    audience: 'All Learners',
    summary: 'Switch Dark/Light colors and Beginner/Intermediate/Expert guidance independently at any time.',
    steps: [
      'Use the header Sun/Moon button to switch Dark Mode and Light Mode.',
      'Use the Experience menu or Profile -> Settings to pick Beginner, Intermediate, or Expert.',
      'In Automatic Progression mode, KALI3977 notifies you before recommending a level upgrade once you meet XP and practice goals.',
      'Switching to Manual mode keeps your chosen Experience locked until you change it.',
    ],
    targetSection: 'settings',
    ctaLabel: 'Open Theme Settings',
  },
];
