import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../../../application/ports/TokenService';
import { Role } from '../../../domain/entities/User';
import { UnauthorizedError, ForbiddenError } from '../../../domain/errors/AppError';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; role: Role };
    }
  }
}

export function requireAuth(tokens: TokenService) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing bearer token');
    }
    const payload = tokens.verify(header.slice('Bearer '.length));
    req.auth = { userId: payload.sub, role: payload.role };
    next();
  };
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      throw new ForbiddenError('Moderator access required');
    }
    next();
  };
}
