import { NextFunction, Response } from 'express';
import { requireAuth } from '../../src/interfaces/http/middleware/auth';
import { AuthTokenPayload, TokenService } from '../../src/application/ports/TokenService';
import { AccountDeactivatedError, UnauthorizedError } from '../../src/domain/errors/AppError';
import { FakeUserRepository } from '../application/fakes';

/** Returns a fixed payload on verify(), or throws like the real JwtTokenService does for a
 * missing/expired/tampered token. */
class FakeTokenService implements TokenService {
  constructor(private readonly payload: AuthTokenPayload | null = null) {}
  sign(): string {
    return 'token';
  }
  verify(): AuthTokenPayload {
    if (!this.payload) throw new UnauthorizedError('Invalid or expired token');
    return this.payload;
  }
}

/** Drives the middleware once and resolves with whatever it did: the (possibly mutated) request,
 * and the error passed to next(), if any. */
function run(
  middleware: ReturnType<typeof requireAuth>,
  authorization?: string,
): Promise<{ req: { auth?: { userId: string; role: string } }; error: unknown }> {
  return new Promise((resolve) => {
    const req = { headers: { authorization } } as unknown as { auth?: { userId: string; role: string } } & Parameters<
      ReturnType<typeof requireAuth>
    >[0];
    const next = ((err?: unknown) => resolve({ req, error: err })) as NextFunction;
    middleware(req, {} as Response, next);
  });
}

describe('requireAuth', () => {
  it('rejects a missing bearer header', async () => {
    const { error } = await run(requireAuth(new FakeTokenService(), new FakeUserRepository()));
    expect(error).toBeInstanceOf(UnauthorizedError);
  });

  it('rejects an invalid or expired token', async () => {
    const { error } = await run(requireAuth(new FakeTokenService(null), new FakeUserRepository()), 'Bearer bad');
    expect(error).toBeInstanceOf(UnauthorizedError);
  });

  it('lets a signed-in, active account through and populates req.auth', async () => {
    const users = new FakeUserRepository();
    const member = await users.create({ fullName: 'M', username: 'm', passwordHash: 'h', role: 'MEMBER' });
    const tokens = new FakeTokenService({ sub: member.id, role: 'MEMBER' });

    const { req, error } = await run(requireAuth(tokens, users), 'Bearer good');

    expect(error).toBeUndefined();
    expect(req.auth).toEqual({ userId: member.id, role: 'MEMBER' });
  });

  it('rejects a deactivated account even though its token is perfectly valid — the whole point', async () => {
    const users = new FakeUserRepository();
    const member = await users.create({ fullName: 'M', username: 'm', passwordHash: 'h', role: 'MEMBER' });
    await users.update(member.id, { active: false });
    const tokens = new FakeTokenService({ sub: member.id, role: 'MEMBER' });

    const { req, error } = await run(requireAuth(tokens, users), 'Bearer stillvalid');

    expect(error).toBeInstanceOf(AccountDeactivatedError);
    expect(req.auth).toBeUndefined();
  });

  it('rejects a token naming a user that no longer exists at all', async () => {
    const tokens = new FakeTokenService({ sub: 'ghost', role: 'MEMBER' });
    const { error } = await run(requireAuth(tokens, new FakeUserRepository()), 'Bearer good');
    expect(error).toBeInstanceOf(AccountDeactivatedError);
  });
});
