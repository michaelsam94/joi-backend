import { Prize, PrizeRedemption } from '../../domain/entities/Prize';

export interface CreatePrizeData {
  name: string;
  description?: string | null;
  pointsCost: number;
  imageUrl?: string | null;
  /** Starting stock. Null/omitted = unlimited. */
  quantity?: number | null;
}

export interface UpdatePrizeData {
  name?: string;
  description?: string | null;
  pointsCost?: number;
  imageUrl?: string | null;
  active?: boolean;
  quantity?: number | null;
}

export interface PrizeRepository {
  create(data: CreatePrizeData): Promise<Prize>;
  findById(id: string): Promise<Prize | null>;
  list(filter?: { activeOnly?: boolean }): Promise<Prize[]>;
  update(id: string, data: UpdatePrizeData): Promise<Prize>;
  delete(id: string): Promise<void>;
  createRedemption(prizeId: string, userId: string, pointsSpent: number, redeemedById: string): Promise<PrizeRedemption>;
  /** Atomically decrements a limited-quantity prize's stock by one, but only if it currently has
   * stock — returns false (no-op) if it's already at 0. A prize with unlimited (null) quantity
   * has nothing to reserve and this is never called for it. */
  tryReserveOne(prizeId: string): Promise<boolean>;
  /** Every distinct prize id this user has personally redeemed before — powers the "you've
   * redeemed this" badge on the prize list. */
  listRedeemedPrizeIdsByUser(userId: string): Promise<string[]>;
}
