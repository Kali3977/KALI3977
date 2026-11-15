import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  createFirebaseAuthProxyRouter,
  rewriteProxyLocation,
  sanitizeProxySetCookie,
} from './firebase-auth-proxy.ts';

async function withProxyServer(
  options: Parameters<typeof createFirebaseAuthProxyRouter>[0],
  fn: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use(createFirebaseAuthProxyRouter(options));
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const { port } = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

function rawHttpRequest(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: Number(parsed.port),
        path: `${parsed.pathname}${parsed.search}`,
        method: init.method || 'GET',
        headers: init.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

test('sanitizeProxySetCookie strips Domain attribute and Secure on non-HTTPS', () => {
  const cookie = 'session=abc123; Path=/; Domain=pacific-quill-c83d0.firebaseapp.com; HttpOnly; Secure; SameSite=None';
  assert.equal(
    sanitizeProxySetCookie(cookie, true),
    'session=abc123; Path=/; HttpOnly; Secure; SameSite=None',
  );
  assert.equal(
    sanitizeProxySetCookie(cookie, false),
    'session=abc123; Path=/; HttpOnly; SameSite=None',
  );
});

test('rewriteProxyLocation rewrites upstream firebaseapp origin to proxy origin', () => {
  assert.equal(
    rewriteProxyLocation(
      'https://pacific-quill-c83d0.firebaseapp.com/__/auth/handler?state=xyz',
      'pacific-quill-c83d0.firebaseapp.com',
      'https://ais-pre.example.run.app',
    ),
    'https://ais-pre.example.run.app/__/auth/handler?state=xyz',
  );
  assert.equal(
    rewriteProxyLocation(
      'https://accounts.google.com/o/oauth2/v2/auth',
      'pacific-quill-c83d0.firebaseapp.com',
      'https://ais-pre.example.run.app',
    ),
    'https://accounts.google.com/o/oauth2/v2/auth',
  );
});

test('GET /__/firebase/init.json returns dynamic authDomain on HTTPS non-localhost', async () => {
  await withProxyServer({}, async (baseUrl) => {
    const httpsRes = await rawHttpRequest(`${baseUrl}/__/firebase/init.json`, {
      headers: {
        host: 'ais-pre-test.asia-east1.run.app',
        'x-forwarded-proto': 'https',
      },
    });
    assert.equal(httpsRes.status, 200);
    const body = JSON.parse(httpsRes.body) as Record<string, string>;
    assert.equal(body.projectId, 'pacific-quill-c83d0');
    assert.equal(body.authDomain, 'ais-pre-test.asia-east1.run.app');
    assert.ok(body.apiKey);

    const localRes = await rawHttpRequest(`${baseUrl}/__/firebase/init.json`, {
      headers: {
        host: 'localhost:3000',
      },
    });
    assert.equal(localRes.status, 200);
    const localBody = JSON.parse(localRes.body) as Record<string, string>;
    assert.equal(localBody.authDomain, 'pacific-quill-c83d0.firebaseapp.com');
  });
});

test('proxy forwards GET/POST /__/auth/* requests, rewrites Location & Set-Cookie, and handles failures', async () => {
  const captured: Array<{ url: string; method: string; body: string }> = [];

  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method || 'GET';
    const body = init?.body ? Buffer.from(init.body as Uint8Array).toString('utf8') : '';
    captured.push({ url, method, body });

    if (url.includes('fail=1')) {
      throw new Error('Upstream unavailable');
    }

    const headers = new Headers({
      'content-type': 'text/html; charset=utf-8',
      'content-encoding': 'gzip',
      location: 'https://pacific-quill-c83d0.firebaseapp.com/__/auth/handler?done=1',
    });
    headers.append(
      'set-cookie',
      'fb_state=123; Path=/; Domain=pacific-quill-c83d0.firebaseapp.com; HttpOnly; Secure',
    );
    return new Response('<html>auth-handler</html>', { status: 302, headers });
  };

  await withProxyServer({ fetchImpl: mockFetch }, async (baseUrl) => {
    const postRes = await rawHttpRequest(`${baseUrl}/__/auth/handler?apiKey=k1&authType=signInViaRedirect`, {
      method: 'POST',
      headers: {
        host: 'ais-dev-test.asia-east1.run.app',
        'x-forwarded-proto': 'https',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'state=abc&code=123',
    });

    assert.equal(postRes.status, 302);
    assert.equal(
      postRes.headers.location,
      'https://ais-dev-test.asia-east1.run.app/__/auth/handler?done=1',
    );
    assert.equal(postRes.headers['content-encoding'], undefined);
    const setCookieHeader = postRes.headers['set-cookie'];
    const cookie = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : String(setCookieHeader || '');
    assert.match(cookie, /fb_state=123/);
    assert.doesNotMatch(cookie, /Domain=pacific-quill-c83d0\.firebaseapp\.com/i);
    assert.equal(postRes.body, '<html>auth-handler</html>');

    assert.equal(captured.length, 1);
    assert.equal(
      captured[0].url,
      'https://pacific-quill-c83d0.firebaseapp.com/__/auth/handler?apiKey=k1&authType=signInViaRedirect',
    );
    assert.equal(captured[0].method, 'POST');
    assert.equal(captured[0].body, 'state=abc&code=123');

    const failRes = await rawHttpRequest(`${baseUrl}/__/auth/handler?fail=1`);
    assert.equal(failRes.status, 502);
  });
});
