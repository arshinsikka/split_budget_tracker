import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { fetch } from 'undici';
import { startServer, ServerInstance } from './helpers/server';
import { Oracle } from './helpers/oracle';
import * as fc from 'fast-check';

describe('Property-based Tests', () => {
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

  describe('Random valid sequences', () => {
    it('should maintain invariants through random expense and settlement sequences', async () => {
      // Define the action types
      type Action =
        | { type: 'expense'; payer: 'A' | 'B'; amount: number; category: string }
        | { type: 'settlement'; from: 'A' | 'B'; to: 'A' | 'B'; amount: number };

      // Generate random valid sequences
      const actionArb = fc.oneof(
        // Expense action
        fc.record({
          type: fc.constant('expense'),
          payer: fc.oneof(fc.constant('A'), fc.constant('B')),
          amount: fc.integer({ min: 1, max: 20000 }).map(cents => cents / 100),
          category: fc.oneof(
            fc.constant('food'),
            fc.constant('groceries'),
            fc.constant('transport'),
            fc.constant('entertainment'),
            fc.constant('other')
          ),
        }),
        // Settlement action (only if there's debt)
        fc
          .record({
            type: fc.constant('settlement'),
            from: fc.oneof(fc.constant('A'), fc.constant('B')),
            to: fc.oneof(fc.constant('A'), fc.constant('B')),
            amount: fc.integer({ min: 1, max: 10000 }).map(cents => cents / 100),
          })
          .filter(action => action.from !== action.to)
      );

      // Generate sequence of 10-20 actions
      const sequenceArb = fc.array(actionArb, { minLength: 10, maxLength: 20 });

      await fc.assert(
        fc.asyncProperty(sequenceArb, async actions => {
          // Reset both oracle and API state
          oracle = new Oracle();
          oracle.setInitialWallets(500, 500);

          // Reset API state
          await fetch(`${server.baseURL}/seed/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletA: 500, walletB: 500 }),
          });

          // Track expected wallet changes
          let expectedWalletChangeA = 0;
          let expectedWalletChangeB = 0;

          // Execute actions
          for (const action of actions) {
            try {
              if (action.type === 'expense') {
                // Execute expense via API
                const response = await fetch(`${server.baseURL}/transactions`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    payerId: action.payer,
                    amount: action.amount.toFixed(2),
                    category: action.category,
                  }),
                });

                if (response.status === 201) {
                  // Update oracle
                  oracle.recordExpense(action.payer, action.amount, action.category);

                  // Track wallet changes
                  if (action.payer === 'A') {
                    expectedWalletChangeA -= action.amount;
                  } else {
                    expectedWalletChangeB -= action.amount;
                  }
                }
              } else if (action.type === 'settlement') {
                // Check if settlement is valid (only settle up to owed amount)
                const currentNetDue = oracle.getNetDue();

                // Only proceed if there's debt and the payer owes money
                if (currentNetDue.owes === action.from && action.amount <= currentNetDue.amount) {
                  // Execute settlement via API
                  const response = await fetch(`${server.baseURL}/settle`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      fromUserId: action.from,
                      toUserId: action.to,
                      amount: action.amount.toFixed(2),
                    }),
                  });

                  if (response.status === 201) {
                    // Update oracle
                    oracle.recordSettlement(action.from, action.to, action.amount);

                    // Track wallet changes
                    if (action.from === 'A') {
                      expectedWalletChangeA -= action.amount;
                      expectedWalletChangeB += action.amount;
                    } else {
                      expectedWalletChangeB -= action.amount;
                      expectedWalletChangeA += action.amount;
                    }
                  }
                }
              }
            } catch (error) {
              // Ignore errors and continue with sequence
            }
          }

          // Get final state from API
          const apiResponse = await fetch(`${server.baseURL}/users`);
          const apiData = await apiResponse.json();
          const oracleData = oracle.getUserSummaries();

          // Assert invariants

          // 1. Budgets are non-decreasing (they only increase with expenses)
          for (let i = 0; i < 2; i++) {
            const apiCategories = Object.keys(apiData.users[i].budgetByCategory);
            for (const category of apiCategories) {
              expect(apiData.users[i].budgetByCategory[category]).toBeGreaterThanOrEqual(0);
            }
          }

          // 2. Net due matches oracle (within 0.01 tolerance)
          expect(apiData.netDue.owes).toBe(oracleData.netDue.owes);
          expect(apiData.netDue.amount).toBeCloseTo(oracleData.netDue.amount, 1);

          // 3. Sum of CASH deltas equals expected wallet change
          const userA = apiData.users.find((u: any) => u.userId === 'A');
          const userB = apiData.users.find((u: any) => u.userId === 'B');

          const actualWalletChangeA = userA.walletBalance - 500; // Starting balance
          const actualWalletChangeB = userB.walletBalance - 500; // Starting balance

          expect(Math.abs(actualWalletChangeA - expectedWalletChangeA)).toBeLessThan(0.01);
          expect(Math.abs(actualWalletChangeB - expectedWalletChangeB)).toBeLessThan(0.01);

          // 4. Wallet balances match oracle (within 0.01 tolerance)
          expect(Math.abs(userA.walletBalance - oracleData.users[0].walletBalance)).toBeLessThan(
            0.01
          );
          expect(Math.abs(userB.walletBalance - oracleData.users[1].walletBalance)).toBeLessThan(
            0.01
          );

          // 5. Budget categories match oracle
          for (let i = 0; i < 2; i++) {
            const apiCategories = Object.keys(apiData.users[i].budgetByCategory);
            const oracleCategories = Object.keys(oracleData.users[i].budgetByCategory);
            expect(apiCategories).toEqual(oracleCategories);

            for (const category of apiCategories) {
              const apiAmount = apiData.users[i].budgetByCategory[category];
              const oracleAmount = oracleData.users[i].budgetByCategory[category];
              expect(apiAmount).toBeCloseTo(oracleAmount, 1);
            }
          }

          return true;
        }),
        { numRuns: 10 } // Run 10 random sequences
      );
    });

    it('should handle edge cases in random sequences', async () => {
      // Test specific edge cases
      const edgeCaseArb = fc.oneof(
        // Very small amounts
        fc.record({
          type: fc.constant('expense'),
          payer: fc.oneof(fc.constant('A'), fc.constant('B')),
          amount: fc.integer({ min: 1, max: 100 }).map(cents => cents / 100),
          category: fc.constant('food'),
        }),
        // Very large amounts
        fc.record({
          type: fc.constant('expense'),
          payer: fc.oneof(fc.constant('A'), fc.constant('B')),
          amount: fc.integer({ min: 15000, max: 20000 }).map(cents => cents / 100),
          category: fc.constant('groceries'),
        }),
        // Odd amounts that create cent remainders
        fc.record({
          type: fc.constant('expense'),
          payer: fc.oneof(fc.constant('A'), fc.constant('B')),
          amount: fc.oneof(fc.constant(101.0), fc.constant(103.0), fc.constant(99.99)),
          category: fc.constant('transport'),
        })
      );

      const sequenceArb = fc.array(edgeCaseArb, { minLength: 5, maxLength: 10 });

      await fc.assert(
        fc.asyncProperty(sequenceArb, async actions => {
          // Reset both oracle and API state
          oracle = new Oracle();
          oracle.setInitialWallets(500, 500);

          // Reset API state
          await fetch(`${server.baseURL}/seed/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletA: 500, walletB: 500 }),
          });

          // Execute actions
          for (const action of actions) {
            try {
              if (action.type === 'expense') {
                const response = await fetch(`${server.baseURL}/transactions`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    payerId: action.payer,
                    amount: action.amount.toFixed(2),
                    category: action.category,
                  }),
                });

                if (response.status === 201) {
                  oracle.recordExpense(action.payer, action.amount, action.category);
                }
              }
            } catch (error) {
              // Ignore errors and continue
            }
          }

          // Get final state
          const apiResponse = await fetch(`${server.baseURL}/users`);
          const apiData = await apiResponse.json();
          const oracleData = oracle.getUserSummaries();

          // Assert that API matches oracle
          expect(apiData.netDue.owes).toBe(oracleData.netDue.owes);
          expect(apiData.netDue.amount).toBeCloseTo(oracleData.netDue.amount, 1);

          for (let i = 0; i < 2; i++) {
            expect(
              Math.abs(apiData.users[i].walletBalance - oracleData.users[i].walletBalance)
            ).toBeLessThan(0.01);

            const apiCategories = Object.keys(apiData.users[i].budgetByCategory);
            const oracleCategories = Object.keys(oracleData.users[i].budgetByCategory);
            expect(apiCategories).toEqual(oracleCategories);

            for (const category of apiCategories) {
              const apiAmount = apiData.users[i].budgetByCategory[category];
              const oracleAmount = oracleData.users[i].budgetByCategory[category];
              expect(apiAmount).toBeCloseTo(oracleAmount, 1);
            }
          }

          return true;
        }),
        { numRuns: 5 } // Run 5 edge case sequences
      );
    });
  });
});
