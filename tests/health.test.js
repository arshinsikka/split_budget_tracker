'use strict';
/**
 * Health endpoint tests
 *
 * Verifies the basic application setup and health check functionality.
 * These tests ensure the Express app starts correctly and responds to requests.
 */
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const vitest_1 = require('vitest');
const supertest_1 = __importDefault(require('supertest'));
const index_1 = __importDefault(require('../src/index'));
(0, vitest_1.describe)('Health Endpoint', () => {
  (0, vitest_1.it)('should return healthy status', async () => {
    const response = await (0, supertest_1.default)(index_1.default)
      .get('/health')
      .expect(200);
    (0, vitest_1.expect)(response.body).toEqual({
      status: 'healthy',
      timestamp: vitest_1.expect.any(String),
      service: 'split-budget-tracker',
      version: '0.1.0',
    });
    // Verify timestamp is a valid ISO string
    (0, vitest_1.expect)(new Date(response.body.timestamp)).toBeInstanceOf(
      Date
    );
  });
  (0, vitest_1.it)('should handle 404 for unknown routes', async () => {
    await (0, supertest_1.default)(index_1.default)
      .get('/unknown-route')
      .expect(404);
  });
});
//# sourceMappingURL=health.test.js.map
