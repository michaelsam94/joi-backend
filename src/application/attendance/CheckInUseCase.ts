import { UserRepository } from '../ports/UserRepository';
import { AttendanceRepository } from '../ports/AttendanceRepository';
import { PointTransactionRepository } from '../ports/PointTransactionRepository';
import { Clock } from '../ports/Clock';
import { NotFoundError, ConflictError, ForbiddenError } from '../../domain/errors/AppError';
import { currentMeetingDate } from '../../domain/entities/Attendance';

export interface CheckInInput {
  qrToken: string;
  checkedById: string;
  /** Optional explicit meeting date (YYYY-MM-DD). Defaults to "this week's meeting date" derived from now(). */
  meetingDate?: string;
}

export interface CheckInOutput {
  userId: string;
  fullName: string;
  meetingDate: string;
  pointsAwarded: number;
  totalPoints: number;
}

/**
 * Records attendance for one scan and awards the fixed attendance points in
 * the same operation — this is the single action the scanner app calls.
 * Re-scanning the same person on the same meeting date is a no-op error
 * (ConflictError), not a duplicate award.
 */
export class CheckInUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly attendance: AttendanceRepository,
    private readonly pointTx: PointTransactionRepository,
    private readonly clock: Clock,
    private readonly attendancePoints: number,
    private readonly meetingDayOfWeek: number,
  ) {}

  async execute(input: CheckInInput): Promise<CheckInOutput> {
    const member = await this.users.findByQrToken(input.qrToken);
    if (!member) throw new NotFoundError('No person matches this QR code');
    if (!member.active) throw new ForbiddenError('This person is deactivated');

    const checker = await this.users.findById(input.checkedById);
    if (!checker) throw new NotFoundError('Checking-in user not found');

    const meetingDate = input.meetingDate
      ? new Date(`${input.meetingDate}T00:00:00.000Z`)
      : currentMeetingDate(this.clock.now(), this.meetingDayOfWeek);

    const already = await this.attendance.findByUserAndDate(member.id, meetingDate);
    if (already) throw new ConflictError(`${member.fullName} is already checked in for this meeting`);

    await this.attendance.create(member.id, meetingDate, checker.id);
    await this.pointTx.create({
      userId: member.id,
      points: this.attendancePoints,
      type: 'ATTENDANCE',
      reason: `Attended meeting ${meetingDate.toISOString().slice(0, 10)}`,
      createdById: checker.id,
    });
    const updated = await this.users.incrementPoints(member.id, this.attendancePoints);

    return {
      userId: member.id,
      fullName: member.fullName,
      meetingDate: meetingDate.toISOString().slice(0, 10),
      pointsAwarded: this.attendancePoints,
      totalPoints: updated.totalPoints,
    };
  }
}
