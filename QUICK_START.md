# Quick Start Guide

Get up and running with MTR Maintenance Tracking in 5 minutes.

## Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js 18+ installed
- ✅ PostgreSQL database (Neon/Supabase/RDS)
- ✅ Looker API credentials (same as ShiftProto)
- ✅ Novu API key (same as ShiftProto)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd /Users/matthieu/Documents/Cursor_Projects/MTR-Maintenance-Tracking
npm install
```

### 2. Set Environment Variables

**Option A: Quick Setup Script**

```bash
source setup-env.sh
```

Then set any missing variables:
```bash
export DATABASE_URL="postgresql://..."
export LOOKER_API_BASE_URL="https://..."
export LOOKER_CLIENT_ID="..."
export LOOKER_CLIENT_SECRET="..."
export NOVU_API_KEY="..."
```

**Option B: Create .env.local**

Create `.env.local` file:
```bash
DATABASE_URL=postgresql://...
LOOKER_API_BASE_URL=https://...
LOOKER_CLIENT_ID=...
LOOKER_CLIENT_SECRET=...
NOVU_API_KEY=...
NOVU_API_HOSTNAME=https://eu.api.novu.co
```

### 3. Set Up Database

```bash
npm run db:generate  # Generate Prisma Client
npm run db:push      # Create database tables
npm run db:seed      # Seed initial data (MTR zones)
```

### 4. Set Up Novu Workflows

```bash
npm run setup:novu
```

### 5. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) 🎉

## Verify Setup

### Test Database
```bash
npm run db:studio  # Opens Prisma Studio
```

### Test Novu
```bash
npm run test:novu
```

### Test API
```bash
curl http://localhost:3000/api/health
```

## Next Steps

1. **Sync Data from Looker**: Create API endpoints to sync engineers and devices
2. **Build Schedule UI**: Create calendar view for maintenance schedules  
3. **Implement Notifications**: Set up cron jobs for daily reminders
4. **Add Completion Tracking**: Build interface for marking maintenance complete

## Troubleshooting

**Database connection issues?**
- Verify `DATABASE_URL` is correct
- Check database server is accessible
- Ensure SSL mode is set: `?sslmode=require`

**Looker connection issues?**
- Verify `LOOKER_API_BASE_URL` has no trailing slash
- Check credentials in Looker Dashboard → API3 Keys

**Novu issues?**
- Verify `NOVU_API_KEY` is set correctly
- Run `npm run setup:novu` to create workflows

## Documentation

- **Full Setup Guide**: See [SETUP.md](./SETUP.md)
- **Environment Variables**: See [ENV_VARIABLES.md](./ENV_VARIABLES.md)
- **Project Requirements**: See [PRD.md](./PRD.md)

## Need Help?

1. Check the troubleshooting section in [SETUP.md](./SETUP.md)
2. Review server logs for detailed error messages
3. Verify all environment variables are set correctly

