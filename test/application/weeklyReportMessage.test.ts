import { formatWeeklyReportMessage } from '../../src/application/telegram/SendWeeklyReportUseCase';

describe('formatWeeklyReportMessage', () => {
  it('lists absentees with their historical attendance and last-attended date', () => {
    const msg = formatWeeklyReportMessage({
      meetingDateISO: '2026-09-04',
      attendedCount: 34,
      totalActiveMembers: 50,
      absentees: [
        { fullName: 'Mina Samir', totalHistoricalAttendance: 12, lastAttendanceDate: '2026-08-28' },
        { fullName: 'Mariam Fady', totalHistoricalAttendance: 3, lastAttendanceDate: '2026-07-31' },
      ],
    });
    expect(msg).toContain('الحضور اليوم: 34 / 50');
    expect(msg).toContain('الغياب اليوم: 2');
    expect(msg).toContain('Mina Samir — حضر 12 اجتماع (إجمالي) — آخر حضور: 2026-08-28');
    expect(msg).toContain('Mariam Fady — حضر 3 اجتماع (إجمالي) — آخر حضور: 2026-07-31');
  });

  it('omits the last-attended date for someone who has never attended', () => {
    const msg = formatWeeklyReportMessage({
      meetingDateISO: '2026-09-04',
      attendedCount: 34,
      totalActiveMembers: 50,
      absentees: [{ fullName: 'New Person', totalHistoricalAttendance: 0, lastAttendanceDate: null }],
    });
    expect(msg).toContain('New Person — حضر 0 اجتماع (إجمالي)');
    expect(msg).not.toContain('آخر حضور');
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
