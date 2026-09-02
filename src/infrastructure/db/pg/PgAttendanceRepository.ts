import { Pool } from 'pg';
import { AttendanceRepository } from '../../../application/ports/AttendanceRepository';
import { Attendance } from '../../../domain/entities/Attendance';
import { ConflictError } from '../../../domain/errors/AppError';

interface AttendanceRow {
  id: string;
  user_id: string;
  meeting_date: Date;
  checked_by_id: string;
  created_at: Date;
}

function toDomain(row: AttendanceRow): Attendance {
  return {
    id: row.id,
    userId: row.user_id,
    meetingDate: row.meeting_date,
    checkedById: row.checked_by_id,
    createdAt: row.created_at,
  };
}

const UNIQUE_VIOLATION = '23505';
// dates go in/out as YYYY-MM-DD to dodge any local-timezone drift from the driver's Date parsing
const toDateOnly = (d: Date) => d.toISOString().slice(0, 10);

export class PgAttendanceRepository implements AttendanceRepository {
  constructor(private readonly db: Pool) {}

  async create(userId: string, meetingDate: Date, checkedById: string): Promise<Attendance> {
    try {
      const { rows } = await this.db.query<AttendanceRow>(
        `INSERT INTO attendance (user_id, meeting_date, checked_by_id)
         VALUES ($1, $2, $3) RETURNING *`,
        [userId, toDateOnly(meetingDate), checkedById],
      );
      return toDomain(rows[0]);
    } catch (e: any) {
      if (e?.code === UNIQUE_VIOLATION) throw new ConflictError('Already checked in for this meeting');
      throw e;
    }
  }

  async findByUserAndDate(userId: string, meetingDate: Date): Promise<Attendance | null> {
    const { rows } = await this.db.query<AttendanceRow>(
      'SELECT * FROM attendance WHERE user_id = $1 AND meeting_date = $2',
      [userId, toDateOnly(meetingDate)],
    );
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async listByDate(meetingDate: Date): Promise<Attendance[]> {
    const { rows } = await this.db.query<AttendanceRow>('SELECT * FROM attendance WHERE meeting_date = $1', [
      toDateOnly(meetingDate),
    ]);
    return rows.map(toDomain);
  }

  async countByUser(userId: string): Promise<number> {
    const { rows } = await this.db.query<{ count: string }>(
      'SELECT COUNT(*) FROM attendance WHERE user_id = $1',
      [userId],
    );
    return Number(rows[0].count);
  }

  async countTotalMeetings(): Promise<number> {
    const { rows } = await this.db.query<{ count: string }>(
      'SELECT COUNT(DISTINCT meeting_date) FROM attendance',
    );
    return Number(rows[0].count);
  }
}
