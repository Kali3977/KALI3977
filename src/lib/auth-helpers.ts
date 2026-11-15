import type { NavSection } from '../types/kali';

export type GoogleAuthStrategy = 'popup' | 'redirect';

export interface AuthEnvironmentInfo {
  userAgent: string;
  isInIframe: boolean;
  maxTouchPoints?: number;
  viewportWidth?: number;
  forceStrategy?: GoogleAuthStrategy;
}

export interface FormattedFirebaseAuthError {
  code: string;
  message: string;
  canRetryWithPopup: boolean;
  canRetryWithRedirect: boolean;
}

export interface PendingRedirectRecord {
  startedAt: number;
  strategy: GoogleAuthStrategy;
  returnSection?: NavSection;
}

export const REDIRECT_PENDING_TTL_MS = 15 * 60 * 1000;

export const VALID_NAV_SECTIONS: readonly NavSection[] = [
  'home',
  'academy',
  'books',
  'labs',
  'ctf',
  'arena',
  'games',
  'tournaments',
  'mentor',
  'community',
  'career',
  'profile',
  'notifications',
  'settings',
  'legal',
  'admin',
];

export function isValidNavSection(val: string | null | undefined): val is NavSection {
  return typeof val === 'string' && (VALID_NAV_SECTIONS as readonly string[]).includes(val);
}

export function parseNavSectionFromHash(hash: string | null | undefined): NavSection | null {
  if (!hash) return null;
  const cleaned = hash.replace(/^#\/?/, '').split('?')[0].trim();
  return isValidNavSection(cleaned) ? cleaned : null;
}

export function isLocalHostname(hostname: string | undefined | null): boolean {
  if (!hostname) return true;
  const lower = hostname.toLowerCase();
  return (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower === '[::1]'
  );
}

/**
 * Resolves the Firebase authDomain for the current runtime environment.
 * On HTTPS non-localhost origins (e.g., Cloud Run dev/pre URLs), returns `window.location.host`
 * so Firebase Auth uses the same-origin `/__/auth/*` reverse proxy and stores OAuth state
 * in first-party storage instead of cross-site `firebaseapp.com` storage.
 */
export function resolveFirebaseAuthDomain(params: {
  protocol?: string;
  host?: string;
  hostname?: string;
  fallbackAuthDomain: string;
}): string {
  const { protocol, host, hostname, fallbackAuthDomain } = params;
  if (
    protocol === 'https:' &&
    host &&
    !isLocalHostname(hostname) &&
    !host.endsWith('.firebaseapp.com') &&
    !host.endsWith('.web.app')
  ) {
    return host;
  }
  return fallbackAuthDomain;
}

export function isSameOriginAuthProxyActive(params: {
  protocol?: string;
  host?: string;
  hostname?: string;
  resolvedAuthDomain: string;
}): boolean {
  return (
    params.protocol === 'https:' &&
    Boolean(params.host) &&
    !isLocalHostname(params.hostname) &&
    params.resolvedAuthDomain === params.host
  );
}

export function serializePendingRedirectRecord(record: PendingRedirectRecord): string {
  return JSON.stringify(record);
}

export function parsePendingRedirectRecord(
  raw: string | null | undefined,
  nowMs: number = Date.now(),
): PendingRedirectRecord | null {
  if (!raw) return null;
  try {
    // Support legacy timestamp-only string gracefully
    if (/^\d+$/.test(raw.trim())) {
      const ts = Number(raw.trim());
      if (nowMs - ts >= 0 && nowMs - ts <= REDIRECT_PENDING_TTL_MS) {
        return { startedAt: ts, strategy: 'redirect' };
      }
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<PendingRedirectRecord>;
    if (typeof parsed.startedAt !== 'number' || !Number.isFinite(parsed.startedAt)) {
      return null;
    }
    if (nowMs - parsed.startedAt < 0 || nowMs - parsed.startedAt > REDIRECT_PENDING_TTL_MS) {
      return null;
    }
    return {
      startedAt: parsed.startedAt,
      strategy: parsed.strategy === 'popup' ? 'popup' : 'redirect',
      returnSection: isValidNavSection(parsed.returnSection) ? parsed.returnSection : undefined,
    };
  } catch {
    return null;
  }
}

export function isMobileUserAgent(userAgent: string, maxTouchPoints = 0): boolean {
  const ua = userAgent || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) {
    return true;
  }
  // iPadOS Safari reports Macintosh in UA with multi-touch support
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) {
    return true;
  }
  return false;
}

export function selectGoogleAuthStrategy(env: AuthEnvironmentInfo): GoogleAuthStrategy {
  if (env.forceStrategy === 'popup') {
    return 'popup';
  }
  if (env.forceStrategy === 'redirect') {
    // Google OAuth pages send X-Frame-Options: SAMEORIGIN; redirect inside an iframe fails.
    return env.isInIframe ? 'popup' : 'redirect';
  }

  // Inside an iframe (such as AI Studio preview), redirect navigation is blocked by accounts.google.com framing rules.
  if (env.isInIframe) {
    return 'popup';
  }

  if (isMobileUserAgent(env.userAgent, env.maxTouchPoints ?? 0)) {
    return 'redirect';
  }

  return 'popup';
}

export function extractFirebaseAuthCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code?: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const match = raw.match(/\((auth\/[a-z0-9-]+)\)/i);
  if (match) {
    return match[1].toLowerCase();
  }
  return 'auth/unknown';
}

export function formatFirebaseAuthError(
  err: unknown,
  context: { currentHost?: string; method?: GoogleAuthStrategy; isInIframe?: boolean } = {},
): FormattedFirebaseAuthError {
  const code = extractFirebaseAuthCode(err);
  const host = context.currentHost || 'this domain';
  const rawMessage = err instanceof Error ? err.message : String(err ?? '');
  const allowRedirectFallback = !context.isInIframe;

  switch (code) {
    case 'auth/popup-closed-by-user':
      return {
        code,
        message:
          'Google sign-in popup was closed before completing authentication. Please try again and keep the popup open until sign-in completes.',
        canRetryWithPopup: true,
        canRetryWithRedirect: allowRedirectFallback,
      };
    case 'auth/popup-blocked':
      return {
        code,
        message:
          'Your browser blocked the Google sign-in popup. Use Redirect Sign-In or allow popups for this site.',
        canRetryWithPopup: true,
        canRetryWithRedirect: allowRedirectFallback,
      };
    case 'auth/cancelled-popup-request':
      return {
        code,
        message:
          'A Google sign-in request was already in progress. Complete the open sign-in window or try again.',
        canRetryWithPopup: true,
        canRetryWithRedirect: allowRedirectFallback,
      };
    case 'auth/unauthorized-domain':
      return {
        code,
        message: `This domain (${host}) is not authorized for Firebase OAuth. Add "${host}" in Firebase Console -> Authentication -> Settings -> Authorized domains.`,
        canRetryWithPopup: false,
        canRetryWithRedirect: false,
      };
    case 'auth/operation-not-allowed':
      return {
        code,
        message:
          'Google Sign-In is disabled for this Firebase project. Enable the Google provider in Firebase Console -> Authentication -> Sign-in method.',
        canRetryWithPopup: false,
        canRetryWithRedirect: false,
      };
    case 'auth/network-request-failed':
      return {
        code,
        message:
          'Network request to Google/Firebase Authentication failed. Check your connection and retry.',
        canRetryWithPopup: true,
        canRetryWithRedirect: allowRedirectFallback,
      };
    case 'auth/account-exists-with-different-credential':
      return {
        code,
        message:
          'An account with this email already exists with a different authentication provider.',
        canRetryWithPopup: true,
        canRetryWithRedirect: false,
      };
    case 'auth/user-disabled':
      return {
        code,
        message: 'This account has been disabled in Firebase Authentication.',
        canRetryWithPopup: false,
        canRetryWithRedirect: false,
      };
    case 'auth/too-many-requests':
      return {
        code,
        message: 'Too many authentication attempts. Please wait a moment before trying again.',
        canRetryWithPopup: true,
        canRetryWithRedirect: false,
      };
    case 'auth/web-storage-unsupported':
      return {
        code,
        message:
          'Browser storage is disabled in this browser context (for example, strict private mode). Open the site in a standard browser tab and try again.',
        canRetryWithPopup: true,
        canRetryWithRedirect: allowRedirectFallback,
      };
    case 'auth/redirect-cancelled-by-user':
    case 'auth/user-cancelled':
      return {
        code,
        message: 'Google sign-in was cancelled before completion. Please try again.',
        canRetryWithPopup: true,
        canRetryWithRedirect: allowRedirectFallback,
      };
    case 'auth/redirect-operation-pending':
      return {
        code,
        message: 'A Google redirect sign-in is already completing. Please wait a moment.',
        canRetryWithPopup: false,
        canRetryWithRedirect: false,
      };
    case 'auth/missing-or-invalid-nonce':
    case 'auth/no-auth-event':
      return {
        code,
        message:
          'Your Google sign-in session expired or did not match the current window. Please start sign-in again.',
        canRetryWithPopup: true,
        canRetryWithRedirect: allowRedirectFallback,
      };
    case 'auth/invalid-api-key':
    case 'auth/app-not-authorized':
      return {
        code,
        message: `Firebase configuration error (${code}). Verify the Firebase Web API key and OAuth settings in Firebase Console.`,
        canRetryWithPopup: false,
        canRetryWithRedirect: false,
      };
    case 'auth/internal-error':
      return {
        code,
        message:
          'Firebase Authentication returned an internal error. Verify Authorized Domains and OAuth Redirect URIs in Firebase/Cloud Console and try again.',
        canRetryWithPopup: true,
        canRetryWithRedirect: allowRedirectFallback,
      };
    default:
      return {
        code,
        message: rawMessage || 'Google authentication failed. Please try again.',
        canRetryWithPopup: true,
        canRetryWithRedirect: allowRedirectFallback,
      };
  }
}
