# Production Deployment Guide

This guide walks you through deploying the MTR Maintenance Tracking application to production and migrating your local data.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Production Database**: Set up a PostgreSQL database (e.g., Neon, Supabase, or Railway)
3. **GitHub Repository**: Push your code to GitHub

## Step 1: Export Local Database

First, export all your local data:

```bash
# Make sure you're using your local .env.local
tsx scripts/export-database.ts
```

This creates a `database-export.json` file with all your data.

## Step 2: Set Up Production Database

1. Create a PostgreSQL database (recommended: [Neon](https://neon.tech) or [Supabase](https://supabase.com))
2. Get your production database connection string
3. Run Prisma migrations on production:

```bash
# Set production DATABASE_URL
export DATABASE_URL="your-production-database-url"

# Push schema to production
npx prisma db push --skip-generate

# Generate Prisma Client
npx prisma generate
```

## Step 3: Import Data to Production

Import your exported data to production:

```bash
# Set production DATABASE_URL
export DATABASE_URL="your-production-database-url"

# Import data
tsx scripts/import-database.ts
```

⚠️ **Warning**: This will delete all existing data in the production database!

## Step 4: Deploy to Vercel

### Option A: Via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install`

5. Add Environment Variables:
   - `DATABASE_URL`: Your production database URL
   - `LOOKER_API_BASE_URL`: Your Looker instance URL
   - `LOOKER_CLIENT_ID`: Your Looker API client ID
   - `LOOKER_CLIENT_SECRET`: Your Looker API client secret
   - `NOVU_API_KEY`: Your Novu API secret key
   - `NOVU_API_HOSTNAME`: (Optional) Your Novu API hostname

6. Click "Deploy"

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

Follow the prompts to set environment variables.

## Step 5: Verify Deployment

1. Visit your Vercel deployment URL
2. Check that all data is present:
   - Schedules are visible
   - Devices are listed
   - Engineers are synced
   - Work orders are displayed

## Step 6: Set Up Continuous Deployment

Once deployed, Vercel will automatically deploy on every push to your main branch.

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is set correctly in Vercel
- Check that your database allows connections from Vercel IPs
- For Neon/Supabase, ensure SSL is enabled

### Build Failures

- Check build logs in Vercel dashboard
- Ensure all environment variables are set
- Verify `prisma generate` runs during build (configured in `package.json`)

### Data Import Issues

- Ensure production database schema matches local schema
- Check foreign key constraints
- Verify all required fields are present in exported data

## Rollback

If you need to rollback:

1. Go to Vercel dashboard → Your project → Deployments
2. Find the previous working deployment
3. Click "..." → "Promote to Production"

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `LOOKER_API_BASE_URL` | Looker instance URL | Yes |
| `LOOKER_CLIENT_ID` | Looker API client ID | Yes |
| `LOOKER_CLIENT_SECRET` | Looker API client secret | Yes |
| `NOVU_API_KEY` | Novu API secret key | Yes |
| `NOVU_API_HOSTNAME` | Novu API hostname (optional) | No |
| `LOOKER_ENGINEERS_LOOK_ID` | Looker Look ID for engineers (default: 160) | No |
| `LOOKER_DEVICES_LOOK_ID` | Looker Look ID for devices (default: 167) | No |
| `LOOKER_VISITS_LOOK_ID` | Looker Look ID for visits (default: 168) | No |

## Post-Deployment Checklist

- [ ] Verify all pages load correctly
- [ ] Test schedule drag-and-drop functionality
- [ ] Verify work order upload works
- [ ] Check admin panel functionality
- [ ] Test Looker sync endpoints
- [ ] Verify notifications are configured
- [ ] Check analytics dashboard
- [ ] Test on mobile devices

## Support

For issues or questions, check:
- Vercel deployment logs
- Database connection logs
- Application error logs in Vercel dashboard

