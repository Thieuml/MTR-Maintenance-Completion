#!/bin/bash

# Script to set Looker environment variables in Vercel
# Usage: Update the values below, then run: bash scripts/set-vercel-looker-env.sh

set -e

echo "🔧 Setting Looker environment variables in Vercel..."
echo ""
echo "⚠️  Please update the values in this script first!"
echo ""

# TODO: Update these values with your actual Looker credentials
LOOKER_API_BASE_URL="https://your-instance.looker.com"
LOOKER_CLIENT_ID="your_client_id_here"
LOOKER_CLIENT_SECRET="your_client_secret_here"

# Set Looker API Base URL
echo "Setting LOOKER_API_BASE_URL..."
echo "$LOOKER_API_BASE_URL" | npx vercel env add LOOKER_API_BASE_URL production

# Set Looker Client ID
echo ""
echo "Setting LOOKER_CLIENT_ID..."
echo "$LOOKER_CLIENT_ID" | npx vercel env add LOOKER_CLIENT_ID production

# Set Looker Client Secret
echo ""
echo "Setting LOOKER_CLIENT_SECRET..."
echo "$LOOKER_CLIENT_SECRET" | npx vercel env add LOOKER_CLIENT_SECRET production

# Set Looker Look IDs (optional, defaults are already set)
echo ""
echo "Setting LOOKER_ENGINEERS_LOOK_ID (default: 160)..."
echo "160" | npx vercel env add LOOKER_ENGINEERS_LOOK_ID production

echo ""
echo "Setting LOOKER_DEVICES_LOOK_ID (default: 167)..."
echo "167" | npx vercel env add LOOKER_DEVICES_LOOK_ID production

echo ""
echo "Setting LOOKER_VISITS_LOOK_ID (default: 168)..."
echo "168" | npx vercel env add LOOKER_VISITS_LOOK_ID production

echo ""
echo "✅ Looker environment variables set!"
echo ""
echo "📋 Next steps:"
echo "   1. Redeploy your app: npx vercel --prod"
echo "   2. Or trigger redeploy from Vercel dashboard"
echo ""
echo "💡 Tip: You can also set these via Vercel dashboard:"
echo "   Settings → Environment Variables → Add"


