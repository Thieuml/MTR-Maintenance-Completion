# MTR Maintenance Tracking - Setup Guide

This guide will help you set up the MTR Maintenance Tracking application from scratch.

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** and npm installed
- **PostgreSQL database** (e.g., Neon, Supabase, or RDS)
- **Looker API credentials** (same as ShiftProto project)
- **Novu account** and API key (same as ShiftProto project)

## Step 1: Clone and Install

```bash
cd /Users/matthieu/Documents/Cursor_Projects/MTR-Maintenance-Tracking
npm install
```

## Step 2: Set Up Environment Variables

### Option A: Using the Setup Script

1. Run the setup script to check your environment:
```bash
source setup-env.sh
```

2. Set missing variables manually:
```bash
# Database
export DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"

# Looker API (use same credentials as ShiftProto)
export LOOKER_API_BASE_URL="https://your-instance.looker.com"
export LOOKER_CLIENT_ID="your_client_id_here"
export LOOKER_CLIENT_SECRET="your_client_secret_here"

# Novu API (use same credentials as ShiftProto)
export NOVU_API_KEY="your_novu_api_key_here"
export NOVU_API_HOSTNAME="https://eu.api.novu.co"
```

### Option B: Create .env.local File

Create a `.env.local` file in the project root:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"

# Looker API Configuration
LOOKER_API_BASE_URL=https://your-instance.looker.com
LOOKER_CLIENT_ID=your_client_id_here
LOOKER_CLIENT_SECRET=your_client_secret_here

# Looker Look IDs (optional - defaults provided)
LOOKER_ENGINEERS_LOOK_ID=160
LOOKER_DEVICES_LOOK_ID=167
LOOKER_VISITS_LOOK_ID=168

# Novu Configuration
NOVU_API_KEY=your_novu_api_key_here
NOVU_API_HOSTNAME=https://eu.api.novu.co
```

**Important**: Never commit `.env.local` to git. It's already in `.gitignore`.

## Step 3: Get Your Credentials

### Database (PostgreSQL)

#### Option A: Neon (Recommended for development)

1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project
3. Copy the connection string
4. Format: `postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require`

#### Option B: Supabase

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a new project
3. Go to Settings → Database
4. Copy the connection string

### Looker API Credentials

Use the same credentials as your ShiftProto project:

1. Log into your Looker instance
2. Go to **Admin** → **Users** → **API3 Keys**
3. Copy the **Client ID** and **Client Secret**

**Look IDs** (already configured, but can be overridden):
- Engineers: Look ID 160 (filtered on HK)
- MTR Devices: Look ID 167
- Maintenance Visits: Look ID 168 (last 3 months)

### Novu API Credentials

Use the same credentials as your ShiftProto project:

1. Go to [Novu Dashboard](https://web.novu.co)
2. Go to **Settings** → **Secret Keys**
3. Copy the **Secret Key** (this is your `NOVU_API_KEY`)
4. Note your API hostname (e.g., `https://eu.api.novu.co`)

## Step 4: Set Up Database

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database (creates tables)
npm run db:push

# Seed initial data (creates MTR zones)
npm run db:seed
```

**Alternative**: If you prefer migrations:
```bash
npm run db:migrate
```

## Step 5: Set Up Novu Workflows

```bash
npm run setup:novu
```

This creates two workflows in Novu:
1. **tonight-schedule**: Daily reminder of planned maintenance units
2. **missed-committed-date**: Alert when a committed date is missed

After running this, customize the notification templates in the Novu dashboard (they're in Chinese by default).

## Step 6: Verify Setup

### Test Database Connection

```bash
npm run db:studio
```

This opens Prisma Studio where you can view and edit your database.

### Test Looker Connection

Create a test script or use the API:

```bash
curl http://localhost:3000/api/health
```

### Test Novu Setup

```bash
npm run test:novu
```

## Step 7: Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Troubleshooting

### Database Connection Issues

**Error**: `Can't reach database server`

**Solutions**:
1. Verify `DATABASE_URL` is correct
2. Check if database server is accessible
3. Ensure SSL mode is set correctly (`?sslmode=require`)
4. For Neon/Supabase, check if IP restrictions are blocking connections

### Looker Connection Issues

**Error**: `Looker connection failed`

**Solutions**:
1. Verify `LOOKER_API_BASE_URL` format (no trailing slash)
2. Check `LOOKER_CLIENT_ID` and `LOOKER_CLIENT_SECRET` are correct
3. Ensure Looker user has access to the specified Looks
4. Test connection: Check Looker dashboard → API3 Keys

### Novu Issues

**Error**: `NOVU_API_KEY environment variable is not set`

**Solutions**:
1. Verify `NOVU_API_KEY` is set correctly
2. Check `NOVU_API_HOSTNAME` matches your Novu region
3. Ensure workflows are created: `npm run setup:novu`

### Prisma Issues

**Error**: `Prisma Client not generated`

**Solutions**:
```bash
npm run db:generate
```

**Error**: `Migration failed`

**Solutions**:
- Use `npm run db:push` for development (direct schema push)
- Or reset and recreate: `npx prisma migrate reset`

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `LOOKER_API_BASE_URL` | Looker instance URL | `https://your-instance.looker.com` |
| `LOOKER_CLIENT_ID` | Looker API client ID | `abc123...` |
| `LOOKER_CLIENT_SECRET` | Looker API client secret | `xyz789...` |
| `NOVU_API_KEY` | Novu API secret key | `sk_abc123...` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOOKER_ENGINEERS_LOOK_ID` | Look ID for engineers | `160` |
| `LOOKER_DEVICES_LOOK_ID` | Look ID for MTR devices | `167` |
| `LOOKER_VISITS_LOOK_ID` | Look ID for maintenance visits | `168` |
| `NOVU_API_HOSTNAME` | Novu API hostname | `https://eu.api.novu.co` |

## Next Steps

After setup is complete:

1. **Sync data from Looker**: Create API endpoints to sync engineers and devices
2. **Build schedule UI**: Create calendar view for maintenance schedules
3. **Implement notifications**: Set up cron jobs for daily reminders
4. **Add completion tracking**: Build interface for marking maintenance as complete

See `PRD.md` for detailed feature requirements.

## Production Deployment

For production deployment (e.g., Vercel):

1. Set all environment variables in your hosting platform
2. Run database migrations: `npm run db:migrate`
3. Seed production data: `npm run db:seed`
4. Set up Novu workflows: `npm run setup:novu`
5. Configure cron jobs for daily syncs and notifications

## Support

If you encounter issues:

1. Check server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test individual integrations (Looker, Novu, Database)
4. Review the troubleshooting section above

