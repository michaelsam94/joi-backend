import { Role } from '../../domain/entities/User';

export interface AuthTokenPayload {
  sub: string;
  role: Role;
}

export interface TokenService {
  sign(payload: AuthTokenPayload): string;
  verify(token: string): AuthTokenPayload;
}
