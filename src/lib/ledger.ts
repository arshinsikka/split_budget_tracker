/**
 * Double-entry ledger engine
 *
 * Implements minimal double-entry accounting for tracking shared expenses
 * between two users. Ensures mathematical consistency through balanced
 * transactions and maintains clear separation between expenses and settlements.
 */

import { v4 as uuidv4 } from 'uuid';
import { validateAmount, splitEqually } from './money';

export type UserId = 'A' | 'B';
export type TransactionType = 'GROUP' | 'SETTLEMENT' | 'INITIAL';
export type Category =
  | 'food'
  | 'groceries'
  | 'transport'
  | 'entertainment'
  | 'other';

/**
 * Ledger entry representing a single account movement
 *
 * Each entry represents a debit or credit to a specific account.
 * All entries in a transaction must sum to zero (balanced).
 */
export interface LedgerEntry {
  id: string; // Unique entry identifier
  txType: TransactionType; // Type of parent transaction
  txId: string; // ID of parent transaction
  account: string; // Account name (e.g., "CASH:A", "EXPENSE:A:food")
  userId: UserId; // User associated with this entry
  category?: Category; // Expense category (for group expenses)
  delta: number; // Amount change (positive = credit, negative = debit)
  createdAt: string; // ISO timestamp
}

/**
 * Input for creating a group expense transaction
 */
export interface GroupExpenseInput {
  payerId: UserId;
  amount: number;
  category: Category;
}

/**
 * Input for creating a settlement transaction
 */
export interface SettlementInput {
  fromUserId: UserId;
  toUserId: UserId;
  amount: number;
}

/**
 * Account name constants for consistency
 */
export const ACCOUNTS = {
  CASH: (userId: UserId) => `CASH:${userId}`,
  EXPENSE: (userId: UserId, category: Category) =>
    `EXPENSE:${userId}:${category}`,
  DUE_FROM: (from: UserId, to: UserId) => `DUE_FROM:${from}->${to}`,
  DUE_TO: (from: UserId, to: UserId) => `DUE_TO:${from}->${to}`,
} as const;

/**
 * Create ledger entries for a group expense transaction
 *
 * Posts the following entries:
 * - Debit payer's cash account (they paid the expense)
 * - Credit both users' expense accounts (they both owe their share)
 * - Credit payer's receivable from other user (other user owes them)
 * - Debit other user's payable to payer (they owe the payer)
 *
 * Uses banker's rounding for equal splits. Any remainder cent is assigned
 * to the payer's receivable to ensure the transaction balances.
 *
 * @param input - Group expense details
 * @returns Array of balanced ledger entries
 *
 * @example
 * postGroupExpense({ payerId: "A", amount: 100.00, category: "food" })
 * // Creates entries:
 * // - CASH:A: -100.00 (A paid)
 * // - EXPENSE:A:food: +50.00 (A's share)
 * // - EXPENSE:B:food: +50.00 (B's share)
 * // - DUE_FROM:A->B: +50.00 (B owes A)
 * // - DUE_TO:B->A: -50.00 (B's liability)
 */
export function postGroupExpense(input: GroupExpenseInput): LedgerEntry[] {
  const { payerId, amount, category } = input;

  // Validate inputs
  validateAmount(amount);

  // Determine the other user
  const otherUserId: UserId = payerId === 'A' ? 'B' : 'A';

  // Use the money module's splitEqually function for consistent banker's rounding
  const split = splitEqually(amount);
  
  // Create transaction ID
  const txId = uuidv4();
  const createdAt = new Date().toISOString();

  const entries: LedgerEntry[] = [];

  // 1. Debit payer's cash (they paid the expense)
  entries.push({
    id: uuidv4(),
    txType: 'GROUP',
    txId,
    account: ACCOUNTS.CASH(payerId),
    userId: payerId,
    delta: -amount, // Negative: cash goes out
    createdAt,
  });

  // 2. Credit both users' expense accounts (split evenly)
  entries.push({
    id: uuidv4(),
    txType: 'GROUP',
    txId,
    account: ACCOUNTS.EXPENSE(payerId, category),
    userId: payerId,
    category,
    delta: split.perUserShare, // Positive: expense increases
    createdAt,
  });

  entries.push({
    id: uuidv4(),
    txType: 'GROUP',
    txId,
    account: ACCOUNTS.EXPENSE(otherUserId, category),
    userId: otherUserId,
    category,
    delta: split.perUserShare, // Positive: expense increases
    createdAt,
  });

  // 3. Credit payer's receivable (other user owes their half + remainder)
  const receivableAmount = split.perUserShare + split.remainder;
  entries.push({
    id: uuidv4(),
    txType: 'GROUP',
    txId,
    account: ACCOUNTS.DUE_FROM(payerId, otherUserId),
    userId: payerId,
    delta: receivableAmount, // Positive: asset increases
    createdAt,
  });

  // 4. Debit other user's payable
  entries.push({
    id: uuidv4(),
    txType: 'GROUP',
    txId,
    account: ACCOUNTS.DUE_TO(otherUserId, payerId),
    userId: otherUserId,
    delta: -receivableAmount, // Negative: liability increases
    createdAt,
  });

  // Verify transaction is balanced
  const totalDelta = entries.reduce((sum, entry) => sum + entry.delta, 0);
  if (Math.abs(totalDelta) > 0.001) { // Increased tolerance for floating-point precision
    throw new Error(
      `Transaction not balanced: total delta = ${totalDelta}`
    );
  }

  return entries;
}

/**
 * Create ledger entries for a settlement transaction
 *
 * Posts the following entries:
 * - Debit payer's cash (they paid the settlement)
 * - Credit payee's cash (they received the settlement)
 * - Debit payee's receivable from payer (reduces what they're owed)
 * - Credit payer's payable to payee (reduces what they owe)
 *
 * Note: Settlements never affect expense accounts - they only move cash
 * and adjust inter-user balances.
 *
 * @param input - Settlement details
 * @returns Array of balanced ledger entries
 *
 * @example
 * postSettlement({ fromUserId: "B", toUserId: "A", amount: 30.00 })
 * // Creates entries:
 * // - CASH:B: -30.00 (B paid)
 * // - CASH:A: +30.00 (A received)
 * // - DUE_FROM:A->B: -30.00 (A's receivable decreases)
 * // - DUE_TO:B->A: +30.00 (B's liability decreases)
 */
export function postSettlement(input: SettlementInput): LedgerEntry[] {
  const { fromUserId, toUserId, amount } = input;

  // Validate inputs
  validateAmount(amount);

  if (fromUserId === toUserId) {
    throw new Error('Cannot settle with yourself');
  }

  // Create transaction ID
  const txId = uuidv4();
  const createdAt = new Date().toISOString();

  const entries: LedgerEntry[] = [];

  // 1. Debit payer's cash (they paid the settlement)
  entries.push({
    id: uuidv4(),
    txType: 'SETTLEMENT',
    txId,
    account: ACCOUNTS.CASH(fromUserId),
    userId: fromUserId,
    delta: -amount, // Negative: cash goes out
    createdAt,
  });

  // 2. Credit payee's cash (they received the settlement)
  entries.push({
    id: uuidv4(),
    txType: 'SETTLEMENT',
    txId,
    account: ACCOUNTS.CASH(toUserId),
    userId: toUserId,
    delta: amount, // Positive: cash comes in
    createdAt,
  });

  // 3. Debit payee's receivable from payer (reduces what they're owed)
  entries.push({
    id: uuidv4(),
    txType: 'SETTLEMENT',
    txId,
    account: ACCOUNTS.DUE_FROM(toUserId, fromUserId),
    userId: toUserId,
    delta: -amount, // Negative: asset decreases
    createdAt,
  });

  // 4. Credit payer's payable to payee (reduces what they owe)
  entries.push({
    id: uuidv4(),
    txType: 'SETTLEMENT',
    txId,
    account: ACCOUNTS.DUE_TO(fromUserId, toUserId),
    userId: fromUserId,
    delta: amount, // Positive: liability decreases
    createdAt,
  });

  // Verify transaction is balanced
  const totalDelta = entries.reduce((sum, entry) => sum + entry.delta, 0);
  if (Math.abs(totalDelta) > 0.001) { // Increased tolerance for floating-point precision
    throw new Error(
      `Transaction not balanced: total delta = ${totalDelta}`
    );
  }

  return entries;
}

/**
 * Validate that a set of ledger entries maintains invariants
 *
 * Checks:
 * 1. Transaction is balanced (sum of deltas = 0)
 * 2. DUE_FROM and DUE_TO accounts are mirrored correctly
 *
 * @param entries - Array of ledger entries to validate
 * @returns true if valid, throws error if invalid
 */
export function validateLedgerEntries(entries: LedgerEntry[]): boolean {
  // Check balance
  const totalDelta = entries.reduce((sum, entry) => sum + entry.delta, 0);
  if (Math.abs(totalDelta) > 0.001) { // Increased tolerance for floating-point precision
    throw new Error(
      `Transaction not balanced: total delta = ${totalDelta}`
    );
  }

  // Check that DUE_FROM and DUE_TO entries are properly paired
  const dueFromEntries = entries.filter((e) =>
    e.account.startsWith('DUE_FROM')
  );
  const dueToEntries = entries.filter((e) => e.account.startsWith('DUE_TO'));

  for (const fromEntry of dueFromEntries) {
    // Extract users from DUE_FROM:A->B
    const match = fromEntry.account.match(/DUE_FROM:([AB])->([AB])/);
    if (!match) continue;

    const [, fromUser, toUser] = match;
    const correspondingToAccount = `DUE_TO:${toUser}->${fromUser}`;

    const toEntry = dueToEntries.find(
      (e) => e.account === correspondingToAccount
    );
    if (!toEntry) {
      throw new Error(
        `Missing corresponding DUE_TO entry for ${fromEntry.account}`
      );
    }

    // Check that they sum to zero (mirrored)
    if (Math.abs(fromEntry.delta + toEntry.delta) > 0.01) {
      throw new Error(
        `DUE_FROM and DUE_TO entries not mirrored: ${fromEntry.delta} + ${toEntry.delta}`
      );
    }
  }

  return true;
}
