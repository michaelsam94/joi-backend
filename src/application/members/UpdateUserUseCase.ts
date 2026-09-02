import { UserRepository, UpdateUserData } from '../ports/UserRepository';
import { NotFoundError } from '../../domain/errors/AppError';
import { User } from '../../domain/entities/User';

export class UpdateUserUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string, data: UpdateUserData): Promise<User> {
    const existing = await this.users.findById(userId);
    if (!existing) throw new NotFoundError('User not found');
    return this.users.update(userId, data);
  }
}
