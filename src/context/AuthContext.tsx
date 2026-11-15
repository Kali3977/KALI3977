import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, ensureAuthPersistence, googleAuthProvider } from '../lib/firebase';
import {
  formatFirebaseAuthError,
  selectGoogleAuthStrategy,
  type GoogleAuthStrategy,
} from '../lib/auth-helpers';
import type { UserProfile } from '../types/kali';

const REDIRECT_PENDING_KEY = 'kali3977_auth_redirect_pending';

interface Membership {
  teamId: number;
  teamName: string;
  teamCode: string;
  roleInTeam: string;
  competitionId: number | null;
  campusId: number | null;
}

interface RemovedMembership {
  teamId: number;
  teamName: string;
  roleInTeam: string;
  removalStatus: string;
  removalReason: string | null;
  removalExpiresAt: string | null;
  competitionId: number | null;
}

interface SessionRecord {
  id: number;
  sessionId: string;
  userAgent: string;
  ipAddress: string;
  revoked: boolean;
  expiresAt: string;
  createdAt: string;
}

interface LoginRecord {
  id: number;
  ipAddress: string;
  userAgent: string;
  status: string;
  createdAt: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  user: UserProfile | null;
  memberships: Membership[];
  removedMemberships: RemovedMembership[];
  sessions: SessionRecord[];
  loginHistory: LoginRecord[];
  unreadNotifications: number;
  loading: boolean;
  authPending: boolean;
  authError: string | null;
  authErrorCode: string | null;
  canRetryWithPopup: boolean;
  canRetryWithRedirect: boolean;
  onlineCount: number;
  lastWsEvent: Record<string, unknown> | null;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  clearAuthError: () => void;
  loginWithGoogle: (forceStrategy?: GoogleAuthStrategy | unknown) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  apiFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
  sendWsMessage: (payload: Record<string, unknown>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function detectIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [removedMemberships, setRemovedMemberships] = useState<RemovedMembership[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginRecord[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [canRetryWithPopup, setCanRetryWithPopup] = useState(false);
  const [canRetryWithRedirect, setCanRetryWithRedirect] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [lastWsEvent, setLastWsEvent] = useState<Record<string, unknown> | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('kali3977_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  const tokenRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const authInFlightRef = useRef<boolean>(false);
  const profileSyncRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('kali3977_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
    setAuthErrorCode(null);
    setCanRetryWithPopup(false);
    setCanRetryWithRedirect(false);
  }, []);

  const apiFetch = useCallback(async <T = unknown>(url: string, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }
    const current = auth.currentUser;
    if (current) {
      const freshToken = await current.getIdToken();
      tokenRef.current = freshToken;
      headers.set('Authorization', `Bearer ${freshToken}`);
    } else if (tokenRef.current) {
      headers.set('Authorization', `Bearer ${tokenRef.current}`);
    }

    const res = await fetch(url, { ...options, headers });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.text()) as unknown as T;
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data as T;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (profileSyncRef.current) {
      return profileSyncRef.current;
    }

    const syncTask = (async () => {
      try {
        const data = await apiFetch<{
          authenticated: boolean;
          user: UserProfile | null;
          memberships?: Membership[];
          removedMemberships?: RemovedMembership[];
          sessions?: SessionRecord[];
          loginHistory?: LoginRecord[];
          unreadNotifications?: number;
        }>('/api/auth/me');
        if (data.authenticated && data.user) {
          setUser(data.user);
          setMemberships(data.memberships || []);
          setRemovedMemberships(data.removedMemberships || []);
          setSessions(data.sessions || []);
          setLoginHistory(data.loginHistory || []);
          setUnreadNotifications(data.unreadNotifications ?? 0);
        } else {
          setUser(null);
          setMemberships([]);
          setRemovedMemberships([]);
          setSessions([]);
          setLoginHistory([]);
          setUnreadNotifications(0);
        }
      } catch (err) {
        console.error('Failed to sync profile:', err);
        if (auth.currentUser) {
          const message = err instanceof Error ? err.message : 'Unable to sync authenticated profile.';
          setAuthErrorCode('auth/profile-sync-failed');
          setAuthError(message);
        }
      }
    })();

    profileSyncRef.current = syncTask;
    try {
      await syncTask;
    } finally {
      if (profileSyncRef.current === syncTask) {
        profileSyncRef.current = null;
      }
    }
  }, [apiFetch]);

  useEffect(() => {
    let active = true;
    let unsub: (() => void) | undefined;

    const initAuth = async () => {
      try {
        await ensureAuthPersistence();

        let redirectPending = false;
        try {
          redirectPending = Boolean(window.sessionStorage.getItem(REDIRECT_PENDING_KEY));
        } catch {
          redirectPending = false;
        }

        try {
          const redirectResult = await getRedirectResult(auth);
          try {
            window.sessionStorage.removeItem(REDIRECT_PENDING_KEY);
          } catch {
            // Ignore sessionStorage restrictions
          }

          if (redirectResult?.user) {
            tokenRef.current = await redirectResult.user.getIdToken();
            if (active) {
              setFirebaseUser(redirectResult.user);
              clearAuthError();
            }
          } else if (redirectPending) {
            await auth.authStateReady();
            if (active && !auth.currentUser) {
              setAuthErrorCode('auth/redirect-storage-partitioned');
              setAuthError(
                'Mobile redirect sign-in returned without an active session because your browser blocked cross-site auth storage. Try Popup Sign-In or allow cookies for Firebase auth.',
              );
              setCanRetryWithPopup(true);
              setCanRetryWithRedirect(false);
            }
          }
        } catch (redirectErr) {
          try {
            window.sessionStorage.removeItem(REDIRECT_PENDING_KEY);
          } catch {
            // Ignore sessionStorage restrictions
          }
          if (active) {
            const formatted = formatFirebaseAuthError(redirectErr, {
              currentHost: window.location.hostname,
              method: 'redirect',
              isInIframe: detectIframe(),
            });
            setAuthErrorCode(formatted.code);
            setAuthError(formatted.message);
            setCanRetryWithPopup(formatted.canRetryWithPopup);
            setCanRetryWithRedirect(formatted.canRetryWithRedirect);
          }
        }

        if (!active) return;

        unsub = onAuthStateChanged(auth, async (fbUser) => {
          if (!active) return;
          setFirebaseUser(fbUser);
          if (fbUser) {
            try {
              tokenRef.current = await fbUser.getIdToken();
              clearAuthError();
            } catch {
              tokenRef.current = null;
            }
          } else {
            tokenRef.current = null;
          }
          await refreshProfile();
          if (active) {
            setLoading(false);
          }
        });
      } catch (err) {
        console.error('Firebase Auth initialization error:', err);
        if (active) {
          const formatted = formatFirebaseAuthError(err, {
            currentHost: typeof window !== 'undefined' ? window.location.hostname : undefined,
            isInIframe: detectIframe(),
          });
          setAuthErrorCode(formatted.code);
          setAuthError(formatted.message);
          setLoading(false);
        }
      }
    };

    void initAuth();

    return () => {
      active = false;
      unsub?.();
    };
  }, [clearAuthError, refreshProfile]);

  useEffect(() => {
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const tokenParam = tokenRef.current ? `?token=${encodeURIComponent(tokenRef.current)}` : '';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws${tokenParam}`);
      wsRef.current = ws;

      ws.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data);
          if (typeof parsed.onlineCount === 'number') {
            setOnlineCount(parsed.onlineCount);
          }
          if (parsed.type === 'notification:new') {
            setUnreadNotifications((n) => n + 1);
          }
          setLastWsEvent(parsed);
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (!closed) {
          reconnectTimer = setTimeout(connect, 4000);
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [firebaseUser?.uid]);

  const loginWithGoogle = useCallback(
    async (maybeStrategy?: GoogleAuthStrategy | unknown) => {
      if (authInFlightRef.current) {
        return;
      }

      const forceStrategy: GoogleAuthStrategy | undefined =
        maybeStrategy === 'popup' || maybeStrategy === 'redirect' ? maybeStrategy : undefined;

      const isInIframe = detectIframe();
      const strategy = selectGoogleAuthStrategy({
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
        isInIframe,
        forceStrategy,
      });

      authInFlightRef.current = true;
      setAuthPending(true);
      clearAuthError();

      let redirecting = false;
      try {
        await ensureAuthPersistence();

        if (strategy === 'redirect') {
          try {
            window.sessionStorage.setItem(REDIRECT_PENDING_KEY, String(Date.now()));
          } catch {
            // Ignore sessionStorage restrictions
          }
          redirecting = true;
          await signInWithRedirect(auth, googleAuthProvider);
          return;
        }

        const cred = await signInWithPopup(auth, googleAuthProvider);
        tokenRef.current = await cred.user.getIdToken();
        setFirebaseUser(cred.user);
        await refreshProfile();
      } catch (err) {
        redirecting = false;
        try {
          window.sessionStorage.removeItem(REDIRECT_PENDING_KEY);
        } catch {
          // Ignore sessionStorage restrictions
        }
        const formatted = formatFirebaseAuthError(err, {
          currentHost: typeof window !== 'undefined' ? window.location.hostname : undefined,
          method: strategy,
          isInIframe,
        });
        setAuthErrorCode(formatted.code);
        setAuthError(formatted.message);
        setCanRetryWithPopup(formatted.canRetryWithPopup);
        setCanRetryWithRedirect(formatted.canRetryWithRedirect);
      } finally {
        if (!redirecting) {
          authInFlightRef.current = false;
          setAuthPending(false);
        }
      }
    },
    [clearAuthError, refreshProfile],
  );

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      tokenRef.current = null;
      setFirebaseUser(null);
      setUser(null);
      setMemberships([]);
      setRemovedMemberships([]);
      setSessions([]);
      setLoginHistory([]);
      setUnreadNotifications(0);
      clearAuthError();
    } catch (err) {
      const formatted = formatFirebaseAuthError(err);
      setAuthErrorCode(formatted.code);
      setAuthError(formatted.message);
    }
  }, [clearAuthError]);

  const sendWsMessage = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        user,
        memberships,
        removedMemberships,
        sessions,
        loginHistory,
        unreadNotifications,
        loading,
        authPending,
        authError,
        authErrorCode,
        canRetryWithPopup,
        canRetryWithRedirect,
        onlineCount,
        lastWsEvent,
        theme,
        toggleTheme,
        clearAuthError,
        loginWithGoogle,
        logout,
        refreshProfile,
        apiFetch,
        sendWsMessage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
