import { PrizeRepository, CreatePrizeData, UpdatePrizeData } from '../ports/PrizeRepository';
import { UserRepository } from '../ports/UserRepository';
import { PointTransactionRepository } from '../ports/PointTransactionRepository';
import { NotFoundError, ValidationError } from '../../domain/errors/AppError';
import { Prize, PrizeRedemption } from '../../domain/entities/Prize';

export class CreatePrizeUseCase {
  constructor(private readonly prizes: PrizeRepository) {}
  async execute(data: CreatePrizeData): Promise<Prize> {
    if (!data.name.trim()) throw new ValidationError('Prize name is required');
    if (data.pointsCost <= 0) throw new ValidationError('Points cost must be positive');
    if (data.quantity != null && data.quantity < 0) throw new ValidationError('Quantity cannot be negative');
    return this.prizes.create(data);
  }
}

export class UpdatePrizeUseCase {
  constructor(private readonly prizes: PrizeRepository) {}
  async execute(id: string, data: UpdatePrizeData): Promise<Prize> {
    const existing = await this.prizes.findById(id);
    if (!existing) throw new NotFoundError('Prize not found');
    if (data.pointsCost !== undefined && data.pointsCost <= 0) {
      throw new ValidationError('Points cost must be positive');
    }
    if (data.quantity != null && data.quantity < 0) throw new ValidationError('Quantity cannot be negative');
    return this.prizes.update(id, data);
  }
}

export class DeletePrizeUseCase {
  constructor(private readonly prizes: PrizeRepository) {}
  async execute(id: string): Promise<void> {
    const existing = await this.prizes.findById(id);
    if (!existing) throw new NotFoundError('Prize not found');
    await this.prizes.delete(id);
  }
}

export class ListPrizesUseCase {
  constructor(private readonly prizes: PrizeRepository) {}
  async execute(filter?: { activeOnly?: boolean }): Promise<Prize[]> {
    return this.prizes.list(filter);
  }
}

export interface RedeemPrizeInput {
  prizeId: string;
  userId: string;
  moderatorId: string;
}

/**
 * Spends a member's points on a prize: validates the prize is active and the
 * member can afford it, then atomically deducts the points (as a
 * PRIZE_REDEEM transaction, same audit trail as any other point change) and
 * records the redemption.
 */
export class RedeemPrizeUseCase {
  constructor(
    private readonly prizes: PrizeRepository,
    private readonly users: UserRepository,
    private readonly pointTx: PointTransactionRepository,
  ) {}

  async execute(input: RedeemPrizeInput): Promise<PrizeRedemption> {
    const prize = await this.prizes.findById(input.prizeId);
    if (!prize) throw new NotFoundError('Prize not found');
    if (!prize.active) throw new ValidationError('This prize is no longer available');

    const user = await this.users.findById(input.userId);
    if (!user) throw new NotFoundError('User not found');
    if (user.totalPoints < prize.pointsCost) {
      throw new ValidationError(
        `${user.fullName} has ${user.totalPoints} points but needs ${prize.pointsCost} for "${prize.name}"`,
      );
    }

    // Limited-quantity prizes reserve a unit atomically before any points move, so a race between
    // two redemptions can't both succeed past the last one in stock — and nothing is charged if
    // the reservation fails.
    if (prize.quantity !== null) {
      const reserved = await this.prizes.tryReserveOne(prize.id);
      if (!reserved) throw new ValidationError(`"${prize.name}" is out of stock`);
    }

    await this.pointTx.create({
      userId: user.id,
      points: -prize.pointsCost,
      type: 'PRIZE_REDEEM',
      reason: `Redeemed prize: ${prize.name}`,
      createdById: input.moderatorId,
    });
    await this.users.incrementPoints(user.id, -prize.pointsCost);

    return this.prizes.createRedemption(prize.id, user.id, prize.pointsCost, input.moderatorId);
  }
}

/** Powers the "you've redeemed this" badge — every prize id this one user has redeemed before. */
export class GetRedeemedPrizeIdsUseCase {
  constructor(private readonly prizes: PrizeRepository) {}
  async execute(userId: string): Promise<string[]> {
    return this.prizes.listRedeemedPrizeIdsByUser(userId);
  }
}
