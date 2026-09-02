import { UserRepository } from '../ports/UserRepository';
import { AttendanceRepository } from '../ports/AttendanceRepository';

export interface AbsenteeInfo {
  userId: string;
  fullName: string;
  totalHistoricalAttendance: number;
}

/**
 * Everyone active who did NOT check in on the given meeting date, each
 * annotated with their all-time attendance count — this is exactly the
 * shape the Friday Telegram report needs, and it's exposed as its own
 * use-case so the report job and the manual API endpoint share one truth.
 */
export class GetAbsenteesUseCase {
  constructor(private readonly users: UserRepository, private readonly attendance: AttendanceRepository) {}

  async execute(meetingDate: Date): Promise<AbsenteeInfo[]> {
    const [allActive, present] = await Promise.all([
      this.users.list({ activeOnly: true }),
      this.attendance.listByDate(meetingDate),
    ]);
    const presentIds = new Set(present.map((a) => a.userId));
    const absentMembers = allActive.filter((u) => u.role === 'MEMBER' && !presentIds.has(u.id));

    const results: AbsenteeInfo[] = [];
    for (const member of absentMembers) {
      const total = await this.attendance.countByUser(member.id);
      results.push({ userId: member.id, fullName: member.fullName, totalHistoricalAttendance: total });
    }
    return results;
  }
}
