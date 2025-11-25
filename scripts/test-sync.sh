#!/bin/bash

# Test script for sync endpoints
# Usage: bash scripts/test-sync.sh

BASE_URL="http://localhost:3004"
TIMEOUT=10  # Timeout in seconds

# Check if jq is available
if command -v jq &> /dev/null; then
    USE_JQ=true
else
    USE_JQ=false
    echo "⚠️  Note: jq not found, output will not be formatted"
fi

# Function to test an endpoint
test_endpoint() {
    local endpoint=$1
    local name=$2
    
    echo "Testing $name..."
    response=$(curl -s --max-time $TIMEOUT "$BASE_URL$endpoint" 2>&1)
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        if [ "$USE_JQ" = true ]; then
            echo "$response" | jq '.' 2>/dev/null || echo "$response"
        else
            echo "$response"
        fi
    elif [ $exit_code -eq 28 ]; then
        echo "❌ Timeout: Server did not respond within ${TIMEOUT}s"
        echo "   Make sure the server is running on $BASE_URL"
    elif [ $exit_code -eq 7 ]; then
        echo "❌ Connection refused: Server is not running on $BASE_URL"
        echo "   Start the server with: npm run dev"
    else
        echo "❌ Error: Failed to connect (exit code: $exit_code)"
        echo "$response"
    fi
    echo ""
}

echo "🧪 Testing MTR Maintenance Tracking Sync Endpoints"
echo "=================================================="
echo ""

# Check if server is running first
echo "Checking if server is running..."
if curl -s --max-time 2 "$BASE_URL/api/health" > /dev/null 2>&1; then
    echo "✅ Server is running"
else
    echo "⚠️  Warning: Could not reach server at $BASE_URL"
    echo "   Make sure the server is running with: npm run dev"
    echo ""
fi
echo ""

test_endpoint "/api/sync/engineers" "Engineers Sync Connection"
test_endpoint "/api/sync/devices" "Devices Sync Connection"
test_endpoint "/api/sync/visits" "Visits Sync Connection"

echo "✅ Connection tests completed!"
echo ""
echo "To run actual sync (dry run first):"
echo "  curl -X POST $BASE_URL/api/sync/engineers -H 'Content-Type: application/json' -d '{\"dryRun\": true}'"
echo "  curl -X POST $BASE_URL/api/sync/devices -H 'Content-Type: application/json' -d '{\"dryRun\": true}'"
echo "  curl -X POST $BASE_URL/api/sync/visits -H 'Content-Type: application/json' -d '{\"dryRun\": true}'"

