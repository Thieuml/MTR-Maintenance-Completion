#!/bin/bash

# Script to update DATABASE_URL in .env.local
# Usage: bash scripts/update-database-url.sh "your-connection-string"

NEW_DATABASE_URL="$1"

if [ -z "$NEW_DATABASE_URL" ]; then
    echo "❌ Error: No database URL provided"
    echo "Usage: bash scripts/update-database-url.sh \"postgresql://...\""
    exit 1
fi

if [ ! -f ".env.local" ]; then
    echo "❌ Error: .env.local file not found"
    exit 1
fi

# Update DATABASE_URL in .env.local
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=\"$NEW_DATABASE_URL\"|" .env.local
else
    # Linux
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"$NEW_DATABASE_URL\"|" .env.local
fi

echo "✅ Updated DATABASE_URL in .env.local"
echo ""
echo "📋 Next steps:"
echo "   1. Run: npm run db:push"
echo "   2. Run: npm run db:seed"

