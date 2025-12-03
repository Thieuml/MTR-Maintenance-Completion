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

#### Required (Currently Configured)

```bash
# Engineers list (filtered on HK)
# Purpose: Sync active engineers for assignment and notifications
LOOKER_ENGINEERS_LOOK_ID=160

# MTR devices/equipment list
# Purpose: Get all MTR lifts and escalators for schedule creation
LOOKER_DEVICES_LOOK_ID=167

# Maintenance visits (last 3 months)
# Purpose: Track recent maintenance completions and compliance
LOOKER_VISITS_LOOK_ID=168
```

#### Additional (To Be Configured)

```bash
# Historical maintenance visits (6+ months)
# Purpose: Compliance reporting, engineer behavior analysis (US15, US16)
# Note: May use same Look as 168 with extended date range
LOOKER_VISITS_HISTORICAL_LOOK_ID=

# Work orders (OR numbers) from EAMS
# Purpose: Bulk import OR numbers for yearly scheduling
# Note: Currently downloaded manually monthly
LOOKER_WORK_ORDERS_LOOK_ID=

# Engineer certifications (CP & RW)
# Purpose: Validate engineer assignments (fixed engineer must have certs)
# Note: May be included in Engineers Look (160)
LOOKER_ENGINEER_CERTIFICATIONS_LOOK_ID=

# Equipment status
# Purpose: Filter active equipment, identify unavailable units
LOOKER_EQUIPMENT_STATUS_LOOK_ID=

# Buildings/locations
# Purpose: Zone assignment, location-based filtering and reporting
# Note: May be included in Devices Look (167)
LOOKER_BUILDINGS_LOOK_ID=

# Contract information
# Purpose: Validate service windows, track contract compliance
LOOKER_CONTRACT_INFO_LOOK_ID=
```

**Description**: Look IDs for syncing data from Looker  
**Default**: Values shown above for required Looks  
**When to change**: If you need to use different Looks or configure additional ones  
**See**: `LOOKER_LOOKS.md` for detailed documentation of each Look ID and its purpose

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
# Database
DATABASE_URL=postgresql://...

# Looker API
LOOKER_API_BASE_URL=https://...
LOOKER_CLIENT_ID=...
LOOKER_CLIENT_SECRET=...

# Looker Look IDs (required)
LOOKER_ENGINEERS_LOOK_ID=160
LOOKER_DEVICES_LOOK_ID=167
LOOKER_VISITS_LOOK_ID=168

# Looker Look IDs (optional - to be configured)
LOOKER_VISITS_HISTORICAL_LOOK_ID=
LOOKER_WORK_ORDERS_LOOK_ID=
LOOKER_ENGINEER_CERTIFICATIONS_LOOK_ID=
LOOKER_EQUIPMENT_STATUS_LOOK_ID=
LOOKER_BUILDINGS_LOOK_ID=
LOOKER_CONTRACT_INFO_LOOK_ID=

# Novu API
NOVU_API_KEY=...
NOVU_API_HOSTNAME=https://eu.api.novu.co
```

**See**: `LOOKER_LOOKS.md` for detailed documentation of each Look ID and its purpose

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

