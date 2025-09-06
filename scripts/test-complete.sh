#!/bin/bash

# Comprehensive Frontend-Backend Integration Test
# This script tests the complete workflow to ensure everything works

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Complete Integration Test${NC}"
echo -e "${BLUE}============================${NC}"
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

# Step 1: Reset to demo data
echo -e "${BLUE}🔄 Step 1: Reset to demo data${NC}"
test_api "/seed/init?demo=true" "POST" "" "Initialize Demo Data"

# Step 2: Test all GET endpoints
echo -e "${BLUE}📊 Step 2: Test all GET endpoints${NC}"
test_api "/health" "GET" "" "Health Check"
test_api "/users" "GET" "" "Get Users"
test_api "/transactions" "GET" "" "Get Transactions"
test_api "/who-owes-who" "GET" "" "Get Debt Status"
test_api "/summary?userId=A" "GET" "" "Get Summary for User A"
test_api "/summary?userId=B" "GET" "" "Get Summary for User B"

# Step 3: Test transaction creation
echo -e "${BLUE}➕ Step 3: Test transaction creation${NC}"
test_api "/transactions" "POST" '{"payerId": "A", "amount": "25.50", "category": "food"}' "Create Transaction (A pays $25.50 for food)"

# Step 4: Test settlement
echo -e "${BLUE}💸 Step 4: Test settlement${NC}"
test_api "/settle" "POST" '{"fromUserId": "B", "toUserId": "A", "amount": "15.00"}' "Create Settlement (B pays A $15.00)"

# Step 5: Verify final state
echo -e "${BLUE}✅ Step 5: Verify final state${NC}"
test_api "/users" "GET" "" "Final User State"
test_api "/who-owes-who" "GET" "" "Final Debt Status"

echo -e "${GREEN}🎉 All backend tests passed!${NC}"
echo ""
echo -e "${BLUE}📱 Frontend Testing Instructions:${NC}"
echo -e "1. Open ${FRONTEND_URL} in your browser"
echo -e "2. Open browser DevTools (F12) and go to Console tab"
echo -e "3. Test the following workflows:"
echo ""
echo -e "${YELLOW}Dashboard Test:${NC}"
echo -e "   - Should show current debt status and user balances"
echo -e "   - Click refresh button to reload data"
echo ""
echo -e "${YELLOW}Transactions Test:${NC}"
echo -e "   - Should show existing transactions"
echo -e "   - Try adding: User A pays \$30.75 for groceries"
echo -e "   - Check console for 'Sending transaction request:' log"
echo -e "   - Should see success toast and updated transaction list"
echo ""
echo -e "${YELLOW}Settlement Test:${NC}"
echo -e "   - Should show current debt status"
echo -e "   - Try settling: User B pays User A \$20.00"
echo -e "   - Check console for 'Sending settlement request:' log"
echo -e "   - Should see success toast and updated debt status"
echo ""
echo -e "${YELLOW}Error Handling Test:${NC}"
echo -e "   - Try invalid amounts (negative, zero, too large)"
echo -e "   - Try self-settlement (A to A)"
echo -e "   - Should see appropriate error messages"
echo ""
echo -e "${RED}If you see any errors:${NC}"
echo -e "   - Check the browser console for detailed error messages"
echo -e "   - Check the backend terminal for validation errors"
echo -e "   - Ensure you're on the correct URL: ${FRONTEND_URL}"
