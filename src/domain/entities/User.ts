export type Role = 'MODERATOR' | 'MEMBER';

export interface User {
  id: string;
  fullName: string;
  username: string;
  passwordHash: string;
  role: Role;
  mustChangePassword: boolean;
  qrToken: string;
  telegramChatId: string | null;
  totalPoints: number;
  active: boolean;
  /** YYYY-MM-DD, or null if not on file. */
  dateOfBirth: string | null;
  phoneNumber: string | null;
  address: string | null;
  /** Sunday-school / age-group class, or null if not on file. */
  className: string | null;
  /** A moderator's private free-text note about this member — never shown to the member. */
  note: string | null;
  /** A temporary draw number handed out at check-in for use during the meeting, or null when
   * they don't currently hold one. Cleared for everyone at once — see ResetRaffleNumbersUseCase. */
  raffleNumber: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type Level = 'Bronze' | 'Silver' | 'Gold' | 'Diamond';

const LEVEL_THRESHOLDS: Array<{ level: Level; min: number }> = [
  { level: 'Diamond', min: 600 },
  { level: 'Gold', min: 300 },
  { level: 'Silver', min: 100 },
  { level: 'Bronze', min: 0 },
];

/** Pure domain rule: derive a gamified "level" badge from a point total. No framework, no I/O. */
export function levelForPoints(totalPoints: number): Level {
  const match = LEVEL_THRESHOLDS.find((t) => totalPoints >= t.min);
  return match ? match.level : 'Bronze';
}

/** The largest draw number that can be handed out. A meeting-sized pool: short enough to call
 * across a room and write on a slip, wide enough that numbers stay memorable and distinct. */
export const MAX_RAFFLE_NUMBER = 999;

/**
 * Pure domain rule: pick a draw number nobody currently holds, uniformly at random from the free
 * ones. Building the free list (rather than guessing and retrying) means this always terminates
 * and stays unbiased even when most of the pool is taken.
 *
 * Returns null when every number is already handed out — the caller turns that into a "reset the
 * numbers first" error rather than looping forever.
 */
export function pickRaffleNumber(taken: Iterable<number>, random: () => number = Math.random): number | null {
  const used = new Set(taken);
  const free: number[] = [];
  for (let n = 1; n <= MAX_RAFFLE_NUMBER; n++) {
    if (!used.has(n)) free.push(n);
  }
  if (free.length === 0) return null;
  return free[Math.floor(random() * free.length)];
}

/** Strips fields a MEMBER should never see about another user. */
export function toPublicUser(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    role: user.role,
    totalPoints: user.totalPoints,
    level: levelForPoints(user.totalPoints),
    active: user.active,
  };
}
