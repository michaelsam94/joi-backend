import { UserRepository } from '../ports/UserRepository';
import { PasswordHasher } from '../ports/PasswordHasher';
import { ConflictError, ValidationError } from '../../domain/errors/AppError';
import { User } from '../../domain/entities/User';

export interface RegisterUserInput {
  fullName: string;
  username: string;
  temporaryPassword: string;
  role?: 'MODERATOR' | 'MEMBER';
  dateOfBirth?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  className?: string | null;
}

/**
 * Moderator-only: registers a new person. A username/password is set as a
 * one-time temporary credential — mustChangePassword is always true, so the
 * person is forced to pick their own password the first time they log in.
 * A QR token is generated automatically by the repository/DB default.
 */
export class RegisterUserUseCase {
  constructor(private readonly users: UserRepository, private readonly hasher: PasswordHasher) {}

  async execute(input: RegisterUserInput): Promise<User> {
    if (!input.fullName.trim()) throw new ValidationError('Full name is required');
    if (!input.username.trim()) throw new ValidationError('Username is required');
    if (input.temporaryPassword.length < 6) {
      throw new ValidationError('Temporary password must be at least 6 characters');
    }

    const existing = await this.users.findByUsername(input.username);
    if (existing) throw new ConflictError('That username is already taken');

    const passwordHash = await this.hasher.hash(input.temporaryPassword);
    return this.users.create({
      fullName: input.fullName.trim(),
      username: input.username.trim(),
      passwordHash,
      role: input.role ?? 'MEMBER',
      dateOfBirth: input.dateOfBirth ?? null,
      phoneNumber: input.phoneNumber ?? null,
      address: input.address ?? null,
      className: input.className ?? null,
    });
  }
}
