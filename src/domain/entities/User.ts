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
