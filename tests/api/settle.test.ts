/**
 * API tests for /settle endpoint
 * 
 * Tests settlement creation, over-settlement validation, and idempotency.
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../src/index';
import { eventStore } from '../../src/repo/eventStore';

describe('POST /settle', () => {
  beforeEach(() => {
    eventStore.clear();
  });

  it('should create a settlement successfully', async () => {
    // First create a debt by having A pay for food
    await request(app)
      .post('/transactions')
      .send({
        payerId: 'A',
        amount: '100.00',
        category: 'food',
      })
      .expect(201);

    const response = await request(app)
      .post('/settle')
      .send({
        fromUserId: 'B',
        toUserId: 'A',
        amount: '30.00',
      })
      .expect(201);

    expect(response.body).toHaveProperty('settlement');
    expect(response.body).toHaveProperty('summary');
    
    const { settlement, summary } = response.body;
    
    expect(settlement).toEqual({
      id: expect.any(String),
      type: 'SETTLEMENT',
      fromUserId: 'B',
      toUserId: 'A',
      amount: 30,
      createdAt: expect.any(String),
    });

    // Net due should be reduced by settlement amount
    expect(summary.netDue).toEqual({
      owes: 'B',
      amount: 20, // 50 - 30
    });
  });

  it('should reject over-settlement', async () => {
    // Create a debt of 50 (A pays 100, B owes 50)
    await request(app)
      .post('/transactions')
      .send({
        payerId: 'A',
        amount: '100.00',
        category: 'food',
      })
      .expect(201);

    // Try to settle more than owed
    const response = await request(app)
      .post('/settle')
      .send({
        fromUserId: 'B',
        toUserId: 'A',
        amount: '80.00', // More than the 50 owed
      })
      .expect(422);

    expect(response.body).toMatchObject({
      type: 'validation-error',
      title: 'Invalid request body',
      detail: expect.stringContaining('Over-settlement'),
      status: 422,
    });
  });

  it('should reject settlement when no money is owed', async () => {
    const response = await request(app)
      .post('/settle')
      .send({
        fromUserId: 'B',
        toUserId: 'A',
        amount: '30.00',
      })
      .expect(422);

    expect(response.body).toMatchObject({
      type: 'validation-error',
      title: 'Invalid request body',
      detail: expect.stringContaining('Over-settlement'),
      status: 422,
    });
  });

  it('should reject self-settlement', async () => {
    const response = await request(app)
      .post('/settle')
      .send({
        fromUserId: 'A',
        toUserId: 'A',
        amount: '30.00',
      })
      .expect(422);

    expect(response.body).toMatchObject({
      type: 'validation-error',
      title: 'Invalid request body',
      detail: expect.stringContaining('Cannot settle with yourself'),
      status: 422,
    });
  });

  it('should support idempotency key', async () => {
    // Create a debt first
    await request(app)
      .post('/transactions')
      .send({
        payerId: 'A',
        amount: '100.00',
        category: 'food',
      })
      .expect(201);

    const idempotencyKey = 'settle-key-123';
    
    const response1 = await request(app)
      .post('/settle')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        fromUserId: 'B',
        toUserId: 'A',
        amount: '30.00',
      })
      .expect(201);

    const response2 = await request(app)
      .post('/settle')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        fromUserId: 'B',
        toUserId: 'A',
        amount: '30.00',
      })
      .expect(200);

    // Should return same response
    expect(response2.body).toEqual(response1.body);
    
    // Should only have one settlement in store
    const transactions = eventStore.listTransactions();
    const settlements = transactions.filter(t => t.type === 'SETTLEMENT');
    expect(settlements).toHaveLength(1);
  });

  it('should reject duplicate idempotency key with different body', async () => {
    // Create a debt first
    await request(app)
      .post('/transactions')
      .send({
        payerId: 'A',
        amount: '100.00',
        category: 'food',
      })
      .expect(201);

    const idempotencyKey = 'settle-key-123';
    
    await request(app)
      .post('/settle')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        fromUserId: 'B',
        toUserId: 'A',
        amount: '30.00',
      })
      .expect(201);

    await request(app)
      .post('/settle')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        fromUserId: 'B',
        toUserId: 'A',
        amount: '40.00', // Different amount
      })
      .expect(409);
  });

  it('should reject invalid fromUserId', async () => {
    await request(app)
      .post('/settle')
      .send({
        fromUserId: 'INVALID',
        toUserId: 'A',
        amount: '30.00',
      })
      .expect(422);
  });

  it('should reject invalid toUserId', async () => {
    await request(app)
      .post('/settle')
      .send({
        fromUserId: 'B',
        toUserId: 'INVALID',
        amount: '30.00',
      })
      .expect(422);
  });

  it('should reject invalid amount format', async () => {
    await request(app)
      .post('/settle')
      .send({
        fromUserId: 'B',
        toUserId: 'A',
        amount: '30.123', // Too many decimal places
      })
      .expect(422);
  });

  it('should reject negative amount', async () => {
    await request(app)
      .post('/settle')
      .send({
        fromUserId: 'B',
        toUserId: 'A',
        amount: '-30.00',
      })
      .expect(422);
  });

  it('should reject missing required fields', async () => {
    await request(app)
      .post('/settle')
      .send({
        fromUserId: 'B',
        // Missing toUserId and amount
      })
      .expect(422);
  });

  it('should handle complex settlement scenarios', async () => {
    // Create multiple debts
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

    // Now B owes A 50 (food), A owes B 60 (groceries)
    // Net: A owes B 10

    // A settles 5 to B
    const response = await request(app)
      .post('/settle')
      .send({
        fromUserId: 'A',
        toUserId: 'B',
        amount: '5.00',
      })
      .expect(201);

    // Net due should be reduced
    expect(response.body.summary.netDue).toEqual({
      owes: 'A',
      amount: 5, // 10 - 5
    });

    // Try to settle more than remaining
    await request(app)
      .post('/settle')
      .send({
        fromUserId: 'A',
        toUserId: 'B',
        amount: '10.00', // More than the 5 remaining
      })
      .expect(422);
  });
});
