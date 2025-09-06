/**
 * Express routes for Split Budget Tracker API
 *
 * Implements all required endpoints with Zod validation,
 * ledger integration, and RFC 7807 error responses.
 */

import { Router, Request, Response, NextFunction } from 'express';

import { postGroupExpense, postSettlement } from '../../lib/ledger';
import { eventStore } from '../../repo/eventStore';
import {
  computeCompleteSummary,
  computeNetDue,
  computeUserSummaryCents,
} from '../../services/projections';
import {
  GroupExpenseInputSchema,
  SettlementInputSchema,
  IdempotencyKeySchema,
  UserSummaryQuerySchema,
  SummaryQuerySchema,
  SeedInitQuerySchema,
  type GroupExpenseInput,
  type SettlementInput,
} from './validators';
import { ValidationError, ConflictError } from './errorHandler';
import { v4 as uuidv4 } from 'uuid';
import { ACCOUNTS } from '../../lib/ledger';

const router = Router();

/**
 * GET /users - Get user summaries and net due
 */
router.get('/users', (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse query parameters
    const queryResult = UserSummaryQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      throw new ValidationError('Invalid query parameters');
    }

    const { userId } = queryResult.data;
    const entries = eventStore.getLedgerEntries();
    const summary = computeCompleteSummary(entries);

    if (userId) {
      // Return specific user summary
      const userSummary = summary.users.find(u => u.userId === userId);
      if (!userSummary) {
        throw new ValidationError(`User ${userId} not found`);
      }
      res.json(userSummary);
    } else {
      // Return complete summary
      res.json(summary);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /users-cents - Get user summaries in integer cents format
 */
router.get('/users-cents', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const entries = eventStore.getLedgerEntries();

    // Get summaries for both users in cents format
    const userASummary = computeUserSummaryCents('A', entries);
    const userBSummary = computeUserSummaryCents('B', entries);

    res.json({
      users: [userASummary, userBSummary],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /summary - Get compact summary for one user
 */
router.get('/summary', (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse query parameters
    const queryResult = SummaryQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      throw new ValidationError('Invalid query parameters');
    }

    const { userId } = queryResult.data;
    const entries = eventStore.getLedgerEntries();
    const summary = computeCompleteSummary(entries);
    const netDue = computeNetDue(entries);

    // Find the user summary
    const userSummary = summary.users.find(u => u.userId === userId);
    if (!userSummary) {
      throw new ValidationError(`User ${userId} not found`);
    }

    // Create compact summary with net position relative to other user
    const otherUserId = userId === 'A' ? 'B' : 'A';
    const netPosition = {
      owes: netDue.owes === userId ? otherUserId : netDue.owes,
      amount:
        netDue.owes === userId ? netDue.amount : netDue.owes === otherUserId ? netDue.amount : 0,
    };

    const compactSummary = {
      userId: userSummary.userId,
      walletBalance: userSummary.walletBalance,
      budgetByCategory: userSummary.budgetByCategory,
      netPosition,
    };

    res.json(compactSummary);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /who-owes-who - Get simplified debt summary
 */
router.get('/who-owes-who', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const entries = eventStore.getLedgerEntries();
    const netDue = computeNetDue(entries);

    const debtSummary = {
      owes: netDue.owes,
      to: netDue.owes === 'A' ? 'B' : netDue.owes === 'B' ? 'A' : null,
      amount: netDue.amount,
    };

    res.json(debtSummary);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /transactions - Create a group expense
 */
router.post('/transactions', (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const bodyResult = GroupExpenseInputSchema.safeParse(req.body);
    if (!bodyResult.success) {
      console.error('Validation error:', bodyResult.error);
      console.error('Request body:', req.body);
      throw new ValidationError('Invalid request body');
    }

    const input: GroupExpenseInput = bodyResult.data;

    // Validate idempotency key header
    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (idempotencyKey) {
      const keyResult = IdempotencyKeySchema.safeParse(idempotencyKey);
      if (!keyResult.success) {
        throw new ValidationError('Invalid idempotency key');
      }

      // Check for existing idempotency response
      const existingResponse = eventStore.getIdempotencyResponse(idempotencyKey);
      if (existingResponse) {
        // Check if request body matches
        const existingInput = existingResponse.input;
        if (JSON.stringify(existingInput) === JSON.stringify(input)) {
          return res.status(200).json(existingResponse.data);
        } else {
          throw new ConflictError('Idempotency key exists with different request body');
        }
      }
    }

    // Convert string amount to number for ledger
    const numericInput = {
      ...input,
      amount: parseFloat(input.amount),
    };

    // Post to ledger
    let entries;
    try {
      entries = postGroupExpense(numericInput);
    } catch (ledgerError) {
      console.error('Ledger error:', ledgerError);
      console.error('Input was:', numericInput);
      throw ledgerError;
    }

    // Store transaction
    const transaction = eventStore.addGroupExpense(numericInput, entries);

    // Compute updated summary
    const summary = computeCompleteSummary(eventStore.getLedgerEntries());

    const response = {
      transaction,
      summary,
    };

    // Store idempotency response if key provided
    if (idempotencyKey) {
      eventStore.storeIdempotencyResponse(idempotencyKey, {
        input,
        data: response,
      });
    }

    return res.status(201).json(response);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /transactions - List all transactions
 */
router.get('/transactions', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const transactions = eventStore.listTransactions();
    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /settle - Create a settlement
 */
router.post('/settle', (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const bodyResult = SettlementInputSchema.safeParse(req.body);
    if (!bodyResult.success) {
      // Check for specific Zod validation errors
      const errors = bodyResult.error.errors;
      const selfSettlementError = errors.find(e => e.message === 'Cannot settle with yourself');
      if (selfSettlementError) {
        throw new ValidationError('Cannot settle with yourself');
      }
      throw new ValidationError('Invalid request body');
    }

    const input: SettlementInput = bodyResult.data;

    // Validate idempotency key header
    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (idempotencyKey) {
      const keyResult = IdempotencyKeySchema.safeParse(idempotencyKey);
      if (!keyResult.success) {
        throw new ValidationError('Invalid idempotency key');
      }

      // Check for existing idempotency response
      const existingResponse = eventStore.getIdempotencyResponse(idempotencyKey);
      if (existingResponse) {
        // Check if request body matches
        const existingInput = existingResponse.input;
        if (JSON.stringify(existingInput) === JSON.stringify(input)) {
          return res.status(200).json(existingResponse.data);
        } else {
          throw new ConflictError('Idempotency key exists with different request body');
        }
      }
    }

    // Convert string amount to number for ledger
    const numericInput = {
      ...input,
      amount: parseFloat(input.amount),
    };

    // Check for over-settlement
    const currentNetDue = computeNetDue(eventStore.getLedgerEntries());
    const settlementAmount = numericInput.amount;

    if (currentNetDue.owes === null) {
      // No money is owed, any settlement is invalid
      throw new ValidationError(`Over-settlement: No money is owed between users`);
    } else if (currentNetDue.owes !== input.fromUserId) {
      // The payer doesn't owe money, this settlement is invalid (wrong direction)
      throw new ValidationError(
        `Over-settlement: ${input.fromUserId} does not owe ${input.toUserId}, cannot settle in this direction`
      );
    } else {
      // The payer owes money, check if they're paying more than owed
      if (settlementAmount > currentNetDue.amount) {
        throw new ValidationError(
          `Over-settlement: Attempted to settle ${settlementAmount} but only ${currentNetDue.amount} is owed`
        );
      }
    }
    // If currentNetDue.owes === input.fromUserId and amount <= currentNetDue.amount, settlement is valid

    // Post to ledger
    const settlementEntries = postSettlement(numericInput);

    // Store transaction
    const settlement = eventStore.addSettlement(numericInput, settlementEntries);

    // Compute updated summary
    const summary = computeCompleteSummary(eventStore.getLedgerEntries());

    const response = {
      settlement,
      summary,
    };

    // Store idempotency response if key provided
    if (idempotencyKey) {
      eventStore.storeIdempotencyResponse(idempotencyKey, {
        input,
        data: response,
      });
    }

    return res.status(201).json(response);
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /seed/init - Reset in-memory state and set starting wallets (test/demo convenience)
 */
router.post('/seed/init', (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse query parameters for demo mode
    const queryResult = SeedInitQuerySchema.safeParse(req.query);
    const isDemo = queryResult.success && queryResult.data.demo === 'true';

    // Parse request body with defaults
    const body = req.body || {};
    const walletA = body.walletA ?? 500; // Default to $500
    const walletB = body.walletB ?? 500; // Default to $500

    // Validate inputs
    if (typeof walletA !== 'number' || typeof walletB !== 'number') {
      throw new ValidationError('walletA and walletB must be numbers');
    }

    if (walletA < 0 || walletB < 0) {
      throw new ValidationError('Wallet balances cannot be negative');
    }

    // Clear event store and set initial state
    eventStore.clear();

    // Set initial wallet balances by creating initial cash entries
    const initialEntries = [
      {
        id: uuidv4(),
        txType: 'INITIAL' as const,
        txId: 'initial',
        account: ACCOUNTS.CASH('A'),
        userId: 'A' as const,
        delta: walletA,
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        txType: 'INITIAL' as const,
        txId: 'initial',
        account: ACCOUNTS.CASH('B'),
        userId: 'B' as const,
        delta: walletB,
        createdAt: new Date().toISOString(),
      },
    ];

    // Add initial entries to event store
    eventStore.addInitialEntries(initialEntries);

    // If demo mode, add sample transactions
    if (isDemo) {
      // Demo transaction 1: A pays 120 food
      const demo1Input: GroupExpenseInput = { payerId: 'A', amount: '120.00', category: 'food' };
      const demo1Entries = postGroupExpense({ ...demo1Input, amount: 120 });
      eventStore.addGroupExpense({ ...demo1Input, amount: 120 }, demo1Entries);

      // Demo transaction 2: B pays 80 groceries
      const demo2Input: GroupExpenseInput = {
        payerId: 'B',
        amount: '80.00',
        category: 'groceries',
      };
      const demo2Entries = postGroupExpense({ ...demo2Input, amount: 80 });
      eventStore.addGroupExpense({ ...demo2Input, amount: 80 }, demo2Entries);

      // Demo transaction 3: A pays 50 transport
      const demo3Input: GroupExpenseInput = {
        payerId: 'A',
        amount: '50.00',
        category: 'transport',
      };
      const demo3Entries = postGroupExpense({ ...demo3Input, amount: 50 });
      eventStore.addGroupExpense({ ...demo3Input, amount: 50 }, demo3Entries);
    }

    // Return current summary
    const summary = computeCompleteSummary(eventStore.getLedgerEntries());

    return res.status(200).json(summary);
  } catch (error) {
    return next(error);
  }
});

export { router as apiRouter };
