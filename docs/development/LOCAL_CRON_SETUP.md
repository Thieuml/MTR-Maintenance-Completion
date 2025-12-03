# Running CRON Job Locally

## Overview

Vercel Cron jobs **only run in production/preview environments** on Vercel. They do **NOT** run automatically in local development.

To test the CRON job locally, you have several options:

## Option 1: Manual Testing (Recommended for Development)

### Using curl

```bash
# If CRON_SECRET is not set (dev mode)
curl -X POST http://localhost:3000/api/cron/planned-to-pending

# If CRON_SECRET is set
curl -X POST http://localhost:3000/api/cron/planned-to-pending \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Using the test script

```bash
# Make sure your dev server is running first
npm run dev

# In another terminal, run:
./scripts/test-cron-local.sh
```

## Option 2: macOS/Linux Cron (Automatic)

Set up a local cron job to run at 7am HK Time (11pm UTC previous day):

```bash
# Edit your crontab
crontab -e

# Add this line (runs at 11pm UTC = 7am HKT)
0 23 * * * cd /path/to/MTR-Maintenance-Tracking && ./scripts/test-cron-local.sh >> /tmp/cron-planned-to-pending.log 2>&1
```

**Note**: Make sure your dev server is running 24/7 for this to work.

## Option 3: Node.js Cron Package (Recommended for Local Development)

Install `node-cron`:

```bash
npm install --save-dev node-cron
```

Create `scripts/local-cron.ts`:

```typescript
import cron from 'node-cron'
import { createHKTDate } from '../lib/utils/timezone'

// Run at 7am HK Time daily
// HK Time is UTC+8, so 7am HKT = 11pm UTC (previous day)
// Cron format: minute hour day month weekday
cron.schedule('0 23 * * *', async () => {
  console.log('[Local CRON] Running PLANNED → PENDING transition...')
  
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET
  
  try {
    const headers: HeadersInit = {}
    if (cronSecret) {
      headers['Authorization'] = `Bearer ${cronSecret}`
    }
    
    const response = await fetch(`${baseUrl}/api/cron/planned-to-pending`, {
      method: 'POST',
      headers,
    })
    
    const result = await response.json()
    console.log('[Local CRON] Result:', result)
  } catch (error) {
    console.error('[Local CRON] Error:', error)
  }
}, {
  timezone: 'Asia/Hong_Kong', // Run in HK Time
})

console.log('[Local CRON] Scheduled to run daily at 7am HK Time')
```

Run it:

```bash
# In a separate terminal (keep dev server running)
npx tsx scripts/local-cron.ts
```

## Option 4: Manual Trigger via Browser/Postman

1. Start your dev server: `npm run dev`
2. Open browser/Postman
3. POST to: `http://localhost:3000/api/cron/planned-to-pending`
4. If `CRON_SECRET` is set, add header: `Authorization: Bearer <your-secret>`

## Verification

After running the CRON job, verify it worked:

```bash
# Check how many schedules were transitioned
npx tsx -e "
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
p.schedule.count({ where: { status: 'PENDING' } })
  .then(count => {
    console.log('PENDING schedules:', count)
    p.\$disconnect()
  })
"
```

## Important Notes

1. **Dev Server Must Be Running**: The CRON job calls your local API endpoint, so `npm run dev` must be running.

2. **Time Zone**: The CRON job uses HK Time (UTC+8). Make sure your system timezone is correct or use timezone-aware scheduling.

3. **Production**: In production on Vercel, the CRON job runs automatically via `vercel.json` configuration. No manual setup needed.

4. **Security**: In development, if `CRON_SECRET` is not set, the endpoint allows unauthenticated requests (less secure but convenient for testing).

## Troubleshooting

**CRON job not running:**
- Check if dev server is running
- Verify the endpoint URL is correct
- Check console logs for errors
- Verify `CRON_SECRET` if authentication is required

**No schedules transitioned:**
- Check if there are any `PLANNED` schedules with past `r1PlannedDate`
- Verify the date comparison logic (uses HK Time)
- Check database connection



