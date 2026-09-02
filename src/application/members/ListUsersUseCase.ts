import { UserRepository } from '../ports/UserRepository';
import { User } from '../../domain/entities/User';

export class ListUsersUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(filter?: { activeOnly?: boolean }): Promise<User[]> {
    return this.users.list(filter);
  }
}
