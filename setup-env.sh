#!/bin/bash

# Quick setup script for MTR Maintenance Tracking environment variables
# Run this to set up your local environment
# Usage: source setup-env.sh

echo "🔧 Setting up MTR Maintenance Tracking environment variables..."
echo ""

# Database URL (PostgreSQL)
# Using same database as shiftproto project
if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="postgresql://neondb_owner:npg_CiquK26stvbx@ep-late-bar-a4a9pbg5-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    echo "✅ DATABASE_URL set (using same database as shiftproto)"
else
    echo "✅ DATABASE_URL is set"
fi

# Looker API Configuration
if [ -z "$LOOKER_API_BASE_URL" ]; then
    echo "⚠️  LOOKER_API_BASE_URL not set. Please set it:"
    echo "   export LOOKER_API_BASE_URL=\"https://your-instance.looker.com\""
    echo ""
else
    echo "✅ LOOKER_API_BASE_URL is set: $LOOKER_API_BASE_URL"
fi

if [ -z "$LOOKER_CLIENT_ID" ]; then
    echo "⚠️  LOOKER_CLIENT_ID not set. Please set it:"
    echo "   export LOOKER_CLIENT_ID=\"your_client_id_here\""
    echo ""
else
    echo "✅ LOOKER_CLIENT_ID is set"
fi

if [ -z "$LOOKER_CLIENT_SECRET" ]; then
    echo "⚠️  LOOKER_CLIENT_SECRET not set. Please set it:"
    echo "   export LOOKER_CLIENT_SECRET=\"your_client_secret_here\""
    echo ""
else
    echo "✅ LOOKER_CLIENT_SECRET is set"
fi

# Looker Look IDs (optional - defaults provided)
export LOOKER_ENGINEERS_LOOK_ID=${LOOKER_ENGINEERS_LOOK_ID:-160}
export LOOKER_DEVICES_LOOK_ID=${LOOKER_DEVICES_LOOK_ID:-167}
export LOOKER_VISITS_LOOK_ID=${LOOKER_VISITS_LOOK_ID:-168}

echo "✅ Looker Look IDs:"
echo "   Engineers: $LOOKER_ENGINEERS_LOOK_ID"
echo "   Devices: $LOOKER_DEVICES_LOOK_ID"
echo "   Visits: $LOOKER_VISITS_LOOK_ID"
echo ""

# Novu Configuration
if [ -z "$NOVU_API_KEY" ]; then
    echo "⚠️  NOVU_API_KEY not set. Please set it:"
    echo "   export NOVU_API_KEY=\"your_novu_api_key_here\""
    echo ""
else
    echo "✅ NOVU_API_KEY is set"
fi

if [ -z "$NOVU_API_HOSTNAME" ]; then
    export NOVU_API_HOSTNAME="https://eu.api.novu.co"
    echo "✅ NOVU_API_HOSTNAME set to default: $NOVU_API_HOSTNAME"
else
    echo "✅ NOVU_API_HOSTNAME is set: $NOVU_API_HOSTNAME"
fi

echo ""
echo "📋 Summary:"
echo "==========="
if [ -n "$DATABASE_URL" ]; then
    echo "  DATABASE_URL: ${DATABASE_URL:0:50}..."
fi
if [ -n "$LOOKER_API_BASE_URL" ]; then
    echo "  LOOKER_API_BASE_URL: $LOOKER_API_BASE_URL"
fi
if [ -n "$LOOKER_CLIENT_ID" ]; then
    echo "  LOOKER_CLIENT_ID: ${LOOKER_CLIENT_ID:0:20}..."
fi
if [ -n "$LOOKER_CLIENT_SECRET" ]; then
    echo "  LOOKER_CLIENT_SECRET: ${LOOKER_CLIENT_SECRET:0:20}..."
fi
if [ -n "$NOVU_API_KEY" ]; then
    echo "  NOVU_API_KEY: ${NOVU_API_KEY:0:20}..."
fi
echo "  NOVU_API_HOSTNAME: $NOVU_API_HOSTNAME"
echo ""

echo "Next steps:"
echo "  1. Ensure all required variables are set (see warnings above)"
echo "  2. Run: npm install"
echo "  3. Run: npm run db:generate"
echo "  4. Run: npm run db:push"
echo "  5. Run: npm run db:seed"
echo "  6. Run: npm run setup:novu"
echo "  7. Run: npm run dev"

