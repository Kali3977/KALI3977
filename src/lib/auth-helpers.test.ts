import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFirebaseAuthCode,
  formatFirebaseAuthError,
  isMobileUserAgent,
  isSameOriginAuthProxyActive,
  parseNavSectionFromHash,
  parsePendingRedirectRecord,
  REDIRECT_PENDING_TTL_MS,
  resolveFirebaseAuthDomain,
  selectGoogleAuthStrategy,
  serializePendingRedirectRecord,
} from './auth-helpers.ts';

test('selectGoogleAuthStrategy picks popup on desktop and inside iframes, redirect on top-level mobile', () => {
  const desktopUa =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const mobileUa =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const androidUa =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

  assert.equal(isMobileUserAgent(desktopUa), false);
  assert.equal(isMobileUserAgent(mobileUa), true);
  assert.equal(isMobileUserAgent(androidUa), true);
  assert.equal(isMobileUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5), true);

  assert.equal(selectGoogleAuthStrategy({ userAgent: desktopUa, isInIframe: false }), 'popup');
  assert.equal(selectGoogleAuthStrategy({ userAgent: mobileUa, isInIframe: false }), 'redirect');
  assert.equal(selectGoogleAuthStrategy({ userAgent: androidUa, isInIframe: false }), 'redirect');

  // Inside an iframe (AI Studio preview), redirect is blocked by Google X-Frame-Options
  assert.equal(selectGoogleAuthStrategy({ userAgent: mobileUa, isInIframe: true }), 'popup');
  assert.equal(
    selectGoogleAuthStrategy({ userAgent: mobileUa, isInIframe: true, forceStrategy: 'redirect' }),
    'popup',
  );
  assert.equal(
    selectGoogleAuthStrategy({ userAgent: desktopUa, isInIframe: false, forceStrategy: 'redirect' }),
    'redirect',
  );
});

test('resolveFirebaseAuthDomain uses same-origin host on HTTPS non-localhost deployments', () => {
  const fallback = 'pacific-quill-c83d0.firebaseapp.com';

  const devHost = 'ais-dev-yzrsbqxvfpod2bdrnylest-57074968653.asia-east1.run.app';
  const resolvedDev = resolveFirebaseAuthDomain({
    protocol: 'https:',
    host: devHost,
    hostname: devHost,
    fallbackAuthDomain: fallback,
  });
  assert.equal(resolvedDev, devHost);
  assert.equal(
    isSameOriginAuthProxyActive({
      protocol: 'https:',
      host: devHost,
      hostname: devHost,
      resolvedAuthDomain: resolvedDev,
    }),
    true,
  );

  const preHost = 'ais-pre-yzrsbqxvfpod2bdrnylest-57074968653.asia-east1.run.app';
  assert.equal(
    resolveFirebaseAuthDomain({
      protocol: 'https:',
      host: preHost,
      hostname: preHost,
      fallbackAuthDomain: fallback,
    }),
    preHost,
  );

  const localResolved = resolveFirebaseAuthDomain({
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    fallbackAuthDomain: fallback,
  });
  assert.equal(localResolved, fallback);
  assert.equal(
    isSameOriginAuthProxyActive({
      protocol: 'http:',
      host: 'localhost:3000',
      hostname: 'localhost',
      resolvedAuthDomain: localResolved,
    }),
    false,
  );

  assert.equal(
    resolveFirebaseAuthDomain({
      protocol: 'https:',
      host: fallback,
      hostname: fallback,
      fallbackAuthDomain: fallback,
    }),
    fallback,
  );
});

test('parsePendingRedirectRecord handles JSON records, legacy timestamps, and TTL expiration', () => {
  const now = 1_700_000_000_000;
  const serialized = serializePendingRedirectRecord({
    startedAt: now - 5_000,
    strategy: 'redirect',
    returnSection: 'games',
  });

  assert.deepEqual(parsePendingRedirectRecord(serialized, now), {
    startedAt: now - 5_000,
    strategy: 'redirect',
    returnSection: 'games',
  });

  // Expired record
  const expired = serializePendingRedirectRecord({
    startedAt: now - REDIRECT_PENDING_TTL_MS - 1,
    strategy: 'redirect',
    returnSection: 'mentor',
  });
  assert.equal(parsePendingRedirectRecord(expired, now), null);

  // Legacy numeric timestamp
  assert.deepEqual(parsePendingRedirectRecord(String(now - 1000), now), {
    startedAt: now - 1000,
    strategy: 'redirect',
  });
  assert.equal(parsePendingRedirectRecord('not-valid-json', now), null);
});

test('parseNavSectionFromHash extracts valid sections safely', () => {
  assert.equal(parseNavSectionFromHash('#games'), 'games');
  assert.equal(parseNavSectionFromHash('#/mentor?tab=1'), 'mentor');
  assert.equal(parseNavSectionFromHash('#unknown-section'), null);
  assert.equal(parseNavSectionFromHash(''), null);
});

test('formatFirebaseAuthError maps Firebase error codes accurately without collapsing to popup-closed-by-user', () => {
  const unauthErr = Object.assign(new Error('Firebase: Error (auth/unauthorized-domain).'), {
    code: 'auth/unauthorized-domain',
  });
  const unauthFormatted = formatFirebaseAuthError(unauthErr, { currentHost: 'localhost' });
  assert.equal(unauthFormatted.code, 'auth/unauthorized-domain');
  assert.match(unauthFormatted.message, /localhost/);
  assert.match(unauthFormatted.message, /Authorized domains/);

  const blockedErr = { code: 'auth/popup-blocked', message: 'Popup blocked' };
  const blockedFormatted = formatFirebaseAuthError(blockedErr, { isInIframe: false });
  assert.equal(blockedFormatted.code, 'auth/popup-blocked');
  assert.equal(blockedFormatted.canRetryWithRedirect, true);

  const popupClosed = new Error('Firebase: Error (auth/popup-closed-by-user).');
  assert.equal(extractFirebaseAuthCode(popupClosed), 'auth/popup-closed-by-user');
  const closedFormatted = formatFirebaseAuthError(popupClosed, { isInIframe: false });
  assert.equal(closedFormatted.code, 'auth/popup-closed-by-user');
  assert.equal(closedFormatted.canRetryWithPopup, true);

  const opNotAllowed = { code: 'auth/operation-not-allowed' };
  assert.match(formatFirebaseAuthError(opNotAllowed).message, /Sign-in method/);

  const nonceErr = { code: 'auth/missing-or-invalid-nonce' };
  assert.equal(formatFirebaseAuthError(nonceErr, { isInIframe: false }).canRetryWithRedirect, true);

  const customBackendErr = new Error('This account is currently suspended.');
  const backendFormatted = formatFirebaseAuthError(customBackendErr);
  assert.equal(backendFormatted.code, 'auth/unknown');
  assert.equal(backendFormatted.message, 'This account is currently suspended.');
});
