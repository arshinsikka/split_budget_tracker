/**
 * Health endpoint tests
 *
 * Verifies the basic application setup and health check functionality.
 * These tests ensure the Express app starts correctly and responds to requests.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Health Endpoint', () => {
  it('should return healthy status', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body).toEqual({
      status: 'healthy',
      timestamp: expect.any(String),
      service: 'split-budget-tracker',
      version: '0.1.0',
    });

    // Verify timestamp is a valid ISO string
    expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
  });

  it('should handle 404 for unknown routes', async () => {
    await request(app).get('/unknown-route').expect(404);
  });
});
