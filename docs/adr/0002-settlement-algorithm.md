# ADR 0002: Settlement Algorithm and Idempotency

## Context

We need a reliable settlement mechanism that prevents over-settlement, maintains mathematical consistency, and supports idempotent operations for reliable retries. The system must handle edge cases like zero balances, wrong settlement directions, and duplicate requests.

## Decision

We implement a three-layer validation system for settlements:

### 1. Pre-Settlement Validation

Before creating any ledger entries, we validate the settlement request against current balances:

```typescript
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
```

### 2. Settlement Direction Logic

Settlements can only flow from the debtor to the creditor:

- **Valid**: B owes A $50 → B can settle $30 to A
- **Invalid**: A owes B $50 → B cannot settle $30 to A (wrong direction)
- **Invalid**: No debt exists → Neither can settle to the other

### 3. Amount Validation

Settlement amounts must not exceed the current debt:

- **Valid**: B owes A $50 → B can settle $30 (partial) or $50 (full)
- **Invalid**: B owes A $50 → B cannot settle $60 (over-settlement)

### 4. Idempotency Implementation

POST endpoints support optional `Idempotency-Key` header:

```http
POST /settle
Idempotency-Key: settlement-001
Content-Type: application/json

{
  "fromUserId": "B",
  "toUserId": "A",
  "amount": "30.00"
}
```

**Behavior**:

- **New key**: Process normally, return 201 Created
- **Duplicate key + identical body**: Return 200 OK with original response
- **Duplicate key + different body**: Return 409 Conflict with RFC 7807 error

**Example conflict**:

```json
{
  "type": "idempotency-conflict",
  "title": "Idempotency conflict",
  "detail": "Request with same key but different body already exists",
  "status": 409
}
```

### 5. Settlement Ledger Entries

When a valid settlement is processed, we create four balanced ledger entries:

```typescript
// Settlement: B pays A $30.00
// 1. Debit B's cash (they paid)
{ account: "CASH:B", delta: -30.00 }

// 2. Credit A's cash (they received)
{ account: "CASH:A", delta: +30.00 }

// 3. Debit A's receivable from B (reduces what they're owed)
{ account: "DUE_FROM:A->B", delta: -30.00 }

// 4. Credit B's payable to A (reduces what they owe)
{ account: "DUE_TO:B->A", delta: +30.00 }
```

**Key Properties**:

- Settlements never affect expense accounts (budgets remain unchanged)
- Transaction is always balanced (sum of deltas = 0)
- DUE_FROM and DUE_TO accounts are properly mirrored

### 6. Edge Cases Handled

#### Zero Balance Settlement

```bash
# When no debt exists
curl -X POST /settle -d '{"fromUserId": "A", "toUserId": "B", "amount": "10.00"}'
# Returns: 422 "Over-settlement: No money is owed between users"
```

#### Wrong Direction Settlement

```bash
# When A owes B $50, but B tries to pay A
curl -X POST /settle -d '{"fromUserId": "B", "toUserId": "A", "amount": "30.00"}'
# Returns: 422 "Over-settlement: B does not owe A, cannot settle in this direction"
```

#### Over-Settlement Attempt

```bash
# When B owes A $50, but tries to pay $60
curl -X POST /settle -d '{"fromUserId": "B", "toUserId": "A", "amount": "60.00"}'
# Returns: 422 "Over-settlement: Attempted to settle 60 but only 50 is owed"
```

#### Self-Settlement Prevention

```bash
# User cannot settle with themselves
curl -X POST /settle -d '{"fromUserId": "A", "toUserId": "A", "amount": "10.00"}'
# Returns: 422 "Cannot settle with yourself"
```

### 7. Net Due Calculation

The `computeNetDue` function calculates who owes whom:

```typescript
// Net due = A's receivable - B's receivable
const netDue = dueFromAToB - dueFromBToA;

if (Math.abs(netDue) < 0.001) {
  return { owes: null, amount: 0 }; // Balanced
} else if (netDue > 0) {
  return { owes: 'B', amount: netDue }; // B owes A
} else {
  return { owes: 'A', amount: Math.abs(netDue) }; // A owes B
}
```

## Consequences

### Positive

- **Prevents financial errors**: Over-settlement is impossible
- **Clear error messages**: Users understand why settlements fail
- **Reliable retries**: Idempotency prevents duplicate processing
- **Audit trail**: Complete settlement history in ledger
- **Mathematical consistency**: Double-entry ensures balances are always correct

### Negative

- **Complexity**: Three-layer validation adds code complexity
- **Performance**: Must compute current balances before each settlement
- **Strict rules**: Users cannot settle in wrong direction (may be confusing)

## Alternatives Considered

### Allow Over-Settlement (Rejected)

Let users settle more than owed and create negative balances. Too risky for financial applications.

### Single Validation Layer (Rejected)

Only validate at ledger level. Would allow invalid settlements to be created then rejected.

### No Idempotency (Rejected)

Simpler but allows duplicate settlements on network retries.

### Floating Point Balances (Rejected)

Use floating point for net due calculations. Prone to precision errors.

## Implementation Notes

The settlement validation is implemented in `src/adapters/http/routes.ts` lines 257-272. The validation happens before any ledger entries are created, ensuring that invalid settlements never pollute the ledger state.

Idempotency is handled at the HTTP layer using a simple in-memory store of request hashes. For production, this would need to be replaced with a persistent store (Redis, database) to survive server restarts.
