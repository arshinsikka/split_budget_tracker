#!/bin/bash

# Comprehensive API and Frontend Integration Test
# This script tests all endpoints and verifies the frontend integration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Split Budget Tracker - Comprehensive Test${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Configuration
BACKEND_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:5174"

# Function to test API endpoint
test_api() {
    local endpoint=$1
    local method=${2:-GET}
    local data=$3
    local description=$4
    
    echo -e "${YELLOW}Testing: ${description}${NC}"
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -X POST "$BACKEND_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s "$BACKEND_URL$endpoint")
    fi
    
    if echo "$response" | jq . >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Success${NC}"
        echo "$response" | jq .
    else
        echo -e "${RED}❌ Failed${NC}"
        echo "$response"
    fi
    echo ""
}

# Test 1: Health Check
test_api "/health" "GET" "" "Health Check"

# Test 2: Get Users
test_api "/users" "GET" "" "Get Users"

# Test 3: Get Transactions
test_api "/transactions" "GET" "" "Get Transactions"

# Test 4: Get Debt Status
test_api "/who-owes-who" "GET" "" "Get Debt Status"

# Test 5: Create Transaction
test_api "/transactions" "POST" '{"payerId": "A", "amount": "15.75", "category": "food"}' "Create Transaction"

# Test 6: Create Settlement
test_api "/settle" "POST" '{"fromUserId": "B", "toUserId": "A", "amount": "10.00"}' "Create Settlement"

# Test 7: Get Summary for User A
test_api "/summary?userId=A" "GET" "" "Get Summary for User A"

# Test 8: Get Summary for User B
test_api "/summary?userId=B" "GET" "" "Get Summary for User B"

# Test 9: Initialize Demo Data
test_api "/seed/init?demo=true" "POST" "" "Initialize Demo Data"

echo -e "${GREEN}🎉 All API tests completed!${NC}"
echo ""
echo -e "${BLUE}📱 Frontend Testing:${NC}"
echo -e "1. Open ${FRONTEND_URL} in your browser"
echo -e "2. Test the Dashboard page - should show user balances and debt status"
echo -e "3. Test the Transactions page - should show transaction list and allow adding new expenses"
echo -e "4. Test the Settlement page - should show debt status and allow recording settlements"
echo -e "5. Verify all forms work without 'Invalid request body' errors"
echo ""
echo -e "${YELLOW}💡 If you see any errors, check the browser console (F12) for details${NC}"
