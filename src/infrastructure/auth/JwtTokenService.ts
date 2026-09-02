import jwt from 'jsonwebtoken';
import { TokenService, AuthTokenPayload } from '../../application/ports/TokenService';
import { UnauthorizedError } from '../../domain/errors/AppError';

export class JwtTokenService implements TokenService {
  constructor(private readonly secret: string, private readonly expiresIn: string) {}

  sign(payload: AuthTokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn } as jwt.SignOptions);
  }

  verify(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, this.secret) as unknown as AuthTokenPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}
