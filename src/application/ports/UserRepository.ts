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
}
