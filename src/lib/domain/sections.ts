import type { NavSection, PlatformSectionState, SectionDisplayStatus } from '../../types/kali';

export interface SectionDefinition {
  sectionKey: NavSection;
  sectionName: string;
  description: string;
  category: string;
  isLockable: boolean;
  defaultDisplayStatus: SectionDisplayStatus;
  sortOrder: number;
}

export const SECTION_DISPLAY_STATUSES: readonly SectionDisplayStatus[] = [
  'enabled',
  'disabled',
  'coming_soon',
  'maintenance',
];

/**
 * Canonical registry of KALI3977 platform sections.
 * Notice: `learn-kali` sits directly after `labs` (Cyber Labs) and before `ctf` (CTF Arena).
 * Non-lockable core essentials (`home`, `profile`, `notifications`, `settings`, `legal`, `admin`)
 * cannot be locked out by "Disable All" so users/admins are never stranded.
 */
export const PLATFORM_SECTION_DEFINITIONS: readonly SectionDefinition[] = [
  {
    sectionKey: 'home',
    sectionName: 'Home',
    description: 'Platform overview, player telemetry, and campus notices.',
    category: 'Essential',
    isLockable: false,
    defaultDisplayStatus: 'enabled',
    sortOrder: 0,
  },
  {
    sectionKey: 'academy',
    sectionName: 'Learning Academy',
    description: 'Structured 8-stage cybersecurity curriculum, quizzes, diagnostics, and certificates.',
    category: 'Education',
    isLockable: true,
    defaultDisplayStatus: 'enabled',
    sortOrder: 10,
  },
  {
    sectionKey: 'books',
    sectionName: 'Books',
    description: 'Open-access textbooks, GNU manuals, and verified publisher references.',
    category: 'Education',
    isLockable: true,
    defaultDisplayStatus: 'enabled',
    sortOrder: 20,
  },
  {
    sectionKey: 'labs',
    sectionName: 'Cyber Labs',
    description: 'Hands-on practical security labs, guided walkthroughs, and sandbox environments.',
    category: 'Practice',
    isLockable: true,
    defaultDisplayStatus: 'enabled',
    sortOrder: 30,
  },
  {
    sectionKey: 'learn-kali',
    sectionName: 'Learn KALI',
    description: 'Gamified mastery of Linux & Kali security tools with skill trees, quests, and safe command practice.',
    category: 'Practice',
    isLockable: true,
    defaultDisplayStatus: 'enabled',
    sortOrder: 40,
  },
  {
    sectionKey: 'ctf',
    sectionName: 'CTF Arena',
    description: 'Server-verified Capture The Flag challenges across all security categories.',
    category: 'Competition',
    isLockable: true,
    defaultDisplayStatus: 'enabled',
    sortOrder: 50,
  },
  {
    sectionKey: 'arena',
    sectionName: 'Multiplayer Arena',
    description: 'Live campus rooms, shared team codes, competition lobbies, and team chat.',
    category: 'Competition',
    isLockable: true,
    defaultDisplayStatus: 'enabled',
    sortOrder: 60,
  },
  {
    sectionKey: 'games',
    sectionName: 'Games Arena',
    description: 'Interactive 30-game cybersecurity arena, matchmaking, and seasonal brackets.',
    category: 'Competition',
    isLockable: true,
    defaultDisplayStatus: 'enabled',
    sortOrder: 70,
  },
  {
    sectionKey: 'tournaments',
    sectionName: 'Tournaments & Events',
    description: 'University leagues, knockout/round-robin brackets, and scheduled competitions.',
    category: 'Competition',
    isLockable: true,
    defaultDisplayStatus: 'enabled',
    sortOrder: 80,
  },
  {
    sectionKey: 'mentor',
    sectionName: 'AI Cyber Mentor',
    description: 'Quota-protected AI cybersecurity study coach with database-enforced limits.',
    category: 'Assistance',
    isLockable: true,
    defaultDisplayStatus: 'enabled',
    sortOrder: 90,
  },
  {
    sectionKey: 'community',
    sectionName: 'Community',
    description: 'Peer discussions, study write-ups, Q&A, and community moderation.',
    category: 'Social',
    isLockable: true,
    defaultDisplayStatus: 'enabled',
    sortOrder: 100,
  },
  {
    sectionKey: 'career',
    sectionName: 'Career Hub',
    description: '18 cybersecurity career blueprints, portfolio guidance, and interview readiness.',
    category: 'Guidance',
    isLockable: true,
    defaultDisplayStatus: 'enabled',
    sortOrder: 110,
  },
  {
    sectionKey: 'profile',
    sectionName: 'My Profile',
    description: 'User account profile, campus verification, and achievements.',
    category: 'Essential',
    isLockable: false,
    defaultDisplayStatus: 'enabled',
    sortOrder: 120,
  },
  {
    sectionKey: 'notifications',
    sectionName: 'Notifications',
    description: 'System announcements, competition notices, and achievement alerts.',
    category: 'Essential',
    isLockable: false,
    defaultDisplayStatus: 'enabled',
    sortOrder: 130,
  },
  {
    sectionKey: 'settings',
    sectionName: 'Settings',
    description: 'Account preferences, MFA setup, and session security.',
    category: 'Essential',
    isLockable: false,
    defaultDisplayStatus: 'enabled',
    sortOrder: 140,
  },
  {
    sectionKey: 'legal',
    sectionName: 'IP & Legal Policies',
    description: 'Copyright notices, acceptable use policy, and IP compliance reporting.',
    category: 'Essential',
    isLockable: false,
    defaultDisplayStatus: 'enabled',
    sortOrder: 150,
  },
  {
    sectionKey: 'admin',
    sectionName: 'Admin Panel',
    description: 'Role-protected platform governance and global management console.',
    category: 'Essential',
    isLockable: false,
    defaultDisplayStatus: 'enabled',
    sortOrder: 160,
  },
];

export const LOCKABLE_SECTION_KEYS: readonly NavSection[] = PLATFORM_SECTION_DEFINITIONS
  .filter((d) => d.isLockable)
  .map((d) => d.sectionKey);

const DEFINITION_MAP = new Map<NavSection, SectionDefinition>(
  PLATFORM_SECTION_DEFINITIONS.map((d) => [d.sectionKey, d]),
);

export function getSectionDefinition(sectionKey: string): SectionDefinition | null {
  return DEFINITION_MAP.get(sectionKey as NavSection) ?? null;
}

export function isStaffAdminRole(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'event_admin' || role === 'moderator';
}

export function normalizeSectionDisplayStatus(
  input: unknown,
  fallback: SectionDisplayStatus = 'enabled',
): SectionDisplayStatus {
  if (typeof input !== 'string') return fallback;
  const cleaned = input.trim().toLowerCase();
  if ((SECTION_DISPLAY_STATUSES as readonly string[]).includes(cleaned)) {
    return cleaned as SectionDisplayStatus;
  }
  return fallback;
}

export function deriveSectionFlags(params: {
  displayStatus?: SectionDisplayStatus;
  enabledStatus?: boolean;
  maintenanceStatus?: boolean;
  isLockable: boolean;
}): {
  displayStatus: SectionDisplayStatus;
  enabledStatus: boolean;
  maintenanceStatus: boolean;
} {
  if (!params.isLockable) {
    return {
      displayStatus: 'enabled',
      enabledStatus: true,
      maintenanceStatus: false,
    };
  }

  let displayStatus: SectionDisplayStatus = params.displayStatus ?? 'enabled';
  if (params.maintenanceStatus === true && displayStatus === 'enabled') {
    displayStatus = 'maintenance';
  } else if (params.enabledStatus === false && displayStatus === 'enabled') {
    displayStatus = 'disabled';
  } else if (params.enabledStatus === true && params.displayStatus === undefined && params.maintenanceStatus !== true) {
    displayStatus = 'enabled';
  }

  return {
    displayStatus,
    enabledStatus: displayStatus === 'enabled',
    maintenanceStatus: displayStatus === 'maintenance',
  };
}

export function getEffectiveSectionStatus(
  section: Pick<PlatformSectionState, 'isLockable' | 'enabledStatus' | 'displayStatus' | 'maintenanceStatus'> | null | undefined,
): SectionDisplayStatus {
  if (!section || !section.isLockable) return 'enabled';
  if (section.maintenanceStatus || section.displayStatus === 'maintenance') return 'maintenance';
  if (section.displayStatus === 'coming_soon') return 'coming_soon';
  if (!section.enabledStatus || section.displayStatus === 'disabled') return 'disabled';
  return 'enabled';
}

export function isSectionVisibleInStudentNav(
  section: Pick<PlatformSectionState, 'isLockable' | 'enabledStatus' | 'displayStatus' | 'maintenanceStatus'> | null | undefined,
): boolean {
  // Disabled, Coming Soon, and Maintenance sections disappear from student-facing navigation.
  return getEffectiveSectionStatus(section) === 'enabled';
}

export interface SectionAccessEvaluation {
  allowed: boolean;
  httpStatus: 200 | 403 | 503;
  effectiveStatus: SectionDisplayStatus;
  reason: string;
}

export function evaluateSectionAccess(params: {
  section: Pick<PlatformSectionState, 'sectionKey' | 'sectionName' | 'isLockable' | 'enabledStatus' | 'displayStatus' | 'maintenanceStatus' | 'statusMessage'> | null | undefined;
  userRole: string | null | undefined;
  previewAsStudent?: boolean;
}): SectionAccessEvaluation {
  const effectiveStatus = getEffectiveSectionStatus(params.section);
  if (effectiveStatus === 'enabled') {
    return {
      allowed: true,
      httpStatus: 200,
      effectiveStatus: 'enabled',
      reason: 'Section is active.',
    };
  }

  // Administrators retain full access unless explicitly rendering a UI student preview
  if (isStaffAdminRole(params.userRole) && !params.previewAsStudent) {
    return {
      allowed: true,
      httpStatus: 200,
      effectiveStatus,
      reason: `Admin override active (student status: ${effectiveStatus}).`,
    };
  }

  const label = params.section?.sectionName || 'This section';
  const customMessage = params.section?.statusMessage?.trim();

  if (effectiveStatus === 'maintenance') {
    return {
      allowed: false,
      httpStatus: 503,
      effectiveStatus: 'maintenance',
      reason: customMessage || `${label} is temporarily under scheduled maintenance.`,
    };
  }

  if (effectiveStatus === 'coming_soon') {
    return {
      allowed: false,
      httpStatus: 403,
      effectiveStatus: 'coming_soon',
      reason: customMessage || `${label} is marked Coming Soon and is not yet open to students.`,
    };
  }

  return {
    allowed: false,
    httpStatus: 403,
    effectiveStatus: 'disabled',
    reason: customMessage || `${label} has been disabled by platform administration.`,
  };
}

export function buildDefaultSectionStates(): PlatformSectionState[] {
  return PLATFORM_SECTION_DEFINITIONS.map((def) => ({
    sectionKey: def.sectionKey,
    sectionName: def.sectionName,
    description: def.description,
    category: def.category,
    isLockable: def.isLockable,
    enabledStatus: true,
    displayStatus: def.defaultDisplayStatus,
    maintenanceStatus: false,
    statusMessage: '',
    sortOrder: def.sortOrder,
    updatedByEmail: null,
  }));
}
