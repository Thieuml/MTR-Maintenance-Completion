# CRON Job Setup - Planned to Pending Transition

## Overview

The CRON job automatically transitions `PLANNED → PENDING` schedules at 7am HK Time daily.

## Configuration

### Vercel Cron (Production)

The CRON job is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/planned-to-pending",
      "schedule": "0 23 * * *"
    }
  ]
}
```

**Schedule Explanation:**
- `"0 23 * * *"` = 11pm UTC (23:00 UTC)
- HKT is UTC+8, so 11pm UTC = 7am HKT next day
- This runs daily at 7am Hong Kong Time

**Note:** The schedule is in UTC (Vercel's default). Adjust if DST affects HKT.

### Environment Variables

Add to Vercel project settings:
- `CRON_SECRET` (optional but recommended for security)

To add via Vercel CLI:
```bash
vercel env add CRON_SECRET
```

Or via Vercel Dashboard:
1. Go to Project Settings → Environment Variables
2. Add `CRON_SECRET` with a secure random value
3. Deploy to production

## Security

The endpoint checks:
1. **Vercel Cron signature** (`x-vercel-signature` header) - automatically added by Vercel
2. **Authorization header** - for manual/external calls: `Bearer <CRON_SECRET>`
3. **Development mode** - if `CRON_SECRET` is not set, allows requests (less secure)

## Testing

### Manual Test (Development)
```bash
# Without auth (if CRON_SECRET not set)
curl -X POST http://localhost:3000/api/cron/planned-to-pending

# With auth
curl -X POST http://localhost:3000/api/cron/planned-to-pending \
  -H "Authorization: Bearer your-secret"
```

### Production Test
```bash
# Test via Vercel deployment
curl -X POST https://your-domain.com/api/cron/planned-to-pending \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Monitoring

The endpoint returns:
```json
{
  "success": true,
  "message": "Transitioned X schedules from PLANNED to PENDING",
  "count": 5,
  "timestamp": "2025-12-01T23:00:00.000Z",
  "hktDate": "2025-12-02T07:00:00.000Z"
}
```

Monitor via:
- Vercel Dashboard → Functions → Cron Jobs
- Application logs
- Database queries for status changes

## Troubleshooting

### CRON not running
1. Check Vercel Dashboard → Functions → Cron Jobs
2. Verify `vercel.json` is deployed
3. Check function logs for errors

### Unauthorized errors
1. Verify `CRON_SECRET` is set in Vercel environment variables
2. Check if request includes proper authorization header
3. Verify Vercel signature is present (for Vercel Cron)

### No schedules transitioned
1. Check if there are any `PLANNED` schedules with past `r1PlannedDate`
2. Verify timezone calculation (should use HKT)
3. Check database connection

## Schedule Adjustment

If you need to change the schedule:

**Current:** `"0 23 * * *"` (7am HKT)

**Other options:**
- `"0 0 * * *"` = Midnight UTC (8am HKT)
- `"0 22 * * *"` = 10pm UTC (6am HKT)
- `"30 22 * * *"` = 10:30pm UTC (6:30am HKT)

Adjust based on your needs and DST considerations.



