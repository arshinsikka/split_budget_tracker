/**
 * Zod validation schemas for API requests
 * 
 * Defines validation rules for request bodies, headers,
 * and query parameters to ensure data integrity.
 */

import { z } from 'zod';

/**
 * Money amount validation
 * Must be positive and have exactly 2 decimal places
 */
export const MoneySchema = z
  .string()
  .regex(/^\d+\.\d{2}$/, 'Amount must be a string with exactly 2 decimal places')
  .refine((val) => {
    const num = parseFloat(val);
    return num > 0 && num <= 1000000;
  }, 'Amount must be positive and less than 1,000,000');

/**
 * Category validation
 */
export const CategorySchema = z.enum(['food', 'groceries', 'transport', 'entertainment', 'other']);

/**
 * User ID validation
 */
export const UserIdSchema = z.enum(['A', 'B']);

/**
 * Group expense input validation
 */
export const GroupExpenseInputSchema = z.object({
  payerId: UserIdSchema,
  amount: MoneySchema,
  category: CategorySchema,
});

/**
 * Settlement input validation
 */
export const SettlementInputSchema = z.object({
  fromUserId: UserIdSchema,
  toUserId: UserIdSchema,
  amount: MoneySchema,
}).refine((data) => data.fromUserId !== data.toUserId, {
  message: 'Cannot settle with yourself',
  path: ['fromUserId'],
});

/**
 * Idempotency key header validation
 */
export const IdempotencyKeySchema = z
  .string()
  .min(1, 'Idempotency key cannot be empty')
  .max(255, 'Idempotency key too long')
  .optional();

/**
 * Query parameters for user summary
 */
export const UserSummaryQuerySchema = z.object({
  userId: UserIdSchema.optional(),
});

/**
 * Type exports for use in routes
 */
export type GroupExpenseInput = z.infer<typeof GroupExpenseInputSchema>;
export type SettlementInput = z.infer<typeof SettlementInputSchema>;
export type Money = z.infer<typeof MoneySchema>;
export type Category = z.infer<typeof CategorySchema>;
export type UserId = z.infer<typeof UserIdSchema>;
