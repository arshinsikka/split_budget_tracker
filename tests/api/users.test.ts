/**
 * API tests for /users endpoint
 * 
 * Tests user summary retrieval and query parameter handling.
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../src/index';
import { eventStore } from '../../src/repo/eventStore';

describe('GET /users', () => {
  beforeEach(() => {
    eventStore.clear();
  });

  it('should return empty user summaries when no transactions exist', async () => {
    const response = await request(app).get('/users').expect(200);
    
    expect(response.body).toEqual({
      users: [
        {
          userId: 'A',
          walletBalance: 0,
          budgetByCategory: {
            food: 0,
            groceries: 0,
            transport: 0,
            entertainment: 0,
            other: 0,
          },
        },
        {
          userId: 'B',
          walletBalance: 0,
          budgetByCategory: {
            food: 0,
            groceries: 0,
            transport: 0,
            entertainment: 0,
            other: 0,
          },
        },
      ],
      netDue: {
        owes: null,
        amount: 0,
      },
    });
  });

  it('should return specific user summary when userId query param provided', async () => {
    const response = await request(app).get('/users?userId=A').expect(200);
    
    expect(response.body).toEqual({
      userId: 'A',
      walletBalance: 0,
      budgetByCategory: {
        food: 0,
        groceries: 0,
        transport: 0,
        entertainment: 0,
        other: 0,
      },
    });
  });

  it('should return 422 for invalid userId query param', async () => {
    await request(app).get('/users?userId=INVALID').expect(422);
  });

  it('should return updated summaries after transactions', async () => {
    // Create a group expense
    await request(app)
      .post('/transactions')
      .send({
        payerId: 'A',
        amount: '100.00',
        category: 'food',
      })
      .expect(201);

    const response = await request(app).get('/users').expect(200);
    
    expect(response.body.users).toHaveLength(2);
    
    // User A should have negative wallet balance and positive food budget
    const userA = response.body.users.find((u: any) => u.userId === 'A');
    expect(userA.walletBalance).toBe(-100);
    expect(userA.budgetByCategory.food).toBe(50);
    
    // User B should have zero wallet balance and positive food budget
    const userB = response.body.users.find((u: any) => u.userId === 'B');
    expect(userB.walletBalance).toBe(0);
    expect(userB.budgetByCategory.food).toBe(50);
    
    // Net due should show B owes A
    expect(response.body.netDue).toEqual({
      owes: 'B',
      amount: 50,
    });
  });

  it('should handle multiple transactions correctly', async () => {
    // Create multiple transactions
    await request(app)
      .post('/transactions')
      .send({
        payerId: 'A',
        amount: '100.00',
        category: 'food',
      })
      .expect(201);

    await request(app)
      .post('/transactions')
      .send({
        payerId: 'B',
        amount: '120.00',
        category: 'groceries',
      })
      .expect(201);

    await request(app)
      .post('/settle')
      .send({
        fromUserId: 'B',
        toUserId: 'A',
        amount: '30.00',
      })
      .expect(201);

    const response = await request(app).get('/users').expect(200);
    
    // User A: paid 100, received 30 settlement, owes 60 for groceries
    const userA = response.body.users.find((u: any) => u.userId === 'A');
    expect(userA.walletBalance).toBe(-70); // -100 + 30
    expect(userA.budgetByCategory.food).toBe(50);
    expect(userA.budgetByCategory.groceries).toBe(60);
    
    // User B: paid 120, paid 30 settlement, owes 50 for food
    const userB = response.body.users.find((u: any) => u.userId === 'B');
    expect(userB.walletBalance).toBe(-150); // -120 - 30
    expect(userB.budgetByCategory.food).toBe(50);
    expect(userB.budgetByCategory.groceries).toBe(60);
    
    // Net due should be balanced after settlement
    expect(response.body.netDue).toEqual({
      owes: 'A',
      amount: 40, // A owes B 10 after transactions, then B settles 30 to A, so A owes B 40
    });
  });
});
