import { PointTransactionRepository } from '../ports/PointTransactionRepository';
import { UserRepository } from '../ports/UserRepository';
import { NotFoundError } from '../../domain/errors/AppError';
import { PointTransaction } from '../../domain/entities/PointTransaction';

export class GetPointsHistoryUseCase {
  constructor(private readonly users: UserRepository, private readonly pointTx: PointTransactionRepository) {}

  async execute(userId: string): Promise<PointTransaction[]> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return this.pointTx.listByUser(userId);
  }
}
