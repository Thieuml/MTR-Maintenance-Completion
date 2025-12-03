#!/bin/bash

# Test CRON job locally
# This script can be run manually or scheduled with your OS cron

# Get CRON_SECRET from .env.local (if set)
if [ -f .env.local ]; then
  export $(cat .env.local | grep CRON_SECRET | xargs)
fi

# Default to localhost:3004 (matches package.json dev script)
# Override with BASE_URL environment variable if needed
BASE_URL="${BASE_URL:-http://localhost:3004}"

echo "Testing CRON job: PLANNED → PENDING transition"
echo "URL: ${BASE_URL}/api/cron/planned-to-pending"
echo ""

# Check if server is running
if ! curl -s "${BASE_URL}" > /dev/null 2>&1; then
  echo "❌ Error: Dev server is not running on ${BASE_URL}"
  echo ""
  echo "Please start the dev server first:"
  echo "  cd $(pwd)"
  echo "  npm run dev"
  echo ""
  exit 1
fi

echo "✅ Dev server is running"
echo ""

if [ -z "$CRON_SECRET" ]; then
  echo "⚠️  CRON_SECRET not set - endpoint will allow requests in dev mode"
  echo ""
  curl -X POST "${BASE_URL}/api/cron/planned-to-pending" \
    -H "Content-Type: application/json" \
    -w "\n\nHTTP Status: %{http_code}\n"
else
  echo "✅ Using CRON_SECRET for authentication"
  echo ""
  curl -X POST "${BASE_URL}/api/cron/planned-to-pending" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Content-Type: application/json" \
    -w "\n\nHTTP Status: %{http_code}\n"
fi

echo ""
echo "Done!"

