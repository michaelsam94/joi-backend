import { Router } from 'express';
import { Container } from '../../../config/container';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { registerUserSchema, updateUserSchema } from '../dto/schemas';
import { toPublicUser, User } from '../../../domain/entities/User';
import { idParam } from '../dto/params';
import { NotFoundError } from '../../../domain/errors/AppError';

/** The full profile view: a moderator (about anyone) or a member (about themselves) only —
 * everyone else only ever gets the leaderboard-safe shape from toPublicUser. */
function toDetailedUser(user: User) {
  return {
    ...toPublicUser(user),
    username: user.username,
    telegramChatId: user.telegramChatId,
    dateOfBirth: user.dateOfBirth,
    phoneNumber: user.phoneNumber,
    address: user.address,
    className: user.className,
    // The temporary draw number from check-in. Members see their own here (via /users/me) and it
    // simply stops being sent once a moderator resets the numbers — nothing on the client has to
    // remember to clear it.
    raffleNumber: user.raffleNumber,
  };
}

/** Adds the moderator-only private note on top of the detailed view — never included in
 * /users/me, so a member never sees notes kept about them. */
function toModeratorDetailedUser(user: User) {
  return { ...toDetailedUser(user), note: user.note };
}

export function userRoutes(container: Container): Router {
  const router = Router();
  router.use(requireAuth(container.tokens));

  // Moderator: register a brand-new person (temp username/password + auto QR token).
  router.post(
    '/',
    requireRole('MODERATOR'),
    validateBody(registerUserSchema),
    asyncHandler(async (req, res) => {
      const user = await container.useCases.registerUser.execute(req.body);
      res.status(201).json(toModeratorDetailedUser(user));
    }),
  );

  // Moderator sees everything; a member sees the public (leaderboard-safe) shape of everyone,
  // and their own full profile via /users/me instead.
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const users = await container.useCases.listUsers.execute({ activeOnly: req.query.activeOnly !== 'false' });
      if (req.auth!.role === 'MODERATOR') {
        res.json(users.map(toModeratorDetailedUser));
      } else {
        res.json(users.map(toPublicUser));
      }
    }),
  );

  router.get(
    '/me',
    asyncHandler(async (req, res) => {
      const users = await container.useCases.listUsers.execute({});
      const me = users.find((u) => u.id === req.auth!.userId);
      if (!me) throw new NotFoundError('User not found');
      res.json(toDetailedUser(me));
    }),
  );

  router.patch(
    '/:id',
    requireRole('MODERATOR'),
    validateBody(updateUserSchema),
    asyncHandler(async (req, res) => {
      const user = await container.useCases.updateUser.execute(idParam(req), req.body);
      res.json(toModeratorDetailedUser(user));
    }),
  );

  // QR image: a member may fetch their own; a moderator may fetch anyone's (for printing/badges).
  router.get(
    '/:id/qr',
    asyncHandler(async (req, res) => {
      if (req.auth!.role !== 'MODERATOR' && req.auth!.userId !== idParam(req)) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'You can only view your own QR code' });
        return;
      }
      const png = await container.useCases.getUserQr.execute(idParam(req));
      res.type('image/png').send(png);
    }),
  );

  router.get(
    '/:id/points/history',
    asyncHandler(async (req, res) => {
      if (req.auth!.role !== 'MODERATOR' && req.auth!.userId !== idParam(req)) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'You can only view your own history' });
        return;
      }
      const history = await container.useCases.getPointsHistory.execute(idParam(req));
      res.json(history);
    }),
  );

  return router;
}
