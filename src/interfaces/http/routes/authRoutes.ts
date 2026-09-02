import { Router } from 'express';
import { Container } from '../../../config/container';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { loginSchema, changePasswordSchema } from '../dto/schemas';

export function authRoutes(container: Container): Router {
  const router = Router();

  router.post(
    '/login',
    validateBody(loginSchema),
    asyncHandler(async (req, res) => {
      const result = await container.useCases.login.execute(req.body);
      res.json(result);
    }),
  );

  router.post(
    '/change-password',
    requireAuth(container.tokens),
    validateBody(changePasswordSchema),
    asyncHandler(async (req, res) => {
      await container.useCases.changePassword.execute({
        userId: req.auth!.userId,
        newPassword: req.body.newPassword,
      });
      res.json({ ok: true });
    }),
  );

  return router;
}
