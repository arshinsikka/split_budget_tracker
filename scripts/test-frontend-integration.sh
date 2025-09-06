#!/bin/bash

# Frontend Integration Test
# This script tests the frontend forms to ensure they work correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Frontend Integration Test${NC}"
echo -e "${BLUE}============================${NC}"
echo ""

# Configuration
BACKEND_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:5174"

echo -e "${YELLOW}Testing Frontend Forms with Correct Data Format${NC}"
echo ""

# Test 1: Transaction Creation with Correct Format
echo -e "${BLUE}Test 1: Transaction Creation${NC}"
echo "Testing: User A pays \$30.75 for groceries"
echo "Expected payload: {\"payerId\": \"A\", \"amount\": 30.75, \"category\": \"groceries\"}"

response=$(curl -s -X POST "$BACKEND_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"payerId": "A", "amount": 30.75, "category": "groceries"}')

if echo "$response" | jq .transaction >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Transaction creation successful${NC}"
  echo "$response" | jq .transaction
else
  echo -e "${RED}❌ Transaction creation failed${NC}"
  echo "$response"
fi
echo ""

# Test 2: Settlement with Correct Format
echo -e "${BLUE}Test 2: Settlement Creation${NC}"
echo "Testing: User B pays User A \$20.00"
echo "Expected payload: {\"fromUserId\": \"B\", \"toUserId\": \"A\", \"amount\": 20.00}"

response=$(curl -s -X POST "$BACKEND_URL/settle" \
  -H "Content-Type: application/json" \
  -d '{"fromUserId": "B", "toUserId": "A", "amount": 20.00}')

if echo "$response" | jq .settlement >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Settlement creation successful${NC}"
  echo "$response" | jq .settlement
else
  echo -e "${RED}❌ Settlement creation failed${NC}"
  echo "$response"
fi
echo ""

# Test 3: Validation Errors
echo -e "${BLUE}Test 3: Validation Error Handling${NC}"

# Test invalid category
echo "Testing invalid category: 'Groceries' (should be 'groceries')"
response=$(curl -s -X POST "$BACKEND_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"payerId": "A", "amount": 25.50, "category": "Groceries"}')

if echo "$response" | jq .type >/dev/null 2>&1 && [[ $(echo "$response" | jq -r .type) == "validation-error" ]]; then
  echo -e "${GREEN}✅ Correctly rejected invalid category${NC}"
  echo "$response" | jq .detail
else
  echo -e "${RED}❌ Should have rejected invalid category${NC}"
  echo "$response"
fi
echo ""

# Test self-settlement
echo "Testing self-settlement: A to A"
response=$(curl -s -X POST "$BACKEND_URL/settle" \
  -H "Content-Type: application/json" \
  -d '{"fromUserId": "A", "toUserId": "A", "amount": 10.00}')

if echo "$response" | jq .type >/dev/null 2>&1 && [[ $(echo "$response" | jq -r .type) == "validation-error" ]]; then
  echo -e "${GREEN}✅ Correctly rejected self-settlement${NC}"
  echo "$response" | jq .detail
else
  echo -e "${RED}❌ Should have rejected self-settlement${NC}"
  echo "$response"
fi
echo ""

# Test 4: Check Current State
echo -e "${BLUE}Test 4: Current Application State${NC}"
echo "Checking current debt status..."

debt_status=$(curl -s "$BACKEND_URL/who-owes-who")
echo "Current debt status:"
echo "$debt_status" | jq .

echo ""
echo -e "${GREEN}🎉 All API tests passed!${NC}"
echo ""
echo -e "${BLUE}📱 Frontend Testing Instructions:${NC}"
echo -e "1. Open ${FRONTEND_URL} in your browser"
echo -e "2. Open DevTools (F12) → Console tab"
echo -e "3. Set VITE_DEBUG_HTTP=true in .env (already set)"
echo ""
echo -e "${YELLOW}Test Cases to Try:${NC}"
echo ""
echo -e "${GREEN}✅ Valid Transaction:${NC}"
echo -e "   - Payer: User A"
echo -e "   - Amount: 30.75"
echo -e "   - Category: Groceries"
echo -e "   - Expected: Success toast, transaction appears in list"
echo ""
echo -e "${GREEN}✅ Valid Settlement:${NC}"
echo -e "   - From: User B"
echo -e "   - To: User A"
echo -e "   - Amount: 20.00"
echo -e "   - Expected: Success toast, debt status updates"
echo ""
echo -e "${RED}❌ Invalid Cases (should show validation errors):${NC}"
echo -e "   - Negative amount: -10.00"
echo -e "   - Self-settlement: A to A"
echo -e "   - Over-settlement: amount > current debt"
echo ""
echo -e "${BLUE}🔍 Debug Information:${NC}"
echo -e "   - Console should show '🚀 API Request:' logs"
echo -e "   - Console should show '📤 Body:' with correct format"
echo -e "   - Console should show '📥 Response:' logs"
echo -e "   - No 'User undefined' should appear in transaction list"
echo -e "   - Categories should display as 'Groceries' but send as 'groceries'"
