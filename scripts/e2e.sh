#!/bin/bash

# E2E test script for Split Budget Tracker
# Demonstrates a realistic scenario using curl and jq

set -e  # Exit on any error

echo "🚀 Starting Split Budget Tracker E2E test..."

# Function to cleanup server process
cleanup() {
    if [ ! -z "$SERVER_PID" ]; then
        echo "🧹 Cleaning up server process (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
}

# Set up cleanup on script exit
trap cleanup EXIT

# Find a free port
PORT=$(python3 -c "
import socket
s = socket.socket()
s.bind(('', 0))
print(s.getsockname()[1])
s.close()
")

echo "📍 Using port: $PORT"

# Start server in background with the correct port
echo "🔧 Starting server..."
PORT=$PORT npm run dev &
SERVER_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to be ready..."
for i in {1..30}; do
    if curl -s "http://localhost:$PORT/health" > /dev/null 2>&1; then
        echo "✅ Server is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Server failed to start within 30 seconds"
        exit 1
    fi
    sleep 1
done

BASE_URL="http://localhost:$PORT"

echo ""
echo "📊 Step 1: Seed initial state and get user summaries"
echo "===================================================="

# Seed initial state
SEED_RESPONSE=$(curl -s -X POST "$BASE_URL/seed/init" \
    -H "Content-Type: application/json" \
    -d '{
        "walletA": 500,
        "walletB": 500
    }' | jq '.')

echo "Seed response:"
echo "$SEED_RESPONSE" | jq '.'

# Get initial state
INITIAL_STATE=$(curl -s "$BASE_URL/users" | jq '.')

echo "Initial state:"
echo "$INITIAL_STATE" | jq '.'

# Verify initial state
echo ""
echo "🔍 Verifying initial state..."

# Check that both users have 500 wallet balance
WALLET_A=$(echo "$INITIAL_STATE" | jq -r '.users[0].walletBalance')
WALLET_B=$(echo "$INITIAL_STATE" | jq -r '.users[1].walletBalance')

if [ "$WALLET_A" != "500" ] || [ "$WALLET_B" != "500" ]; then
    echo "❌ Initial wallet balances are incorrect: A=$WALLET_A, B=$WALLET_B"
    exit 1
fi

# Check that net due is 0
NET_DUE=$(echo "$INITIAL_STATE" | jq -r '.netDue.owes')
if [ "$NET_DUE" != "null" ]; then
    echo "❌ Initial net due should be null, got: $NET_DUE"
    exit 1
fi

echo "✅ Initial state verified"

echo ""
echo "💰 Step 2: Create group expense (A pays 120 for food)"
echo "====================================================="

# Create expense with idempotency key
EXPENSE_RESPONSE=$(curl -s -X POST "$BASE_URL/transactions" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: e2e-food-expense" \
    -d '{
        "payerId": "A",
        "amount": "120.00",
        "category": "food"
    }' | jq '.')

echo "Expense response:"
echo "$EXPENSE_RESPONSE" | jq '.'

# Verify expense response
echo ""
echo "🔍 Verifying expense response..."

# Check transaction details
TX_TYPE=$(echo "$EXPENSE_RESPONSE" | jq -r '.transaction.type')
TX_PAYER=$(echo "$EXPENSE_RESPONSE" | jq -r '.transaction.payerId')
TX_AMOUNT=$(echo "$EXPENSE_RESPONSE" | jq -r '.transaction.amount')
TX_CATEGORY=$(echo "$EXPENSE_RESPONSE" | jq -r '.transaction.category')

if [ "$TX_TYPE" != "GROUP" ] || [ "$TX_PAYER" != "A" ] || [ "$TX_AMOUNT" != "120" ] || [ "$TX_CATEGORY" != "food" ]; then
    echo "❌ Transaction details incorrect: type=$TX_TYPE, payer=$TX_PAYER, amount=$TX_AMOUNT, category=$TX_CATEGORY"
    exit 1
fi

# Check wallet balances after expense
WALLET_A_AFTER=$(echo "$EXPENSE_RESPONSE" | jq -r '.summary.users[0].walletBalance')
WALLET_B_AFTER=$(echo "$EXPENSE_RESPONSE" | jq -r '.summary.users[1].walletBalance')

if [ "$WALLET_A_AFTER" != "380" ] || [ "$WALLET_B_AFTER" != "500" ]; then
    echo "❌ Wallet balances after expense incorrect: A=$WALLET_A_AFTER, B=$WALLET_B_AFTER"
    exit 1
fi

# Check net due after expense
NET_DUE_AFTER=$(echo "$EXPENSE_RESPONSE" | jq -r '.summary.netDue.owes')
NET_DUE_AMOUNT=$(echo "$EXPENSE_RESPONSE" | jq -r '.summary.netDue.amount')

if [ "$NET_DUE_AFTER" != "B" ] || [ "$NET_DUE_AMOUNT" != "60" ]; then
    echo "❌ Net due after expense incorrect: owes=$NET_DUE_AFTER, amount=$NET_DUE_AMOUNT"
    exit 1
fi

echo "✅ Expense response verified"

echo ""
echo "📋 Step 3: List all transactions"
echo "================================="

# Get transactions list
TRANSACTIONS=$(curl -s "$BASE_URL/transactions" | jq '.')

echo "Transactions:"
echo "$TRANSACTIONS" | jq '.'

# Verify transactions list
echo ""
echo "🔍 Verifying transactions list..."

# Check that we have exactly one transaction
TX_COUNT=$(echo "$TRANSACTIONS" | jq 'length')
if [ "$TX_COUNT" != "1" ]; then
    echo "❌ Expected 1 transaction, got: $TX_COUNT"
    exit 1
fi

# Check transaction details
FIRST_TX_TYPE=$(echo "$TRANSACTIONS" | jq -r '.[0].type')
FIRST_TX_PAYER=$(echo "$TRANSACTIONS" | jq -r '.[0].payerId')

if [ "$FIRST_TX_TYPE" != "GROUP" ] || [ "$FIRST_TX_PAYER" != "A" ]; then
    echo "❌ First transaction details incorrect: type=$FIRST_TX_TYPE, payer=$FIRST_TX_PAYER"
    exit 1
fi

echo "✅ Transactions list verified"

echo ""
echo "💸 Step 4: Create settlement (B pays A 60)"
echo "==========================================="

# Create settlement
SETTLEMENT_RESPONSE=$(curl -s -X POST "$BASE_URL/settle" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: e2e-settlement" \
    -d '{
        "fromUserId": "B",
        "toUserId": "A",
        "amount": "60.00"
    }' | jq '.')

echo "Settlement response:"
echo "$SETTLEMENT_RESPONSE" | jq '.'

# Verify settlement response
echo ""
echo "🔍 Verifying settlement response..."

# Check settlement details
SETTLEMENT_TYPE=$(echo "$SETTLEMENT_RESPONSE" | jq -r '.settlement.type')
SETTLEMENT_FROM=$(echo "$SETTLEMENT_RESPONSE" | jq -r '.settlement.fromUserId')
SETTLEMENT_TO=$(echo "$SETTLEMENT_RESPONSE" | jq -r '.settlement.toUserId')
SETTLEMENT_AMOUNT=$(echo "$SETTLEMENT_RESPONSE" | jq -r '.settlement.amount')

if [ "$SETTLEMENT_TYPE" != "SETTLEMENT" ] || [ "$SETTLEMENT_FROM" != "B" ] || [ "$SETTLEMENT_TO" != "A" ] || [ "$SETTLEMENT_AMOUNT" != "60" ]; then
    echo "❌ Settlement details incorrect: type=$SETTLEMENT_TYPE, from=$SETTLEMENT_FROM, to=$SETTLEMENT_TO, amount=$SETTLEMENT_AMOUNT"
    exit 1
fi

# Check wallet balances after settlement
WALLET_A_FINAL=$(echo "$SETTLEMENT_RESPONSE" | jq -r '.summary.users[0].walletBalance')
WALLET_B_FINAL=$(echo "$SETTLEMENT_RESPONSE" | jq -r '.summary.users[1].walletBalance')

if [ "$WALLET_A_FINAL" != "440" ] || [ "$WALLET_B_FINAL" != "440" ]; then
    echo "❌ Wallet balances after settlement incorrect: A=$WALLET_A_FINAL, B=$WALLET_B_FINAL"
    exit 1
fi

# Check net due after settlement
NET_DUE_FINAL=$(echo "$SETTLEMENT_RESPONSE" | jq -r '.summary.netDue.owes')
NET_DUE_FINAL_AMOUNT=$(echo "$SETTLEMENT_RESPONSE" | jq -r '.summary.netDue.amount')

if [ "$NET_DUE_FINAL" != "null" ] || [ "$NET_DUE_FINAL_AMOUNT" != "0" ]; then
    echo "❌ Net due after settlement incorrect: owes=$NET_DUE_FINAL, amount=$NET_DUE_FINAL_AMOUNT"
    exit 1
fi

echo "✅ Settlement response verified"

echo ""
echo "📊 Step 5: Get final user summaries"
echo "===================================="

# Get final state
FINAL_STATE=$(curl -s "$BASE_URL/users" | jq '.')

echo "Final state:"
echo "$FINAL_STATE" | jq '.'

# Verify final state
echo ""
echo "🔍 Verifying final state..."

# Check that both users have 440 wallet balance
FINAL_WALLET_A=$(echo "$FINAL_STATE" | jq -r '.users[0].walletBalance')
FINAL_WALLET_B=$(echo "$FINAL_STATE" | jq -r '.users[1].walletBalance')

if [ "$FINAL_WALLET_A" != "440" ] || [ "$FINAL_WALLET_B" != "440" ]; then
    echo "❌ Final wallet balances incorrect: A=$FINAL_WALLET_A, B=$FINAL_WALLET_B"
    exit 1
fi

# Check that net due is 0
FINAL_NET_DUE=$(echo "$FINAL_STATE" | jq -r '.netDue.owes')
if [ "$FINAL_NET_DUE" != "null" ]; then
    echo "❌ Final net due should be null, got: $FINAL_NET_DUE"
    exit 1
fi

# Check budget categories
BUDGET_A_FOOD=$(echo "$FINAL_STATE" | jq -r '.users[0].budgetByCategory.food // 0')
BUDGET_B_FOOD=$(echo "$FINAL_STATE" | jq -r '.users[1].budgetByCategory.food // 0')

if [ "$BUDGET_A_FOOD" != "60" ] || [ "$BUDGET_B_FOOD" != "60" ]; then
    echo "❌ Budget categories incorrect: A food=$BUDGET_A_FOOD, B food=$BUDGET_B_FOOD"
    exit 1
fi

echo "✅ Final state verified"

echo ""
echo "🎉 E2E test completed successfully!"
echo "===================================="
echo "✅ Initial state: Both users have 500 wallet balance, no debt"
echo "✅ Expense: A paid 120 for food, B owes A 60"
echo "✅ Settlement: B paid A 60, debt settled"
echo "✅ Final state: Both users have 440 wallet balance, no debt"
echo "✅ Budgets: Both users have 60 in food category"

echo ""
echo "🧪 Testing idempotency..."
echo "========================="

# Test idempotency by repeating the same request
IDEMPOTENCY_RESPONSE=$(curl -s -X POST "$BASE_URL/transactions" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: e2e-food-expense" \
    -d '{
        "payerId": "A",
        "amount": "120.00",
        "category": "food"
    }' | jq '.')

# Should return 200 (not 201) for idempotent request
IDEMPOTENCY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/transactions" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: e2e-food-expense" \
    -d '{
        "payerId": "A",
        "amount": "120.00",
        "category": "food"
    }')

if [ "$IDEMPOTENCY_STATUS" != "200" ]; then
    echo "❌ Idempotency test failed: expected 200, got $IDEMPOTENCY_STATUS"
    exit 1
fi

echo "✅ Idempotency test passed"

echo ""
echo "🎯 All tests passed! The Split Budget Tracker is working correctly."
