import { Router } from 'express';
import { Container } from '../../../config/container';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { adjustPointsSchema } from '../dto/schemas';
import { toPublicUser } from '../../../domain/entities/User';

export function pointsRoutes(container: Container): Router {
  const router = Router();
  router.use(requireAuth(container.tokens, container.userRepo));

  router.post(
    '/adjust',
    requireRole('MODERATOR'),
    validateBody(adjustPointsSchema),
    asyncHandler(async (req, res) => {
      const user = await container.useCases.adjustPoints.execute({
        userId: req.body.userId,
        points: req.body.points,
        reason: req.body.reason,
        moderatorId: req.auth!.userId,
      });
      res.json(toPublicUser(user));
    }),
  );

  return router;
}
