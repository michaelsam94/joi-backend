import { Router } from 'express';
import { Container } from '../../../config/container';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';

export function leaderboardRoutes(container: Container): Router {
  const router = Router();
  router.use(requireAuth(container.tokens));

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const board = await container.useCases.getLeaderboard.execute();
      res.json(board);
    }),
  );

  return router;
}
