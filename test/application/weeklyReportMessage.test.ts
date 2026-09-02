import { formatWeeklyReportMessage } from '../../src/application/telegram/SendWeeklyReportUseCase';

describe('formatWeeklyReportMessage', () => {
  it('lists absentees with their historical attendance', () => {
    const msg = formatWeeklyReportMessage({
      meetingDateISO: '2026-09-04',
      attendedCount: 34,
      totalActiveMembers: 50,
      absentees: [
        { fullName: 'Mina Samir', totalHistoricalAttendance: 12 },
        { fullName: 'Mariam Fady', totalHistoricalAttendance: 3 },
      ],
    });
    expect(msg).toContain('Attended today: 34 / 50');
    expect(msg).toContain('Absent today: 2');
    expect(msg).toContain('Mina Samir — attended 12 meeting(s)');
    expect(msg).toContain('Mariam Fady — attended 3 meeting(s)');
  });

  it('celebrates full attendance when there are no absentees', () => {
    const msg = formatWeeklyReportMessage({
      meetingDateISO: '2026-09-04',
      attendedCount: 10,
      totalActiveMembers: 10,
      absentees: [],
    });
    expect(msg).toContain('Everyone showed up this week');
  });
});
