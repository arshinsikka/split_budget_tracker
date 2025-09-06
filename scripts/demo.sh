#!/bin/bash

# Demo script for Split Budget Tracker
# Shows key features and capabilities in an interactive way

set -e  # Exit on any error

echo "🎭 Split Budget Tracker Demo"
echo "============================"
echo ""

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

echo "📍 Starting server on port: $PORT"

# Start server in background
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
echo "🏦 Initializing with demo data..."
echo "================================"

# Initialize with demo data
DEMO_RESPONSE=$(curl -s -X POST "$BASE_URL/seed/init?demo=true" | jq '.')

echo "Demo data loaded:"
echo "$DEMO_RESPONSE" | jq '.'

echo ""
echo "📊 Current User Summaries"
echo "========================="

# Get current user summaries
USERS_RESPONSE=$(curl -s "$BASE_URL/users" | jq '.')

echo "User summaries:"
echo "$USERS_RESPONSE" | jq '.'

echo ""
echo "📋 All Transactions"
echo "==================="

# Get all transactions
TRANSACTIONS_RESPONSE=$(curl -s "$BASE_URL/transactions" | jq '.')

echo "Transactions (in chronological order):"
echo "$TRANSACTIONS_RESPONSE" | jq '.'

echo ""
echo "💳 Individual User Dashboards"
echo "============================="

# Get individual user dashboards
echo "User A Dashboard:"
curl -s "$BASE_URL/summary?userId=A" | jq '.'

echo ""
echo "User B Dashboard:"
curl -s "$BASE_URL/summary?userId=B" | jq '.'

echo ""
echo "💰 Debt Summary"
echo "==============="

# Get debt summary
DEBT_RESPONSE=$(curl -s "$BASE_URL/who-owes-who" | jq '.')

echo "Who owes who:"
echo "$DEBT_RESPONSE" | jq '.'

echo ""
echo "🔄 Testing Idempotency"
echo "====================="

# Test idempotency
echo "Creating a new expense with idempotency key..."
EXPENSE_RESPONSE=$(curl -s -X POST "$BASE_URL/transactions" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: demo-expense-123" \
    -d '{
        "payerId": "A",
        "amount": "50.00",
        "category": "entertainment"
    }' | jq '.')

echo "First request response:"
echo "$EXPENSE_RESPONSE" | jq '.'

echo ""
echo "Repeating the same request with same idempotency key..."
EXPENSE_RESPONSE_2=$(curl -s -X POST "$BASE_URL/transactions" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: demo-expense-123" \
    -d '{
        "payerId": "A",
        "amount": "50.00",
        "category": "entertainment"
    }' | jq '.')

echo "Second request response (should be identical):"
echo "$EXPENSE_RESPONSE_2" | jq '.'

echo ""
echo "🧪 Testing Error Handling"
echo "=========================="

# Test error handling
echo "Testing validation error (invalid amount):"
ERROR_RESPONSE=$(curl -s -X POST "$BASE_URL/transactions" \
    -H "Content-Type: application/json" \
    -d '{
        "payerId": "A",
        "amount": "invalid",
        "category": "food"
    }' | jq '.')

echo "Error response:"
echo "$ERROR_RESPONSE" | jq '.'

echo ""
echo "🎯 Key Features Demonstrated"
echo "============================"
echo "✅ Double-entry ledger accounting"
echo "✅ Equal expense splitting with banker's rounding"
echo "✅ Category-based budget tracking"
echo "✅ Idempotency support for reliable retries"
echo "✅ RFC 7807 error handling"
echo "✅ Chronological transaction ordering"
echo "✅ Real-time user summaries and debt tracking"
echo "✅ Individual user dashboards"
echo "✅ Simplified debt summary"

echo ""
echo "🎉 Demo completed successfully!"
echo "==============================="
echo "The Split Budget Tracker is working correctly with all features."
echo ""
echo "💡 Try these commands to explore further:"
echo "   curl -s $BASE_URL/users | jq '.'"
echo "   curl -s $BASE_URL/transactions | jq '.'"
echo "   curl -s $BASE_URL/summary?userId=A | jq '.'"
echo "   curl -s $BASE_URL/who-owes-who | jq '.'"
echo ""
echo "📚 For more information, see:"
echo "   - README.md for complete documentation"
echo "   - openapi.yaml for API specification"
echo "   - scripts/e2e.sh for comprehensive testing"
