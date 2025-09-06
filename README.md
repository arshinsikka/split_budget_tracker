# Split Budget Tracker

A backend API for tracking shared expenses between two friends using double-entry ledger accounting. Keeps "spent vs paid vs owed" amounts mathematically consistent.

## Requirements

- Node.js 20+
- npm 9+
- Ports 3000 (backend) and 5173 (frontend) must be free

## Features

- **Double-entry ledger** - Mathematical consistency between spent, paid, and owed amounts
- **Equal expense splitting** - Group expenses split equally between two users
- **Category-based budgets** - Track spending by category (food, groceries, transport, entertainment, other)
- **Idempotency support** - Reliable retries with `Idempotency-Key` header
- **Integer-cent arithmetic** - Precise currency handling with banker's rounding
- **Over-settlement protection** - Prevents paying more than what's owed
- **RFC 7807 error handling** - Standardized error responses
- **In-memory storage** - Simple persistence for demo purposes

## Quick Start

### Backend (API Server)

```bash
# Navigate to backend folder (if not already in root)
cd split_budget_tracker

# Install dependencies
npm install

# Development mode (hot reload on port 3000)
npm run dev

# OR Production mode
npm run build
npm start
```

Backend API is available at: http://localhost:3000

Swagger UI: http://localhost:3000/docs

### Frontend (Dashboard UI)

```bash
cd frontend
npm install

# Start dev server (Vite on port 5173)
npm run dev
```

Frontend UI is available at: http://localhost:5173

Make sure the backend is running on port 3000 first.

### Demo Data

```bash
# Load demo data via API
npm run demo

# Or via curl
curl -X POST "http://localhost:3000/seed/init?demo=true"
```

### Reset vs Demo

**Reset**: Clears all data and returns to clean baseline state

- User A wallet: $500.00
- User B wallet: $500.00
- Spend by category: $0.00
- Net balances: $0.00 (all settled up)

**Demo**: Loads sample transactions to demonstrate system functionality

- Shows how expenses are split and tracked
- Demonstrates settlement workflow
- Includes sample data for testing

**Where to trigger Reset/Demo**:

- **Frontend Dashboard**: Use the "Reset" and "Demo" buttons in the UI
- **Backend API**: Call `/seed/init` endpoint:
  - Reset: `curl -X POST "http://localhost:3000/seed/init?demo=false"`
  - Demo: `curl -X POST "http://localhost:3000/seed/init?demo=true"`

## End-to-End Run

1. Open **two terminals**:
   - **Terminal 1 (backend)**:
     ```bash
     cd split_budget_tracker
     npm install
     npm run dev
     ```
   - **Terminal 2 (frontend)**:
     ```bash
     cd frontend
     npm install
     npm run dev
     ```

2. Open [http://localhost:5173](http://localhost:5173) in your browser.
   - Dashboard shows both users' wallets and spends.
   - Use the UI buttons to **add group expenses, view transactions, and record settlements**.
   - All actions are powered by the backend API on [http://localhost:3000](http://localhost:3000).

3. To reset or demo-load:
   - Either use the buttons in the frontend,
   - Or call backend endpoints:
     - Reset: `curl -X POST "http://localhost:3000/seed/init?demo=false"`
     - Demo: `curl -X POST "http://localhost:3000/seed/init?demo=true"`

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
- `GET /users-cents` - Get user summaries in integer cents format
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

# Get user summaries in integer cents format
curl http://localhost:3000/users-cents

# Get user dashboard (Day 5 feature)
curl -s http://localhost:3000/summary?userId=A | jq

# Get debt summary (Day 5 feature)
curl -s http://localhost:3000/who-owes-who | jq

# Reset to clean state (both users $500, no transactions)
curl -X POST "http://localhost:3000/seed/init?demo=false"

# Load demo data (sample transactions)
curl -X POST "http://localhost:3000/seed/init?demo=true"
```

### Demo Scenario

**Prerequisites**: `curl`, `jq`, `bash`

Run the complete demo scenario:

```bash
# Run the automated demo script
bash scripts/e2e.sh
```

**Manual Demo Steps**:

1. **Initialize with demo data**:

```bash
curl -s -X POST "http://localhost:3000/seed/init?demo=true" | jq
```

2. **Create group expense** (A pays $120 dinner):

```bash
curl -s -X POST "http://localhost:3000/transactions" \
  -H "Content-Type: application/json" \
  -d '{"payerId": "A", "amount": "120.00", "category": "food"}' | jq
```

3. **Check who owes what**:

```bash
curl -s "http://localhost:3000/who-owes-who" | jq
# Returns: {"owes": "B", "to": "A", "amount": 60}
```

4. **Record settlement** (B pays A $60):

```bash
curl -s -X POST "http://localhost:3000/settle" \
  -H "Content-Type: application/json" \
  -d '{"fromUserId": "B", "toUserId": "A", "amount": "60.00"}' | jq
```

5. **Verify final state**:

```bash
curl -s "http://localhost:3000/users" | jq
curl -s "http://localhost:3000/who-owes-who" | jq
# Returns: {"owes": null, "to": null, "amount": 0}
```

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

## Design Overview

Summary of Approach:
I modeled the system using a three-lane ledger (Wallet for cash flow, Spend for consumption, Settle for net debt) to keep accounting consistent. I chose integer-cent arithmetic with deterministic rounding to avoid floating-point errors. Additional safeguards like idempotency keys and over-settlement protection ensure reliability and correctness.

The Split Budget Tracker uses a three-lane financial model to separate different types of money flows:

```
┌─────────────────┬─────────────────┬─────────────────┐
│   Wallet (cash) │ Spend (consume) │ Settle (net)    │
├─────────────────┼─────────────────┼─────────────────┤
│ Out-of-pocket   │ Your share of   │ What one user   │
│ payments and    │ each bill for   │ owes the other  │
│ reimbursements  │ budgeting       │ (sum of cross-  │
│                 │                 │ paid shares     │
│                 │                 │ minus settle-   │
│                 │                 │ ments)          │
└─────────────────┴─────────────────┴─────────────────┘
```

### Three-Lane Definitions

**Wallet (cash)**: Out-of-pocket payments and reimbursements. This tracks actual cash flow - when you pay a bill or receive a settlement.

**Spend (consumption)**: Your share of each bill for budgeting. This tracks what you consumed regardless of who paid, useful for personal budget tracking.

**Settle (net debt)**: What one user owes the other (sum of cross-paid shares minus settlements). This is the net amount that needs to be settled between users.

### Rounding Rule

For odd-cent totals, the payer receives the extra cent. This ensures deterministic handling of remainders.

**Example**: $20.01 bill split two ways

- A (payer): $10.01 (gets the extra cent)
- B (other): $10.00
- Total: $20.01 ✓

### Example Walkthrough

**Scenario**: A pays $20.00 + $20.01 for food and groceries

1. **After $20.00 food bill**:
   - Wallets: A -$20.00, B $0
   - Spend: A $10.00, B $10.00
   - Net: B owes A $10.00

2. **After $20.01 groceries bill**:
   - Wallets: A -$40.01, B $0
   - Spend: A $20.01, B $20.00 (A gets extra cent)
   - Net: B owes A $20.00

3. **After B settles $20.00**:
   - Wallets: A -$20.01, B -$20.00
   - Spend: A $20.01, B $20.00 (unchanged)
   - Net: $0 (balanced)

## CI & Scripts

This project uses GitHub Actions for continuous integration. All scripts are designed to run locally and in CI without errors.

### Core Scripts

- `npm run typecheck` – TypeScript type checking (no emit)
- `npm run lint` – ESLint with TypeScript support
- `npm run format` – Prettier format checking
- `npm run test` – Runs Vitest tests with dot reporter
- `npm run build` – Compiles TypeScript to dist/

### Development Scripts

- `npm run dev` – Start development server with tsx
- `npm run start` – Start production server from dist/
- `npm run demo` – Load demo data and show system functionality

### CI Pipeline

The CI runs on every push and pull request:

1. **Type Check** – Ensures TypeScript compiles without errors
2. **Lint** – ESLint with zero warnings allowed
3. **Format** – Prettier format validation
4. **Test** – All unit, integration, and acceptance tests
5. **Build** – Compile and verify build output


### Local Development

Run the full CI pipeline locally:

```bash
npm ci
npm run typecheck
npm run lint
npm run format
npm test
npm run build
```

### Code Quality

- **ESLint**: Configured with TypeScript rules and Prettier integration
- **Prettier**: Consistent code formatting across the project
- **TypeScript**: Strict type checking with comprehensive compiler options
- **Vitest**: Fast testing with TypeScript support

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

This implementation handles the core requirements for expense splitting between two users:

✅ **Health Checks** - All tests passing  
✅ **Endpoint Coverage** - All required endpoints implemented and tested  
✅ **Contract Verification** - OpenAPI spec matches implementation  
✅ **Money & Rounding** - Consistent banker's rounding with integer-cent arithmetic  
✅ **Idempotency** - Request deduplication with proper conflict detection  
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

## Troubleshooting

- If `npm run dev` fails, check Node.js version (`node -v` → must be >=20).
- If port 3000 or 5173 is already in use, stop other processes or change the port in config.
- If the frontend shows blank, confirm backend is running on port 3000.

## License

MIT
