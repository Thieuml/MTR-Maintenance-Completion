#!/bin/bash

# Script to restore .env.local file with proper structure
# This recreates the .env.local file based on env.example

echo "🔧 Restoring .env.local file..."

# Check if .env.local exists
if [ -f ".env.local" ]; then
    echo "⚠️  .env.local already exists. Creating backup..."
    cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)
fi

# Create .env.local from env.example
cat > .env.local << 'EOF'
# ============================================
# MTR Maintenance Tracking - Environment Variables
# ============================================
# Local Development Configuration
# Never commit this file to git (already in .gitignore)

# ============================================
# DATABASE CONFIGURATION
# ============================================
# Local PostgreSQL database URL
# Format: postgresql://user:password@host:port/database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mtr_maintenance?schema=public"

# ============================================
# LOOKER API CONFIGURATION
# ============================================
# Same credentials as ShiftProto project
LOOKER_API_BASE_URL=https://your-instance.looker.com
LOOKER_CLIENT_ID=your_client_id_here
LOOKER_CLIENT_SECRET=your_client_secret_here

# ============================================
# LOOKER LOOK IDs - DATA SOURCES
# ============================================
# Required Looks (Currently Configured)
LOOKER_ENGINEERS_LOOK_ID=160              # Engineers list (filtered on HK)
LOOKER_DEVICES_LOOK_ID=167                # MTR devices/equipment list
LOOKER_VISITS_LOOK_ID=168                 # Maintenance visits (last 3 months)

# Additional Looks (To Be Configured)
LOOKER_VISITS_HISTORICAL_LOOK_ID=
LOOKER_WORK_ORDERS_LOOK_ID=
LOOKER_ENGINEER_CERTIFICATIONS_LOOK_ID=
LOOKER_EQUIPMENT_STATUS_LOOK_ID=
LOOKER_BUILDINGS_LOOK_ID=
LOOKER_CONTRACT_INFO_LOOK_ID=

# ============================================
# NOVU CONFIGURATION
# ============================================
# Same credentials as ShiftProto project
NOVU_API_KEY=your_novu_api_key_here
NOVU_API_HOSTNAME=https://eu.api.novu.co
EOF

echo "✅ .env.local file created!"
echo ""
echo "⚠️  IMPORTANT: Please update the following values:"
echo "   1. DATABASE_URL - Your local PostgreSQL connection string"
echo "   2. LOOKER_API_BASE_URL - Your Looker instance URL"
echo "   3. LOOKER_CLIENT_ID - Your Looker API client ID"
echo "   4. LOOKER_CLIENT_SECRET - Your Looker API client secret"
echo "   5. NOVU_API_KEY - Your Novu API key"
echo ""
echo "You can edit .env.local manually or use:"
echo "  nano .env.local"
echo "  vim .env.local"
echo "  code .env.local"


