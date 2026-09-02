import express, { Express } from 'express';
import cors from 'cors';
import { Container } from './config/container';
import { authRoutes } from './interfaces/http/routes/authRoutes';
import { userRoutes } from './interfaces/http/routes/userRoutes';
import { attendanceRoutes } from './interfaces/http/routes/attendanceRoutes';
import { pointsRoutes } from './interfaces/http/routes/pointsRoutes';
import { leaderboardRoutes } from './interfaces/http/routes/leaderboardRoutes';
import { prizeRoutes } from './interfaces/http/routes/prizeRoutes';
import { telegramRoutes } from './interfaces/http/routes/telegramRoutes';
import { exportRoutes } from './interfaces/http/routes/exportRoutes';
import { uploadRoutes, uploadsDir } from './interfaces/http/routes/uploadRoutes';
import { errorHandler } from './interfaces/http/middleware/errorHandler';

export function buildApp(container: Container): Express {
  const app = express();
  // Behind a reverse proxy (nginx/certbot terminating HTTPS) in production — without this,
  // req.protocol always reports 'http' and uploaded-image URLs would be built as http:// even
  // though the public site is https://.
  app.set('trust proxy', true);
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true, app: 'Joi', time: new Date().toISOString() }));

  app.use('/auth', authRoutes(container));
  app.use('/users', userRoutes(container));
  app.use('/attendance', attendanceRoutes(container));
  app.use('/points', pointsRoutes(container));
  app.use('/leaderboard', leaderboardRoutes(container));
  app.use('/prizes', prizeRoutes(container));
  app.use('/telegram', telegramRoutes(container));
  app.use('/export', exportRoutes(container));
  // Static image reads are intentionally public (no auth) — Coil/AsyncImage on mobile requests
  // these plain, without an Authorization header. Only the upload (POST) below requires a
  // moderator token.
  app.use('/uploads', express.static(uploadsDir));
  app.use('/uploads', uploadRoutes(container));

  app.use(errorHandler);
  return app;
}
