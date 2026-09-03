/** Base class for all expected/business errors. HTTP layer maps `status` straight through. */
export class AppError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Invalid credentials') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You are not allowed to do that') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * The account behind an otherwise validly-signed token has been deactivated since the token was
 * issued. requireAuth checks this on every authenticated request (not just at login), so a
 * moderator deactivating someone takes effect on that person's very next request rather than
 * waiting out the token's remaining lifetime (up to JWT_EXPIRES_IN, 12h by default). 401 rather
 * than 403: this isn't "you can't do this one thing", it's "this session is no longer valid at
 * all" — the same bucket the client treats an expired/invalid token as, so it clears the session
 * and returns to the login screen instead of showing an in-place error.
 */
export class AccountDeactivatedError extends AppError {
  constructor(message = 'This account has been deactivated') {
    super(message, 401, 'ACCOUNT_DEACTIVATED');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

/** A feature that depends on optional external setup (Telegram, Google) hasn't been configured yet. */
export class NotConfiguredError extends AppError {
  constructor(message: string) {
    super(message, 503, 'NOT_CONFIGURED');
  }
}
