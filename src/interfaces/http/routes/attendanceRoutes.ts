import { Router } from 'express';
import { Container } from '../../../config/container';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { checkInSchema } from '../dto/schemas';
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
  router.use(requireAuth(container.tokens));

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
