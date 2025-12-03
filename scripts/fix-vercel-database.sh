#!/bin/bash

# Script to update DATABASE_URL in Vercel and trigger redeploy

set -e

PRODUCTION_DB_URL="postgresql://neondb_owner:npg_sOGgE5quI7ab@ep-ancient-sunset-a16tps9b-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

echo "🔧 Updating DATABASE_URL in Vercel..."
echo ""

# Remove existing DATABASE_URL for production
echo "Step 1: Removing existing DATABASE_URL..."
npx vercel env rm DATABASE_URL production --yes

# Add new DATABASE_URL
echo ""
echo "Step 2: Adding production DATABASE_URL..."
echo "$PRODUCTION_DB_URL" | npx vercel env add DATABASE_URL production

echo ""
echo "✅ DATABASE_URL updated in Vercel!"
echo ""
echo "📋 Next steps:"
echo "   1. Trigger a redeploy:"
echo "      npx vercel --prod"
echo ""
echo "   OR"
echo ""
echo "   2. Go to Vercel dashboard → Deployments → Click '...' → 'Redeploy'"
echo ""
echo "⏳ Waiting 3 seconds before redeploying..."
sleep 3

echo ""
echo "🚀 Triggering redeploy..."
npx vercel --prod

echo ""
echo "✅ Done! Your production app should now connect to the correct database."
echo "   Give it a minute for the deployment to complete, then refresh your app."


