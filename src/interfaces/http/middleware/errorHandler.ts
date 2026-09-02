import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../../domain/errors/AppError';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  console.error('[unhandled error]', err);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong' });
}

/** Wraps an async Express handler so thrown/rejected errors reach errorHandler. */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
