# Demo Guide

This guide walks through the complete Split Budget Tracker demo scenario using real API calls and expected responses.

## Prerequisites

- Node.js 18+ installed
- `curl` and `jq` available in terminal
- Server running on `http://localhost:3000`

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm run dev

# In another terminal, run the demo
bash scripts/e2e.sh
```

## Manual Demo Steps

### 1. Initialize System

```bash
# Reset and initialize with demo data
curl -s -X POST "http://localhost:3000/seed/init?demo=true" | jq
```

**Expected Response**:

```json
{
  "users": [
    {
      "userId": "A",
      "walletBalance": 330,
      "budgetByCategory": {
        "food": 60,
        "groceries": 40,
        "transport": 25,
        "entertainment": 0,
        "other": 0
      }
    },
    {
      "userId": "B",
      "walletBalance": 420,
      "budgetByCategory": {
        "food": 60,
        "groceries": 40,
        "transport": 25,
        "entertainment": 0,
        "other": 0
      }
    }
  ],
  "netDue": {
    "owes": "B",
    "amount": 45
  }
}
```

**What happened**: Demo data created three transactions:

- A paid $120 food (split: $60 each)
- B paid $80 groceries (split: $40 each)
- A paid $50 transport (split: $25 each)

Net result: B owes A $45.

### 2. Check Current State

```bash
# Get user summaries
curl -s "http://localhost:3000/users" | jq

# Get debt summary
curl -s "http://localhost:3000/who-owes-who" | jq
```

**Expected Debt Summary**:

```json
{
  "owes": "B",
  "to": "A",
  "amount": 45
}
```

### 3. Create New Group Expense

```bash
# A pays for dinner
curl -s -X POST "http://localhost:3000/transactions" \
  -H "Content-Type: application/json" \
  -d '{"payerId": "A", "amount": "100.00", "category": "food"}' | jq
```

**Expected Response**:

```json
{
  "transaction": {
    "id": "tx-001",
    "type": "GROUP",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "payerId": "A",
    "amount": 100,
    "category": "food",
    "perUserShare": 50
  },
  "summary": {
    "users": [
      {
        "userId": "A",
        "walletBalance": 230,
        "budgetByCategory": {
          "food": 110,
          "groceries": 40,
          "transport": 25,
          "entertainment": 0,
          "other": 0
        }
      },
      {
        "userId": "B",
        "walletBalance": 420,
        "budgetByCategory": {
          "food": 110,
          "groceries": 40,
          "transport": 25,
          "entertainment": 0,
          "other": 0
        }
      }
    ],
    "netDue": {
      "owes": "B",
      "amount": 95
    }
  }
}
```

**What happened**: A's wallet decreased by $100, both food budgets increased by $50, B now owes A $95 total.

### 4. Record Settlement

```bash
# B pays A $60
curl -s -X POST "http://localhost:3000/settle" \
  -H "Content-Type: application/json" \
  -d '{"fromUserId": "B", "toUserId": "A", "amount": "60.00"}' | jq
```

**Expected Response**:

```json
{
  "settlement": {
    "id": "settle-001",
    "type": "SETTLEMENT",
    "createdAt": "2024-01-15T11:00:00.000Z",
    "fromUserId": "B",
    "toUserId": "A",
    "amount": 60
  },
  "summary": {
    "users": [
      {
        "userId": "A",
        "walletBalance": 290,
        "budgetByCategory": {
          "food": 110,
          "groceries": 40,
          "transport": 25,
          "entertainment": 0,
          "other": 0
        }
      },
      {
        "userId": "B",
        "walletBalance": 360,
        "budgetByCategory": {
          "food": 110,
          "groceries": 40,
          "transport": 25,
          "entertainment": 0,
          "other": 0
        }
      }
    ],
    "netDue": {
      "owes": "B",
      "amount": 35
    }
  }
}
```

**What happened**: B's wallet decreased by $60, A's wallet increased by $60, B now owes A $35 remaining.

### 5. Final Settlement

```bash
# B pays remaining $35
curl -s -X POST "http://localhost:3000/settle" \
  -H "Content-Type: application/json" \
  -d '{"fromUserId": "B", "toUserId": "A", "amount": "35.00"}' | jq
```

**Expected Response**:

```json
{
  "settlement": {
    "id": "settle-002",
    "type": "SETTLEMENT",
    "createdAt": "2024-01-15T12:00:00.000Z",
    "fromUserId": "B",
    "toUserId": "A",
    "amount": 35
  },
  "summary": {
    "users": [
      {
        "userId": "A",
        "walletBalance": 325,
        "budgetByCategory": {
          "food": 110,
          "groceries": 40,
          "transport": 25,
          "entertainment": 0,
          "other": 0
        }
      },
      {
        "userId": "B",
        "walletBalance": 325,
        "budgetByCategory": {
          "food": 110,
          "groceries": 40,
          "transport": 25,
          "entertainment": 0,
          "other": 0
        }
      }
    ],
    "netDue": {
      "owes": null,
      "amount": 0
    }
  }
}
```

**What happened**: Accounts are now balanced! Both users have $325 in their wallets and identical budget spending.

### 6. Verify Final State

```bash
# Check final balances
curl -s "http://localhost:3000/users" | jq

# Verify no debt remains
curl -s "http://localhost:3000/who-owes-who" | jq
```

**Expected Final Debt Summary**:

```json
{
  "owes": null,
  "to": null,
  "amount": 0
}
```

## Edge Case Testing

### Test Rounding with Odd Amounts

```bash
# Test $100.01 split (should be $50.01 each)
curl -s -X POST "http://localhost:3000/transactions" \
  -H "Content-Type: application/json" \
  -d '{"payerId": "A", "amount": "100.01", "category": "food"}' | jq
```

**Expected**: Each user owes $50.01, A is owed $50.01 by B.

### Test Over-Settlement Prevention

```bash
# Try to settle more than owed
curl -s -X POST "http://localhost:3000/settle" \
  -H "Content-Type: application/json" \
  -d '{"fromUserId": "B", "toUserId": "A", "amount": "1000.00"}' | jq
```

**Expected Error**:

```json
{
  "type": "validation-error",
  "title": "Over-settlement",
  "detail": "Over-settlement: Attempted to settle 1000 but only 50.01 is owed",
  "status": 422
}
```

### Test Wrong Direction Settlement

```bash
# Try to settle in wrong direction
curl -s -X POST "http://localhost:3000/settle" \
  -H "Content-Type: application/json" \
  -d '{"fromUserId": "A", "toUserId": "B", "amount": "25.00"}' | jq
```

**Expected Error**:

```json
{
  "type": "validation-error",
  "title": "Over-settlement",
  "detail": "Over-settlement: A does not owe B, cannot settle in this direction",
  "status": 422
}
```

## Idempotency Testing

### Test Duplicate Request

```bash
# First request
curl -s -X POST "http://localhost:3000/transactions" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-001" \
  -d '{"payerId": "A", "amount": "50.00", "category": "food"}' | jq

# Duplicate request (should return same response)
curl -s -X POST "http://localhost:3000/transactions" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-001" \
  -d '{"payerId": "A", "amount": "50.00", "category": "food"}' | jq
```

**Expected**: Second request returns 200 OK with identical response.

### Test Idempotency Conflict

```bash
# Same key, different body
curl -s -X POST "http://localhost:3000/transactions" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-001" \
  -d '{"payerId": "A", "amount": "75.00", "category": "food"}' | jq
```

**Expected Error**:

```json
{
  "type": "idempotency-conflict",
  "title": "Idempotency conflict",
  "detail": "Request with same key but different body already exists",
  "status": 409
}
```

## Automated Demo Script

The `scripts/e2e.sh` script runs the complete demo automatically:

```bash
# Run automated demo
bash scripts/e2e.sh
```

This script:

1. Starts server on random port
2. Initializes with demo data
3. Creates sample transactions
4. Records settlements
5. Verifies final state with `jq` assertions
6. Cleans up server process

## Expected Final Balances

After running the complete demo:

- **User A wallet**: $325.00
- **User B wallet**: $325.00
- **Net debt**: $0.00 (balanced)
- **Total food budget**: $110.00 each
- **Total groceries budget**: $40.00 each
- **Total transport budget**: $25.00 each

The demo demonstrates that the system maintains mathematical consistency across all transactions while providing clear audit trails and preventing financial errors.
