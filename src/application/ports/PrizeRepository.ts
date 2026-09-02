import { Prize, PrizeRedemption } from '../../domain/entities/Prize';

export interface CreatePrizeData {
  name: string;
  description?: string | null;
  pointsCost: number;
  imageUrl?: string | null;
}

export interface UpdatePrizeData {
  name?: string;
  description?: string | null;
  pointsCost?: number;
  imageUrl?: string | null;
  active?: boolean;
}

export interface PrizeRepository {
  create(data: CreatePrizeData): Promise<Prize>;
  findById(id: string): Promise<Prize | null>;
  list(filter?: { activeOnly?: boolean }): Promise<Prize[]>;
  update(id: string, data: UpdatePrizeData): Promise<Prize>;
  delete(id: string): Promise<void>;
  createRedemption(prizeId: string, userId: string, pointsSpent: number, redeemedById: string): Promise<PrizeRedemption>;
}
