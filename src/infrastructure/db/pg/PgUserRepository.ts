import { Pool } from 'pg';
import { UserRepository, CreateUserData, UpdateUserData } from '../../../application/ports/UserRepository';
import { User } from '../../../domain/entities/User';
import { ConflictError } from '../../../domain/errors/AppError';

interface UserRow {
  id: string;
  full_name: string;
  username: string;
  password_hash: string;
  role: string;
  must_change_password: boolean;
  qr_token: string;
  telegram_chat_id: string | null;
  total_points: number;
  active: boolean;
  date_of_birth: string | null;
  phone_number: string | null;
  address: string | null;
  class_name: string | null;
  note: string | null;
  raffle_number: number | null;
  is_protected: boolean;
  created_at: Date;
  updated_at: Date;
}

function toDomain(row: UserRow): User {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role as User['role'],
    mustChangePassword: row.must_change_password,
    qrToken: row.qr_token,
    telegramChatId: row.telegram_chat_id,
    totalPoints: row.total_points,
    active: row.active,
    dateOfBirth: row.date_of_birth,
    phoneNumber: row.phone_number,
    address: row.address,
    className: row.class_name,
    note: row.note,
    raffleNumber: row.raffle_number,
    isProtected: row.is_protected,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const UNIQUE_VIOLATION = '23505';

export class PgUserRepository implements UserRepository {
  constructor(private readonly db: Pool) {}

  async create(data: CreateUserData): Promise<User> {
    try {
      const { rows } = await this.db.query<UserRow>(
        `INSERT INTO users (full_name, username, password_hash, role, date_of_birth, phone_number, address, class_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          data.fullName,
          data.username,
          data.passwordHash,
          data.role,
          data.dateOfBirth ?? null,
          data.phoneNumber ?? null,
          data.address ?? null,
          data.className ?? null,
        ],
      );
      return toDomain(rows[0]);
    } catch (e: any) {
      if (e?.code === UNIQUE_VIOLATION) throw new ConflictError('That username is already taken');
      throw e;
    }
  }

  async findById(id: string): Promise<User | null> {
    const { rows } = await this.db.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const { rows } = await this.db.query<UserRow>('SELECT * FROM users WHERE username = $1', [username]);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByQrToken(qrToken: string): Promise<User | null> {
    const { rows } = await this.db.query<UserRow>('SELECT * FROM users WHERE qr_token = $1', [qrToken]);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async list(filter?: { activeOnly?: boolean }): Promise<User[]> {
    const { rows } = filter?.activeOnly
      ? await this.db.query<UserRow>('SELECT * FROM users WHERE active = TRUE ORDER BY full_name ASC')
      : await this.db.query<UserRow>('SELECT * FROM users ORDER BY full_name ASC');
    return rows.map(toDomain);
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (data.fullName !== undefined) {
      sets.push(`full_name = $${i++}`);
      values.push(data.fullName);
    }
    if (data.role !== undefined) {
      sets.push(`role = $${i++}`);
      values.push(data.role);
    }
    if (data.active !== undefined) {
      sets.push(`active = $${i++}`);
      values.push(data.active);
    }
    if (data.telegramChatId !== undefined) {
      sets.push(`telegram_chat_id = $${i++}`);
      values.push(data.telegramChatId);
    }
    if (data.dateOfBirth !== undefined) {
      sets.push(`date_of_birth = $${i++}`);
      values.push(data.dateOfBirth);
    }
    if (data.phoneNumber !== undefined) {
      sets.push(`phone_number = $${i++}`);
      values.push(data.phoneNumber);
    }
    if (data.address !== undefined) {
      sets.push(`address = $${i++}`);
      values.push(data.address);
    }
    if (data.className !== undefined) {
      sets.push(`class_name = $${i++}`);
      values.push(data.className);
    }
    if (data.note !== undefined) {
      sets.push(`note = $${i++}`);
      values.push(data.note);
    }
    sets.push(`updated_at = now()`);

    values.push(id);
    const { rows } = await this.db.query<UserRow>(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    return toDomain(rows[0]);
  }

  async setPassword(id: string, passwordHash: string, mustChangePassword: boolean): Promise<void> {
    await this.db.query(
      'UPDATE users SET password_hash = $1, must_change_password = $2, updated_at = now() WHERE id = $3',
      [passwordHash, mustChangePassword, id],
    );
  }

  async incrementPoints(id: string, delta: number): Promise<User> {
    const { rows } = await this.db.query<UserRow>(
      'UPDATE users SET total_points = total_points + $1, updated_at = now() WHERE id = $2 RETURNING *',
      [delta, id],
    );
    return toDomain(rows[0]);
  }

  async listTakenRaffleNumbers(): Promise<number[]> {
    const { rows } = await this.db.query<{ raffle_number: number }>(
      'SELECT raffle_number FROM users WHERE raffle_number IS NOT NULL',
    );
    return rows.map((r) => r.raffle_number);
  }

  async assignRaffleNumber(id: string, raffleNumber: number): Promise<User | null> {
    try {
      const { rows } = await this.db.query<UserRow>(
        'UPDATE users SET raffle_number = $1, updated_at = now() WHERE id = $2 RETURNING *',
        [raffleNumber, id],
      );
      return rows[0] ? toDomain(rows[0]) : null;
    } catch (e: any) {
      // Two moderators scanning at once can pick the same free number; the partial unique index
      // catches it here and the use-case picks another rather than showing an error.
      if (e?.code === UNIQUE_VIOLATION) return null;
      throw e;
    }
  }

  async clearAllRaffleNumbers(): Promise<number> {
    const result = await this.db.query(
      'UPDATE users SET raffle_number = NULL, updated_at = now() WHERE raffle_number IS NOT NULL',
    );
    return result.rowCount ?? 0;
  }
}
