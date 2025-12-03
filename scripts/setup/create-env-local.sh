#!/bin/bash

# Script to create .env.local file with pre-filled database URL
# Usage: bash scripts/create-env-local.sh

ENV_FILE=".env.local"

echo "🔧 Creating .env.local file..."

# Check if .env.local already exists
if [ -f "$ENV_FILE" ]; then
    echo "⚠️  .env.local already exists. Backing up to .env.local.backup"
    cp "$ENV_FILE" "${ENV_FILE}.backup"
fi

# Create .env.local with database URL pre-filled
cat > "$ENV_FILE" << 'EOF'
# ============================================
# MTR Maintenance Tracking - Environment Variables
# ============================================
# This file is gitignored - safe to store credentials here

# ============================================
# DATABASE CONFIGURATION
# ============================================
# Using same database as shiftproto project
DATABASE_URL="postgresql://neondb_owner:npg_CiquK26stvbx@ep-late-bar-a4a9pbg5-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# ============================================
# LOOKER API CONFIGURATION
# ============================================
# TODO: Add your Looker credentials (same as shiftproto)
LOOKER_API_BASE_URL=https://your-instance.looker.com
LOOKER_CLIENT_ID=your_client_id_here
LOOKER_CLIENT_SECRET=your_client_secret_here

# ============================================
# LOOKER LOOK IDs - DATA SOURCES
# ============================================
# See LOOKER_LOOKS.md for detailed documentation

# Required Looks (Currently Configured)
LOOKER_ENGINEERS_LOOK_ID=160              # Engineers list (filtered on HK)
LOOKER_DEVICES_LOOK_ID=167                # MTR devices/equipment list
LOOKER_VISITS_LOOK_ID=168                 # Maintenance visits (last 3 months)

# Additional Looks (To Be Configured)
LOOKER_VISITS_HISTORICAL_LOOK_ID=         # Historical visits (6+ months)
LOOKER_WORK_ORDERS_LOOK_ID=               # Work orders (OR numbers) from EAMS
LOOKER_ENGINEER_CERTIFICATIONS_LOOK_ID=   # Engineer certifications (CP & RW)
LOOKER_EQUIPMENT_STATUS_LOOK_ID=          # Equipment status
LOOKER_BUILDINGS_LOOK_ID=                 # Buildings/locations data
LOOKER_CONTRACT_INFO_LOOK_ID=             # Contract information

# ============================================
# NOVU CONFIGURATION
# ============================================
# TODO: Add your Novu API key (same as shiftproto)
NOVU_API_KEY=your_novu_api_key_here
NOVU_API_HOSTNAME=https://eu.api.novu.co
EOF

echo "✅ Created $ENV_FILE"
echo ""
echo "📝 Next steps:"
echo "   1. Edit $ENV_FILE and add your Looker credentials:"
echo "      - LOOKER_API_BASE_URL"
echo "      - LOOKER_CLIENT_ID"
echo "      - LOOKER_CLIENT_SECRET"
echo ""
echo "   2. Add your Novu API key:"
echo "      - NOVU_API_KEY"
echo ""
echo "   3. Then run:"
echo "      npm run db:generate"
echo "      npm run db:push"
echo "      npm run db:seed"

