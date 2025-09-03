/**
 * Split Budget Tracker - Main Application Entry Point
 *
 * A lightweight backend for tracking shared expenses between two friends.
 * Features double-entry style ledger for correctness and clear separation
 * between group expenses and personal settlements.
 */

import express from 'express';
import { errorHandler, NotFoundError } from './adapters/http/errorHandler';
import { healthRouter } from './adapters/http/healthRouter';
import { apiRouter } from './adapters/http/routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/health', healthRouter);
app.use('/', apiRouter);

// 404 handler for unknown routes
app.use('*', (_req, _res, next) => {
  next(new NotFoundError('Route not found'));
});

// Error handling (must be last)
app.use(errorHandler);

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Split Budget Tracker running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

export default app;
