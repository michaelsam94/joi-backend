import { UserRepository } from '../ports/UserRepository';
import { PasswordHasher } from '../ports/PasswordHasher';
import { TokenService } from '../ports/TokenService';
import { UnauthorizedError, ForbiddenError } from '../../domain/errors/AppError';

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginOutput {
  token: string;
  mustChangePassword: boolean;
  user: {
    id: string;
    fullName: string;
    role: 'MODERATOR' | 'MEMBER';
  };
}

export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.users.findByUsername(input.username);
    if (!user) throw new UnauthorizedError();
    if (!user.active) throw new ForbiddenError('This account has been deactivated');

    const ok = await this.hasher.compare(input.password, user.passwordHash);
    if (!ok) throw new UnauthorizedError();

    const token = this.tokens.sign({ sub: user.id, role: user.role });
    return {
      token,
      mustChangePassword: user.mustChangePassword,
      user: { id: user.id, fullName: user.fullName, role: user.role },
    };
  }
}
