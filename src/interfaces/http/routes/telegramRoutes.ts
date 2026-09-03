import { Router } from 'express';
import { Container } from '../../../config/container';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requireRole } from '../middleware/auth';

export function telegramRoutes(container: Container): Router {
  const router = Router();
  router.use(requireAuth(container.tokens, container.userRepo));

  // Manual trigger — lets a moderator test the exact message the Friday cron job will send.
  router.post(
    '/send-weekly-report',
    requireRole('MODERATOR'),
    asyncHandler(async (_req, res) => {
      const result = await container.useCases.sendWeeklyReport.execute();
      res.json(result);
    }),
  );

  return router;
}
