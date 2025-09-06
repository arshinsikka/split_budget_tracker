/**
 * API tests for /transactions endpoints
 *
 * Tests group expense creation, transaction listing, and validation.
 */

import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../src/index';
import { eventStore } from '../../src/repo/eventStore';

describe('POST /transactions', () => {
  beforeEach(() => {
    eventStore.clear();
  });

  it('should create a group expense successfully', async () => {
    const response = await request(app)
      .post('/transactions')
      .send({
        payerId: 'A',
        amount: '100.00',
        category: 'food',
      })
      .expect(201);

    expect(response.body).toHaveProperty('transaction');
    expect(response.body).toHaveProperty('summary');

    const { transaction, summary } = response.body;

    expect(transaction).toEqual({
      id: expect.any(String),
      type: 'GROUP',
      payerId: 'A',
      amount: 100,
      category: 'food',
      perUserShare: 50,
      remainder: 0,
      createdAt: expect.any(String),
    });

    expect(summary.users).toHaveLength(2);
    expect(summary.netDue).toEqual({
      owes: 'B',
      amount: 50,
    });
  });

  it('should handle odd amounts with remainder', async () => {
    const response = await request(app)
      .post('/transactions')
      .send({
        payerId: 'A',
        amount: '101.00',
        category: 'groceries',
      })
      .expect(201);

    const { transaction } = response.body;

    expect(transaction.perUserShare).toBe(50.5);
    expect(transaction.remainder).toBe(0);
  });

  it('should support idempotency key', async () => {
    const idempotencyKey = 'test-key-123';

    const response1 = await request(app)
      .post('/transactions')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        payerId: 'A',
        amount: '100.00',
        category: 'food',
      })
      .expect(201);

    const response2 = await request(app)
      .post('/transactions')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        payerId: 'A',
        amount: '100.00',
        category: 'food',
      })
      .expect(200);

    // Should return same response
    expect(response2.body).toEqual(response1.body);

    // Should only have one transaction in store
    const transactions = eventStore.listTransactions();
    expect(transactions).toHaveLength(1);
  });

  it('should reject duplicate idempotency key with different body', async () => {
    const idempotencyKey = 'test-key-123';

    await request(app)
      .post('/transactions')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        payerId: 'A',
        amount: '100.00',
        category: 'food',
      })
      .expect(201);

    await request(app)
      .post('/transactions')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        payerId: 'A',
        amount: '200.00', // Different amount
        category: 'food',
      })
      .expect(409);
  });

  it('should reject invalid payerId', async () => {
    await request(app)
      .post('/transactions')
      .send({
        payerId: 'INVALID',
        amount: '100.00',
        category: 'food',
      })
      .expect(422);
  });

  it('should reject invalid amount format', async () => {
    await request(app)
      .post('/transactions')
      .send({
        payerId: 'A',
        amount: '100.123', // Too many decimal places
        category: 'food',
      })
      .expect(422);
  });

  it('should reject negative amount', async () => {
    await request(app)
      .post('/transactions')
      .send({
        payerId: 'A',
        amount: '-100.00',
        category: 'food',
      })
      .expect(422);
  });

  it('should reject invalid category', async () => {
    await request(app)
      .post('/transactions')
      .send({
        payerId: 'A',
        amount: '100.00',
        category: 'INVALID',
      })
      .expect(422);
  });

  it('should reject missing required fields', async () => {
    await request(app)
      .post('/transactions')
      .send({
        payerId: 'A',
        // Missing amount and category
      })
      .expect(422);
  });
});

describe('GET /transactions', () => {
  beforeEach(() => {
    eventStore.clear();
  });

  it('should return empty array when no transactions exist', async () => {
    const response = await request(app).get('/transactions').expect(200);
    expect(response.body).toEqual([]);
  });

  it('should return all transactions in chronological order', async () => {
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
        fromUserId: 'A',
        toUserId: 'B',
        amount: '10.00',
      })
      .expect(201);

    const response = await request(app).get('/transactions').expect(200);

    expect(response.body).toHaveLength(3);

    // Should be in chronological order
    const transactions = response.body;
    expect(transactions[0].type).toBe('GROUP');
    expect(transactions[1].type).toBe('GROUP');
    expect(transactions[2].type).toBe('SETTLEMENT');

    // Check timestamps are in order
    const timestamps = transactions.map((t: any) => new Date(t.createdAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
  });

  it('should return correct transaction structure', async () => {
    await request(app)
      .post('/transactions')
      .send({
        payerId: 'A',
        amount: '100.00',
        category: 'food',
      })
      .expect(201);

    const response = await request(app).get('/transactions').expect(200);

    expect(response.body[0]).toEqual({
      id: expect.any(String),
      type: 'GROUP',
      payerId: 'A',
      amount: 100,
      category: 'food',
      perUserShare: 50,
      remainder: 0,
      createdAt: expect.any(String),
    });
  });
});
