/**
 * Projection services for computing user summaries from ledger entries
 * 
 * Pure functions that compute wallet balances, budget summaries,
 * and net due amounts from the ledger entries.
 */

import { LedgerEntry, UserId, Category } from '../lib/ledger';

/**
 * Round money values to 2 decimal places to ensure consistent formatting
 */
function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface UserSummary {
  userId: UserId;
  walletBalance: number;
  budgetByCategory: Record<Category, number>;
}

export interface NetDue {
  owes: UserId | null;
  amount: number;
}

/**
 * Compute wallet balance for a user
 * 
 * Wallet balance = sum of all CASH deltas for the user
 */
export function computeWalletBalance(userId: UserId, entries: LedgerEntry[]): number {
  return roundTo2Decimals(
    entries
      .filter(entry => entry.account === `CASH:${userId}`)
      .reduce((sum, entry) => sum + entry.delta, 0)
  );
}

/**
 * Compute budget by category for a user
 * 
 * Budget = sum of all EXPENSE deltas for the user by category
 */
export function computeBudgetByCategory(userId: UserId, entries: LedgerEntry[]): Record<Category, number> {
  const budget: Record<Category, number> = {
    food: 0,
    groceries: 0,
    transport: 0,
    entertainment: 0,
    other: 0,
  };

  entries
    .filter(entry => entry.account.startsWith(`EXPENSE:${userId}:`))
    .forEach(entry => {
      const category = entry.account.split(':')[2] as Category;
      if (category && budget.hasOwnProperty(category)) {
        budget[category] += entry.delta;
      }
    });

  // Round all budget values to 2 decimal places
  Object.keys(budget).forEach(category => {
    budget[category as Category] = roundTo2Decimals(budget[category as Category]);
  });

  return budget;
}

/**
 * Compute net due between users
 * 
 * Returns who owes whom and how much based on DUE_FROM/DUE_TO balances
 * 
 * The net due is calculated as: (A's receivable from B) - (B's receivable from A)
 * If positive: B owes A
 * If negative: A owes B
 */
export function computeNetDue(entries: LedgerEntry[]): NetDue {
  // Calculate A's receivable from B (DUE_FROM:A->B)
  const dueFromAToB = entries
    .filter(entry => entry.account === 'DUE_FROM:A->B')
    .reduce((sum, entry) => sum + entry.delta, 0);

  // Calculate B's receivable from A (DUE_FROM:B->A)
  const dueFromBToA = entries
    .filter(entry => entry.account === 'DUE_FROM:B->A')
    .reduce((sum, entry) => sum + entry.delta, 0);

  // Net due = A's receivable - B's receivable
  // If positive: B owes A (A has a receivable from B)
  // If negative: A owes B (B has a receivable from A)
  const netDue = dueFromAToB - dueFromBToA;

  if (Math.abs(netDue) < 0.001) { // Increased tolerance for floating-point precision
    // Balanced
    return { owes: null, amount: 0 };
  } else if (netDue > 0) {
    // B owes A
    return { owes: 'B', amount: roundTo2Decimals(netDue) };
  } else {
    // A owes B
    return { owes: 'A', amount: roundTo2Decimals(Math.abs(netDue)) };
  }
}

/**
 * Compute user summary for a specific user
 */
export function computeUserSummary(userId: UserId, entries: LedgerEntry[]): UserSummary {
  return {
    userId,
    walletBalance: computeWalletBalance(userId, entries),
    budgetByCategory: computeBudgetByCategory(userId, entries),
  };
}

/**
 * Compute summaries for both users
 */
export function computeUserSummaries(entries: LedgerEntry[]): UserSummary[] {
  return [
    computeUserSummary('A', entries),
    computeUserSummary('B', entries),
  ];
}

/**
 * Get complete summary including user summaries and net due
 */
export function computeCompleteSummary(entries: LedgerEntry[]) {
  return {
    users: computeUserSummaries(entries),
    netDue: computeNetDue(entries),
  };
}
