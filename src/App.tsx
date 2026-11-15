import React, { useState } from 'react';
import {
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  Flag,
  FlaskConical,
  Gamepad2,
  Home,
  Library,
  LogOut,
  Menu,
  Moon,
  Scale,
  Settings,
  Shield,
  Sun,
  Swords,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { NavSection } from './types/kali';
import { HomeDashboard } from './components/HomeDashboard';
import { LearningAcademy } from './components/LearningAcademy';
import { BooksLibrary } from './components/BooksLibrary';
import { CyberLabs } from './components/CyberLabs';
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
import { KALI3977_COPYRIGHT_NOTICE } from './lib/domain/anti-abuse';

const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'academy', label: 'Learning Academy', icon: BookOpen },
  { id: 'books', label: 'Books', icon: Library },
  { id: 'labs', label: 'Cyber Labs', icon: FlaskConical },
  { id: 'ctf', label: 'CTF Arena', icon: Flag },
  { id: 'arena', label: 'Multiplayer Arena', icon: Swords },
  { id: 'games', label: 'Games Arena', icon: Gamepad2 },
  { id: 'tournaments', label: 'Tournaments & Events', icon: Trophy },
  { id: 'mentor', label: 'AI Cyber Mentor', icon: Bot },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'career', label: 'Career Hub', icon: Briefcase },
  { id: 'profile', label: 'My Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'legal', label: 'IP & Legal Policies', icon: Scale },
];

const Shell: React.FC = () => {
  const {
    user,
    unreadNotifications,
    authPending,
    authError,
    canRetryWithPopup,
    canRetryWithRedirect,
    theme,
    toggleTheme,
    clearAuthError,
    loginWithGoogle,
    logout,
  } = useAuth();
  const [active, setActive] = useState<NavSection>('home');
  const [legalInitialTab, setLegalInitialTab] = useState<'copyright' | 'terms' | 'privacy' | 'aup' | 'report'>('copyright');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isStaff = Boolean(user && ['owner', 'event_admin', 'moderator'].includes(user.role));

  const navigate = (section: NavSection) => {
    setActive(section);
    setMobileMenuOpen(false);
  };

  const openLegalTab = (tab: 'copyright' | 'terms' | 'privacy' | 'aup' | 'report') => {
    setLegalInitialTab(tab);
    navigate('legal');
  };

  const activeTitle =
    active === 'admin'
      ? 'Admin Panel'
      : NAV_ITEMS.find((i) => i.id === active)?.label || 'Home';

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-[#0A0D12] dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0D1117]">
        <div className="flex h-16 items-center px-6 border-b border-slate-200 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => navigate('home')}
            className="shrink-0"
            aria-label="KALI3977 Home"
          >
            <BrandMark size={24} />
          </button>
        </div>

        <nav aria-label="Primary Navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <span className="flex items-center gap-3 truncate">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'notifications' && unreadNotifications > 0 && (
                  <span className="font-mono text-xs text-emerald-500 tabular-nums">
                    {unreadNotifications}
                  </span>
                )}
              </button>
            );
          })}

          {isStaff && (
            <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => navigate('admin')}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                  active === 'admin'
                    ? 'bg-violet-500/15 text-violet-500'
                    : 'text-violet-600 dark:text-violet-400 hover:bg-violet-500/10'
                }`}
              >
                <Shield className="h-4 w-4 shrink-0" />
                <span>Admin Panel</span>
              </button>
            </div>
          )}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-800/80 p-4 text-xs text-slate-500 dark:text-slate-400">
          {user ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                  {user.displayName}
                </p>
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
            <p>Guest Access · Sign in to save XP & join rooms</p>
          )}
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex w-72 flex-col bg-white dark:bg-[#0D1117] border-r border-slate-200 dark:border-slate-800">
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
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      active === item.id
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
              {isStaff && (
                <button
                  type="button"
                  onClick={() => navigate('admin')}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-violet-500"
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
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top Bar (Clean 3-Zone Contract) */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-8 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#0A0D12]/90 px-4 sm:px-8 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg p-2 lg:hidden hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {activeTitle}
            </span>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => navigate('profile')}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                {user.displayName} · <span className="font-mono text-emerald-500">{user.xp} XP</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={authPending}
                onClick={() => void loginWithGoogle()}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
              >
                {authPending ? 'Signing in...' : 'Sign In with Google'}
              </button>
            )}
          </div>
        </header>

        {authError && (
          <div
            role="alert"
            className="mx-4 mt-4 sm:mx-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-400"
          >
            <span className="flex-1 min-w-[220px]">{authError}</span>
            <div className="flex items-center gap-2 shrink-0">
              {canRetryWithPopup && (
                <button
                  type="button"
                  disabled={authPending}
                  onClick={() => void loginWithGoogle('popup')}
                  className="rounded-lg border border-rose-400/40 px-2.5 py-1 font-medium text-rose-200 hover:bg-rose-500/20 disabled:opacity-60"
                >
                  Retry Popup
                </button>
              )}
              {canRetryWithRedirect && (
                <button
                  type="button"
                  disabled={authPending}
                  onClick={() => void loginWithGoogle('redirect')}
                  className="rounded-lg border border-emerald-400/40 px-2.5 py-1 font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-60"
                >
                  Use Redirect Sign-In
                </button>
              )}
              <button
                type="button"
                onClick={clearAuthError}
                aria-label="Dismiss authentication error"
                className="rounded-lg p-1 text-rose-300 hover:bg-rose-500/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto min-w-0 overflow-x-hidden">
          {active === 'home' && <HomeDashboard onNavigate={navigate} />}
          {active === 'academy' && <LearningAcademy />}
          {active === 'books' && <BooksLibrary />}
          {active === 'labs' && <CyberLabs />}
          {active === 'ctf' && <CtfArena />}
          {active === 'arena' && <MultiplayerArena />}
          {active === 'games' && <GamesArenaHub />}
          {active === 'tournaments' && <TournamentsView />}
          {active === 'mentor' && <AiCyberMentor />}
          {active === 'community' && <CommunityView />}
          {active === 'career' && <CareerHubView />}
          {active === 'profile' && <ProfileView />}
          {active === 'notifications' && <NotificationsView />}
          {active === 'settings' && <SettingsView />}
          {active === 'legal' && <LegalIpHub initialTab={legalInitialTab} />}
          {active === 'admin' && <OwnerControlCentre />}
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-800/80 px-4 sm:px-8 py-4 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-3">
          <span>{KALI3977_COPYRIGHT_NOTICE} Not an official Kali Linux product.</span>
          <div className="flex flex-wrap items-center gap-4">
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
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
