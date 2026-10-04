import { DeletePrizeUseCase } from '../../src/application/prizes/PrizeUseCases';
import { NotFoundError } from '../../src/domain/errors/AppError';
import { FakePrizeRepository } from './fakes';

describe('DeletePrizeUseCase', () => {
  it('hard-deletes a prize that was never redeemed', async () => {
    const prizes = new FakePrizeRepository();
    const prize = await prizes.create({ name: 'Mug', pointsCost: 10 });

    const useCase = new DeletePrizeUseCase(prizes);
    await useCase.execute(prize.id);

    expect(await prizes.findById(prize.id)).toBeNull();
  });

  it('hard-deletes a prize with redemption history, clearing its redemptions too', async () => {
    // prize_redemptions.prize_id has no ON DELETE CASCADE, so a plain DELETE FROM prizes used to
    // throw an unhandled FK violation for any prize that had ever been redeemed. The repository
    // now clears the prize's redemptions first (same transaction) so the delete actually removes
    // the prize completely, as a moderator deleting a prize expects.
    const prizes = new FakePrizeRepository();
    const prize = await prizes.create({ name: 'T-Shirt', pointsCost: 20 });
    await prizes.createRedemption(prize.id, 'user-1', 20, 'moderator-1');

    const useCase = new DeletePrizeUseCase(prizes);
    await useCase.execute(prize.id);

    expect(await prizes.findById(prize.id)).toBeNull();
    expect(await prizes.listRedeemedPrizeIdsByUser('user-1')).not.toContain(prize.id);
  });

  it('throws NotFoundError for an unknown prize id', async () => {
    const prizes = new FakePrizeRepository();
    const useCase = new DeletePrizeUseCase(prizes);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
