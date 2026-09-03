import { UserRepository, UpdateUserData } from '../ports/UserRepository';
import { PasswordHasher } from '../ports/PasswordHasher';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/errors/AppError';
import { User } from '../../domain/entities/User';

export interface UpdateUserInput extends UpdateUserData {
  /** Moderator-set reset password — people forget theirs. Setting this hashes it and forces the
   * member to change it on their next login, exactly like a brand-new registration. */
  temporaryPassword?: string;
}

export class UpdateUserUseCase {
  constructor(private readonly users: UserRepository, private readonly hasher: PasswordHasher) {}

  async execute(userId: string, data: UpdateUserInput): Promise<User> {
    const existing = await this.users.findById(userId);
    if (!existing) throw new NotFoundError('User not found');

    // A protected account (the seeded first moderator — see db/seed.ts) can't be touched through
    // this path at all: not deactivated, not reset, not edited. They still change their own
    // password themselves via the ordinary self-service /auth/change-password — this only blocks
    // another moderator acting on them.
    if (existing.isProtected) {
      throw new ForbiddenError('This account is protected and cannot be changed');
    }

    const { temporaryPassword, ...profileData } = data;
    let user = await this.users.update(userId, profileData);

    if (temporaryPassword) {
      if (temporaryPassword.length < 6) {
        throw new ValidationError('Temporary password must be at least 6 characters');
      }
      const passwordHash = await this.hasher.hash(temporaryPassword);
      await this.users.setPassword(userId, passwordHash, true);
      user = { ...user, mustChangePassword: true };
    }

    return user;
  }
}
