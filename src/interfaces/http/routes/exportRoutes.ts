import { Router } from 'express';
import { Container } from '../../../config/container';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requireRole } from '../middleware/auth';

export function exportRoutes(container: Container): Router {
  const router = Router();
  router.use(requireAuth(container.tokens, container.userRepo));

  router.post(
    '/qr-sheet',
    requireRole('MODERATOR'),
    asyncHandler(async (_req, res) => {
      const result = await container.useCases.exportQrSheet.execute();
      res.json(result);
    }),
  );

  router.post(
    '/database',
    requireRole('MODERATOR'),
    asyncHandler(async (_req, res) => {
      const result = await container.useCases.exportDatabase.execute();
      res.json(result);
    }),
  );

  return router;
}
