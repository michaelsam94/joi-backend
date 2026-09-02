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
    expect(msg).toContain('الحضور اليوم: 34 / 50');
    expect(msg).toContain('الغياب اليوم: 2');
    expect(msg).toContain('Mina Samir — حضر 12 اجتماع');
    expect(msg).toContain('Mariam Fady — حضر 3 اجتماع');
  });

  it('celebrates full attendance when there are no absentees', () => {
    const msg = formatWeeklyReportMessage({
      meetingDateISO: '2026-09-04',
      attendedCount: 10,
      totalActiveMembers: 10,
      absentees: [],
    });
    expect(msg).toContain('حضر الجميع هذا الأسبوع');
  });
});
