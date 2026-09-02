import { UserRepository } from '../ports/UserRepository';
import { AttendanceRepository } from '../ports/AttendanceRepository';
import { NotificationBot } from '../ports/NotificationBot';
import { Clock } from '../ports/Clock';
import { GetAbsenteesUseCase } from '../attendance/GetAbsenteesUseCase';
import { currentMeetingDate } from '../../domain/entities/Attendance';

export interface WeeklyReportResult {
  meetingDate: string;
  attendedCount: number;
  totalActiveMembers: number;
  absentees: Array<{ fullName: string; totalHistoricalAttendance: number }>;
  message: string;
  sentToChatIds: string[];
}

/** Pure formatting, kept separate so it's trivially unit-testable without a bot or a clock. */
export function formatWeeklyReportMessage(input: {
  meetingDateISO: string;
  attendedCount: number;
  totalActiveMembers: number;
  absentees: Array<{ fullName: string; totalHistoricalAttendance: number }>;
}): string {
  const lines: string[] = [];
  lines.push(`📊 *Joi — Weekly Report* (${input.meetingDateISO})`);
  lines.push('');
  lines.push(`✅ Attended today: ${input.attendedCount} / ${input.totalActiveMembers}`);
  lines.push(`❌ Absent today: ${input.absentees.length}`);
  lines.push('');
  if (input.absentees.length === 0) {
    lines.push('Everyone showed up this week! 🎉');
  } else {
    lines.push('Absentees & their attendance history:');
    for (const a of input.absentees) {
      lines.push(`• ${a.fullName} — attended ${a.totalHistoricalAttendance} meeting(s) all-time`);
    }
  }
  return lines.join('\n');
}

export class SendWeeklyReportUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly attendance: AttendanceRepository,
    private readonly absenteesUseCase: GetAbsenteesUseCase,
    private readonly bot: NotificationBot,
    private readonly clock: Clock,
    private readonly meetingDayOfWeek: number,
    private readonly adminChatIds: string[],
  ) {}

  async execute(): Promise<WeeklyReportResult> {
    const meetingDate = currentMeetingDate(this.clock.now(), this.meetingDayOfWeek);
    const meetingDateISO = meetingDate.toISOString().slice(0, 10);

    const [present, allActive, absentees] = await Promise.all([
      this.attendance.listByDate(meetingDate),
      this.users.list({ activeOnly: true }),
      this.absenteesUseCase.execute(meetingDate),
    ]);

    const totalActiveMembers = allActive.filter((u) => u.role === 'MEMBER').length;
    const message = formatWeeklyReportMessage({
      meetingDateISO,
      attendedCount: present.length,
      totalActiveMembers,
      absentees,
    });

    const sentToChatIds: string[] = [];
    for (const chatId of this.adminChatIds) {
      if (!chatId) continue;
      await this.bot.sendMessage(chatId, message);
      sentToChatIds.push(chatId);
    }

    return {
      meetingDate: meetingDateISO,
      attendedCount: present.length,
      totalActiveMembers,
      absentees,
      message,
      sentToChatIds,
    };
  }
}
