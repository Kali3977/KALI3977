import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  Check,
  Flag,
  FlaskConical,
  Gamepad2,
  HelpCircle,
  Home,
  Library,
  Loader2,
  LogOut,
  Menu,
  MonitorSmartphone,
  Moon,
  Scale,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Swords,
  Terminal,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LayoutProvider, useLayout } from './context/LayoutContext';
import { SectionProvider, useSections } from './context/SectionContext';
import type { LayoutPreference, LearningExperience, NavSection, PrimaryHub } from './types/kali';
import { HomeDashboard } from './components/HomeDashboard';
import { LearningAcademy } from './components/LearningAcademy';
import { BooksLibrary } from './components/BooksLibrary';
import { CyberLabs } from './components/CyberLabs';
import { LearnKaliFoundation } from './components/LearnKaliFoundation';
import { CtfArena } from './components/CtfArena';
import { MultiplayerArena } from './components/MultiplayerArena';
import { GamesArenaHub } from './components/games/GamesArenaHub';
import { TournamentsView } from './components/TournamentsView';
import { AiCyberMentor } from './components/AiCyberMentor';
import { CareerHubView, CommunityView } from './components/CommunityCareerHub';
import {
  NotificationsView,
  ProfileView,
  SettingsView,
} from './components/ProfileSettingsNotifications';
import { OwnerControlCentre } from './components/OwnerControlCentre';
import { BrandMark } from './components/BrandMark';
import { LegalIpHub } from './components/LegalIpHub';
import { SectionUnavailableView, getUnavailableSectionTitle } from './components/SectionUnavailableView';
import { OnboardingModal } from './components/OnboardingModal';
import { GlobalSearchHelpModal } from './components/GlobalSearchHelpModal';
import { KALI3977_COPYRIGHT_NOTICE } from './lib/domain/anti-abuse';
import { parseNavSectionFromHash } from './lib/auth-helpers';
import { getEffectiveSectionStatus } from './lib/domain/sections';
import { getHubForSection } from './lib/domain/learning-experience';
import { LAYOUT_OPTIONS } from './lib/domain/responsive-layout';

interface SubSectionItem {
  id: NavSection;
  label: string;
  shortDesc: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface PrimaryHubConfig {
  id: Exclude<PrimaryHub, 'admin'>;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  sections: SubSectionItem[];
}

const PRIMARY_HUBS: PrimaryHubConfig[] = [
  {
    id: 'home',
    label: 'Home',
    icon: Home,
    sections: [{ id: 'home', label: 'Dashboard', shortDesc: 'Overview & next steps', icon: Home }],
  },
  {
    id: 'learn',
    label: 'Learn',
    icon: BookOpen,
    sections: [
      { id: 'academy', label: 'Academy & Paths', shortDesc: 'Structured Stages 1–8', icon: BookOpen },
      { id: 'learn-kali', label: 'Learn KALI', shortDesc: 'Linux & Kali command labs', icon: Terminal },
      { id: 'books', label: 'Books Library', shortDesc: 'Manuals & references', icon: Library },
      { id: 'mentor', label: 'AI Cyber Mentor', shortDesc: 'Guided study coach', icon: Bot },
    ],
  },
  {
    id: 'practice',
    label: 'Practice',
    icon: FlaskConical,
    sections: [
      { id: 'labs', label: 'Cyber Labs', shortDesc: 'Hands-on environments', icon: FlaskConical },
      { id: 'ctf', label: 'CTF Arena', shortDesc: 'Capture The Flag challenges', icon: Flag },
    ],
  },
  {
    id: 'play',
    label: 'Play',
    icon: Gamepad2,
    sections: [
      { id: 'games', label: 'Games Arena', shortDesc: 'Cyber training games', icon: Gamepad2 },
      { id: 'arena', label: 'Multiplayer & Teams', shortDesc: 'Room codes & live battles', icon: Swords },
      { id: 'tournaments', label: 'Tournaments', shortDesc: 'Competitions & brackets', icon: Trophy },
    ],
  },
  {
    id: 'community',
    label: 'Community',
    icon: Users,
    sections: [{ id: 'community', label: 'Community Hub', shortDesc: 'Teams, chat & study groups', icon: Users }],
  },
  {
    id: 'career',
    label: 'Career',
    icon: Briefcase,
    sections: [{ id: 'career', label: 'Career Hub', shortDesc: 'Career paths & portfolios', icon: Briefcase }],
  },
  {
    id: 'profile',
    label: 'My Profile',
    icon: User,
    sections: [
      { id: 'profile', label: 'Progress & History', shortDesc: 'XP, badges & bookmarks', icon: User },
      { id: 'notifications', label: 'Notifications', shortDesc: 'Alerts & updates', icon: Bell },
      { id: 'settings', label: 'Settings', shortDesc: 'Themes, MFA & sessions', icon: Settings },
      { id: 'legal', label: 'IP & Legal Policies', shortDesc: 'Rules & reporting', icon: Scale },
    ],
  },
];

const ALL_SUB_SECTIONS: SubSectionItem[] = PRIMARY_HUBS.flatMap((h) => h.sections);

const Shell: React.FC = () => {
  const {
    user,
    unreadNotifications,
    loading,
    authPending,
    authError,
    canRetryWithPopup,
    canRetryWithRedirect,
    theme,
    learningExperience,
    onboardingCompleted,
    onboardingGoal,
    pendingThemeUpgrade,
    toggleTheme,
    setLearningExperience,
    completeOnboarding,
    respondToThemeUpgrade,
    clearAuthError,
    loginWithGoogle,
    logout,
    refreshProfile,
    apiFetch,
  } = useAuth();
  const {
    previewAsStudent,
    setPreviewAsStudent,
    getSection,
    isSectionVisibleInNav,
    evaluateAccess,
  } = useSections();
  const {
    preference: layoutPreference,
    effectiveLayout,
    showSidebar,
    showMobileDrawerToggle,
    showCompactDesktopNavBar,
    setPreference: setLayoutPreference,
  } = useLayout();

  const [active, setActive] = useState<NavSection>(() => {
    if (typeof window === 'undefined') return 'home';
    return parseNavSectionFromHash(window.location.hash) ?? 'home';
  });
  const [legalInitialTab, setLegalInitialTab] = useState<'copyright' | 'terms' | 'privacy' | 'aup' | 'report'>('copyright');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingPromptedOnce, setOnboardingPromptedOnce] = useState(false);
  const [searchModal, setSearchModal] = useState<{ open: boolean; mode: 'search' | 'help' }>({
    open: false,
    mode: 'search',
  });
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<
    Array<{ id: number; type: string; title: string; body: string; isRead: boolean; createdAt: string }>
  >([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const notifContainerRef = React.useRef<HTMLDivElement | null>(null);

  const isStaff = Boolean(user && ['owner', 'event_admin', 'moderator'].includes(user.role));
  const activeHub = getHubForSection(active);
  const activeAccess = evaluateAccess(active);

  // Open optional onboarding automatically once for first-time learners after profile hydration
  useEffect(() => {
    const autostart =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('autostart') === '1';
    if (!loading && !onboardingCompleted && !onboardingPromptedOnce && !autostart) {
      setOnboardingOpen(true);
      setOnboardingPromptedOnce(true);
    }
  }, [loading, onboardingCompleted, onboardingPromptedOnce]);

  useEffect(() => {
    const syncFromHash = () => {
      const parsed = parseNavSectionFromHash(window.location.hash);
      if (parsed) {
        setActive(parsed);
      }
    };
    window.addEventListener('hashchange', syncFromHash);
    window.addEventListener('popstate', syncFromHash);
    return () => {
      window.removeEventListener('hashchange', syncFromHash);
      window.removeEventListener('popstate', syncFromHash);
    };
  }, []);

  const loadPopoverNotifications = async () => {
    if (!user) {
      setNotifItems([]);
      setNotifError(null);
      return;
    }
    setNotifLoading(true);
    setNotifError(null);
    try {
      const res = await apiFetch<{
        notifications: Array<{
          id: number;
          type: string;
          title: string;
          body: string;
          isRead: boolean;
          createdAt: string;
        }>;
      }>('/api/notifications');
      setNotifItems(res.notifications || []);
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : 'Unable to load notifications.');
    } finally {
      setNotifLoading(false);
    }
  };

  useEffect(() => {
    if (notifOpen) {
      void loadPopoverNotifications();
    }
  }, [notifOpen, user?.id]);

  useEffect(() => {
    if (!notifOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (notifContainerRef.current && !notifContainerRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [notifOpen]);

  const handleMarkNotifRead = async (id: number) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      await refreshProfile();
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : 'Failed to update notification.');
    }
  };

  const handleMarkAllNotifsRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      setNotifItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await refreshProfile();
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : 'Failed to mark notifications read.');
    }
  };

  const navigate = (section: NavSection) => {
    setActive(section);
    setMobileMenuOpen(false);
    setNotifOpen(false);
    if (typeof window !== 'undefined' && window.location.hash !== `#${section}`) {
      window.history.replaceState(null, '', `#${section}`);
    }
  };

  const visibleHubs = useMemo(() => {
    return PRIMARY_HUBS.map((hub) => ({
      ...hub,
      visibleSections: hub.sections.filter((sec) => isSectionVisibleInNav(sec.id)),
    })).filter((hub) => hub.visibleSections.length > 0);
  }, [isSectionVisibleInNav]);

  const currentHubConfig = visibleHubs.find((h) => h.id === activeHub);
  const openHub = (hubId: Exclude<PrimaryHub, 'admin'>) => {
    const found = visibleHubs.find((h) => h.id === hubId);
    if (!found || found.visibleSections.length === 0) return;
    if (activeHub === hubId) {
      setMobileMenuOpen(false);
      return;
    }
    navigate(found.visibleSections[0].id);
  };

  const openLegalTab = (tab: 'copyright' | 'terms' | 'privacy' | 'aup' | 'report') => {
    setLegalInitialTab(tab);
    navigate('legal');
  };

  const activeSectionMeta = ALL_SUB_SECTIONS.find((s) => s.id === active);
  const activeShortTitle = active === 'admin' ? 'Admin Panel' : activeSectionMeta?.label || 'Home';
  const activeTitle =
    active === 'admin'
      ? 'Admin Panel'
      : activeSectionMeta
        ? `${PRIMARY_HUBS.find((h) => h.id === activeHub)?.label || 'Home'} · ${activeSectionMeta.label}`
        : 'Home';

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-[#0A0D12] dark:text-slate-100">
      {/* Desktop Sidebar — Controlled dynamically by LayoutProvider (Automatic or Manual Desktop on >=1024px) */}
      {showSidebar && (
        <aside className="flex w-64 flex-col fixed inset-y-0 z-40 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0D1117]">
        <div className="flex h-16 items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => navigate('home')}
            className="shrink-0"
            aria-label="KALI3977 Home"
          >
            <BrandMark size={24} />
          </button>
        </div>

        <nav aria-label="Primary Navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          {visibleHubs.map((hub) => {
            const Icon = hub.icon;
            const isHubActive = activeHub === hub.id;
            const hasRestrictedChild =
              isStaff &&
              !previewAsStudent &&
              hub.visibleSections.some((s) => getEffectiveSectionStatus(getSection(s.id)) !== 'enabled');
            return (
              <div key={hub.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => openHub(hub.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                    isHubActive
                      ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3 truncate">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{hub.label}</span>
                  </span>
                  {hub.id === 'profile' && unreadNotifications > 0 ? (
                    <span className="font-mono text-xs text-emerald-500 tabular-nums">{unreadNotifications}</span>
                  ) : hasRestrictedChild ? (
                    <span className="font-mono text-[10px] uppercase text-amber-500">mod</span>
                  ) : null}
                </button>

                {isHubActive && hub.visibleSections.length > 1 && (
                  <div className="pl-7 pr-1 space-y-0.5">
                    {hub.visibleSections.map((sub) => {
                      const subActive = active === sub.id;
                      const effStatus = getEffectiveSectionStatus(getSection(sub.id));
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => navigate(sub.id)}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                            subActive
                              ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          <span className="truncate">{sub.label}</span>
                          {isStaff && !previewAsStudent && effStatus !== 'enabled' && (
                            <span className="font-mono text-[10px] uppercase text-amber-500">
                              {effStatus === 'coming_soon' ? 'soon' : effStatus === 'maintenance' ? 'maint' : 'off'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {isStaff && (
            <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => navigate('admin')}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                  active === 'admin'
                    ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
                    : 'text-violet-600 dark:text-violet-400 hover:bg-violet-500/10'
                }`}
              >
                <Shield className="h-4 w-4 shrink-0" />
                <span>Admin Panel</span>
              </button>
            </div>
          )}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-800/80 p-4 space-y-3 text-xs text-slate-500 dark:text-slate-400">
          <button
            type="button"
            onClick={() => setOnboardingOpen(true)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-emerald-500/40"
          >
            Quick Start Guide
          </button>

          {user ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{user.displayName}</p>
                <p className="truncate font-mono text-[11px]">{user.role}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                aria-label="Sign out"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-500"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p>Guest Access · Sign in to save XP &amp; join rooms</p>
          )}
        </div>
        </aside>
      )}

      {/* Slide-out Navigation Drawer (Mobile, Tablet, or Safe-Constrained Mode) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-white dark:bg-[#0D1117] border-r border-slate-200 dark:border-slate-800">
            <div className="flex h-16 items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800">
              <BrandMark size={22} />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-3 pt-3 pb-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
              <div>
                <label
                  htmlFor="drawer-layout-preference-select"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                >
                  Display &amp; Layout ({effectiveLayout})
                </label>
                <select
                  id="drawer-layout-preference-select"
                  value={layoutPreference}
                  onChange={(e) => void setLayoutPreference(e.target.value as LayoutPreference)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] px-2.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
                >
                  {LAYOUT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:hidden">
                <label
                  htmlFor="mobile-learning-experience-select"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                >
                  Learning Experience
                </label>
                <select
                  id="mobile-learning-experience-select"
                  value={learningExperience}
                  onChange={(e) => void setLearningExperience(e.target.value as LearningExperience)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] px-2.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="beginner">Beginner · Default</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="expert">Expert</option>
                </select>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-2">
              {visibleHubs.map((hub) => {
                const Icon = hub.icon;
                return (
                  <div key={hub.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => openHub(hub.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                        activeHub === hub.id
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{hub.label}</span>
                    </button>
                    {hub.visibleSections.length > 1 && (
                      <div className="pl-7 space-y-0.5">
                        {hub.visibleSections.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => navigate(sub.id)}
                            className={`block w-full text-left rounded px-2.5 py-1.5 text-xs ${
                              active === sub.id
                                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {isStaff && (
                <button
                  type="button"
                  onClick={() => navigate('admin')}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-violet-600 dark:text-violet-400"
                >
                  <Shield className="h-4 w-4" />
                  <span>Admin Panel</span>
                </button>
              )}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className={`flex-1 flex flex-col min-w-0 ${showSidebar ? 'pl-64' : ''}`}>
        {/* Clean 3-Zone Header */}
        <header className="kali-topbar shrink-0 sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between gap-1.5 sm:gap-3 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#0A0D12]/95 px-2.5 sm:px-8 backdrop-blur-md max-w-full">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {showMobileDrawerToggle && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <span className="font-display text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              <span className="sm:hidden">{activeShortTitle}</span>
              <span className="hidden sm:inline">{activeTitle}</span>
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setSearchModal({ open: true, mode: 'search' })}
              aria-label="Open global search"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-2 md:px-3 md:py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-emerald-500/40 whitespace-nowrap shrink-0 min-h-[36px] min-w-[36px]"
            >
              <Search className="h-3.5 w-3.5 text-emerald-500" />
              <span className="hidden xl:inline">Search courses, commands, labs...</span>
              <span className="hidden md:inline xl:hidden">Search</span>
            </button>

            <button
              type="button"
              onClick={() => setSearchModal({ open: true, mode: 'help' })}
              aria-label="Open Help Docs and Glossary"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 p-2 md:px-2.5 md:py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[36px] min-w-[36px]"
            >
              <HelpCircle className="h-3.5 w-3.5 text-cyan-500" />
              <span className="hidden md:inline">Help</span>
            </button>

            {/* Top Header Notification Bell & Popover */}
            <div ref={notifContainerRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                aria-label="Open notifications"
                aria-expanded={notifOpen}
                aria-haspopup="dialog"
                className="relative inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 min-h-[36px] min-w-[36px]"
              >
                <Bell className="h-4 w-4 text-emerald-500" />
                {user && unreadNotifications > 0 && (
                  <span
                    aria-label={`${unreadNotifications} unread notifications`}
                    className="absolute -top-1 -right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 font-mono text-[10px] font-bold text-white leading-none"
                  >
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div
                  role="dialog"
                  aria-label="Notifications panel"
                  className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-11 w-[calc(100vw-1rem)] sm:w-96 max-h-[75dvh] flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] shadow-2xl z-50 overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-emerald-500" />
                      <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Notifications
                      </h2>
                      {user && unreadNotifications > 0 && (
                        <span className="font-mono text-[11px] text-rose-500">
                          {unreadNotifications} unread
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {user && notifItems.some((n) => !n.isRead) && (
                        <button
                          type="button"
                          onClick={() => void handleMarkAllNotifsRead()}
                          className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        aria-label="Close notifications panel"
                        className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                    {!user ? (
                      <div className="p-5 text-center space-y-3 text-xs">
                        <p className="text-slate-500 dark:text-slate-400">
                          Sign in with Google to receive competition alerts, earned XP badges, and team notifications.
                        </p>
                        <button
                          type="button"
                          disabled={authPending}
                          onClick={() => {
                            setNotifOpen(false);
                            void loginWithGoogle();
                          }}
                          className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                        >
                          {authPending ? 'Signing in...' : 'Sign In with Google'}
                        </button>
                      </div>
                    ) : notifLoading ? (
                      <div className="p-6 flex items-center justify-center gap-2 text-xs text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                        <span>Loading notifications...</span>
                      </div>
                    ) : notifError ? (
                      <div className="p-4 text-center space-y-2 text-xs">
                        <p className="text-rose-500">{notifError}</p>
                        <button
                          type="button"
                          onClick={() => void loadPopoverNotifications()}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1 font-medium"
                        >
                          Retry
                        </button>
                      </div>
                    ) : notifItems.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                        You are all caught up — no notifications right now.
                      </div>
                    ) : (
                      notifItems.slice(0, 12).map((n) => (
                        <div
                          key={n.id}
                          className={`p-3.5 text-xs space-y-1.5 ${
                            n.isRead
                              ? 'opacity-75'
                              : 'bg-emerald-500/5 border-l-2 border-l-emerald-500'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                              {n.title}
                            </p>
                            {!n.isRead && (
                              <button
                                type="button"
                                onClick={() => void handleMarkNotifRead(n.id)}
                                className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-medium hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                              >
                                <Check className="h-3 w-3 text-emerald-500" />
                                Read
                              </button>
                            )}
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{n.body}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A0D12] px-4 py-2.5 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => navigate('notifications')}
                      className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Open Notifications Page
                    </button>
                    {user && (
                      <button
                        type="button"
                        onClick={() => navigate('settings')}
                        className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      >
                        Alert Settings
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] px-2 py-1">
              <MonitorSmartphone className="h-3.5 w-3.5 text-cyan-500 shrink-0" aria-hidden="true" />
              <label className="sr-only" htmlFor="header-layout-select">
                Display and Layout Mode
              </label>
              <select
                id="header-layout-select"
                value={layoutPreference}
                onChange={(e) => void setLayoutPreference(e.target.value as LayoutPreference)}
                aria-label="Display and Layout Mode"
                title="Display & Layout Mode (Auto, Mobile, Tablet, or Desktop)"
                className="bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                {LAYOUT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-white dark:bg-[#11161F]">
                    Layout: {opt.shortLabel}
                  </option>
                ))}
              </select>
            </div>

            <label className="sr-only" htmlFor="learning-experience-select">
              Learning Experience Theme
            </label>
            <select
              id="learning-experience-select"
              value={learningExperience}
              onChange={(e) => void setLearningExperience(e.target.value as LearningExperience)}
              aria-label="Learning Experience Theme"
              className="hidden md:block rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11161F] px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="beginner">Beginner · Default</option>
              <option value="intermediate">Intermediate</option>
              <option value="expert">Expert</option>
            </select>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Appearance: Dark (switch to Light)' : 'Appearance: Light (switch to Dark)'}
              className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => navigate('profile')}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 sm:px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 min-h-[36px] flex items-center"
              >
                <span className="hidden sm:inline">{user.displayName} · </span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">{user.xp} XP</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={authPending}
                onClick={() => void loginWithGoogle()}
                className="rounded-lg bg-emerald-500 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 min-h-[36px] flex items-center"
              >
                {authPending ? 'Signing in...' : 'Sign In'}
              </button>
            )}
          </div>
        </header>

        {/* Compact Desktop Top Hub Bar when Desktop Layout is selected on narrow viewports */}
        {showCompactDesktopNavBar && (
          <nav
            aria-label="Desktop Quick Navigation"
            className="shrink-0 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0D1117] px-3 py-2 flex items-center gap-1.5 overflow-x-auto max-w-full"
          >
            {visibleHubs.map((hub) => {
              const Icon = hub.icon;
              const isHubActive = activeHub === hub.id;
              return (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => openHub(hub.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    isHubActive
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{hub.label}</span>
                </button>
              );
            })}
            {isStaff && (
              <button
                type="button"
                onClick={() => navigate('admin')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${
                  active === 'admin'
                    ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30'
                    : 'text-violet-600 dark:text-violet-400 hover:bg-violet-500/10'
                }`}
              >
                <Shield className="h-3.5 w-3.5 shrink-0" />
                <span>Admin Panel</span>
              </button>
            )}
          </nav>
        )}

        {/* Hub Sub-Section Tabs (for multi-section hubs: Learn, Practice, Play, My Profile) */}
        {currentHubConfig && currentHubConfig.visibleSections.length > 1 && active !== 'admin' && (
          <div className="shrink-0 border-b border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-[#0D1117]/70 px-4 sm:px-8">
            <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto py-2.5">
              {currentHubConfig.visibleSections.map((sub) => {
                const Icon = sub.icon;
                const isSubActive = active === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => navigate(sub.id)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      isSubActive
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {authError && (
          <div
            role="alert"
            className="mx-4 mt-4 sm:mx-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-500 dark:text-rose-300"
          >
            <span className="w-full sm:w-auto sm:flex-1 min-w-0 break-words">{authError}</span>
            <div className="flex items-center gap-2 shrink-0">
              {canRetryWithPopup && (
                <button
                  type="button"
                  disabled={authPending}
                  onClick={() => void loginWithGoogle('popup')}
                  className="rounded-lg border border-rose-400/40 px-2.5 py-1 font-medium hover:bg-rose-500/20 disabled:opacity-60"
                >
                  Retry Popup
                </button>
              )}
              {canRetryWithRedirect && (
                <button
                  type="button"
                  disabled={authPending}
                  onClick={() => void loginWithGoogle('redirect')}
                  className="rounded-lg border border-emerald-400/40 px-2.5 py-1 font-medium text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-60"
                >
                  Use Redirect Sign-In
                </button>
              )}
              <button
                type="button"
                onClick={clearAuthError}
                aria-label="Dismiss authentication error"
                className="rounded-lg p-1 hover:bg-rose-500/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {pendingThemeUpgrade && (
          <div className="mx-4 mt-4 sm:mx-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-xs text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>
                <strong>Learning Milestone Reached:</strong> Your XP and practical progress qualify you for{' '}
                <strong className="capitalize">{pendingThemeUpgrade} Experience</strong>. Upgrade now or stay in your current mode?
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void respondToThemeUpgrade('accept')}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Switch to {pendingThemeUpgrade === 'expert' ? 'Expert' : 'Intermediate'}
              </button>
              <button
                type="button"
                onClick={() => void respondToThemeUpgrade('decline')}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Keep Current
              </button>
            </div>
          </div>
        )}

        {previewAsStudent && (
          <div className="mx-4 mt-4 sm:mx-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">
            <span>
              Student Preview Mode is active: disabled, Coming Soon, and Maintenance sections are hidden exactly as students experience them.
            </span>
            <button
              type="button"
              onClick={() => setPreviewAsStudent(false)}
              className="rounded-lg border border-amber-500/40 px-2.5 py-1 font-semibold hover:bg-amber-500/20"
            >
              Exit Student Preview
            </button>
          </div>
        )}

        <main className="kali-shell-main flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto min-w-0 overflow-x-hidden">
          {!activeAccess.allowed ? (
            <SectionUnavailableView
              sectionName={getUnavailableSectionTitle(active)}
              status={activeAccess.effectiveStatus}
              message={activeAccess.reason}
              onNavigateHome={() => navigate('home')}
              previewAsStudent={previewAsStudent}
              onExitPreview={() => setPreviewAsStudent(false)}
            />
          ) : (
            <>
              {active === 'home' && (
                <HomeDashboard
                  onNavigate={navigate}
                  onOpenOnboarding={() => setOnboardingOpen(true)}
                  onOpenHelp={() => setSearchModal({ open: true, mode: 'help' })}
                />
              )}
              {active === 'academy' && <LearningAcademy onNavigate={navigate} />}
              {active === 'books' && <BooksLibrary />}
              {active === 'labs' && <CyberLabs />}
              {active === 'learn-kali' && <LearnKaliFoundation />}
              {active === 'ctf' && <CtfArena />}
              {active === 'arena' && <MultiplayerArena />}
              {active === 'games' && <GamesArenaHub />}
              {active === 'tournaments' && <TournamentsView />}
              {active === 'mentor' && <AiCyberMentor />}
              {active === 'community' && <CommunityView />}
              {active === 'career' && <CareerHubView />}
              {active === 'profile' && <ProfileView onNavigate={navigate} />}
              {active === 'notifications' && <NotificationsView />}
              {active === 'settings' && <SettingsView onOpenOnboarding={() => setOnboardingOpen(true)} />}
              {active === 'legal' && <LegalIpHub initialTab={legalInitialTab} />}
              {active === 'admin' && <OwnerControlCentre />}
            </>
          )}
        </main>

        <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800/80 px-4 sm:px-8 py-4 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-3">
          <span>{KALI3977_COPYRIGHT_NOTICE} Not an official Kali Linux product.</span>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setSearchModal({ open: true, mode: 'help' })}
              className="hover:text-emerald-500 transition-colors"
            >
              Help &amp; Glossary
            </button>
            <button
              type="button"
              onClick={() => openLegalTab('terms')}
              className="hover:text-emerald-500 transition-colors"
            >
              Terms &amp; Policies
            </button>
            <button
              type="button"
              onClick={() => openLegalTab('copyright')}
              className="hover:text-emerald-500 transition-colors"
            >
              Copyright &amp; Licensing
            </button>
            <button
              type="button"
              onClick={() => openLegalTab('report')}
              className="text-amber-600 dark:text-amber-400 hover:underline transition-colors"
            >
              Report IP Violation / Dispute
            </button>
          </div>
        </footer>
      </div>

      <OnboardingModal
        open={onboardingOpen}
        initialExperience={learningExperience}
        initialGoal={onboardingGoal}
        onComplete={async (opts) => {
          await completeOnboarding(opts);
          setOnboardingOpen(false);
        }}
        onSkip={async () => {
          await completeOnboarding({ skipped: true });
          setOnboardingOpen(false);
        }}
        onNavigate={navigate}
      />

      <GlobalSearchHelpModal
        open={searchModal.open}
        initialMode={searchModal.mode}
        onClose={() => setSearchModal((prev) => ({ ...prev, open: false }))}
        onNavigate={navigate}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <LayoutProvider>
        <SectionProvider>
          <Shell />
        </SectionProvider>
      </LayoutProvider>
    </AuthProvider>
  );
}
