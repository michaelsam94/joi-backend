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

  it('deactivates instead of hard-deleting a prize with redemption history', async () => {
    // prize_redemptions.prize_id has no ON DELETE CASCADE, so a hard delete here would violate
    // the FK — this is the exact bug that made "delete prize" appear to silently do nothing for
    // any prize that had ever been redeemed.
    const prizes = new FakePrizeRepository();
    const prize = await prizes.create({ name: 'T-Shirt', pointsCost: 20 });
    await prizes.createRedemption(prize.id, 'user-1', 20, 'moderator-1');

    const useCase = new DeletePrizeUseCase(prizes);
    await useCase.execute(prize.id);

    const stillThere = await prizes.findById(prize.id);
    expect(stillThere).not.toBeNull();
    expect(stillThere!.active).toBe(false);
  });

  it('throws NotFoundError for an unknown prize id', async () => {
    const prizes = new FakePrizeRepository();
    const useCase = new DeletePrizeUseCase(prizes);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
