/**
 * Ledger engine unit tests
 *
 * Tests double-entry ledger posting for group expenses and settlements.
 * Verifies mathematical consistency and proper account movements.
 */

import { describe, it, expect } from 'vitest';
import {
  postGroupExpense,
  postSettlement,
  validateLedgerEntries,
  ACCOUNTS,
  type LedgerEntry,
  type GroupExpenseInput,
  type SettlementInput,
} from '../../src/lib/ledger';

describe('Ledger Engine', () => {
  describe('postGroupExpense', () => {
    it('should create balanced entries for even amount split', () => {
      const input: GroupExpenseInput = {
        payerId: 'A',
        amount: 100.0,
        category: 'food',
      };

      const entries = postGroupExpense(input);

      // Should create 5 entries
      expect(entries).toHaveLength(5);

      // Verify transaction is balanced
      const totalDelta = entries.reduce((sum, entry) => sum + entry.delta, 0);
      expect(Math.abs(totalDelta)).toBeLessThan(0.01);

      // Verify all entries have same transaction ID
      const txId = entries[0].txId;
      expect(entries.every((entry) => entry.txId === txId)).toBe(true);

      // Verify all entries are GROUP type
      expect(entries.every((entry) => entry.txType === 'GROUP')).toBe(true);

      // Verify specific entries
      const cashEntry = entries.find((e) => e.account === ACCOUNTS.CASH('A'));
      expect(cashEntry).toBeDefined();
      expect(cashEntry!.delta).toBe(-100.0);

      const expenseA = entries.find(
        (e) => e.account === ACCOUNTS.EXPENSE('A', 'food')
      );
      expect(expenseA).toBeDefined();
      expect(expenseA!.delta).toBe(50.0);

      const expenseB = entries.find(
        (e) => e.account === ACCOUNTS.EXPENSE('B', 'food')
      );
      expect(expenseB).toBeDefined();
      expect(expenseB!.delta).toBe(50.0);

      const dueFrom = entries.find(
        (e) => e.account === ACCOUNTS.DUE_FROM('A', 'B')
      );
      expect(dueFrom).toBeDefined();
      expect(dueFrom!.delta).toBe(50.0);

      const dueTo = entries.find(
        (e) => e.account === ACCOUNTS.DUE_TO('B', 'A')
      );
      expect(dueTo).toBeDefined();
      expect(dueTo!.delta).toBe(-50.0);
    });

    it("should handle odd amounts with banker's rounding", () => {
      const input: GroupExpenseInput = {
        payerId: 'A',
        amount: 101.0,
        category: 'groceries',
      };

      const entries = postGroupExpense(input);

      // Verify split: 101.00 / 2 = 50.50 each
      const expenseA = entries.find(
        (e) => e.account === ACCOUNTS.EXPENSE('A', 'groceries')
      );
      const expenseB = entries.find(
        (e) => e.account === ACCOUNTS.EXPENSE('B', 'groceries')
      );

      expect(expenseA!.delta).toBe(50.5);
      expect(expenseB!.delta).toBe(50.5);

      // Verify DUE_FROM and DUE_TO are mirrored
      const dueFrom = entries.find(
        (e) => e.account === ACCOUNTS.DUE_FROM('A', 'B')
      );
      const dueTo = entries.find(
        (e) => e.account === ACCOUNTS.DUE_TO('B', 'A')
      );

      expect(dueFrom!.delta).toBe(50.5);
      expect(dueTo!.delta).toBe(-50.5);

      // Verify transaction is balanced
      const totalDelta = entries.reduce((sum, entry) => sum + entry.delta, 0);
      expect(Math.abs(totalDelta)).toBeLessThan(0.01);
    });

    it.skip('should handle amounts with remainder cents', () => {
      const input: GroupExpenseInput = {
        payerId: 'B',
        amount: 100.03,
        category: 'transport',
      };

      const entries = postGroupExpense(input);

      // Split: 100.03 / 2 = 50.015 -> 50.01 each (floor division)
      // Remainder: 100.03 - (50.01 * 2) = 0.01
      const expenseA = entries.find(
        (e) => e.account === ACCOUNTS.EXPENSE('A', 'transport')
      );
      const expenseB = entries.find(
        (e) => e.account === ACCOUNTS.EXPENSE('B', 'transport')
      );

      expect(expenseA!.delta).toBe(50.01); // A gets their share
      expect(expenseB!.delta).toBe(50.02); // B gets their share + remainder

      // Payer (B) gets the remainder cent in their receivable
      const dueFrom = entries.find(
        (e) => e.account === ACCOUNTS.DUE_FROM('B', 'A')
      );
      const dueTo = entries.find(
        (e) => e.account === ACCOUNTS.DUE_TO('A', 'B')
      );

      expect(dueFrom!.delta).toBe(50.02); // B is owed 50.02 by A
      expect(dueTo!.delta).toBe(-50.02); // A owes 50.02 to B

      // Verify total expenses equal original amount
      const totalExpenses = expenseA!.delta + expenseB!.delta;
      expect(totalExpenses).toBe(100.03); // 50.01 + 50.02
    });

    it('should reject invalid amounts', () => {
      const invalidInputs: GroupExpenseInput[] = [
        { payerId: 'A', amount: 0, category: 'food' },
        { payerId: 'A', amount: -100, category: 'food' },
        { payerId: 'A', amount: 100.001, category: 'food' },
      ];

      for (const input of invalidInputs) {
        expect(() => postGroupExpense(input)).toThrow();
      }
    });

    it('should work when B is the payer', () => {
      const input: GroupExpenseInput = {
        payerId: 'B',
        amount: 120.0,
        category: 'entertainment',
      };

      const entries = postGroupExpense(input);

      // Verify B's cash is debited
      const cashB = entries.find((e) => e.account === ACCOUNTS.CASH('B'));
      expect(cashB!.delta).toBe(-120.0);

      // Verify B's receivable from A (B is the payer)
      const dueFrom = entries.find(
        (e) => e.account === ACCOUNTS.DUE_FROM('B', 'A')
      );
      expect(dueFrom).toBeDefined();
      expect(dueFrom!.delta).toBe(60.0);

      // Verify A's payable to B
      const dueTo = entries.find(
        (e) => e.account === ACCOUNTS.DUE_TO('A', 'B')
      );
      expect(dueTo).toBeDefined();
      expect(dueTo!.delta).toBe(-60.0);

      // Verify transaction is balanced
      const totalDelta = entries.reduce((sum, entry) => sum + entry.delta, 0);
      expect(Math.abs(totalDelta)).toBeLessThan(0.01);
    });
  });

  describe('postSettlement', () => {
    it('should create balanced settlement entries', () => {
      const input: SettlementInput = {
        fromUserId: 'B',
        toUserId: 'A',
        amount: 30.0,
      };

      const entries = postSettlement(input);

      // Should create 4 entries
      expect(entries).toHaveLength(4);

      // Verify transaction is balanced
      const totalDelta = entries.reduce((sum, entry) => sum + entry.delta, 0);
      expect(Math.abs(totalDelta)).toBeLessThan(0.01);

      // Verify all entries have same transaction ID
      const txId = entries[0].txId;
      expect(entries.every((entry) => entry.txId === txId)).toBe(true);

      // Verify all entries are SETTLEMENT type
      expect(entries.every((entry) => entry.txType === 'SETTLEMENT')).toBe(
        true
      );

      // Verify specific entries
      const cashB = entries.find((e) => e.account === ACCOUNTS.CASH('B'));
      expect(cashB!.delta).toBe(-30.0);

      const cashA = entries.find((e) => e.account === ACCOUNTS.CASH('A'));
      expect(cashA!.delta).toBe(30.0);

      const dueFrom = entries.find(
        (e) => e.account === ACCOUNTS.DUE_FROM('A', 'B')
      );
      expect(dueFrom!.delta).toBe(-30.0);

      const dueTo = entries.find(
        (e) => e.account === ACCOUNTS.DUE_TO('B', 'A')
      );
      expect(dueTo!.delta).toBe(30.0);
    });

    it('should reject self-settlement', () => {
      const input: SettlementInput = {
        fromUserId: 'A',
        toUserId: 'A',
        amount: 30.0,
      };

      expect(() => postSettlement(input)).toThrow(
        'Cannot settle with yourself'
      );
    });

    it('should reject invalid amounts', () => {
      const invalidInputs: SettlementInput[] = [
        { fromUserId: 'B', toUserId: 'A', amount: 0 },
        { fromUserId: 'B', toUserId: 'A', amount: -30 },
        { fromUserId: 'B', toUserId: 'A', amount: 30.001 },
      ];

      for (const input of invalidInputs) {
        expect(() => postSettlement(input)).toThrow();
      }
    });

    it('should work when A pays B', () => {
      const input: SettlementInput = {
        fromUserId: 'A',
        toUserId: 'B',
        amount: 25.5,
      };

      const entries = postSettlement(input);

      // Verify A's cash is debited
      const cashA = entries.find((e) => e.account === ACCOUNTS.CASH('A'));
      expect(cashA!.delta).toBe(-25.5);

      // Verify B's cash is credited
      const cashB = entries.find((e) => e.account === ACCOUNTS.CASH('B'));
      expect(cashB!.delta).toBe(25.5);

      // Verify B's receivable from A decreases
      const dueFrom = entries.find(
        (e) => e.account === ACCOUNTS.DUE_FROM('B', 'A')
      );
      expect(dueFrom!.delta).toBe(-25.5);

      // Verify A's payable to B decreases
      const dueTo = entries.find(
        (e) => e.account === ACCOUNTS.DUE_TO('A', 'B')
      );
      expect(dueTo!.delta).toBe(25.5);

      // Verify transaction is balanced
      const totalDelta = entries.reduce((sum, entry) => sum + entry.delta, 0);
      expect(Math.abs(totalDelta)).toBeLessThan(0.01);
    });
  });

  describe('validateLedgerEntries', () => {
    it('should reject unbalanced transactions', () => {
      const entries: LedgerEntry[] = [
        {
          id: '1',
          txType: 'GROUP',
          txId: 'tx-1',
          account: ACCOUNTS.CASH('A'),
          userId: 'A',
          delta: -100.0,
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          txType: 'GROUP',
          txId: 'tx-1',
          account: ACCOUNTS.EXPENSE('A', 'food'),
          userId: 'A',
          category: 'food',
          delta: 50.0,
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          txType: 'GROUP',
          txId: 'tx-1',
          account: ACCOUNTS.EXPENSE('B', 'food'),
          userId: 'B',
          category: 'food',
          delta: 40.0, // Wrong amount - should be 50.00
          createdAt: new Date().toISOString(),
        },
      ];

      expect(() => validateLedgerEntries(entries)).toThrow(
        'Transaction not balanced'
      );
    });

    it('should validate balanced transactions', () => {
      const entries: LedgerEntry[] = [
        {
          id: '1',
          txType: 'GROUP',
          txId: 'tx-1',
          account: ACCOUNTS.CASH('A'),
          userId: 'A',
          delta: -100.0,
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          txType: 'GROUP',
          txId: 'tx-1',
          account: ACCOUNTS.EXPENSE('A', 'food'),
          userId: 'A',
          category: 'food',
          delta: 50.0,
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          txType: 'GROUP',
          txId: 'tx-1',
          account: ACCOUNTS.EXPENSE('B', 'food'),
          userId: 'B',
          category: 'food',
          delta: 50.0,
          createdAt: new Date().toISOString(),
        },
        {
          id: '4',
          txType: 'GROUP',
          txId: 'tx-1',
          account: ACCOUNTS.DUE_FROM('A', 'B'),
          userId: 'A',
          delta: 50.0,
          createdAt: new Date().toISOString(),
        },
        {
          id: '5',
          txType: 'GROUP',
          txId: 'tx-1',
          account: ACCOUNTS.DUE_TO('B', 'A'),
          userId: 'B',
          delta: -50.0,
          createdAt: new Date().toISOString(),
        },
      ];

      expect(validateLedgerEntries(entries)).toBe(true);
    });

    it('should validate DUE_FROM and DUE_TO mirroring', () => {
      const entries: LedgerEntry[] = [
        {
          id: '1',
          txType: 'GROUP',
          txId: 'tx-1',
          account: ACCOUNTS.CASH('A'),
          userId: 'A',
          delta: -100.0,
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          txType: 'GROUP',
          txId: 'tx-1',
          account: ACCOUNTS.EXPENSE('A', 'food'),
          userId: 'A',
          category: 'food',
          delta: 50.0,
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          txType: 'GROUP',
          txId: 'tx-1',
          account: ACCOUNTS.EXPENSE('B', 'food'),
          userId: 'B',
          category: 'food',
          delta: 50.0,
          createdAt: new Date().toISOString(),
        },
        {
          id: '4',
          txType: 'GROUP',
          txId: 'tx-1',
          account: ACCOUNTS.DUE_FROM('A', 'B'),
          userId: 'A',
          delta: 50.0,
          createdAt: new Date().toISOString(),
        },
        {
          id: '5',
          txType: 'GROUP',
          txId: 'tx-1',
          account: ACCOUNTS.DUE_TO('B', 'A'),
          userId: 'B',
          delta: -40.0, // Wrong amount - should be -50.00
          createdAt: new Date().toISOString(),
        },
      ];

      expect(() => validateLedgerEntries(entries)).toThrow(
        'Transaction not balanced'
      );
    });
  });

  describe('Integration Tests', () => {
    it('should handle multiple transactions maintaining invariants', () => {
      // Create a group expense
      const expense1 = postGroupExpense({
        payerId: 'A',
        amount: 100.0,
        category: 'food',
      });

      // Create another group expense
      const expense2 = postGroupExpense({
        payerId: 'B',
        amount: 120.0,
        category: 'groceries',
      });

      // Create a settlement
      const settlement = postSettlement({
        fromUserId: 'B',
        toUserId: 'A',
        amount: 30.0,
      });

      // All transactions should be balanced
      expect(validateLedgerEntries(expense1)).toBe(true);
      expect(validateLedgerEntries(expense2)).toBe(true);
      expect(validateLedgerEntries(settlement)).toBe(true);

      // Verify all entries have unique IDs
      const allEntries = [...expense1, ...expense2, ...settlement];
      const ids = allEntries.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should handle edge case with 101.00 split', () => {
      const entries = postGroupExpense({
        payerId: 'A',
        amount: 101.0,
        category: 'food',
      });

      // Verify the split: 101.00 / 2 = 50.50 each
      const expenseA = entries.find(
        (e) => e.account === ACCOUNTS.EXPENSE('A', 'food')
      );
      const expenseB = entries.find(
        (e) => e.account === ACCOUNTS.EXPENSE('B', 'food')
      );

      expect(expenseA!.delta).toBe(50.5);
      expect(expenseB!.delta).toBe(50.5);

      // Verify total expenses equal original amount
      const totalExpenses = expenseA!.delta + expenseB!.delta;
      expect(totalExpenses).toBe(101.0);

      // Verify transaction is balanced
      expect(validateLedgerEntries(entries)).toBe(true);
    });
  });
});
