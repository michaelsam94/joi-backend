import dotenv from 'dotenv';

dotenv.config();

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  port: Number(optional('PORT', '3000')),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: optional('JWT_SECRET', 'dev-secret-change-me'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '12h'),
  attendancePoints: Number(optional('ATTENDANCE_POINTS', '10')),
  meetingDayOfWeek: Number(optional('MEETING_DAY_OF_WEEK', '5')),
  telegramBotToken: optional('TELEGRAM_BOT_TOKEN') || undefined,
  telegramAdminChatIds: optional('TELEGRAM_ADMIN_CHAT_IDS')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  weeklyReportCron: optional('WEEKLY_REPORT_CRON', '0 13 * * 5'),
  googleServiceAccountJson: optional('GOOGLE_SERVICE_ACCOUNT_JSON') || undefined,
  googleDriveFolderId: optional('GOOGLE_DRIVE_FOLDER_ID') || undefined,
};
