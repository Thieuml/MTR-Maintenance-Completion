#!/bin/bash

# Script to help set up a new database for MTR Maintenance Tracking
# Usage: bash scripts/setup-new-database.sh

echo "🔧 MTR Maintenance Tracking - Database Setup"
echo "==========================================="
echo ""
echo "This script will help you set up a NEW database for the MTR project."
echo ""
echo "⚠️  IMPORTANT: This project should use a SEPARATE database from shiftproto"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found. Creating it..."
    bash scripts/create-env-local.sh
fi

echo "📋 Database Setup Options:"
echo ""
echo "1. Neon (Recommended - same provider as shiftproto)"
echo "   → Go to: https://console.neon.tech"
echo "   → Create new project: 'MTR Maintenance Tracking'"
echo "   → Copy connection string"
echo ""
echo "2. Supabase"
echo "   → Go to: https://app.supabase.com"
echo "   → Create new project: 'MTR Maintenance Tracking'"
echo "   → Settings → Database → Copy connection string"
echo ""
echo "3. Other PostgreSQL provider"
echo "   → Use any PostgreSQL database"
echo ""

read -p "Have you created a new database? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "📝 Please provide your new database connection string:"
    echo "   Format: postgresql://user:password@host:5432/database?sslmode=require"
    echo ""
    read -p "DATABASE_URL: " NEW_DATABASE_URL
    
    if [ -z "$NEW_DATABASE_URL" ]; then
        echo "❌ No database URL provided. Exiting."
        exit 1
    fi
    
    # Update .env.local
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=\"$NEW_DATABASE_URL\"|" .env.local
    else
        # Linux
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"$NEW_DATABASE_URL\"|" .env.local
    fi
    
    echo ""
    echo "✅ Updated .env.local with new DATABASE_URL"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Run: npm run db:push"
    echo "   2. Run: npm run db:seed"
    echo "   3. Run: npm run db:studio (to verify)"
    echo ""
else
    echo ""
    echo "📝 Please create a new database first, then run this script again."
    echo ""
    echo "Quick links:"
    echo "  - Neon: https://console.neon.tech"
    echo "  - Supabase: https://app.supabase.com"
    echo ""
fi

