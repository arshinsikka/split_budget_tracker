/**
 * Black-box acceptance tests for Day 5 features
 *
 * Tests the new /summary and /who-owes-who endpoints
 * using only HTTP requests (no internal module imports).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startServer, type ServerHelper } from './helpers/server';

describe('Summary and Who-Owes-Who Endpoints', () => {
  let server: ServerHelper;

  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('GET /summary', () => {
    it('should return correct initial state for both users', async () => {
      // Initialize fresh state
      const initResponse = await fetch(`${server.baseURL}/seed/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletA: 500, walletB: 500 }),
      });
      expect(initResponse.status).toBe(200);

      // Get summary for user A
      const summaryAResponse = await fetch(`${server.baseURL}/summary?userId=A`);
      expect(summaryAResponse.status).toBe(200);
      const summaryA = await summaryAResponse.json();

      expect(summaryA).toEqual({
        userId: 'A',
        walletBalance: 500,
        budgetByCategory: {
          food: 0,
          groceries: 0,
          transport: 0,
          entertainment: 0,
          other: 0,
        },
        netPosition: {
          owes: null,
          amount: 0,
        },
      });

      // Get summary for user B
      const summaryBResponse = await fetch(`${server.baseURL}/summary?userId=B`);
      expect(summaryBResponse.status).toBe(200);
      const summaryB = await summaryBResponse.json();

      expect(summaryB).toEqual({
        userId: 'B',
        walletBalance: 500,
        budgetByCategory: {
          food: 0,
          groceries: 0,
          transport: 0,
          entertainment: 0,
          other: 0,
        },
        netPosition: {
          owes: null,
          amount: 0,
        },
      });
    });

    it('should reflect group expense in user summaries', async () => {
      // Initialize fresh state
      await fetch(`${server.baseURL}/seed/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletA: 500, walletB: 500 }),
      });

      // Create group expense: A pays 120 food
      const expenseResponse = await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: 'A',
          amount: '120.00',
          category: 'food',
        }),
      });
      expect(expenseResponse.status).toBe(201);

      // Get summary for user A (payer)
      const summaryAResponse = await fetch(`${server.baseURL}/summary?userId=A`);
      expect(summaryAResponse.status).toBe(200);
      const summaryA = await summaryAResponse.json();

      expect(summaryA).toEqual({
        userId: 'A',
        walletBalance: 380, // 500 - 120
        budgetByCategory: {
          food: 60, // 120/2
          groceries: 0,
          transport: 0,
          entertainment: 0,
          other: 0,
        },
        netPosition: {
          owes: 'B', // B owes A 60
          amount: 60,
        },
      });

      // Get summary for user B (non-payer)
      const summaryBResponse = await fetch(`${server.baseURL}/summary?userId=B`);
      expect(summaryBResponse.status).toBe(200);
      const summaryB = await summaryBResponse.json();

      expect(summaryB).toEqual({
        userId: 'B',
        walletBalance: 500, // unchanged
        budgetByCategory: {
          food: 60, // 120/2
          groceries: 0,
          transport: 0,
          entertainment: 0,
          other: 0,
        },
        netPosition: {
          owes: 'A', // B owes A 60
          amount: 60,
        },
      });
    });

    it('should reflect settlement in user summaries', async () => {
      // Initialize fresh state
      await fetch(`${server.baseURL}/seed/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletA: 500, walletB: 500 }),
      });

      // Create group expense: A pays 120 food
      await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: 'A',
          amount: '120.00',
          category: 'food',
        }),
      });

      // Create settlement: B pays A 60
      const settlementResponse = await fetch(`${server.baseURL}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: 'B',
          toUserId: 'A',
          amount: '60.00',
        }),
      });
      expect(settlementResponse.status).toBe(201);

      // Get summary for user A
      const summaryAResponse = await fetch(`${server.baseURL}/summary?userId=A`);
      expect(summaryAResponse.status).toBe(200);
      const summaryA = await summaryAResponse.json();

      expect(summaryA).toEqual({
        userId: 'A',
        walletBalance: 440, // 500 - 120 + 60
        budgetByCategory: {
          food: 60, // unchanged by settlement
          groceries: 0,
          transport: 0,
          entertainment: 0,
          other: 0,
        },
        netPosition: {
          owes: null, // debt settled
          amount: 0,
        },
      });

      // Get summary for user B
      const summaryBResponse = await fetch(`${server.baseURL}/summary?userId=B`);
      expect(summaryBResponse.status).toBe(200);
      const summaryB = await summaryBResponse.json();

      expect(summaryB).toEqual({
        userId: 'B',
        walletBalance: 440, // 500 - 60
        budgetByCategory: {
          food: 60, // unchanged by settlement
          groceries: 0,
          transport: 0,
          entertainment: 0,
          other: 0,
        },
        netPosition: {
          owes: null, // debt settled
          amount: 0,
        },
      });
    });

    it('should return 422 for invalid userId', async () => {
      const response = await fetch(`${server.baseURL}/summary?userId=Z`);
      expect(response.status).toBe(422);

      const error = await response.json();
      expect(error).toMatchObject({
        type: 'validation-error',
        title: 'Invalid request body',
        status: 422,
      });
    });
  });

  describe('GET /who-owes-who', () => {
    it('should return null when no debt exists', async () => {
      // Initialize fresh state
      await fetch(`${server.baseURL}/seed/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletA: 500, walletB: 500 }),
      });

      const response = await fetch(`${server.baseURL}/who-owes-who`);
      expect(response.status).toBe(200);

      const debtSummary = await response.json();
      expect(debtSummary).toEqual({
        owes: null,
        to: null,
        amount: 0,
      });
    });

    it('should reflect debt after group expense', async () => {
      // Initialize fresh state
      await fetch(`${server.baseURL}/seed/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletA: 500, walletB: 500 }),
      });

      // Create group expense: A pays 120 food
      await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: 'A',
          amount: '120.00',
          category: 'food',
        }),
      });

      const response = await fetch(`${server.baseURL}/who-owes-who`);
      expect(response.status).toBe(200);

      const debtSummary = await response.json();
      expect(debtSummary).toEqual({
        owes: 'B', // B owes A
        to: 'A', // A is owed
        amount: 60, // 120/2
      });
    });

    it('should return null after settlement', async () => {
      // Initialize fresh state
      await fetch(`${server.baseURL}/seed/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletA: 500, walletB: 500 }),
      });

      // Create group expense: A pays 120 food
      await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: 'A',
          amount: '120.00',
          category: 'food',
        }),
      });

      // Create settlement: B pays A 60
      await fetch(`${server.baseURL}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: 'B',
          toUserId: 'A',
          amount: '60.00',
        }),
      });

      const response = await fetch(`${server.baseURL}/who-owes-who`);
      expect(response.status).toBe(200);

      const debtSummary = await response.json();
      expect(debtSummary).toEqual({
        owes: null, // debt settled
        to: null,
        amount: 0,
      });
    });
  });

  describe('POST /seed/init?demo=true', () => {
    it('should preload demo data and return correct state', async () => {
      const response = await fetch(`${server.baseURL}/seed/init?demo=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(response.status).toBe(200);

      const demoState = await response.json();

      // Verify users array structure
      expect(demoState).toHaveProperty('users');
      expect(Array.isArray(demoState.users)).toBe(true);
      expect(demoState.users).toHaveLength(2);

      // Verify netDue structure
      expect(demoState).toHaveProperty('netDue');
      expect(demoState.netDue).toHaveProperty('owes');
      expect(demoState.netDue).toHaveProperty('amount');

      // Verify demo transactions were created
      const transactionsResponse = await fetch(`${server.baseURL}/transactions`);
      expect(transactionsResponse.status).toBe(200);
      const transactions = await transactionsResponse.json();

      // Should have 3 demo transactions
      expect(transactions).toHaveLength(3);

      // Verify transaction types and amounts
      const foodTx = transactions.find((t: any) => t.category === 'food');
      const groceriesTx = transactions.find((t: any) => t.category === 'groceries');
      const transportTx = transactions.find((t: any) => t.category === 'transport');

      expect(foodTx).toBeDefined();
      expect(groceriesTx).toBeDefined();
      expect(transportTx).toBeDefined();

      expect(foodTx.amount).toBe(120);
      expect(groceriesTx.amount).toBe(80);
      expect(transportTx.amount).toBe(50);
    });
  });
});
