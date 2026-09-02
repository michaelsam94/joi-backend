import { UserRepository } from '../ports/UserRepository';
import { PasswordHasher } from '../ports/PasswordHasher';
import { NotFoundError, ValidationError } from '../../domain/errors/AppError';

export interface ChangePasswordInput {
  userId: string;
  newPassword: string;
}

export class ChangePasswordUseCase {
  constructor(private readonly users: UserRepository, private readonly hasher: PasswordHasher) {}

  async execute(input: ChangePasswordInput): Promise<void> {
    if (input.newPassword.length < 6) {
      throw new ValidationError('Password must be at least 6 characters');
    }
    const user = await this.users.findById(input.userId);
    if (!user) throw new NotFoundError('User not found');

    const hash = await this.hasher.hash(input.newPassword);
    await this.users.setPassword(user.id, hash, false);
  }
}
