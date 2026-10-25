import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { handleApiRoute, ai, apiKey } from './server/api';
import { setupGeminiLiveWebSocket } from './server/geminiLive';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware with expanded limit for audio payloads
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // API router
  app.use(async (req, res, next) => {
    if (req.url && req.url.startsWith('/api/')) {
      const handled = await handleApiRoute(req, res);
      if (handled) return;
    }
    next();
  });

  const server = http.createServer(app);

  // WebSocket Server for Gemini 3.8 Live API streaming
  const wss = new WebSocketServer({ noServer: true });
  setupGeminiLiveWebSocket(wss, ai, apiKey);

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/api/live-stream') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch {
      // Ignore malformed upgrade URLs
    }
  });

  // Mount Vite in dev mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Serve transformed index.html for SPA routes
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        if (vite && vite.ssrFixStacktrace) {
          vite.ssrFixStacktrace(e);
        }
        next(e);
      }
    });
  } else {
    // Production static serving
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Nexus AI server ready at http://0.0.0.0:${PORT} (Gemini 3.8 Live WS at /api/live-stream)`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
