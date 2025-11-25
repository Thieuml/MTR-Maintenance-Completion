#!/bin/bash

# Test script for sync endpoints
# Usage: bash scripts/test-sync.sh

BASE_URL="http://localhost:3000"

echo "🧪 Testing MTR Maintenance Tracking Sync Endpoints"
echo "=================================================="
echo ""

echo "1. Testing Engineers Sync Connection..."
curl -s "$BASE_URL/api/sync/engineers" | jq '.' || curl -s "$BASE_URL/api/sync/engineers"
echo ""
echo ""

echo "2. Testing Devices Sync Connection..."
curl -s "$BASE_URL/api/sync/devices" | jq '.' || curl -s "$BASE_URL/api/sync/devices"
echo ""
echo ""

echo "3. Testing Visits Sync Connection..."
curl -s "$BASE_URL/api/sync/visits" | jq '.' || curl -s "$BASE_URL/api/sync/visits"
echo ""
echo ""

echo "✅ Connection tests completed!"
echo ""
echo "To run actual sync (dry run first):"
echo "  curl -X POST $BASE_URL/api/sync/engineers -H 'Content-Type: application/json' -d '{\"dryRun\": true}'"
echo "  curl -X POST $BASE_URL/api/sync/devices -H 'Content-Type: application/json' -d '{\"dryRun\": true}'"
echo "  curl -X POST $BASE_URL/api/sync/visits -H 'Content-Type: application/json' -d '{\"dryRun\": true}'"

