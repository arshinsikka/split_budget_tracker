/**
 * Health check endpoint
 *
 * Simple endpoint to verify the application is running and responsive.
 * Useful for monitoring, load balancers, and development verification.
 */

import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'split-budget-tracker',
    version: '0.1.0',
  });
});

export { router as healthRouter };
