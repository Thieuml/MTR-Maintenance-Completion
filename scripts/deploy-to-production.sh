#!/bin/bash

# Production Deployment Script for MTR Maintenance Tracking
# This script helps deploy the application to Vercel and migrate data

set -e

echo "🚀 MTR Maintenance Tracking - Production Deployment"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Export local database
echo -e "${YELLOW}Step 1: Exporting local database...${NC}"
if [ ! -f ".env.local" ]; then
    echo -e "${RED}✗ Error: .env.local file not found${NC}"
    echo "Please create .env.local with your local DATABASE_URL"
    exit 1
fi

npm run db:export

if [ ! -f "database-export.json" ]; then
    echo -e "${RED}✗ Error: Export failed - database-export.json not created${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Local database exported successfully${NC}"
echo ""

# Step 2: Check if Vercel CLI is available
echo -e "${YELLOW}Step 2: Checking Vercel CLI...${NC}"
if ! command -v vercel &> /dev/null; then
    echo "Vercel CLI not found globally. Will use npx vercel instead."
    USE_NPX=true
else
    USE_NPX=false
fi
echo -e "${GREEN}✓ Vercel CLI ready${NC}"
echo ""

# Step 3: Check if logged in to Vercel
echo -e "${YELLOW}Step 3: Checking Vercel authentication...${NC}"
if [ "$USE_NPX" = true ]; then
    if ! npx vercel whoami &> /dev/null; then
        echo "Please login to Vercel:"
        npx vercel login
    fi
    VERCEL_CMD="npx vercel"
else
    if ! vercel whoami &> /dev/null; then
        echo "Please login to Vercel:"
        vercel login
    fi
    VERCEL_CMD="vercel"
fi
echo -e "${GREEN}✓ Vercel authentication verified${NC}"
echo ""

# Step 4: Prompt for production database URL
echo -e "${YELLOW}Step 4: Production Database Setup${NC}"
echo "Please provide your production database connection string:"
read -p "Production DATABASE_URL: " PROD_DATABASE_URL

if [ -z "$PROD_DATABASE_URL" ]; then
    echo -e "${RED}✗ Error: Production DATABASE_URL is required${NC}"
    exit 1
fi

# Step 5: Push schema to production
echo ""
echo -e "${YELLOW}Step 5: Pushing schema to production database...${NC}"
export DATABASE_URL="$PROD_DATABASE_URL"
npx prisma db push --skip-generate
npx prisma generate
echo -e "${GREEN}✓ Schema pushed to production${NC}"
echo ""

# Step 6: Import data to production
echo -e "${YELLOW}Step 6: Importing data to production database...${NC}"
echo -e "${RED}⚠️  WARNING: This will DELETE all existing data in production!${NC}"
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Deployment cancelled"
    exit 0
fi

export DATABASE_URL="$PROD_DATABASE_URL"
npm run db:import

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Data imported to production successfully${NC}"
else
    echo -e "${RED}✗ Error: Data import failed${NC}"
    exit 1
fi
echo ""

# Step 7: Deploy to Vercel
echo -e "${YELLOW}Step 7: Deploying to Vercel...${NC}"
echo "Make sure you have set all environment variables in Vercel dashboard:"
echo "  - DATABASE_URL"
echo "  - LOOKER_API_BASE_URL"
echo "  - LOOKER_CLIENT_ID"
echo "  - LOOKER_CLIENT_SECRET"
echo "  - NOVU_API_KEY"
echo ""
read -p "Ready to deploy? (yes/no): " DEPLOY_CONFIRM

if [ "$DEPLOY_CONFIRM" != "yes" ]; then
    echo "Deployment cancelled. You can deploy later with: vercel --prod"
    exit 0
fi

$VERCEL_CMD --prod

echo ""
echo -e "${GREEN}✓ Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify your deployment at the Vercel URL"
echo "2. Check that all data is present"
echo "3. Test key functionality (schedules, work orders, etc.)"
echo ""
if [ "$USE_NPX" = true ]; then
    echo "To view logs: npx vercel logs"
else
    echo "To view logs: vercel logs"
fi
echo "To rollback: Go to Vercel dashboard → Deployments → Promote previous deployment"

