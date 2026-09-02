import { Pool } from 'pg';
import { DatabaseExportRepository, ExportTable } from '../../../application/ports/DatabaseExportRepository';

function formatDate(value: unknown): string {
  if (value == null) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  return date.toISOString().slice(0, 10);
}

function formatTimestamp(value: unknown): string {
  if (value == null) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

/** Queries every table directly (raw SQL, not the typed repositories) so the export can include
 * every column and resolve foreign keys to readable names in one pass — a moderator opening the
 * sheet shouldn't have to look up what a UUID means. */
export class PgDatabaseExportRepository implements DatabaseExportRepository {
  constructor(private readonly db: Pool) {}

  async exportAllTables(): Promise<ExportTable[]> {
    const [members, attendance, transactions, prizes, redemptions] = await Promise.all([
      this.exportMembers(),
      this.exportAttendance(),
      this.exportPointTransactions(),
      this.exportPrizes(),
      this.exportRedemptions(),
    ]);
    return [members, attendance, transactions, prizes, redemptions];
  }

  private async exportMembers(): Promise<ExportTable> {
    const { rows } = await this.db.query(
      `SELECT full_name, username, role, total_points, active, date_of_birth, phone_number,
              address, class_name, note, telegram_chat_id, must_change_password, created_at
       FROM users ORDER BY full_name`,
    );
    return {
      title: 'Members',
      headers: [
        'Full name', 'Username', 'Role', 'Total points', 'Active', 'Date of birth', 'Phone number',
        'Address', 'Class', 'Note', 'Telegram chat id', 'Must change password', 'Created at',
      ],
      rows: rows.map((r) => [
        r.full_name,
        r.username,
        r.role,
        r.total_points,
        r.active,
        formatDate(r.date_of_birth),
        r.phone_number ?? '',
        r.address ?? '',
        r.class_name ?? '',
        r.note ?? '',
        r.telegram_chat_id ?? '',
        r.must_change_password,
        formatTimestamp(r.created_at),
      ]),
    };
  }

  private async exportAttendance(): Promise<ExportTable> {
    const { rows } = await this.db.query(
      `SELECT a.meeting_date, m.full_name AS member_name, c.full_name AS checked_by_name, a.created_at
       FROM attendance a
       JOIN users m ON m.id = a.user_id
       JOIN users c ON c.id = a.checked_by_id
       ORDER BY a.meeting_date DESC, m.full_name`,
    );
    return {
      title: 'Attendance',
      headers: ['Meeting date', 'Member', 'Checked in by', 'Recorded at'],
      rows: rows.map((r) => [formatDate(r.meeting_date), r.member_name, r.checked_by_name, formatTimestamp(r.created_at)]),
    };
  }

  private async exportPointTransactions(): Promise<ExportTable> {
    const { rows } = await this.db.query(
      `SELECT pt.created_at, m.full_name AS member_name, pt.points, pt.type, pt.reason, cb.full_name AS created_by_name
       FROM point_transactions pt
       JOIN users m ON m.id = pt.user_id
       LEFT JOIN users cb ON cb.id = pt.created_by_id
       ORDER BY pt.created_at DESC`,
    );
    return {
      title: 'Point Transactions',
      headers: ['Date', 'Member', 'Points', 'Type', 'Reason', 'Recorded by'],
      rows: rows.map((r) => [
        formatTimestamp(r.created_at),
        r.member_name,
        r.points,
        r.type,
        r.reason ?? '',
        r.created_by_name ?? '',
      ]),
    };
  }

  private async exportPrizes(): Promise<ExportTable> {
    const { rows } = await this.db.query(
      `SELECT name, description, points_cost, quantity, active, created_at FROM prizes ORDER BY name`,
    );
    return {
      title: 'Prizes',
      headers: ['Name', 'Description', 'Points cost', 'Quantity (blank = unlimited)', 'Active', 'Created at'],
      rows: rows.map((r) => [
        r.name,
        r.description ?? '',
        r.points_cost,
        r.quantity ?? '',
        r.active,
        formatTimestamp(r.created_at),
      ]),
    };
  }

  private async exportRedemptions(): Promise<ExportTable> {
    const { rows } = await this.db.query(
      `SELECT pr.created_at, m.full_name AS member_name, p.name AS prize_name, pr.points_spent, rb.full_name AS redeemed_by_name
       FROM prize_redemptions pr
       JOIN users m ON m.id = pr.user_id
       JOIN prizes p ON p.id = pr.prize_id
       JOIN users rb ON rb.id = pr.redeemed_by_id
       ORDER BY pr.created_at DESC`,
    );
    return {
      title: 'Prize Redemptions',
      headers: ['Date', 'Member', 'Prize', 'Points spent', 'Redeemed by'],
      rows: rows.map((r) => [
        formatTimestamp(r.created_at),
        r.member_name,
        r.prize_name,
        r.points_spent,
        r.redeemed_by_name,
      ]),
    };
  }
}
