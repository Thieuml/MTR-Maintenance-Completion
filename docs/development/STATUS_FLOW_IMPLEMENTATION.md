# Status Flow Refactor - Implementation Summary

## Overview

This document summarizes the implementation of the revised status flow architecture as defined in `STATUS_FLOW.md`.

## Changes Implemented

### 1. Schema Updates ✅

**File**: `prisma/schema.prisma`

- Added `isLate` Boolean field (default: false)
- Added `lastSkippedDate` DateTime? field (nullable)
- Added `skippedCount` Int field (default: 0)
- Updated `ScheduleStatus` enum:
  - Added: `PENDING`, `SKIPPED`, `CANCELLED`
  - Removed: `COMPLETED_LATE`, `RESCHEDULED`, `TO_RESCHEDULE`, `IN_PROGRESS`, `OVERDUE` (deprecated)

### 2. Database Migration ✅

**File**: `prisma/migrations/20251130000000_status_flow_refactor/migration.sql`

- Adds new columns with defaults
- Adds new enum values
- Migrates existing data:
  - `COMPLETED_LATE` → `COMPLETED` + `isLate = true`
  - `RESCHEDULED` → `PLANNED` + `skippedCount = 1`
  - `TO_RESCHEDULE` → `SKIPPED` (if `dueDate >= today`) or `MISSED` (if `dueDate < today`)
  - `IN_PROGRESS` → `PENDING` (if past date) or `PLANNED` (if future date)
  - `OVERDUE` → `MISSED`
- Backfills `isLate` flag for existing `COMPLETED` and `PLANNED` items
- Backfills `lastSkippedDate` for rescheduled items

### 3. CRON Job ✅

**File**: `app/api/cron/planned-to-pending/route.ts`

- Automatically transitions `PLANNED → PENDING` at 7am HK Time daily
- Uses HKT timezone utilities
- Protected with `CRON_SECRET` environment variable
- Returns count of transitions performed

**Setup Required**:
- Add `CRON_SECRET` to environment variables
- Configure scheduled job to call `/api/cron/planned-to-pending` at 7am HKT
- For Vercel: Add to `vercel.json` cron configuration
- For other platforms: Use GitHub Actions, external cron service, etc.

### 4. Validation Endpoint ✅

**File**: `app/api/schedules/[id]/validate/route.ts`

**Changes**:
- `action: 'completed'`:
  - Sets `status = 'COMPLETED'`
  - Calculates `isLate` flag: `completionDate > mtrPlannedStartDate + 6 days`
- `action: 'to_reschedule'`:
  - If `dueDate < today`: Sets `status = 'MISSED'` (final status)
  - If `dueDate >= today`: Sets `status = 'SKIPPED'` + increments `skippedCount`
  - Sets `lastSkippedDate = r1PlannedDate`
  - Sets `r1PlannedDate = null`

### 5. Reschedule/Move Endpoint ✅

**File**: `app/api/schedules/[id]/move/route.ts`

**Changes**:
- Only `SKIPPED` schedules can be rescheduled
- Prevents moving `COMPLETED` or `MISSED` schedules
- Transition: `SKIPPED → PLANNED` (removed `RESCHEDULED` status)
- Calculates `isLate` flag: `r1PlannedDate > mtrPlannedStartDate + 6 days`
- Preserves `skippedCount` and `lastSkippedDate` (doesn't change them)

### 6. Delete Endpoints ✅

**Files**:
- `app/api/schedules/[id]/route.ts` (DELETE method)
- `app/api/admin/work-orders/[id]/route.ts` (DELETE method)

**Changes**:
- Only `PLANNED`, `PENDING`, or `SKIPPED` can be deleted
- `MISSED` and `COMPLETED` cannot be deleted (statistics integrity)
- Soft delete: Sets `status = 'CANCELLED'` (preserves audit trail)

## Next Steps

### 1. Run Migration

```bash
# Generate Prisma client with new schema
npx prisma generate

# Run migration (in development)
npx prisma migrate dev

# Or apply migration in production
npx prisma migrate deploy
```

### 2. Configure CRON Job

**For Vercel** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/planned-to-pending",
      "schedule": "0 23 * * *" // 7am HKT = 11pm UTC previous day (during DST)
    }
  ]
}
```

**Note**: Adjust schedule based on DST. HKT is UTC+8, so:
- During standard time: 7am HKT = 11pm UTC previous day
- During DST (if applicable): Adjust accordingly

**For GitHub Actions** (`.github/workflows/cron.yml`):
```yaml
name: Planned to Pending Transition
on:
  schedule:
    - cron: '0 23 * * *' # 7am HKT
jobs:
  transition:
    runs-on: ubuntu-latest
    steps:
      - name: Call API
        run: |
          curl -X POST https://your-domain.com/api/cron/planned-to-pending \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### 3. Update Frontend Components

**Pending Tasks**:
- [ ] Update calendar to show `MISSED` items as read-only
- [ ] Update calendar to show `COMPLETED` items as read-only
- [ ] Update status badges to show `SKIPPED` status
- [ ] Update status badges to show `PENDING` status
- [ ] Update Daily Report logic to use new statuses
- [ ] Update work order categorization hook
- [ ] Update validation page to handle new statuses
- [ ] Update reschedule page to filter `SKIPPED` items (not `RESCHEDULED`)

### 4. Environment Variables

Add to `.env.local` and production:
```bash
CRON_SECRET=your-secret-token-here
```

### 5. Testing Checklist

- [ ] Test `PLANNED → PENDING` auto-transition (CRON job)
- [ ] Test `PENDING → COMPLETED` with late flag calculation
- [ ] Test `PENDING → SKIPPED` (dueDate >= today)
- [ ] Test `PENDING → MISSED` (dueDate < today)
- [ ] Test `SKIPPED → PLANNED` (rescheduling)
- [ ] Test delete restrictions (cannot delete MISSED/COMPLETED)
- [ ] Test calendar display (show MISSED/COMPLETED as read-only)
- [ ] Test Daily Report with new statuses
- [ ] Test multiple reschedules (skippedCount increments)
- [ ] Test `isLate` flag calculation for both COMPLETED and PLANNED

## Migration Notes

### Data Safety

The migration is designed to be safe:
- All new fields have defaults
- Existing data is migrated to appropriate new statuses
- No data loss occurs
- Enum values are added (not removed) - deprecated values remain but won't be used

### Rollback Plan

If rollback is needed:
1. Revert schema changes
2. Revert API endpoint changes
3. Data migration can be reversed (statuses can be mapped back)

## Key Business Rules Implemented

1. **Late Flag**: Uses `mtrPlannedStartDate + 6 days` (not `r0PlannedDate`)
2. **MISSED vs SKIPPED**: Based on `dueDate` comparison with today
3. **Final States**: `COMPLETED`, `MISSED`, `CANCELLED` cannot transition
4. **Delete Restrictions**: Only `PLANNED`, `PENDING`, `SKIPPED` can be deleted
5. **Rescheduling**: Only `SKIPPED` can be rescheduled → `PLANNED`
6. **Auto-Transition**: `PLANNED → PENDING` at 7am HKT daily

## Files Modified

- `prisma/schema.prisma`
- `prisma/migrations/20251130000000_status_flow_refactor/migration.sql`
- `app/api/cron/planned-to-pending/route.ts` (new)
- `app/api/schedules/[id]/validate/route.ts`
- `app/api/schedules/[id]/move/route.ts`
- `app/api/schedules/[id]/route.ts`
- `app/api/admin/work-orders/[id]/route.ts`
- `docs/development/STATUS_FLOW.md` (updated)

## Files Still To Update

- Frontend components (calendar, status badges, etc.)
- Work order categorization hook
- Daily Report logic
- Validation page
- Reschedule page



