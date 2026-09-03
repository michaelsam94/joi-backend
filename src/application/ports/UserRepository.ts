import { User } from '../../domain/entities/User';

export interface CreateUserData {
  fullName: string;
  username: string;
  passwordHash: string;
  role: 'MODERATOR' | 'MEMBER';
  dateOfBirth?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  className?: string | null;
}

export interface UpdateUserData {
  fullName?: string;
  role?: 'MODERATOR' | 'MEMBER';
  active?: boolean;
  telegramChatId?: string | null;
  dateOfBirth?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  className?: string | null;
  note?: string | null;
}

export interface UserRepository {
  create(data: CreateUserData): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByQrToken(qrToken: string): Promise<User | null>;
  list(filter?: { activeOnly?: boolean }): Promise<User[]>;
  update(id: string, data: UpdateUserData): Promise<User>;
  setPassword(id: string, passwordHash: string, mustChangePassword: boolean): Promise<void>;
  /** Atomically adjust the denormalized totalPoints cache by a signed delta. */
  incrementPoints(id: string, delta: number): Promise<User>;
  /** Every draw number currently held by somebody — the pool to pick a fresh one out of. */
  listTakenRaffleNumbers(): Promise<number[]>;
  /** Hands one member a draw number. Returns null if the number was claimed by a concurrent
   * assignment in the meantime, so the caller can pick again rather than fail the moderator. */
  assignRaffleNumber(id: string, raffleNumber: number): Promise<User | null>;
  /** Clears everyone's draw number at once; resolves to how many were cleared. */
  clearAllRaffleNumbers(): Promise<number>;
}
