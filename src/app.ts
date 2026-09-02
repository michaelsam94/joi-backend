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
import { errorHandler } from './interfaces/http/middleware/errorHandler';

export function buildApp(container: Container): Express {
  const app = express();
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

  app.use(errorHandler);
  return app;
}
