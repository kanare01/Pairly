import http from 'http';
import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { getDb } from './server/db.js';
import { seedDatabase } from './server/seed.js';
import { setupWebSocket } from './server/websocket/wsServer.js';

import { authRouter } from './server/routes/auth.js';
import { usersRouter } from './server/routes/users.js';
import { peopleRouter } from './server/routes/people.js';
import { interactionsRouter } from './server/routes/likes.js';
import { postsRouter } from './server/routes/posts.js';
import { messagesRouter } from './server/routes/messages.js';
import { mailRouter } from './server/routes/mail.js';
import { creditsRouter } from './server/routes/credits.js';
import { giftsRouter } from './server/routes/gifts.js';
import { paymentsRouter } from './server/routes/payments.js';
import { reportsRouter } from './server/routes/reports.js';
import { adminRouter } from './server/routes/admin.js';
import { mediaRouter } from './server/routes/media.js';
import { notificationsRouter } from './server/routes/notifications.js';

async function startServer() {
  // Initialize Database and Seed initial data
  console.log('[Server] Initializing database...');
  await getDb();
  await seedDatabase();

  const app = express();
  const PORT = 3000;

  // Middlewares
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Static uploads directory
  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      app: 'Pairly',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/people', peopleRouter);
  app.use('/api', interactionsRouter); // /api/likes, /api/matches, /api/follows, /api/blocks
  app.use('/api/posts', postsRouter);
  app.use('/api/feed', postsRouter); // Alias for feed
  app.use('/api/messages', messagesRouter);
  app.use('/api/conversations', messagesRouter); // Alias for conversations
  app.use('/api/mail', mailRouter);
  app.use('/api/threads', mailRouter); // Alias for mail threads
  app.use('/api/credits', creditsRouter);
  app.use('/api/gifts', giftsRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/media', mediaRouter);
  app.use('/api/notifications', notificationsRouter);

  // CRITICAL: Any unhandled /api/* request MUST return JSON 404, NEVER fall through to Vite SPA html!
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  // Vite middleware for development / static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  // Setup WebSocket server
  setupWebSocket(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Pairly full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
