# Split Budget Tracker

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/arshinsikka/split-budget-tracker)
[![Test Coverage](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/arshinsikka/split-budget-tracker)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A backend API for tracking shared expenses between two friends with double-entry ledger accounting for mathematical consistency.

## Features

- **Double-entry ledger** - Ensures "spent vs paid vs owed" is always consistent
- **Equal expense splitting** - Group expenses are split equally between users
- **Category-based budgets** - Track spending by category (food, groceries, transport, etc.)
- **Idempotency support** - Reliable retries with `Idempotency-Key` header
- **Banker's rounding** - Precise currency handling to 2 decimal places
- **Over-settlement protection** - Prevents paying more than what's owed
- **RFC 7807 error handling** - Standardized error responses with proper content types
- **Comprehensive test coverage** - Unit, integration, and property-based tests
- **OpenAPI specification** - Complete API documentation with examples

## Quick Start

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start development server
npm run dev

# Verify it's working
curl -s http://localhost:3000/health | jq
```

## API Documentation

- **OpenAPI Specification**: [openapi.yaml](./openapi.yaml)
- **Interactive Examples**: [api-examples.http](./api-examples.http) (VS Code REST Client)
- **Swagger UI**: Available at `/docs` when server is running

## Design Documentation

- **Architecture Decision Record**: [ADR-0001](./docs/adr/0001-ledger-and-budget-model.md)
- **Sequence Diagrams**: 
  - [Group Expense Flow](./docs/sequence-diagrams/group-expense.mmd)
  - [Settlement Flow](./docs/sequence-diagrams/settlement.mmd)

## API Overview

### Core Endpoints

- `GET /health` - Health check
- `GET /users` - Get both users' summaries (wallet balances, budgets, net due)
- `POST /transactions` - Create group expense (with idempotency support)
- `GET /transactions` - List all transactions
- `POST /settle` - Record settlement between users
- `GET /summary?userId=A` - Get user dashboard
- `GET /who-owes-who` - Simple debt summary
- `POST /seed/init?demo=true` - Create sample data

### Example Usage

```bash
# Create a group expense
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"payerId": "A", "amount": "100.00", "category": "food"}'

# Record a settlement
curl -X POST http://localhost:3000/settle \
  -H "Content-Type: application/json" \
  -d '{"fromUserId": "B", "toUserId": "A", "amount": "30.00"}'

# Get user summaries
curl http://localhost:3000/users

# Get user dashboard (Day 5 feature)
curl -s http://localhost:3000/summary?userId=A | jq

# Get debt summary (Day 5 feature)
curl -s http://localhost:3000/who-owes-who | jq

# Initialize with demo data (Day 5 feature)
curl -s -X POST "http://localhost:3000/seed/init?demo=true" | jq
```

### E2E Demo

Run the complete demo scenario:

```bash
# Run the end-to-end demo script
bash scripts/e2e.sh
```

This script:
1. Starts the server on a random port
2. Initializes with demo data (`POST /seed/init?demo=true`)
3. Creates sample transactions and settlements
4. Verifies final state with `jq` assertions
5. Cleans up the server process

### Idempotency

POST endpoints support optional `Idempotency-Key` header:

```bash
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: abc123" \
  -d '{"payerId": "A", "amount": "100.00", "category": "food"}'
```

- **New key**: Process normally, return 201 Created
- **Duplicate key + same body**: Return 200 OK with original response
- **Duplicate key + different body**: Return 409 Conflict

## Data Model

### Users
Exactly two users: "A" and "B"

### Account Types
- **CASH:{user}** - Wallet balance
- **EXPENSE:{user}:{category}** - Budget tracking by category
- **DUE_FROM:A->B** - Amount A is owed by B
- **DUE_TO:B->A** - Amount B owes to A

### Transaction Types
1. **Group Expense**: Payer pays total, split equally between users
2. **Settlement**: Direct payment between users (doesn't affect budgets)

### Currency
All amounts in SGD (Singapore Dollar) with 2 decimal places

## Development

### Project Structure

```
src/
├── domain/          # Business entities and pure logic
├── lib/ledger/      # Double-entry ledger implementation
├── services/        # Use cases and business operations
├── repo/            # Data persistence (in-memory)
└── adapters/http/   # Express routes and controllers
```

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Testing

```bash
# Run all tests
npm test

# Run tests once
npm run test:run

# Run with coverage
npm run test:run -- --coverage
```

## Quality & Reliability

### Audit Results
This implementation has been thoroughly audited against the Split Budget Tracker requirements:

✅ **Health Checks** - All tests passing (105 passed, 1 skipped)  
✅ **Endpoint Coverage** - All required endpoints implemented and tested  
✅ **Contract Verification** - OpenAPI spec matches implementation  
✅ **Money & Rounding** - Consistent banker's rounding with integer-cent arithmetic  
✅ **Idempotency** - Robust request deduplication with proper conflict detection  
✅ **Error Model** - RFC 7807 Problem Details with correct content types  
✅ **Ordering & Summaries** - Chronological transaction ordering and accurate projections  

### Test Coverage
- **Unit Tests** - Core ledger logic and money utilities
- **Integration Tests** - API endpoints with real HTTP requests
- **Property-Based Tests** - Random transaction sequences with oracle validation
- **Contract Tests** - OpenAPI specification compliance
- **Acceptance Tests** - End-to-end scenarios and edge cases

### Error Handling

The API uses RFC 7807 Problem Details for consistent error responses:

```json
{
  "type": "validation-error",
  "title": "Invalid amount",
  "detail": "Amount must be positive and have at most 2 decimal places",
  "status": 422
}
```

Common error types:
- `validation-error` (422) - Invalid payload/amount/category
- `over-settlement` (400) - Paying more than owed
- `idempotency-conflict` (409) - Key exists with different body
- `not-found` (404) - Unknown routes

## License

MIT
