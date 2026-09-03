import { UpdateUserUseCase } from '../../src/application/members/UpdateUserUseCase';
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/domain/errors/AppError';
import { FakeUserRepository } from './fakes';

/** A minimal PasswordHasher for these tests — no need to pull in the real bcrypt-cost hasher. */
class FakeHasher {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }
  async compare(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}

describe('UpdateUserUseCase', () => {
  it('refuses every kind of change to a protected account', async () => {
    const users = new FakeUserRepository();
    const admin = await users.create({
      fullName: 'Joi Admin',
      username: 'admin',
      passwordHash: 'h',
      role: 'MODERATOR',
    });
    // Simulate the seed script's protection flag directly, since FakeUserRepository.create()
    // mirrors CreateUserData and isProtected is never part of it — same as production.
    (await users.findById(admin.id))!.isProtected = true;

    const useCase = new UpdateUserUseCase(users, new FakeHasher());

    await expect(useCase.execute(admin.id, { active: false })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(useCase.execute(admin.id, { fullName: 'Renamed' })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(useCase.execute(admin.id, { role: 'MEMBER' })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      useCase.execute(admin.id, { temporaryPassword: 'NewPassword1' }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // None of it took effect.
    const after = await users.findById(admin.id);
    expect(after!.active).toBe(true);
    expect(after!.fullName).toBe('Joi Admin');
    expect(after!.role).toBe('MODERATOR');
    expect(after!.passwordHash).toBe('h');
  });

  it('lets an ordinary member be edited, deactivated, and password-reset as before', async () => {
    const users = new FakeUserRepository();
    const member = await users.create({
      fullName: 'Member',
      username: 'member',
      passwordHash: 'h',
      role: 'MEMBER',
    });
    const useCase = new UpdateUserUseCase(users, new FakeHasher());

    const deactivated = await useCase.execute(member.id, { active: false });
    expect(deactivated.active).toBe(false);

    const renamed = await useCase.execute(member.id, { fullName: 'New Name' });
    expect(renamed.fullName).toBe('New Name');

    const reset = await useCase.execute(member.id, { temporaryPassword: 'FreshPass1' });
    expect(reset.mustChangePassword).toBe(true);
    expect((await users.findById(member.id))!.passwordHash).toBe('hashed:FreshPass1');
  });

  it('still rejects a too-short reset password for a non-protected account', async () => {
    const users = new FakeUserRepository();
    const member = await users.create({
      fullName: 'Member',
      username: 'member',
      passwordHash: 'h',
      role: 'MEMBER',
    });
    const useCase = new UpdateUserUseCase(users, new FakeHasher());

    await expect(useCase.execute(member.id, { temporaryPassword: 'abc' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('404s on an unknown user before ever checking protection', async () => {
    const users = new FakeUserRepository();
    const useCase = new UpdateUserUseCase(users, new FakeHasher());
    await expect(useCase.execute('nope', { active: false })).rejects.toBeInstanceOf(NotFoundError);
  });
});
