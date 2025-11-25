#!/bin/bash

# Test script for Schedule API endpoints
# Usage: bash scripts/test-schedules.sh

BASE_URL="http://localhost:3004"

echo "🧪 Testing MTR Schedule Management API"
echo "======================================"
echo ""

echo "1. Testing GET /api/schedules (all schedules)..."
curl -s "$BASE_URL/api/schedules" | python3 -m json.tool || curl -s "$BASE_URL/api/schedules"
echo ""
echo ""

echo "2. Testing GET /api/schedules with date filter..."
curl -s "$BASE_URL/api/schedules?from=2025-01-01&to=2025-12-31" | python3 -m json.tool || curl -s "$BASE_URL/api/schedules?from=2025-01-01&to=2025-12-31"
echo ""
echo ""

echo "3. Testing GET /api/schedules with status filter..."
curl -s "$BASE_URL/api/schedules?status=PLANNED" | python3 -m json.tool || curl -s "$BASE_URL/api/schedules?status=PLANNED"
echo ""
echo ""

echo "✅ Schedule API tests completed!"
echo ""
echo "Note: Empty results are expected if no schedules have been created yet."
echo ""
echo "To create a schedule, you need:"
echo "  1. Sync equipment from Looker: POST $BASE_URL/api/sync/devices"
echo "  2. Create schedule: POST $BASE_URL/api/schedules"

