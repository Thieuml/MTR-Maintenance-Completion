# Environment Variables Quick Reference

Quick reference guide for all environment variables used in MTR Maintenance Tracking.

## Required Variables

### Database

```bash
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
```

**Description**: PostgreSQL connection string  
**Where to get**: Neon, Supabase, or RDS console  
**Example**: `postgresql://neondb_owner:pass@ep-xxx.neon.tech/neondb?sslmode=require`

### Looker API

```bash
LOOKER_API_BASE_URL="https://your-instance.looker.com"
LOOKER_CLIENT_ID="your_client_id_here"
LOOKER_CLIENT_SECRET="your_client_secret_here"
```

**Description**: Looker API credentials (same as ShiftProto project)  
**Where to get**: Looker Dashboard → Admin → Users → API3 Keys  
**Note**: No trailing slash in `LOOKER_API_BASE_URL`

### Novu API

```bash
NOVU_API_KEY="your_novu_api_key_here"
NOVU_API_HOSTNAME="https://eu.api.novu.co"
```

**Description**: Novu API credentials (same as ShiftProto project)  
**Where to get**: Novu Dashboard → Settings → Secret Keys  
**Note**: `NOVU_API_HOSTNAME` defaults to EU region if not set

## Optional Variables

### Looker Look IDs

```bash
LOOKER_ENGINEERS_LOOK_ID=160
LOOKER_DEVICES_LOOK_ID=167
LOOKER_VISITS_LOOK_ID=168
```

**Description**: Look IDs for syncing data from Looker  
**Default**: Values shown above  
**When to change**: If you need to use different Looks

## Quick Setup Commands

### Using Environment Variables (Temporary)

```bash
export DATABASE_URL="postgresql://..."
export LOOKER_API_BASE_URL="https://..."
export LOOKER_CLIENT_ID="..."
export LOOKER_CLIENT_SECRET="..."
export NOVU_API_KEY="..."
export NOVU_API_HOSTNAME="https://eu.api.novu.co"
```

### Using .env.local File (Persistent)

Create `.env.local` in project root:

```bash
DATABASE_URL=postgresql://...
LOOKER_API_BASE_URL=https://...
LOOKER_CLIENT_ID=...
LOOKER_CLIENT_SECRET=...
NOVU_API_KEY=...
NOVU_API_HOSTNAME=https://eu.api.novu.co
```

### Using Setup Script

```bash
source setup-env.sh
```

Then set any missing variables manually.

## Verification

### Check if variables are set:

```bash
echo $DATABASE_URL
echo $LOOKER_API_BASE_URL
echo $NOVU_API_KEY
```

### Test connections:

```bash
# Database
npm run db:studio

# Looker (via API endpoint)
curl http://localhost:3000/api/health

# Novu
npm run test:novu
```

## Production (Vercel)

Set all variables in Vercel Dashboard:
1. Go to Project → Settings → Environment Variables
2. Add each variable for Production environment
3. Redeploy to apply changes

## Security Notes

- ⚠️ Never commit `.env.local` to git (already in `.gitignore`)
- ⚠️ Never expose API keys in client-side code
- ⚠️ Use different credentials for development and production
- ⚠️ Rotate credentials regularly

