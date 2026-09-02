import { currentMeetingDate } from '../../src/domain/entities/Attendance';

describe('currentMeetingDate', () => {
  const FRIDAY = 5;

  it('returns the same date when today already is the meeting day', () => {
    // 2026-09-04 is a Friday
    const today = new Date('2026-09-04T10:00:00.000Z');
    const result = currentMeetingDate(today, FRIDAY);
    expect(result.toISOString().slice(0, 10)).toBe('2026-09-04');
  });

  it('rolls back to the most recent past meeting day', () => {
    // 2026-09-02 is a Wednesday; the most recent Friday before it is 2026-08-28
    const today = new Date('2026-09-02T10:00:00.000Z');
    const result = currentMeetingDate(today, FRIDAY);
    expect(result.toISOString().slice(0, 10)).toBe('2026-08-28');
  });

  it('rolls back a full week when today is the day after the meeting day', () => {
    // 2026-09-05 is a Saturday
    const today = new Date('2026-09-05T10:00:00.000Z');
    const result = currentMeetingDate(today, FRIDAY);
    expect(result.toISOString().slice(0, 10)).toBe('2026-09-04');
  });
});
