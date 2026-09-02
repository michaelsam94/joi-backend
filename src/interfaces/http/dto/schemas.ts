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
