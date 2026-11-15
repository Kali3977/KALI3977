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
          'Your browser blocked the Google sign-in popup. Please allow popups for this site or use Redirect Sign-In.',
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
          'Browser storage or cookies are blocked. Enable site data/cookies to complete Google authentication.',
        canRetryWithPopup: true,
        canRetryWithRedirect: false,
      };
    case 'auth/redirect-cancelled-by-user':
      return {
        code,
        message: 'Google redirect sign-in was cancelled before completion. Please try again.',
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
          'Firebase Authentication returned an internal error. Verify OAuth client and authorized domains in Firebase Console and try again.',
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
