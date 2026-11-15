export type NavSection =
  | 'home'
  | 'academy'
  | 'books'
  | 'labs'
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
