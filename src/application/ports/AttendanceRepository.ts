import { Attendance } from '../../domain/entities/Attendance';

export interface AttendanceRepository {
  /** Throws ConflictError (mapped from a unique-constraint violation) if already checked in for that date. */
  create(userId: string, meetingDate: Date, checkedById: string): Promise<Attendance>;
  findByUserAndDate(userId: string, meetingDate: Date): Promise<Attendance | null>;
  listByDate(meetingDate: Date): Promise<Attendance[]>;
  countByUser(userId: string): Promise<number>;
  countTotalMeetings(): Promise<number>;
  /** The most recent meeting date this user was checked in for, or null if they never have been. */
  lastAttendanceDate(userId: string): Promise<Date | null>;
}
