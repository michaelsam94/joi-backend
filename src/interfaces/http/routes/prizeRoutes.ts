import { Router } from 'express';
import { Container } from '../../../config/container';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createPrizeSchema, updatePrizeSchema, redeemPrizeSchema } from '../dto/schemas';
import { idParam } from '../dto/params';

export function prizeRoutes(container: Container): Router {
  const router = Router();
  router.use(requireAuth(container.tokens));

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const activeOnly = req.auth!.role !== 'MODERATOR' || req.query.activeOnly !== 'false';
      const prizes = await container.useCases.listPrizes.execute({ activeOnly });
      res.json(prizes);
    }),
  );

  // Every prize id the signed-in user has personally redeemed before — powers the "you've
  // redeemed this" badge. Placed before "/:id" routes so it isn't swallowed by them.
  router.get(
    '/redeemed-by-me',
    asyncHandler(async (req, res) => {
      const prizeIds = await container.useCases.getRedeemedPrizeIds.execute(req.auth!.userId);
      res.json({ prizeIds });
    }),
  );

  router.post(
    '/',
    requireRole('MODERATOR'),
    validateBody(createPrizeSchema),
    asyncHandler(async (req, res) => {
      const prize = await container.useCases.createPrize.execute(req.body);
      res.status(201).json(prize);
    }),
  );

  router.patch(
    '/:id',
    requireRole('MODERATOR'),
    validateBody(updatePrizeSchema),
    asyncHandler(async (req, res) => {
      const prize = await container.useCases.updatePrize.execute(idParam(req), req.body);
      res.json(prize);
    }),
  );

  router.delete(
    '/:id',
    requireRole('MODERATOR'),
    asyncHandler(async (req, res) => {
      await container.useCases.deletePrize.execute(idParam(req));
      res.status(204).send();
    }),
  );

  router.post(
    '/:id/redeem',
    requireRole('MODERATOR'),
    validateBody(redeemPrizeSchema),
    asyncHandler(async (req, res) => {
      const redemption = await container.useCases.redeemPrize.execute({
        prizeId: idParam(req),
        userId: req.body.userId,
        moderatorId: req.auth!.userId,
      });
      res.status(201).json(redemption);
    }),
  );

  return router;
}
