import { registerUserSchema, updateUserSchema } from '../../src/interfaces/http/dto/schemas';

/**
 * The mobile app's edit-member form sends every field on every save, including an explicit
 * `null` for temporaryPassword when the moderator left it blank (see
 * UpdateMemberProfileRequestDto — unlike the event forms, it uses `encodeDefaults = true` rather
 * than omitting unset fields). updateUserSchema has to accept that null the same as omission —
 * it used to reject it outright with "Invalid input: expected string, received null", which made
 * every edit-member save with a blank password field fail.
 */
describe('updateUserSchema', () => {
  it('accepts an explicit null temporaryPassword the same as it being absent', () => {
    const withNull = updateUserSchema.safeParse({ fullName: 'Renamed', temporaryPassword: null });
    expect(withNull.success).toBe(true);
    if (withNull.success) expect(withNull.data.temporaryPassword ?? null).toBeNull();

    const omitted = updateUserSchema.safeParse({ fullName: 'Renamed' });
    expect(omitted.success).toBe(true);
    if (omitted.success) expect(omitted.data.temporaryPassword).toBeUndefined();
  });

  it('still validates a real reset password', () => {
    expect(updateUserSchema.safeParse({ temporaryPassword: 'FreshPass1' }).success).toBe(true);
    expect(updateUserSchema.safeParse({ temporaryPassword: 'short' }).success).toBe(false);
  });
});

describe('registerUserSchema', () => {
  it('still requires temporaryPassword on create — only the edit form made it optional', () => {
    expect(
      registerUserSchema.safeParse({ fullName: 'New Member', username: 'newmember' }).success,
    ).toBe(false);
    expect(
      registerUserSchema.safeParse({
        fullName: 'New Member',
        username: 'newmember',
        temporaryPassword: 'StartPass1',
      }).success,
    ).toBe(true);
  });
});
