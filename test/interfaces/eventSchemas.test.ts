import { updateEventSchema, createEventSchema } from '../../src/interfaces/http/dto/schemas';

/**
 * The Android client serializes with `explicitNulls = false`, so it cannot send `null` to clear a
 * field — it sends `''` instead. These lock in that an empty string means "remove this" while an
 * absent key still means "leave it alone".
 */
describe('updateEventSchema', () => {
  it('treats an empty string as "clear this field"', () => {
    const parsed = updateEventSchema.parse({ eventTime: '', imageUrl: '', location: '', description: '' });
    expect(parsed).toMatchObject({ eventTime: null, imageUrl: null, location: null, description: null });
  });

  it('leaves an absent field alone rather than clearing it', () => {
    const parsed = updateEventSchema.parse({ name: 'Renamed' });
    expect(parsed.name).toBe('Renamed');
    expect(parsed.eventTime ?? undefined).toBeUndefined();
    expect(parsed.imageUrl ?? undefined).toBeUndefined();
  });

  it('still validates a real value', () => {
    expect(updateEventSchema.parse({ eventTime: '18:30' }).eventTime).toBe('18:30');
    expect(updateEventSchema.safeParse({ eventTime: '6pm' }).success).toBe(false);
    expect(updateEventSchema.safeParse({ imageUrl: 'not-a-url' }).success).toBe(false);
    expect(updateEventSchema.safeParse({ price: -1 }).success).toBe(false);
    expect(updateEventSchema.safeParse({ eventDate: '01-07-2026' }).success).toBe(false);
  });
});

describe('createEventSchema', () => {
  it('accepts the minimum a moderator has to type, and rejects a missing date', () => {
    expect(createEventSchema.safeParse({ name: 'Trip', price: 0, eventDate: '2026-07-01' }).success).toBe(true);
    expect(createEventSchema.safeParse({ name: 'Trip', price: 0 }).success).toBe(false);
  });
});
