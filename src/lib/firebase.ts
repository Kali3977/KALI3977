import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  inMemoryPersistence,
  setPersistence,
  type Auth,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { isSameOriginAuthProxyActive, resolveFirebaseAuthDomain } from './auth-helpers';

const resolvedAuthDomain =
  typeof window !== 'undefined'
    ? resolveFirebaseAuthDomain({
        protocol: window.location.protocol,
        host: window.location.host,
        hostname: window.location.hostname,
        fallbackAuthDomain: firebaseConfig.authDomain,
      })
    : firebaseConfig.authDomain;

export const usingSameOriginAuthProxy =
  typeof window !== 'undefined'
    ? isSameOriginAuthProxyActive({
        protocol: window.location.protocol,
        host: window.location.host,
        hostname: window.location.hostname,
        resolvedAuthDomain,
      })
    : false;

export const effectiveAuthDomain = resolvedAuthDomain;

const effectiveFirebaseConfig = {
  ...firebaseConfig,
  authDomain: resolvedAuthDomain,
};

export const app = getApps().length > 0 ? getApp() : initializeApp(effectiveFirebaseConfig);

function createAuthInstance(): Auth {
  try {
    return initializeAuth(app, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
      ],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Already initialized (e.g., module reload) -> return existing Auth instance
    return getAuth(app);
  }
}

export const auth = createAuthInstance();

export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.addScope('email');
googleAuthProvider.addScope('profile');
googleAuthProvider.setCustomParameters({
  prompt: 'select_account',
});

let persistencePromise: Promise<void> | null = null;

export function ensureAuthPersistence(): Promise<void> {
  if (!persistencePromise) {
    persistencePromise = (async () => {
      try {
        await setPersistence(auth, indexedDBLocalPersistence);
      } catch {
        try {
          await setPersistence(auth, browserLocalPersistence);
        } catch {
          try {
            await setPersistence(auth, browserSessionPersistence);
          } catch {
            await setPersistence(auth, inMemoryPersistence);
          }
        }
      }
    })();
  }
  return persistencePromise;
}
