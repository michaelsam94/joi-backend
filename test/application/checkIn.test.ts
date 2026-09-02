import { CheckInUseCase } from '../../src/application/attendance/CheckInUseCase';
import { AdjustPointsUseCase } from '../../src/application/points/AdjustPointsUseCase';
import { RedeemPrizeUseCase } from '../../src/application/prizes/PrizeUseCases';
import { ConflictError, ValidationError } from '../../src/domain/errors/AppError';
import {
  FakeUserRepository,
  FakePointTransactionRepository,
  FakeAttendanceRepository,
  FakePrizeRepository,
  FixedClock,
  makeUser,
} from './fakes';

describe('CheckInUseCase', () => {
  it('records attendance and awards attendance points exactly once', async () => {
    const users = new FakeUserRepository();
    const attendance = new FakeAttendanceRepository();
    const pointTx = new FakePointTransactionRepository();
    const moderator = await users.create({ fullName: 'Mod', username: 'mod', passwordHash: 'h', role: 'MODERATOR' });
    const member = await users.create({ fullName: 'Member', username: 'mem', passwordHash: 'h', role: 'MEMBER' });

    const clock = new FixedClock(new Date('2026-09-04T12:00:00.000Z')); // a Friday
    const useCase = new CheckInUseCase(users, attendance, pointTx, clock, 10, 5);

    const result = await useCase.execute({ qrToken: member.qrToken, checkedById: moderator.id });
    expect(result.pointsAwarded).toBe(10);
    expect(result.totalPoints).toBe(10);

    await expect(useCase.execute({ qrToken: member.qrToken, checkedById: moderator.id })).rejects.toBeInstanceOf(
      ConflictError,
    );
    // still only 10 points, not 20 — the rejected second scan must not double-award
    expect((await users.findById(member.id))!.totalPoints).toBe(10);
  });
});

describe('AdjustPointsUseCase', () => {
  it('requires a non-empty reason and a non-zero delta', async () => {
    const users = new FakeUserRepository();
    const pointTx = new FakePointTransactionRepository();
    const member = await users.create({ fullName: 'Member', username: 'mem', passwordHash: 'h', role: 'MEMBER' });
    const useCase = new AdjustPointsUseCase(users, pointTx);

    await expect(useCase.execute({ userId: member.id, points: 0, reason: 'x', moderatorId: 'mod' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(useCase.execute({ userId: member.id, points: 5, reason: '  ', moderatorId: 'mod' })).rejects.toBeInstanceOf(
      ValidationError,
    );

    const updated = await useCase.execute({ userId: member.id, points: -3, reason: 'Correction', moderatorId: 'mod' });
    expect(updated.totalPoints).toBe(-3);
  });
});

describe('RedeemPrizeUseCase', () => {
  it('refuses a redemption the member cannot afford, and deducts points when they can', async () => {
    const users = new FakeUserRepository();
    const pointTx = new FakePointTransactionRepository();
    const prizes = new FakePrizeRepository();
    const member = await users.create({ fullName: 'Member', username: 'mem', passwordHash: 'h', role: 'MEMBER' });
    await users.incrementPoints(member.id, 15);
    const prize = await prizes.create({ name: 'Snack', pointsCost: 20 });

    const useCase = new RedeemPrizeUseCase(prizes, users, pointTx);
    await expect(
      useCase.execute({ prizeId: prize.id, userId: member.id, moderatorId: 'mod' }),
    ).rejects.toBeInstanceOf(ValidationError);

    await users.incrementPoints(member.id, 10); // now has 25
    const redemption = await useCase.execute({ prizeId: prize.id, userId: member.id, moderatorId: 'mod' });
    expect(redemption.pointsSpent).toBe(20);
    expect((await users.findById(member.id))!.totalPoints).toBe(5);
  });
});
