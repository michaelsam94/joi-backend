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
  /** Chat IDs the bot tried and failed to reach (bad token, wrong chat ID, bot never
   * messaged/blocked, etc). One bad chat no longer crashes the whole request — see `execute()`. */
  failedChatIds: string[];
}

/** Pure formatting, kept separate so it's trivially unit-testable without a bot or a clock. */
export function formatWeeklyReportMessage(input: {
  meetingDateISO: string;
  attendedCount: number;
  totalActiveMembers: number;
  absentees: Array<{ fullName: string; totalHistoricalAttendance: number }>;
}): string {
  const lines: string[] = [];
  lines.push(`📊 *تقرير جوي الأسبوعي* (${input.meetingDateISO})`);
  lines.push('');
  lines.push(`✅ الحضور اليوم: ${input.attendedCount} / ${input.totalActiveMembers}`);
  lines.push(`❌ الغياب اليوم: ${input.absentees.length}`);
  lines.push('');
  if (input.absentees.length === 0) {
    lines.push('حضر الجميع هذا الأسبوع! 🎉');
  } else {
    lines.push('الغائبون وعدد مرات حضورهم:');
    for (const a of input.absentees) {
      lines.push(`• ${a.fullName} — حضر ${a.totalHistoricalAttendance} اجتماع (إجمالي)`);
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
    const failedChatIds: string[] = [];
    for (const chatId of this.adminChatIds) {
      if (!chatId) continue;
      try {
        await this.bot.sendMessage(chatId, message);
        sentToChatIds.push(chatId);
      } catch (err) {
        // A single bad/misconfigured chat (wrong ID, bot blocked, bad token, etc) must not take
        // down the whole request — log it for the admin's own `docker compose logs` debugging and
        // keep going so any other correctly-configured chats still get the report.
        console.error(`[telegram] Failed to send weekly report to chat ${chatId}:`, err);
        failedChatIds.push(chatId);
      }
    }

    return {
      meetingDate: meetingDateISO,
      attendedCount: present.length,
      totalActiveMembers,
      absentees,
      message,
      sentToChatIds,
      failedChatIds,
    };
  }
}
