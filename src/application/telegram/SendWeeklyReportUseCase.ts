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
  absentees: Array<{ fullName: string; totalHistoricalAttendance: number; lastAttendanceDate: string | null }>;
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
  absentees: Array<{ fullName: string; totalHistoricalAttendance: number; lastAttendanceDate: string | null }>;
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
      const lastAttendedSuffix =
        a.totalHistoricalAttendance > 0 && a.lastAttendanceDate ? ` — آخر حضور: ${a.lastAttendanceDate}` : '';
      lines.push(`• ${a.fullName} — حضر ${a.totalHistoricalAttendance} اجتماع (إجمالي)${lastAttendedSuffix}`);
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
    /** Fixed base recipients from TELEGRAM_ADMIN_CHAT_IDS — merged in `execute()` with every chat
     * id Telegram reports has recently messaged the bot (see NotificationBot.discoverChatIds),
     * so the report broadcasts to everyone who's said something to the bot, not only these. */
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

    // Broadcast to the fixed admin list plus everyone Telegram says has recently messaged the
    // bot — a curl to getUpdates under the hood — so members don't need to be hand-added to
    // TELEGRAM_ADMIN_CHAT_IDS one by one. Discovery failing (e.g. a transient network error) must
    // not stop the send to the chats we already know about.
    let discoveredChatIds: string[] = [];
    try {
      discoveredChatIds = await this.bot.discoverChatIds();
    } catch (err) {
      console.error('[telegram] Failed to discover chat ids to broadcast to:', err);
    }
    const chatIdsToNotify = Array.from(new Set([...this.adminChatIds, ...discoveredChatIds]));

    const sentToChatIds: string[] = [];
    const failedChatIds: string[] = [];
    for (const chatId of chatIdsToNotify) {
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
