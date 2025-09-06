import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { fetch } from 'undici';
import { startServer, ServerInstance } from './helpers/server';

describe('Black-box Acceptance Tests', () => {
  let server: ServerInstance;

  beforeAll(async () => {
    server = await startServer();
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('Fresh start', () => {
    it('should return empty user summaries with correct shape', async () => {
      // Seed initial state
      await fetch(`${server.baseURL}/seed/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletA: 500, walletB: 500 }),
      });

      const response = await fetch(`${server.baseURL}/users`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        users: expect.arrayContaining([
          expect.objectContaining({
            userId: 'A',
            walletBalance: 500,
            budgetByCategory: expect.objectContaining({
              food: 0,
              groceries: 0,
              transport: 0,
              entertainment: 0,
              other: 0,
            }),
          }),
          expect.objectContaining({
            userId: 'B',
            walletBalance: 500,
            budgetByCategory: expect.objectContaining({
              food: 0,
              groceries: 0,
              transport: 0,
              entertainment: 0,
              other: 0,
            }),
          }),
        ]),
        netDue: expect.objectContaining({
          owes: null,
          amount: 0,
        }),
      });
    });
  });

  describe('Group expense flow', () => {
    it('should handle A pays 120 food correctly', async () => {
      // Seed initial state
      await fetch(`${server.baseURL}/seed/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletA: 500, walletB: 500 }),
      });

      // Post expense
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
      const expenseData = await expenseResponse.json();

      expect(expenseData).toMatchObject({
        transaction: expect.objectContaining({
          type: 'GROUP',
          payerId: 'A',
          amount: 120,
          category: 'food',
        }),
        summary: expect.objectContaining({
          users: expect.arrayContaining([
            expect.objectContaining({
              userId: 'A',
              walletBalance: 380, // 500 - 120
            }),
            expect.objectContaining({
              userId: 'B',
              walletBalance: 500, // unchanged
            }),
          ]),
        }),
      });

      // Verify /transactions includes the entry
      const transactionsResponse = await fetch(`${server.baseURL}/transactions`);
      expect(transactionsResponse.status).toBe(200);

      const transactions = await transactionsResponse.json();
      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toMatchObject({
        type: 'GROUP',
        payerId: 'A',
        amount: 120,
        category: 'food',
      });

      // Verify /users shows correct state
      const usersResponse = await fetch(`${server.baseURL}/users`);
      expect(usersResponse.status).toBe(200);

      const usersData = await usersResponse.json();
      expect(usersData).toMatchObject({
        users: expect.arrayContaining([
          expect.objectContaining({
            userId: 'A',
            walletBalance: 380,
            budgetByCategory: expect.objectContaining({
              food: 60, // 120/2
            }),
          }),
          expect.objectContaining({
            userId: 'B',
            walletBalance: 500,
            budgetByCategory: expect.objectContaining({
              food: 60, // 120/2
            }),
          }),
        ]),
        netDue: expect.objectContaining({
          owes: 'B',
          amount: 60, // B owes A 60
        }),
      });
    });
  });

  describe('Idempotency', () => {
    it('should handle idempotency key correctly', async () => {
      const idempotencyKey = 'test-key-123';

      // First request
      const response1 = await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          payerId: 'B',
          amount: '100.00',
          category: 'groceries',
        }),
      });

      expect(response1.status).toBe(201);
      const data1 = await response1.json();

      // Second request with same key and body
      const response2 = await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          payerId: 'B',
          amount: '100.00',
          category: 'groceries',
        }),
      });

      expect(response2.status).toBe(200); // Should return same response
      const data2 = await response2.json();

      expect(data2).toEqual(data1);

      // Third request with same key but different body
      const response3 = await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          payerId: 'A',
          amount: '50.00',
          category: 'food',
        }),
      });

      expect(response3.status).toBe(409); // Conflict
    });
  });

  describe('Settlement flow', () => {
    it('should handle settlement B→A 60 correctly', async () => {
      // Seed initial state
      await fetch(`${server.baseURL}/seed/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletA: 500, walletB: 500 }),
      });

      // First create a debt
      await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: 'A',
          amount: '120.00',
          category: 'food',
        }),
      });

      // Then settle
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
      const settlementData = await settlementResponse.json();

      expect(settlementData).toMatchObject({
        settlement: expect.objectContaining({
          type: 'SETTLEMENT',
          fromUserId: 'B',
          toUserId: 'A',
          amount: 60,
        }),
      });

      // Verify wallets bounced back
      const usersResponse = await fetch(`${server.baseURL}/users`);
      expect(usersResponse.status).toBe(200);

      const usersData = await usersResponse.json();
      expect(usersData).toMatchObject({
        users: expect.arrayContaining([
          expect.objectContaining({
            userId: 'A',
            walletBalance: 440, // 380 + 60
          }),
          expect.objectContaining({
            userId: 'B',
            walletBalance: 440, // 500 - 60
          }),
        ]),
        netDue: expect.objectContaining({
          owes: null,
          amount: 0, // Fully settled
        }),
      });
    });
  });

  describe('Validation errors', () => {
    it('should reject bad category', async () => {
      const response = await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: 'A',
          amount: '100.00',
          category: 'invalid-category',
        }),
      });

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data).toMatchObject({
        type: 'validation-error',
        title: 'Invalid request body',
        status: 422,
      });
    });

    it('should reject negative amount', async () => {
      const response = await fetch(`${server.baseURL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId: 'A',
          amount: '-50.00',
          category: 'food',
        }),
      });

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data).toMatchObject({
        type: 'validation-error',
        title: 'Invalid request body',
        status: 422,
      });
    });

    it('should reject self-settlement', async () => {
      const response = await fetch(`${server.baseURL}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: 'A',
          toUserId: 'A',
          amount: '30.00',
        }),
      });

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data).toMatchObject({
        type: 'validation-error',
        title: 'Invalid request body',
        detail: expect.stringContaining('Cannot settle with yourself'),
        status: 422,
      });
    });

    it('should reject settlement when nothing owed', async () => {
      const response = await fetch(`${server.baseURL}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: 'B',
          toUserId: 'A',
          amount: '30.00',
        }),
      });

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data).toMatchObject({
        type: 'validation-error',
        title: 'Invalid request body',
        detail: expect.stringContaining('Over-settlement'),
        status: 422,
      });
    });
  });
});
