export type NavSection =
  | 'home'
  | 'academy'
  | 'books'
  | 'labs'
  | 'learn-kali'
  | 'ctf'
  | 'arena'
  | 'games'
  | 'tournaments'
  | 'mentor'
  | 'community'
  | 'career'
  | 'profile'
  | 'notifications'
  | 'settings'
  | 'legal'
  | 'admin';

export type SectionDisplayStatus = 'enabled' | 'disabled' | 'coming_soon' | 'maintenance';

export interface PlatformSectionState {
  sectionKey: NavSection;
  sectionName: string;
  description: string;
  category: string;
  isLockable: boolean;
  enabledStatus: boolean;
  displayStatus: SectionDisplayStatus;
  maintenanceStatus: boolean;
  statusMessage: string;
  sortOrder: number;
  updatedByEmail?: string | null;
  updatedAt?: string;
}

export type PrimaryHub =
  | 'home'
  | 'learn'
  | 'practice'
  | 'play'
  | 'community'
  | 'career'
  | 'profile'
  | 'admin';

export type AppearanceTheme = 'dark' | 'light';

export type LearningExperience = 'beginner' | 'intermediate' | 'expert';

export type ProgressionMode = 'automatic' | 'manual';

export type LayoutPreference = 'automatic' | 'mobile' | 'tablet' | 'desktop';

export interface BookmarkItem {
  type: 'course' | 'tool' | 'lab' | 'ctf';
  slug: string;
  title: string;
  addedAt: string;
}

export interface LearningExperienceConfig {
  defaultLearningExperience: LearningExperience;
  autoProgressionEnabled: boolean;
  beginnerMaxXp: number;
  intermediateMaxXp: number;
  minLessonsForIntermediate: number;
  minPracticeForIntermediate: number;
  minLessonsForExpert: number;
  minPracticeForExpert: number;
}

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  emailVerified: boolean;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  country: string;
  role: 'guest' | 'player' | 'team_captain' | 'moderator' | 'event_admin' | 'owner';
  campusId: number | null;
  campusName?: string | null;
  campusVerificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected' | string;
  campusVerificationMethod?: string | null;
  xp: number;
  level: number;
  levelProgress: {
    level: number;
    currentLevelXp: number;
    nextLevelXp: number;
    progressPct: number;
  };
  ctfPoints: number;
  dailyStreak: number;
  mfaEnabled: boolean;
  policyAcknowledgedAt?: string | null;
  profileVisibility: 'public' | 'private';
  preferredLang: 'en' | 'hi';
  appearanceTheme: AppearanceTheme;
  learningExperience: LearningExperience;
  progressionMode: ProgressionMode;
  layoutPreference: LayoutPreference;
  onboardingCompleted: boolean;
  onboardingGoal: string;
  pendingThemeUpgrade?: LearningExperience | null;
  dismissedThemeUpgrade?: LearningExperience | null;
  bookmarks?: BookmarkItem[];
  notificationPrefs: {
    competitions: boolean;
    teamChat: boolean;
    securityAlerts: boolean;
    achievements: boolean;
  };
}

export interface Campus {
  id: number;
  code: string;
  name: string;
  country: string;
  city: string;
  emailDomain?: string | null;
  verified: boolean;
}
