export interface Attendance {
  id: string;
  userId: string;
  meetingDate: Date;
  checkedById: string;
  createdAt: Date;
}

/**
 * Resolves the calendar date (midnight UTC) of the current/most recent meeting,
 * given the configured meeting day-of-week (0=Sunday..6=Saturday).
 * If `today` already IS the meeting day, that date is used.
 */
export function currentMeetingDate(today: Date, meetingDayOfWeek: number): Date {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const diff = (d.getUTCDay() - meetingDayOfWeek + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}
