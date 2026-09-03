import { AssignRaffleNumberUseCase, ResetRaffleNumbersUseCase } from '../../src/application/raffle/RaffleUseCases';
import { pickRaffleNumber, MAX_RAFFLE_NUMBER } from '../../src/domain/entities/User';
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/domain/errors/AppError';
import { FakeUserRepository } from './fakes';

const makeMember = (users: FakeUserRepository, fullName: string) =>
  users.create({ fullName, username: fullName.toLowerCase(), passwordHash: 'h', role: 'MEMBER' });

describe('pickRaffleNumber', () => {
  it('only ever returns a number nobody currently holds', () => {
    const taken = [1, 2, 3];
    for (let i = 0; i < 50; i++) {
      const picked = pickRaffleNumber(taken)!;
      expect(taken).not.toContain(picked);
      expect(picked).toBeGreaterThanOrEqual(1);
      expect(picked).toBeLessThanOrEqual(MAX_RAFFLE_NUMBER);
    }
  });

  it('finds the one number left rather than guessing forever', () => {
    const allButOne = Array.from({ length: MAX_RAFFLE_NUMBER - 1 }, (_, i) => i + 1);
    expect(pickRaffleNumber(allButOne)).toBe(MAX_RAFFLE_NUMBER);
  });

  it('returns null when the whole pool is handed out', () => {
    const everything = Array.from({ length: MAX_RAFFLE_NUMBER }, (_, i) => i + 1);
    expect(pickRaffleNumber(everything)).toBeNull();
  });

  it('draws uniformly from the free numbers', () => {
    // random() = 0 takes the first free number, just under 1 takes the last.
    expect(pickRaffleNumber([1, 2], () => 0)).toBe(3);
    expect(pickRaffleNumber([], () => 0.999999)).toBe(MAX_RAFFLE_NUMBER);
  });
});

describe('AssignRaffleNumberUseCase', () => {
  it('hands out a number, and hands back the same one if asked again', async () => {
    const users = new FakeUserRepository();
    const member = await makeMember(users, 'Member');
    const useCase = new AssignRaffleNumberUseCase(users);

    const first = await useCase.execute(member.id);
    expect(first.raffleNumber).toBeGreaterThanOrEqual(1);
    expect(first.alreadyHeld).toBe(false);

    // A double-tap in the check-in popup must not redraw — they've already written theirs down.
    const second = await useCase.execute(member.id);
    expect(second.raffleNumber).toBe(first.raffleNumber);
    expect(second.alreadyHeld).toBe(true);
  });

  it('never gives two people the same number', async () => {
    const users = new FakeUserRepository();
    const useCase = new AssignRaffleNumberUseCase(users);
    const members = await Promise.all(
      Array.from({ length: 40 }, (_, i) => makeMember(users, `Member${i}`)),
    );

    const assigned: number[] = [];
    for (const member of members) {
      assigned.push((await useCase.execute(member.id)).raffleNumber);
    }
    expect(new Set(assigned).size).toBe(assigned.length);
  });

  it('refuses an unknown or deactivated person', async () => {
    const users = new FakeUserRepository();
    const useCase = new AssignRaffleNumberUseCase(users);
    const member = await makeMember(users, 'Gone');
    await users.update(member.id, { active: false });

    await expect(useCase.execute('nope')).rejects.toBeInstanceOf(NotFoundError);
    await expect(useCase.execute(member.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('asks for a reset instead of hanging when every number is taken', async () => {
    const users = new FakeUserRepository();
    const useCase = new AssignRaffleNumberUseCase(users);
    // One holder per number in the pool, then one more person with nothing left to give.
    for (let n = 1; n <= MAX_RAFFLE_NUMBER; n++) {
      const holder = await makeMember(users, `Holder${n}`);
      await users.assignRaffleNumber(holder.id, n);
    }
    const unlucky = await makeMember(users, 'Unlucky');

    await expect(useCase.execute(unlucky.id)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('ResetRaffleNumbersUseCase', () => {
  it('clears every number at once so members stop seeing one', async () => {
    const users = new FakeUserRepository();
    const assign = new AssignRaffleNumberUseCase(users);
    const a = await makeMember(users, 'A');
    const b = await makeMember(users, 'B');
    const c = await makeMember(users, 'C'); // never given one
    await assign.execute(a.id);
    await assign.execute(b.id);

    const result = await new ResetRaffleNumbersUseCase(users).execute();

    expect(result.cleared).toBe(2); // C was never counted — they had nothing to clear
    expect((await users.findById(a.id))!.raffleNumber).toBeNull();
    expect((await users.findById(b.id))!.raffleNumber).toBeNull();
    expect((await users.findById(c.id))!.raffleNumber).toBeNull();

    // And a fresh draw works straight afterwards
    expect((await assign.execute(a.id)).alreadyHeld).toBe(false);
  });

  it('is harmless when nobody holds a number', async () => {
    const users = new FakeUserRepository();
    expect(await new ResetRaffleNumbersUseCase(users).execute()).toEqual({ cleared: 0 });
  });
});
