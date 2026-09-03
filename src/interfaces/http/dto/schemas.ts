import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  newPassword: z.string().min(6),
});

const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateOfBirth must be YYYY-MM-DD')
  .nullable()
  .optional();

export const registerUserSchema = z.object({
  fullName: z.string().min(1),
  username: z.string().min(3),
  temporaryPassword: z.string().min(6),
  role: z.enum(['MODERATOR', 'MEMBER']).optional(),
  dateOfBirth: dateOfBirthSchema,
  phoneNumber: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  className: z.string().nullable().optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  role: z.enum(['MODERATOR', 'MEMBER']).optional(),
  active: z.boolean().optional(),
  telegramChatId: z.string().nullable().optional(),
  dateOfBirth: dateOfBirthSchema,
  phoneNumber: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  className: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  /** Set by a moderator to reset a member's forgotten password — see UpdateUserUseCase. */
  temporaryPassword: z.string().min(6).optional(),
});

export const checkInSchema = z.object({
  qrToken: z.string().min(1),
  meetingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const assignRaffleNumberSchema = z.object({
  userId: z.string().min(1),
});

export const adjustPointsSchema = z.object({
  userId: z.string().min(1),
  points: z.number().int().refine((v) => v !== 0, 'points cannot be 0'),
  reason: z.string().min(1),
});

export const createPrizeSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  pointsCost: z.number().int().positive(),
  imageUrl: z.string().url().nullable().optional(),
  /** Starting stock. Omitted/null = unlimited. */
  quantity: z.number().int().nonnegative().nullable().optional(),
});

export const updatePrizeSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  pointsCost: z.number().int().positive().optional(),
  imageUrl: z.string().url().nullable().optional(),
  active: z.boolean().optional(),
  quantity: z.number().int().nonnegative().nullable().optional(),
});

export const redeemPrizeSchema = z.object({
  userId: z.string().min(1),
});

const eventDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'eventDate must be YYYY-MM-DD');
const eventTimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'eventTime must be HH:MM')
  .nullable()
  .optional();

/**
 * The clearable form of an optional field, for PATCH bodies.
 *
 * The Android client serializes with `explicitNulls = false`, which drops null properties from the
 * request body entirely — so a member of the team clearing an event's start time or poster would
 * otherwise send nothing at all and the old value would survive. An empty string is the wire
 * signal for "remove this", normalized to null here so the repository writes a real NULL.
 */
const clearable = <T extends z.ZodType>(schema: T) =>
  z
    .union([z.literal(''), schema])
    .nullable()
    .optional()
    .transform((value) => (value === '' ? null : value));

export const createEventSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  /** Price per person. 0 = a free event. */
  price: z.number().nonnegative(),
  eventDate: eventDateSchema,
  eventTime: eventTimeSchema,
  imageUrl: z.string().url().nullable().optional(),
});

export const updateEventSchema = z.object({
  name: z.string().min(1).optional(),
  description: clearable(z.string()),
  location: clearable(z.string()),
  price: z.number().nonnegative().optional(),
  eventDate: eventDateSchema.optional(),
  eventTime: clearable(z.string().regex(/^\d{2}:\d{2}$/, 'eventTime must be HH:MM')),
  imageUrl: clearable(z.string().url()),
  active: z.boolean().optional(),
});

/** One installment. Negative amounts are allowed on purpose — that's how a refund or a
 * correction is recorded without deleting history. */
export const recordEventPaymentSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().refine((v) => v !== 0, 'amount cannot be 0'),
  note: z.string().nullable().optional(),
});

export const updateEventPaymentSchema = z.object({
  amount: z
    .number()
    .refine((v) => v !== 0, 'amount cannot be 0')
    .optional(),
  note: z.string().nullable().optional(),
});

/** Sets a member's running total for an event outright, instead of editing one installment. */
export const setMemberEventTotalSchema = z.object({
  total: z.number().nonnegative(),
});
