import { Router, type Request, type Response } from 'express';
import firebaseConfig from '../../firebase-applet-config.json';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding',
  'content-length',
  'strict-transport-security',
  'alt-svc',
  'set-cookie',
]);

export function sanitizeProxySetCookie(cookieHeader: string, isHttps: boolean): string {
  // Strip upstream Domain attribute so cookies become first-party host cookies for the proxy origin
  let cleaned = cookieHeader.replace(/;\s*domain=[^;]+/gi, '');
  if (!isHttps) {
    cleaned = cleaned.replace(/;\s*secure\b/gi, '');
  }
  return cleaned;
}

export function rewriteProxyLocation(
  location: string,
  upstreamHost: string,
  proxyOrigin: string,
): string {
  const prefix = `https://${upstreamHost}`;
  if (location.startsWith(prefix)) {
    return `${proxyOrigin}${location.slice(prefix.length)}`;
  }
  return location;
}

async function readRawRequestBody(req: Request): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return undefined;
  }
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string') {
    return Buffer.from(req.body, 'utf8');
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

export interface FirebaseAuthProxyOptions {
  upstreamHost?: string;
  fetchImpl?: typeof fetch;
}

function isLocalProxyHost(host: string | undefined): boolean {
  if (!host) return true;
  const hostname = host.split(':')[0].toLowerCase();
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

function resolveProxyOriginInfo(req: Request, upstreamHost: string) {
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const requestHost = forwardedHost || req.get('host');
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  const isHttps = req.protocol === 'https' || forwardedProto === 'https';
  const proxyHost = requestHost || upstreamHost;
  const proxyProto = isHttps ? 'https' : 'http';
  return {
    requestHost,
    isHttps,
    isLocalhost: isLocalProxyHost(requestHost),
    proxyOrigin: `${proxyProto}://${proxyHost}`,
  };
}

export function createFirebaseAuthProxyRouter(options: FirebaseAuthProxyOptions = {}) {
  const router = Router();
  const upstreamHost = options.upstreamHost ?? firebaseConfig.authDomain;
  const fetchFn = options.fetchImpl ?? fetch;

  // Serve Firebase Web client init.json locally for same-origin helper scripts (public config only)
  router.get('/__/firebase/init.json', (req: Request, res: Response) => {
    const { requestHost, isHttps, isLocalhost } = resolveProxyOriginInfo(req, upstreamHost);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      apiKey: firebaseConfig.apiKey,
      authDomain: isHttps && !isLocalhost && requestHost ? requestHost : firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
    });
  });

  const proxyHandler = async (req: Request, res: Response) => {
    if (!req.originalUrl.startsWith('/__/auth/') && !req.originalUrl.startsWith('/__/firebase/')) {
      return res.status(404).json({ error: 'Not found' });
    }

    const { requestHost, isHttps, proxyOrigin } = resolveProxyOriginInfo(req, upstreamHost);
    const targetUrl = `https://${upstreamHost}${req.originalUrl}`;
    const forwardedHeaders = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (HOP_BY_HOP_HEADERS.has(lower) || lower === 'accept-encoding') continue;
      if (Array.isArray(value)) {
        for (const item of value) forwardedHeaders.append(key, item);
      } else if (typeof value === 'string') {
        forwardedHeaders.set(key, value);
      }
    }

    forwardedHeaders.set('host', upstreamHost);
    if (requestHost) {
      forwardedHeaders.set('x-forwarded-host', requestHost);
    }

    try {
      const bodyBuffer = await readRawRequestBody(req);
      const upstreamRes = await fetchFn(targetUrl, {
        method: req.method,
        headers: forwardedHeaders,
        body: bodyBuffer ? new Uint8Array(bodyBuffer) : undefined,
        redirect: 'manual',
      });

      upstreamRes.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (STRIPPED_RESPONSE_HEADERS.has(lower)) return;
        if (lower === 'location') {
          res.setHeader('location', rewriteProxyLocation(value, upstreamHost, proxyOrigin));
          return;
        }
        res.setHeader(key, value);
      });

      const getSetCookie = (upstreamRes.headers as unknown as { getSetCookie?: () => string[] })
        .getSetCookie;
      const setCookies = typeof getSetCookie === 'function' ? getSetCookie.call(upstreamRes.headers) : [];
      if (setCookies.length > 0) {
        res.setHeader(
          'set-cookie',
          setCookies.map((c) => sanitizeProxySetCookie(c, isHttps)),
        );
      }

      const payload = Buffer.from(await upstreamRes.arrayBuffer());
      res.status(upstreamRes.status).send(payload);
    } catch (err) {
      console.error('Firebase auth reverse proxy error:', err);
      res.status(502).json({
        error: 'Unable to reach Firebase Authentication upstream handler.',
      });
    }
  };

  router.all(/^\/__\/(?:auth|firebase)\/.*$/, proxyHandler);
  return router;
}
