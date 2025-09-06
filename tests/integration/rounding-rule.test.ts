/**
 * Rounding rule integration tests
 *
 * Tests the complete flow from group expense creation to final settlement
 * to verify the rounding rule is correctly applied throughout the system.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { eventStore } from '../../src/repo/eventStore';
import { postGroupExpense, postSettlement } from '../../src/lib/ledger';
import { computeCompleteSummary, computeUserSummaryCents } from '../../src/services/projections';

describe('Rounding Rule Integration Tests', () => {
  beforeEach(() => {
    // Reset event store before each test
    eventStore.clear();

    // Initialize with demo data (A: $500, B: $500)
    eventStore.addInitialEntries([
      {
        id: 'init-a',
        txType: 'INIT',
        txId: 'init',
        account: 'CASH:A',
        userId: 'A',
        delta: 500,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'init-b',
        txType: 'INIT',
        txId: 'init',
        account: 'CASH:B',
        userId: 'B',
        delta: 500,
        createdAt: new Date().toISOString(),
      },
    ]);
  });

  describe('Rounding Rule: Payer gets extra cent', () => {
    it('should handle $20.00 + $20.01 scenario correctly', () => {
      // A pays $20.00 for food
      const expense1 = postGroupExpense({
        payerId: 'A',
        amount: 20.0,
        category: 'food',
      });
      eventStore.addInitialEntries(expense1);

      // A pays $20.01 for groceries
      const expense2 = postGroupExpense({
        payerId: 'A',
        amount: 20.01,
        category: 'groceries',
      });
      eventStore.addInitialEntries(expense2);

      const summary = computeCompleteSummary(eventStore.getLedgerEntries());

      // Verify wallets: A should have paid $40.01 total
      expect(summary.users.find(u => u.userId === 'A')?.walletBalance).toBe(459.99); // 500 - 40.01
      expect(summary.users.find(u => u.userId === 'B')?.walletBalance).toBe(500); // B hasn't paid anything

      // Verify spend: A gets extra cent for $20.01 split
      const userA = summary.users.find(u => u.userId === 'A');
      expect(userA?.budgetByCategory.food).toBe(10.0); // $20.00 split evenly
      expect(userA?.budgetByCategory.groceries).toBe(10.01); // $20.01 split: A gets extra cent

      const userB = summary.users.find(u => u.userId === 'B');
      expect(userB?.budgetByCategory.food).toBe(10.0); // $20.00 split evenly
      expect(userB?.budgetByCategory.groceries).toBe(10.0); // $20.01 split: B gets $10.00

      // Verify net debt: B owes A $20.00 total
      expect(summary.netDue.owes).toBe('B');
      expect(summary.netDue.amount).toBe(20.0);
    });

    it('should handle settlement correctly', () => {
      // Setup: A pays $20.00 + $20.01
      const expense1 = postGroupExpense({
        payerId: 'A',
        amount: 20.0,
        category: 'food',
      });
      eventStore.addInitialEntries(expense1);

      const expense2 = postGroupExpense({
        payerId: 'A',
        amount: 20.01,
        category: 'groceries',
      });
      eventStore.addInitialEntries(expense2);

      // B settles $20.00 to A
      const settlement = postSettlement({
        fromUserId: 'B',
        toUserId: 'A',
        amount: 20.0,
      });
      eventStore.addInitialEntries(settlement);

      const summary = computeCompleteSummary(eventStore.getLedgerEntries());

      // Verify wallets after settlement
      expect(summary.users.find(u => u.userId === 'A')?.walletBalance).toBe(479.99); // 500 - 40.01 + 20.00
      expect(summary.users.find(u => u.userId === 'B')?.walletBalance).toBe(480.0); // 500 - 20.00

      // Verify spend unchanged (settlements don't affect budgets)
      const userA = summary.users.find(u => u.userId === 'A');
      expect(userA?.budgetByCategory.food).toBe(10.0);
      expect(userA?.budgetByCategory.groceries).toBe(10.01);

      const userB = summary.users.find(u => u.userId === 'B');
      expect(userB?.budgetByCategory.food).toBe(10.0);
      expect(userB?.budgetByCategory.groceries).toBe(10.0);

      // Verify net debt: B still owes A $0.00 (settled)
      expect(summary.netDue.owes).toBe(null);
      expect(summary.netDue.amount).toBe(0);
    });

    it('should return correct integer cents format', () => {
      // Setup: A pays $20.00 + $20.01
      const expense1 = postGroupExpense({
        payerId: 'A',
        amount: 20.0,
        category: 'food',
      });
      eventStore.addInitialEntries(expense1);

      const expense2 = postGroupExpense({
        payerId: 'A',
        amount: 20.01,
        category: 'groceries',
      });
      eventStore.addInitialEntries(expense2);

      const userASummary = computeUserSummaryCents('A', eventStore.getLedgerEntries());
      const userBSummary = computeUserSummaryCents('B', eventStore.getLedgerEntries());

      // Verify A's summary in cents
      expect(userASummary.wallet.balanceCents).toBe(45999); // $459.99
      expect(userASummary.spendByCategory.find(c => c.name === 'Food')?.spentCents).toBe(1000); // $10.00
      expect(userASummary.spendByCategory.find(c => c.name === 'Groceries')?.spentCents).toBe(1001); // $10.01
      expect(userASummary.netBetweenUsersCents.owes).toBe(0); // A doesn't owe
      expect(userASummary.netBetweenUsersCents.isOwed).toBe(2000); // A is owed $20.00

      // Verify B's summary in cents
      expect(userBSummary.wallet.balanceCents).toBe(50000); // $500.00
      expect(userBSummary.spendByCategory.find(c => c.name === 'Food')?.spentCents).toBe(1000); // $10.00
      expect(userBSummary.spendByCategory.find(c => c.name === 'Groceries')?.spentCents).toBe(1000); // $10.00
      expect(userBSummary.netBetweenUsersCents.owes).toBe(2000); // B owes $20.00
      expect(userBSummary.netBetweenUsersCents.isOwed).toBe(0); // B is not owed
    });
  });

  describe('Edge Cases', () => {
    it('should handle $0.01 split correctly', () => {
      const expense = postGroupExpense({
        payerId: 'A',
        amount: 0.01,
        category: 'food',
      });
      eventStore.addInitialEntries(expense);

      const summary = computeCompleteSummary(eventStore.getLedgerEntries());

      // A should get the full cent, B gets nothing
      expect(summary.users.find(u => u.userId === 'A')?.budgetByCategory.food).toBe(0.01);
      expect(summary.users.find(u => u.userId === 'B')?.budgetByCategory.food).toBe(0.0);

      // B owes A $0.00 (since B's share is $0.00)
      expect(summary.netDue.owes).toBe(null);
      expect(summary.netDue.amount).toBe(0);
    });

    it('should handle $0.02 split correctly', () => {
      const expense = postGroupExpense({
        payerId: 'A',
        amount: 0.02,
        category: 'food',
      });
      eventStore.addInitialEntries(expense);

      const summary = computeCompleteSummary(eventStore.getLedgerEntries());

      // Both should get $0.01
      expect(summary.users.find(u => u.userId === 'A')?.budgetByCategory.food).toBe(0.01);
      expect(summary.users.find(u => u.userId === 'B')?.budgetByCategory.food).toBe(0.01);

      // B owes A $0.01 (since A paid $0.02 but B's share is only $0.01)
      expect(summary.netDue.owes).toBe('B');
      expect(summary.netDue.amount).toBe(0.01);
    });
  });
});
