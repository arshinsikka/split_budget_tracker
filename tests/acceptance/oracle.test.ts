import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { fetch } from 'undici';
import { startServer, ServerInstance } from './helpers/server';
import { Oracle } from './helpers/oracle';

describe('Oracle-based Tests', () => {
  let server: ServerInstance;
  let oracle: Oracle;

  beforeAll(async () => {
    server = await startServer();
    oracle = new Oracle();
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(async () => {
    // Reset oracle for each test
    oracle = new Oracle();

    // Seed initial state
    await fetch(`${server.baseURL}/seed/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletA: 500, walletB: 500 }),
    });

    // Set oracle initial state
    oracle.setInitialWallets(500, 500);
  });

  describe('Oracle vs API comparison', () => {
    it('should match oracle for alternating payers', async () => {
      // A pays 100 for food
      await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: 'A',
          amount: '100.00',
          category: 'food',
        }),
      });
      oracle.recordExpense('A', 100, 'food');

      // B pays 120 for groceries
      await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: 'B',
          amount: '120.00',
          category: 'groceries',
        }),
      });
      oracle.recordExpense('B', 120, 'groceries');

      // Compare results
      const apiResponse = await fetch(`${server.baseURL}/users`);
      const apiData = await apiResponse.json();
      const oracleData = oracle.getUserSummaries();

      // Compare within 0.01 tolerance
      expect(apiData.users).toHaveLength(2);
      expect(oracleData.users).toHaveLength(2);

      for (let i = 0; i < 2; i++) {
        expect(
          Math.abs(apiData.users[i].walletBalance - oracleData.users[i].walletBalance)
        ).toBeLessThan(0.01);
        expect(apiData.users[i].userId).toBe(oracleData.users[i].userId);

        // Compare budget categories
        const apiCategories = Object.keys(apiData.users[i].budgetByCategory);
        const oracleCategories = Object.keys(oracleData.users[i].budgetByCategory);
        expect(apiCategories).toEqual(oracleCategories);

        for (const category of apiCategories) {
          const apiAmount = apiData.users[i].budgetByCategory[category];
          const oracleAmount = oracleData.users[i].budgetByCategory[category];
          expect(Math.abs(apiAmount - oracleAmount)).toBeLessThan(0.01);
        }
      }

      // Compare net due
      expect(apiData.netDue.owes).toBe(oracleData.netDue.owes);
      expect(Math.abs(apiData.netDue.amount - oracleData.netDue.amount)).toBeLessThan(0.01);
    });

    it('should handle partial settlements correctly', async () => {
      // A pays 100 for food
      await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: 'A',
          amount: '100.00',
          category: 'food',
        }),
      });
      oracle.recordExpense('A', 100, 'food');

      // B settles 30 to A
      await fetch(`${server.baseURL}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: 'B',
          toUserId: 'A',
          amount: '30.00',
        }),
      });
      oracle.recordSettlement('B', 'A', 30);

      // Compare results
      const apiResponse = await fetch(`${server.baseURL}/users`);
      const apiData = await apiResponse.json();
      const oracleData = oracle.getUserSummaries();

      // Compare net due
      expect(apiData.netDue.owes).toBe(oracleData.netDue.owes);
      expect(Math.abs(apiData.netDue.amount - oracleData.netDue.amount)).toBeLessThan(0.01);

      // Compare wallet balances
      for (let i = 0; i < 2; i++) {
        expect(
          Math.abs(apiData.users[i].walletBalance - oracleData.users[i].walletBalance)
        ).toBeLessThan(0.01);
      }
    });

    it('should handle multi-category expenses', async () => {
      // A pays 100 for food
      await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: 'A',
          amount: '100.00',
          category: 'food',
        }),
      });
      oracle.recordExpense('A', 100, 'food');

      // B pays 80 for transport
      await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: 'B',
          amount: '80.00',
          category: 'transport',
        }),
      });
      oracle.recordExpense('B', 80, 'transport');

      // A pays 60 for entertainment
      await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: 'A',
          amount: '60.00',
          category: 'entertainment',
        }),
      });
      oracle.recordExpense('A', 60, 'entertainment');

      // Compare results
      const apiResponse = await fetch(`${server.baseURL}/users`);
      const apiData = await apiResponse.json();
      const oracleData = oracle.getUserSummaries();

      // Compare all budget categories
      for (let i = 0; i < 2; i++) {
        const apiCategories = Object.keys(apiData.users[i].budgetByCategory);
        const oracleCategories = Object.keys(oracleData.users[i].budgetByCategory);
        expect(apiCategories).toEqual(oracleCategories);

        for (const category of apiCategories) {
          const apiAmount = apiData.users[i].budgetByCategory[category];
          const oracleAmount = oracleData.users[i].budgetByCategory[category];
          expect(Math.abs(apiAmount - oracleAmount)).toBeLessThan(0.01);
        }
      }

      // Compare net due
      expect(apiData.netDue.owes).toBe(oracleData.netDue.owes);
      expect(Math.abs(apiData.netDue.amount - oracleData.netDue.amount)).toBeLessThan(0.01);
    });

    it('should handle odd splits like 101.00 correctly', async () => {
      // A pays 101.00 for food (odd amount to test cent remainder policy)
      await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: 'A',
          amount: '101.00',
          category: 'food',
        }),
      });
      oracle.recordExpense('A', 101, 'food');

      // Compare results
      const apiResponse = await fetch(`${server.baseURL}/users`);
      const apiData = await apiResponse.json();
      const oracleData = oracle.getUserSummaries();

      // Check that the odd cent was handled correctly
      // According to ADR: budgets are 50.50/50.50, remainder goes to receivable
      const userA = apiData.users.find((u: any) => u.userId === 'A');
      const userB = apiData.users.find((u: any) => u.userId === 'B');

      expect(userA.budgetByCategory.food).toBe(50.5);
      expect(userB.budgetByCategory.food).toBe(50.5);

      // Compare with oracle
      expect(
        Math.abs(userA.budgetByCategory.food - oracleData.users[0].budgetByCategory.food)
      ).toBeLessThan(0.01);
      expect(
        Math.abs(userB.budgetByCategory.food - oracleData.users[1].budgetByCategory.food)
      ).toBeLessThan(0.01);
    });

    it('should maintain budget invariance during settlements', async () => {
      // A pays 100 for food
      await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: 'A',
          amount: '100.00',
          category: 'food',
        }),
      });
      oracle.recordExpense('A', 100, 'food');

      // Record budget state before settlement
      const beforeSettlement = await fetch(`${server.baseURL}/users`);
      const beforeData = await beforeSettlement.json();

      // B settles 30 to A
      await fetch(`${server.baseURL}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: 'B',
          toUserId: 'A',
          amount: '30.00',
        }),
      });
      oracle.recordSettlement('B', 'A', 30);

      // Record budget state after settlement
      const afterSettlement = await fetch(`${server.baseURL}/users`);
      const afterData = await afterSettlement.json();

      // Budgets should be unchanged
      for (let i = 0; i < 2; i++) {
        const beforeCategories = Object.keys(beforeData.users[i].budgetByCategory);
        const afterCategories = Object.keys(afterData.users[i].budgetByCategory);
        expect(afterCategories).toEqual(beforeCategories);

        for (const category of beforeCategories) {
          expect(afterData.users[i].budgetByCategory[category]).toBe(
            beforeData.users[i].budgetByCategory[category]
          );
        }
      }

      // Compare with oracle
      const oracleData = oracle.getUserSummaries();
      for (let i = 0; i < 2; i++) {
        const apiCategories = Object.keys(afterData.users[i].budgetByCategory);
        const oracleCategories = Object.keys(oracleData.users[i].budgetByCategory);
        expect(apiCategories).toEqual(oracleCategories);

        for (const category of apiCategories) {
          const apiAmount = afterData.users[i].budgetByCategory[category];
          const oracleAmount = oracleData.users[i].budgetByCategory[category];
          expect(Math.abs(apiAmount - oracleAmount)).toBeLessThan(0.01);
        }
      }
    });
  });
});
