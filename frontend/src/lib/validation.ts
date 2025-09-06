import { z } from 'zod';

// User ID validation
export const UserIdSchema = z.enum(['A', 'B']);

// Money validation - string with exactly 2 decimal places
export const MoneySchema = z
  .string()
  .regex(/^\d+\.\d{2}$/, 'Amount must be a string with exactly 2 decimal places');

// Category validation
export const CategorySchema = z.enum(['food', 'groceries', 'transport', 'entertainment', 'other']);

// Transaction input validation
export const CreateTransactionSchema = z.object({
  payerId: UserIdSchema,
  amount: MoneySchema,
  category: CategorySchema,
});

// Settlement input validation
export const SettlementSchema = z
  .object({
    fromUserId: UserIdSchema,
    toUserId: UserIdSchema,
    amount: MoneySchema,
  })
  .refine(data => data.fromUserId !== data.toUserId, {
    message: 'Cannot settle with yourself',
  });

// Type exports
export type CreateTransactionRequest = z.infer<typeof CreateTransactionSchema>;
export type SettlementRequest = z.infer<typeof SettlementSchema>;
export type UserId = z.infer<typeof UserIdSchema>;
export type Category = z.infer<typeof CategorySchema>;
