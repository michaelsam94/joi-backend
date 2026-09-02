import { Pool } from 'pg';
import {
  PointTransactionRepository,
  CreatePointTransactionData,
} from '../../../application/ports/PointTransactionRepository';
import { PointTransaction } from '../../../domain/entities/PointTransaction';

interface PointTxRow {
  id: string;
  user_id: string;
  points: number;
  type: string;
  reason: string | null;
  created_by_id: string | null;
  created_at: Date;
}

function toDomain(row: PointTxRow): PointTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    points: row.points,
    type: row.type as PointTransaction['type'],
    reason: row.reason,
    createdById: row.created_by_id,
    createdAt: row.created_at,
  };
}

export class PgPointTransactionRepository implements PointTransactionRepository {
  constructor(private readonly db: Pool) {}

  async create(data: CreatePointTransactionData): Promise<PointTransaction> {
    const { rows } = await this.db.query<PointTxRow>(
      `INSERT INTO point_transactions (user_id, points, type, reason, created_by_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.userId, data.points, data.type, data.reason ?? null, data.createdById ?? null],
    );
    return toDomain(rows[0]);
  }

  async listByUser(userId: string): Promise<PointTransaction[]> {
    const { rows } = await this.db.query<PointTxRow>(
      'SELECT * FROM point_transactions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return rows.map(toDomain);
  }
}
