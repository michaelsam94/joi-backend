import cron from 'node-cron';
import { SendWeeklyReportUseCase } from '../../application/telegram/SendWeeklyReportUseCase';

/** Wires the Friday-13:00-Cairo cron schedule to the weekly report use-case. */
export function scheduleWeeklyReport(useCase: SendWeeklyReportUseCase, cronExpression: string): void {
  cron.schedule(
    cronExpression,
    async () => {
      try {
        const result = await useCase.execute();
        console.log(
          `[scheduler] Weekly report sent for ${result.meetingDate} to ${result.sentToChatIds.length} chat(s)` +
            (result.failedChatIds.length > 0 ? ` (${result.failedChatIds.length} failed)` : ''),
        );
      } catch (err) {
        console.error('[scheduler] Failed to send weekly report', err);
      }
    },
    { timezone: 'Africa/Cairo' },
  );
  console.log(`[scheduler] Weekly report scheduled: "${cronExpression}" (Africa/Cairo)`);
}
