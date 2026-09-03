import { Router } from 'express';
import { Container } from '../../../config/container';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  createEventSchema,
  updateEventSchema,
  recordEventPaymentSchema,
  updateEventPaymentSchema,
  setMemberEventTotalSchema,
} from '../dto/schemas';
import { idParam } from '../dto/params';

export function eventRoutes(container: Container): Router {
  const router = Router();
  router.use(requireAuth(container.tokens, container.userRepo));

  /**
   * Everyone signed in sees the upcoming events; each row carries the *caller's own* paid and
   * remaining amounts, so a member never learns anything about anyone else's money here.
   * `?upcomingOnly=false` includes past events; a moderator may additionally pass
   * `?activeOnly=false` to see the ones they've hidden.
   */
  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const isModerator = req.auth!.role === 'MODERATOR';
      const events = await container.useCases.listEvents.execute({
        viewerId: req.auth!.userId,
        activeOnly: !isModerator || req.query.activeOnly !== 'false',
        upcomingOnly: req.query.upcomingOnly !== 'false',
      });
      res.json(events);
    }),
  );

  router.post(
    '/',
    requireRole('MODERATOR'),
    validateBody(createEventSchema),
    asyncHandler(async (req, res) => {
      const event = await container.useCases.createEvent.execute(req.body);
      res.status(201).json(event);
    }),
  );

  router.patch(
    '/:id',
    requireRole('MODERATOR'),
    validateBody(updateEventSchema),
    asyncHandler(async (req, res) => {
      const event = await container.useCases.updateEvent.execute(idParam(req), req.body);
      res.json(event);
    }),
  );

  router.delete(
    '/:id',
    requireRole('MODERATOR'),
    asyncHandler(async (req, res) => {
      await container.useCases.deleteEvent.execute(idParam(req));
      res.status(204).send();
    }),
  );

  // The moderator's payment sheet: every member, what they've paid, and what's left.
  router.get(
    '/:id/payments',
    requireRole('MODERATOR'),
    asyncHandler(async (req, res) => {
      const roster = await container.useCases.getEventRoster.execute(idParam(req));
      res.json(roster);
    }),
  );

  // A member's own ledger for one event — their installments and what they still owe.
  router.get(
    '/:id/payments/me',
    asyncHandler(async (req, res) => {
      const mine = await container.useCases.getMyEventPayments.execute(idParam(req), req.auth!.userId);
      res.json(mine);
    }),
  );

  // Records one installment. Called once for a member paying in full, repeatedly for one paying
  // it off in parts.
  router.post(
    '/:id/payments',
    requireRole('MODERATOR'),
    validateBody(recordEventPaymentSchema),
    asyncHandler(async (req, res) => {
      const payment = await container.useCases.recordEventPayment.execute({
        eventId: idParam(req),
        userId: req.body.userId,
        amount: req.body.amount,
        note: req.body.note ?? null,
        recordedById: req.auth!.userId,
      });
      res.status(201).json(payment);
    }),
  );

  // Sets a member's total for the event outright (recorded as a balancing entry, so the ledger
  // still shows what was collected and when).
  router.put(
    '/:id/payments/member/:userId',
    requireRole('MODERATOR'),
    validateBody(setMemberEventTotalSchema),
    asyncHandler(async (req, res) => {
      const result = await container.useCases.setMemberEventTotal.execute({
        eventId: idParam(req),
        userId: idParam(req, 'userId'),
        total: req.body.total,
        moderatorId: req.auth!.userId,
      });
      res.json(result);
    }),
  );

  router.patch(
    '/:id/payments/:paymentId',
    requireRole('MODERATOR'),
    validateBody(updateEventPaymentSchema),
    asyncHandler(async (req, res) => {
      const payment = await container.useCases.updateEventPayment.execute(idParam(req, 'paymentId'), req.body);
      res.json(payment);
    }),
  );

  router.delete(
    '/:id/payments/:paymentId',
    requireRole('MODERATOR'),
    asyncHandler(async (req, res) => {
      await container.useCases.deleteEventPayment.execute(idParam(req, 'paymentId'));
      res.status(204).send();
    }),
  );

  return router;
}
