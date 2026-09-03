import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../../../application/ports/TokenService';
import { UserRepository } from '../../../application/ports/UserRepository';
import { Role } from '../../../domain/entities/User';
import { AccountDeactivatedError, UnauthorizedError, ForbiddenError } from '../../../domain/errors/AppError';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; role: Role };
    }
  }
}

/**
 * Verifies the bearer token, then re-checks the account it names is still active — a signature
 * that still checks out isn't enough on its own, since the token itself has no way to know it's
 * been deactivated since it was issued. That DB lookup on every request is what makes a
 * deactivation take effect immediately instead of waiting out the token's remaining lifetime.
 */
export function requireAuth(tokens: TokenService, users: UserRepository) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      next(new UnauthorizedError('Missing bearer token'));
      return;
    }

    let payload;
    try {
      payload = tokens.verify(header.slice('Bearer '.length));
    } catch (err) {
      next(err);
      return;
    }

    users
      .findById(payload.sub)
      .then((user) => {
        if (!user || !user.active) {
          next(new AccountDeactivatedError());
          return;
        }
        req.auth = { userId: payload.sub, role: payload.role };
        next();
      })
      .catch(next);
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
