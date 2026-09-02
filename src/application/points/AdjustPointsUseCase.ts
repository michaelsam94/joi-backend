import { UserRepository } from '../ports/UserRepository';
import { PointTransactionRepository } from '../ports/PointTransactionRepository';
import { NotFoundError, ValidationError } from '../../domain/errors/AppError';
import { User } from '../../domain/entities/User';

export interface AdjustPointsInput {
  userId: string;
  points: number; // positive = add, negative = remove
  reason: string;
  moderatorId: string;
}

/** Moderator-only manual add/remove of points, always with an audited reason. */
export class AdjustPointsUseCase {
  constructor(private readonly users: UserRepository, private readonly pointTx: PointTransactionRepository) {}

  async execute(input: AdjustPointsInput): Promise<User> {
    if (input.points === 0) throw new ValidationError('Points delta cannot be zero');
    if (!input.reason?.trim()) throw new ValidationError('A reason is required for manual point adjustments');

    const user = await this.users.findById(input.userId);
    if (!user) throw new NotFoundError('User not found');

    await this.pointTx.create({
      userId: user.id,
      points: input.points,
      type: input.points > 0 ? 'MANUAL_ADD' : 'MANUAL_REMOVE',
      reason: input.reason.trim(),
      createdById: input.moderatorId,
    });

    return this.users.incrementPoints(user.id, input.points);
  }
}
