/**
 * In-memory event store for transactions and ledger entries
 * 
 * Stores all transactions and their corresponding ledger entries
 * in memory arrays. Provides helper functions for querying and
 * maintaining data consistency.
 */


import {
  LedgerEntry,
  GroupExpenseInput,
  SettlementInput,
  UserId,

  Category,
} from '../lib/ledger';

export interface GroupExpense {
  id: string;
  type: 'GROUP';
  payerId: UserId;
  amount: number;
  category: Category;
  perUserShare: number;
  remainder: number;
  createdAt: string;
}

export interface Settlement {
  id: string;
  type: 'SETTLEMENT';
  fromUserId: UserId;
  toUserId: UserId;
  amount: number;
  createdAt: string;
}

export type Transaction = GroupExpense | Settlement;

/**
 * In-memory event store
 */
class EventStore {
  private transactions: Transaction[] = [];
  private ledgerEntries: LedgerEntry[] = [];
  private idempotencyMap = new Map<string, any>();

  /**
   * Add a group expense transaction
   */
  addGroupExpense(input: GroupExpenseInput, entries: LedgerEntry[]): GroupExpense {
    const otherUserShare = entries.find(e => e.account.includes('EXPENSE') && e.userId !== input.payerId)?.delta || 0;
    const transaction: GroupExpense = {
      id: entries[0]!.txId,
      type: 'GROUP',
      payerId: input.payerId,
      amount: Math.round(input.amount * 100) / 100,
      category: input.category,
      perUserShare: Math.round(otherUserShare * 100) / 100,
      remainder: Math.round((input.amount - otherUserShare * 2) * 100) / 100,
      createdAt: entries[0]!.createdAt,
    };

    this.transactions.push(transaction);
    this.ledgerEntries.push(...entries);

    return transaction;
  }

  /**
   * Add a settlement transaction
   */
  addSettlement(input: SettlementInput, entries: LedgerEntry[]): Settlement {
    const transaction: Settlement = {
      id: entries[0]!.txId,
      type: 'SETTLEMENT',
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      amount: Math.round(input.amount * 100) / 100,
      createdAt: entries[0]!.createdAt,
    };

    this.transactions.push(transaction);
    this.ledgerEntries.push(...entries);

    return transaction;
  }

  /**
   * List all transactions
   */
  listTransactions(): Transaction[] {
    return [...this.transactions].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  /**
   * Get all ledger entries
   */
  getLedgerEntries(): LedgerEntry[] {
    return [...this.ledgerEntries];
  }

  /**
   * Store idempotency response
   */
  storeIdempotencyResponse(key: string, response: any): void {
    this.idempotencyMap.set(key, response);
  }

  /**
   * Get idempotency response
   */
  getIdempotencyResponse(key: string): any | undefined {
    return this.idempotencyMap.get(key);
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.transactions = [];
    this.ledgerEntries = [];
    this.idempotencyMap.clear();
  }

  /**
   * Add initial ledger entries (for seeding)
   */
  addInitialEntries(entries: LedgerEntry[]): void {
    this.ledgerEntries.push(...entries);
  }

  /**
   * Get transaction by ID
   */
  getTransaction(id: string): Transaction | undefined {
    return this.transactions.find(t => t.id === id);
  }

  /**
   * Get ledger entries for a transaction
   */
  getLedgerEntriesForTransaction(txId: string): LedgerEntry[] {
    return this.ledgerEntries.filter(e => e.txId === txId);
  }
}

// Export singleton instance
export const eventStore = new EventStore();
