import { Router } from 'express';
import { Container } from '../../../config/container';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { checkInSchema, assignRaffleNumberSchema } from '../dto/schemas';
import { currentMeetingDate } from '../../../domain/entities/Attendance';
import { env } from '../../../config/env';

function parseMeetingDateQuery(q: unknown): Date {
  if (typeof q === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q)) {
    return new Date(`${q}T00:00:00.000Z`);
  }
  return currentMeetingDate(new Date(), env.meetingDayOfWeek);
}

export function attendanceRoutes(container: Container): Router {
  const router = Router();
  router.use(requireAuth(container.tokens, container.userRepo));

  // Scanner endpoint: moderator scans a member's QR code to check them in for this week's meeting.
  router.post(
    '/check-in',
    requireRole('MODERATOR'),
    validateBody(checkInSchema),
    asyncHandler(async (req, res) => {
      const result = await container.useCases.checkIn.execute({
        qrToken: req.body.qrToken,
        meetingDate: req.body.meetingDate,
        checkedById: req.auth!.userId,
      });
      res.status(201).json(result);
    }),
  );

  router.get(
    '/',
    requireRole('MODERATOR'),
    asyncHandler(async (req, res) => {
      const meetingDate = parseMeetingDateQuery(req.query.meetingDate);
      const rows = await container.attendanceRepo.listByDate(meetingDate);
      res.json({ meetingDate: meetingDate.toISOString().slice(0, 10), attendees: rows });
    }),
  );

  /**
   * Optional follow-up to a check-in: hand the member a temporary draw number for the meeting.
   * Separate from /check-in on purpose — the moderator decides per person, from the popup, and a
   * meeting with no raffle never calls this at all.
   */
  router.post(
    '/raffle-number',
    requireRole('MODERATOR'),
    validateBody(assignRaffleNumberSchema),
    asyncHandler(async (req, res) => {
      const result = await container.useCases.assignRaffleNumber.execute(req.body.userId);
      res.status(201).json(result);
    }),
  );

  // Every number in play, with no indication of who holds which — the pool a moderator draws
  // from. Finding the person behind a drawn number is a separate step (the members list).
  router.get(
    '/raffle-numbers',
    requireRole('MODERATOR'),
    asyncHandler(async (_req, res) => {
      const result = await container.useCases.listRaffleNumbers.execute();
      res.json(result);
    }),
  );

  // "The activity is over" — clears every number at once, so they vanish from members' profiles.
  router.post(
    '/raffle-number/reset',
    requireRole('MODERATOR'),
    asyncHandler(async (req, res) => {
      const result = await container.useCases.resetRaffleNumbers.execute();
      res.json(result);
    }),
  );

  router.get(
    '/absentees',
    requireRole('MODERATOR'),
    asyncHandler(async (req, res) => {
      const meetingDate = parseMeetingDateQuery(req.query.meetingDate);
      const absentees = await container.useCases.getAbsentees.execute(meetingDate);
      res.json({ meetingDate: meetingDate.toISOString().slice(0, 10), absentees });
    }),
  );

  return router;
}
