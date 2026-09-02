import { PointTransaction, PointType } from '../../domain/entities/PointTransaction';

export interface CreatePointTransactionData {
  userId: string;
  points: number;
  type: PointType;
  reason?: string | null;
  createdById?: string | null;
}

export interface PointTransactionRepository {
  create(data: CreatePointTransactionData): Promise<PointTransaction>;
  listByUser(userId: string): Promise<PointTransaction[]>;
}
