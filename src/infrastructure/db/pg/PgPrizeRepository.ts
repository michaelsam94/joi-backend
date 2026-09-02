import { Pool } from 'pg';
import { PrizeRepository, CreatePrizeData, UpdatePrizeData } from '../../../application/ports/PrizeRepository';
import { Prize, PrizeRedemption } from '../../../domain/entities/Prize';

interface PrizeRow {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  image_url: string | null;
  active: boolean;
  quantity: number | null;
}

interface RedemptionRow {
  id: string;
  prize_id: string;
  user_id: string;
  points_spent: number;
  redeemed_by_id: string;
  created_at: Date;
}

const toPrize = (row: PrizeRow): Prize => ({
  id: row.id,
  name: row.name,
  description: row.description,
  pointsCost: row.points_cost,
  imageUrl: row.image_url,
  active: row.active,
  quantity: row.quantity,
});

const toRedemption = (row: RedemptionRow): PrizeRedemption => ({
  id: row.id,
  prizeId: row.prize_id,
  userId: row.user_id,
  pointsSpent: row.points_spent,
  redeemedById: row.redeemed_by_id,
  createdAt: row.created_at,
});

export class PgPrizeRepository implements PrizeRepository {
  constructor(private readonly db: Pool) {}

  async create(data: CreatePrizeData): Promise<Prize> {
    const { rows } = await this.db.query<PrizeRow>(
      `INSERT INTO prizes (name, description, points_cost, image_url, quantity)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.name, data.description ?? null, data.pointsCost, data.imageUrl ?? null, data.quantity ?? null],
    );
    return toPrize(rows[0]);
  }

  async findById(id: string): Promise<Prize | null> {
    const { rows } = await this.db.query<PrizeRow>('SELECT * FROM prizes WHERE id = $1', [id]);
    return rows[0] ? toPrize(rows[0]) : null;
  }

  async list(filter?: { activeOnly?: boolean }): Promise<Prize[]> {
    const { rows } = filter?.activeOnly
      ? await this.db.query<PrizeRow>('SELECT * FROM prizes WHERE active = TRUE ORDER BY points_cost ASC')
      : await this.db.query<PrizeRow>('SELECT * FROM prizes ORDER BY points_cost ASC');
    return rows.map(toPrize);
  }

  async update(id: string, data: UpdatePrizeData): Promise<Prize> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (data.name !== undefined) {
      sets.push(`name = $${i++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      sets.push(`description = $${i++}`);
      values.push(data.description);
    }
    if (data.pointsCost !== undefined) {
      sets.push(`points_cost = $${i++}`);
      values.push(data.pointsCost);
    }
    if (data.imageUrl !== undefined) {
      sets.push(`image_url = $${i++}`);
      values.push(data.imageUrl);
    }
    if (data.active !== undefined) {
      sets.push(`active = $${i++}`);
      values.push(data.active);
    }
    if (data.quantity !== undefined) {
      sets.push(`quantity = $${i++}`);
      values.push(data.quantity);
    }
    sets.push(`updated_at = now()`);

    values.push(id);
    const { rows } = await this.db.query<PrizeRow>(
      `UPDATE prizes SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    return toPrize(rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.db.query('DELETE FROM prizes WHERE id = $1', [id]);
  }

  async createRedemption(
    prizeId: string,
    userId: string,
    pointsSpent: number,
    redeemedById: string,
  ): Promise<PrizeRedemption> {
    const { rows } = await this.db.query<RedemptionRow>(
      `INSERT INTO prize_redemptions (prize_id, user_id, points_spent, redeemed_by_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [prizeId, userId, pointsSpent, redeemedById],
    );
    return toRedemption(rows[0]);
  }

  async tryReserveOne(prizeId: string): Promise<boolean> {
    // The WHERE guard makes this a single atomic check-and-decrement — two concurrent redeems
    // can't both succeed past the last unit in stock.
    const { rows } = await this.db.query(
      `UPDATE prizes SET quantity = quantity - 1, updated_at = now()
       WHERE id = $1 AND quantity IS NOT NULL AND quantity > 0
       RETURNING id`,
      [prizeId],
    );
    return rows.length > 0;
  }

  async listRedeemedPrizeIdsByUser(userId: string): Promise<string[]> {
    const { rows } = await this.db.query<{ prize_id: string }>(
      'SELECT DISTINCT prize_id FROM prize_redemptions WHERE user_id = $1',
      [userId],
    );
    return rows.map((r) => r.prize_id);
  }
}
