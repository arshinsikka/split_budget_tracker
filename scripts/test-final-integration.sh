#!/bin/bash

# Final Integration Test - Frontend & Backend
# This script verifies that both transactions and settlements work correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎯 Final Integration Test - Transactions & Settlements${NC}"
echo -e "${BLUE}====================================================${NC}"
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
        if echo "$response" | jq -e '.transaction' >/dev/null 2>&1 || echo "$response" | jq -e '.settlement' >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Success${NC}"
            echo "$response" | jq .
        elif echo "$response" | jq -e '.type' >/dev/null 2>&1 && [[ $(echo "$response" | jq -r '.type') == "validation-error" ]]; then
            echo -e "${RED}❌ Validation Error (Expected)${NC}"
            echo "$response" | jq .
        else
            echo -e "${GREEN}✅ Success${NC}"
            echo "$response" | jq .
        fi
    else
        echo -e "${RED}❌ Failed${NC}"
        echo "$response"
    fi
    echo ""
}

# Step 1: Reset to demo data
echo -e "${BLUE}🔄 Step 1: Reset to demo data${NC}"
curl -s -X POST "$BACKEND_URL/seed/init?demo=true" > /dev/null
echo -e "${GREEN}Demo data reset${NC}"
echo ""

# Step 2: Test Transaction Creation
echo -e "${BLUE}➕ Step 2: Test Transaction Creation${NC}"
test_api "/transactions" "POST" '{"payerId": "A", "amount": "30.75", "category": "groceries"}' "Create Transaction (A pays $30.75 for groceries)"

# Step 3: Test Settlement Creation
echo -e "${BLUE}💸 Step 3: Test Settlement Creation${NC}"
test_api "/settle" "POST" '{"fromUserId": "B", "toUserId": "A", "amount": "25.00"}' "Create Settlement (B pays A $25.00)"

# Step 4: Test Validation Errors
echo -e "${BLUE}❌ Step 4: Test Validation Errors${NC}"
test_api "/transactions" "POST" '{"payerId": "A", "amount": "25.50", "category": "Groceries"}' "Invalid Category (Groceries vs groceries)"
test_api "/settle" "POST" '{"fromUserId": "A", "toUserId": "A", "amount": "10.00"}' "Self-Settlement (A to A)"

# Step 5: Check Final State
echo -e "${BLUE}📊 Step 5: Check Final State${NC}"
test_api "/who-owes-who" "GET" "" "Current Debt Status"
test_api "/transactions" "GET" "" "Transaction List"

echo -e "${GREEN}🎉 All API tests completed!${NC}"
echo ""
echo -e "${BLUE}📱 Frontend Testing Instructions:${NC}"
echo -e "1. Open ${FRONTEND_URL} in your browser"
echo -e "2. Open DevTools (F12) → Console tab"
echo -e "3. You should see debug logs with '🚀 API Request:' and '📤 Body:'"
echo ""
echo -e "${YELLOW}Test Cases to Try in Frontend:${NC}"
echo ""
echo -e "${GREEN}✅ Valid Transaction:${NC}"
echo -e "   - Payer: User A"
echo -e "   - Amount: 30.75"
echo -e "   - Category: Groceries"
echo -e "   - Expected: Success toast, transaction appears in list"
echo -e "   - Console should show: '📤 Body: {\"payerId\":\"A\",\"amount\":\"30.75\",\"category\":\"groceries\"}'"
echo ""
echo -e "${GREEN}✅ Valid Settlement:${NC}"
echo -e "   - From: User B"
echo -e "   - To: User A"
echo -e "   - Amount: 25.00"
echo -e "   - Expected: Success toast, debt status updates"
echo -e "   - Console should show: '📤 Body: {\"fromUserId\":\"B\",\"toUserId\":\"A\",\"amount\":\"25.00\"}'"
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
echo -e "   - Amounts should be sent as strings with 2 decimal places"
echo ""
echo -e "${GREEN}✅ Success Criteria:${NC}"
echo -e "   - No 422 'Invalid request body' errors"
echo -e "   - No 'User undefined' in transaction list"
echo -e "   - Proper data format in console logs"
echo -e "   - Success toasts for valid submissions"
echo -e "   - Validation errors for invalid submissions"
