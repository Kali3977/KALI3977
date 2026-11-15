import express from 'express';
import http from 'node:http';
import path from 'node:path';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { createApiRouter } from './src/server/routes.ts';
import { initRealtimeServer } from './src/server/realtime.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Secure HTTP headers (configured cleanly for AI Studio iframe, OAuth popups, and Vite assets)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  app.use('/api', (req, res, next) => {
    res.setHeader('X-KALI3977-Platform', 'KALI3977 Educational Platform');
    if (
      req.path.startsWith('/admin') ||
      req.path.startsWith('/auth') ||
      req.path.startsWith('/arena') ||
      req.path.startsWith('/ip-reports')
    ) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
    }
    next();
  });

  app.use('/api', createApiRouter());

  const httpServer = http.createServer(app);
  initRealtimeServer(httpServer);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.on('error', (err) => {
    console.error('KALI3977 HTTP server error:', err);
    process.exit(1);
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`KALI3977 server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start KALI3977 server:', err);
  process.exit(1);
});
