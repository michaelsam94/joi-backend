import { UserRepository } from '../ports/UserRepository';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors/AppError';
import { pickRaffleNumber } from '../../domain/entities/User';

export interface AssignRaffleNumberOutput {
  userId: string;
  fullName: string;
  raffleNumber: number;
  /** True when they already held this number and it was handed back unchanged rather than redrawn. */
  alreadyHeld: boolean;
}

/**
 * Hands a member a temporary draw number for the meeting — the optional step a moderator takes
 * from the check-in popup.
 *
 * Deliberately idempotent: if they already hold a number, that same number comes back. By the time
 * a moderator taps twice the member has usually already written theirs down, and silently redrawing
 * would leave two different numbers in the room believing they're the same person's.
 */
export class AssignRaffleNumberUseCase {
  /** How many times to redraw when a concurrent scan claims the number first. Two moderators
   * scanning simultaneously is the realistic worst case; three attempts is far past it. */
  private static readonly MAX_ATTEMPTS = 3;

  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<AssignRaffleNumberOutput> {
    const member = await this.users.findById(userId);
    if (!member) throw new NotFoundError('User not found');
    if (!member.active) throw new ForbiddenError('This person is deactivated');

    if (member.raffleNumber !== null) {
      return {
        userId: member.id,
        fullName: member.fullName,
        raffleNumber: member.raffleNumber,
        alreadyHeld: true,
      };
    }

    for (let attempt = 0; attempt < AssignRaffleNumberUseCase.MAX_ATTEMPTS; attempt++) {
      const taken = await this.users.listTakenRaffleNumbers();
      const candidate = pickRaffleNumber(taken);
      if (candidate === null) {
        throw new ValidationError('Every draw number is taken — reset the numbers before handing out more');
      }
      const updated = await this.users.assignRaffleNumber(member.id, candidate);
      if (updated) {
        return {
          userId: updated.id,
          fullName: updated.fullName,
          raffleNumber: candidate,
          alreadyHeld: false,
        };
      }
    }

    throw new ValidationError('Couldn’t hand out a number just then — try that again');
  }
}

export interface ListRaffleNumbersOutput {
  numbers: number[];
  count: number;
}

/**
 * Every draw number currently in play, and nothing else — no names, no user ids.
 *
 * This is what a moderator draws *from*: seeing the pool without seeing who holds what keeps the
 * pick honest. Sorted ascending on purpose — check-in order would leak the very link this is meant
 * to withhold, since the moderator scanned people in that order. Matching a drawn number back to a
 * person is a separate, deliberate step (the members list).
 */
export class ListRaffleNumbersUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(): Promise<ListRaffleNumbersOutput> {
    const numbers = (await this.users.listTakenRaffleNumbers()).sort((a, b) => a - b);
    return { numbers, count: numbers.length };
  }
}

export interface ResetRaffleNumbersOutput {
  cleared: number;
}

/**
 * Clears every draw number in one go — the moderator's "the activity is over" action. Members'
 * profiles stop showing a number the moment this runs, which is the whole point of the numbers
 * being temporary.
 */
export class ResetRaffleNumbersUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(): Promise<ResetRaffleNumbersOutput> {
    return { cleared: await this.users.clearAllRaffleNumbers() };
  }
}
