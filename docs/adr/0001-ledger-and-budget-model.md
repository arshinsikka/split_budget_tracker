# ADR 0001: Ledger and Budget Model

## Context

We need a reliable system for tracking shared expenses between two friends that maintains consistency between "spent vs paid vs owed" amounts. The system must handle currency rounding, prevent over-settlement, and provide clear audit trails.

## Decision

We will implement a minimal double-entry ledger system with the following characteristics:

### Account Structure

For two users "A" and "B", we maintain these account types:

- **CASH:{user}** (asset) - Wallet balance for each user
- **EXPENSE:{user}:{category}** (expense) - Budget tracking by category
- **DUE_FROM:A->B** (asset) - Amount A is owed by B
- **DUE_TO:B->A** (liability) - Amount B owes to A

### Transaction Types

#### Group Expense (payer pays total T, split equally)

When user A pays $100.00 for food:

```
Expense: +50.00 to EXPENSE:A:food, +50.00 to EXPENSE:B:food
Cash: -100.00 to CASH:A
Inter-user: +50.00 to DUE_FROM:A->B, -50.00 to DUE_TO:B->A
```

#### Settlement (B pays A amount S)

When B pays A $30.00:

```
Cash: -30.00 to CASH:B, +30.00 to CASH:A
Dues: -30.00 to DUE_FROM:A->B, -30.00 to DUE_TO:B->A
```

### Rounding Policy

We use **banker's rounding** to 2 decimal places. When splitting creates a 0.01 remainder, assign the odd cent to the payer's receivable.

**Example**: A pays $101.00 for food

- Split: $101.00 ÷ 2 = $50.50 each
- Rounding: $50.50 → $50.50 (no change)
- Result: Each owes $50.50, A is owed $50.50 by B

**Example**: A pays $100.01 for groceries

- Split: $100.01 ÷ 2 = $50.005 each
- Rounding: $50.005 → $50.01 (banker's rounding)
- Result: Each owes $50.01, A is owed $50.01 by B

### Idempotency Policy

Support optional `Idempotency-Key` header on POST endpoints:

- **New request**: Process normally, return 201 Created
- **Duplicate key + identical body**: Return 200 OK with original response
- **Duplicate key + different body**: Return 409 Conflict with RFC7807 error

**Example**:

```http
POST /transactions
Idempotency-Key: abc123
{"payerId": "A", "amount": 50.00, "category": "food"}
```

### Invariants

1. **Balance**: Each transaction sums to zero (∑ deltas = 0)
2. **Duality**: DUE_FROM:A->B = -DUE_TO:B->A always
3. **Budget isolation**: Settlements never affect EXPENSE accounts
4. **Wallet consistency**: User balance = initial + ∑ CASH deltas
5. **Non-negative amounts**: Reject amounts ≤ 0
6. **Precision**: All amounts rounded to 2 decimal places

### API Response Format

All API responses use **numbers with 2 decimal places** for money amounts, not strings. This provides better JSON serialization and avoids string parsing issues.

**Example response**:

```json
{
  "userId": "A",
  "walletBalance": 440.0,
  "budgetByCategory": {
    "food": 60.0,
    "groceries": 0.0,
    "transport": 0.0,
    "entertainment": 0.0,
    "other": 0.0
  },
  "netPosition": {
    "owes": null,
    "amount": 0.0
  }
}
```

### Additional Endpoints (Day 5)

#### GET /summary?userId={A|B}

Returns a compact user dashboard with wallet balance, budget by category, and net position relative to the other user.

**Response format**:

```json
{
  "userId": "A",
  "walletBalance": 440.0,
  "budgetByCategory": {
    "food": 60.0,
    "groceries": 0.0,
    "transport": 0.0,
    "entertainment": 0.0,
    "other": 0.0
  },
  "netPosition": {
    "owes": "B",
    "amount": 60.0
  }
}
```

#### GET /who-owes-who

Returns simplified debt summary showing who owes whom and how much.

**Response format**:

```json
{
  "owes": "B",
  "to": "A",
  "amount": 60.0
}
```

When no debt exists:

```json
{
  "owes": null,
  "to": null,
  "amount": 0.0
}
```

#### POST /seed/init?demo=true

Initializes the system with sample data for demonstration and testing purposes. Preloads three transactions:

1. A pays 120.00 food
2. B pays 80.00 groceries
3. A pays 50.00 transport

**Response**: Current state after demo data creation.

### Error Model

Use RFC 7807 Problem Details with these types:

- `validation-error` (422): Invalid payload/amount/category
- `over-settlement` (400): Paying more than owed
- `idempotency-conflict` (409): Key exists with different body
- `not-found` (404): Unknown routes

**Example error**:

```json
{
  "type": "validation-error",
  "title": "Invalid amount",
  "detail": "Amount must be positive and have at most 2 decimal places",
  "status": 422
}
```

## Consequences

### Positive

- **Correctness**: Double-entry ensures mathematical consistency
- **Auditability**: Complete transaction history with clear causality
- **Flexibility**: Easy to extend with new transaction types
- **Reliability**: Idempotency prevents duplicate processing

### Negative

- **Complexity**: More complex than simple totals
- **Performance**: Multiple account updates per transaction
- **Storage**: More data to persist (though minimal for 2 users)

## Alternatives Considered

### Simple Totals (Rejected)

Track running totals of who owes whom. Simpler but harder to audit and correct errors.

### Single Account Per User (Rejected)

One balance per user. Loses category-level budget tracking.

### Floating Point (Rejected)

Use floating point for amounts. Prone to rounding errors in financial calculations.

### No Idempotency (Rejected)

Simpler but allows duplicate transactions on retries.
