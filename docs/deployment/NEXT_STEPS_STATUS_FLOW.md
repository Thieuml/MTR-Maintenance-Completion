# Status Flow Refactor - Next Steps

## ✅ Completed

1. **Schema Updates**
   - Added `isLate`, `lastSkippedDate`, `skippedCount` fields
   - Updated `ScheduleStatus` enum (added PENDING, SKIPPED, CANCELLED)

2. **Database Migration**
   - Migration SQL file created
   - Ready to run: `npx prisma migrate dev`

3. **CRON Job**
   - Endpoint created: `/api/cron/planned-to-pending`
   - Configured in `vercel.json`
   - CRON_SECRET set up

4. **API Endpoints Updated**
   - Validation endpoint (PENDING → COMPLETED/SKIPPED/MISSED)
   - Reschedule endpoint (SKIPPED → PLANNED)
   - Delete endpoints (restrictions added)

5. **Documentation**
   - STATUS_FLOW.md updated
   - STATUS_FLOW_IMPLEMENTATION.md created
   - CRON_SETUP.md created
   - CRON_SECRET_SETUP.md created

## 🔄 Next Steps

### 1. Run Migration (Development)

```bash
cd MTR-Maintenance-Tracking
export $(cat .env.local | grep DATABASE_URL | xargs)
npx prisma migrate dev --name status_flow_refactor
npx prisma generate
```

### 2. Test Implementation

**Test CRON Job:**
```bash
# Manual test
curl -X POST http://localhost:3000/api/cron/planned-to-pending \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Test Validation:**
- Mark item as completed → Should set `isLate` flag
- Mark item as "to reschedule" with past dueDate → Should become MISSED
- Mark item as "to reschedule" with future dueDate → Should become SKIPPED

**Test Reschedule:**
- Reschedule SKIPPED item → Should become PLANNED
- Check `skippedCount` increments

**Test Delete:**
- Try deleting MISSED/COMPLETED → Should fail
- Try deleting PLANNED/PENDING/SKIPPED → Should work (sets to CANCELLED)

### 3. Update Frontend Components

**Priority Order:**

1. **Status Badges** (`components/shared/StatusBadge.tsx` or similar)
   - Add `SKIPPED` badge (orange)
   - Add `PENDING` badge (yellow)
   - Update `COMPLETED` to show "Late" indicator if `isLate = true`

2. **Work Order Categorization Hook** (`lib/hooks/useWorkOrderCategorization.ts`)
   - Update to use `PENDING` status (not display logic)
   - Update to use `SKIPPED` instead of `RESCHEDULED`
   - Handle `MISSED` status

3. **Calendar Component** (`components/schedule/ScheduleCalendar.tsx`)
   - Show `MISSED` items (read-only, non-editable)
   - Show `COMPLETED` items (read-only)
   - Prevent editing `MISSED` and `COMPLETED`

4. **Validation Page** (`app/validation/page.tsx`)
   - Update to handle `PENDING` status
   - Show correct status badges

5. **Reschedule Page** (`app/reschedule/page.tsx`)
   - Filter `SKIPPED` items (not `RESCHEDULED`)
   - Update status checks

6. **Daily Report** (`app/work-order-tracking/page.tsx`)
   - Update "Items Pending Rescheduling" logic (PENDING + SKIPPED)
   - Update "Items Rescheduled" logic (PLANNED with skippedCount > 0)
   - Update "Items Now Completed" logic

7. **Work Order Tracking Page**
   - Update tabs to use new statuses
   - Show `lastSkippedDate` where appropriate

### 4. Deploy to Production

**Before deploying:**

1. **Run migration in production:**
   ```bash
   npx prisma migrate deploy
   ```

2. **Verify CRON_SECRET is set in Vercel:**
   ```bash
   vercel env ls
   ```

3. **Deploy:**
   ```bash
   vercel --prod
   ```

4. **Verify CRON job:**
   - Check Vercel Dashboard → Functions → Cron Jobs
   - Should show scheduled job

5. **Monitor first run:**
   - Check logs after 7am HKT
   - Verify schedules transition correctly

### 5. Post-Deployment Verification

- [ ] CRON job runs successfully
- [ ] Schedules transition PLANNED → PENDING
- [ ] Validation works (COMPLETED/SKIPPED/MISSED)
- [ ] Rescheduling works (SKIPPED → PLANNED)
- [ ] Delete restrictions work
- [ ] Frontend displays correctly
- [ ] Daily Report shows correct data

## 📋 Testing Checklist

- [ ] Migration runs successfully
- [ ] CRON job transitions schedules
- [ ] Validation endpoint sets correct statuses
- [ ] Late flag calculated correctly
- [ ] Reschedule increments skippedCount
- [ ] Delete restrictions enforced
- [ ] Frontend shows correct badges
- [ ] Calendar shows MISSED/COMPLETED as read-only
- [ ] Daily Report logic works

## 🐛 Troubleshooting

**Migration fails:**
- Check database connection
- Verify schema matches
- Check for conflicting migrations

**CRON not running:**
- Verify `vercel.json` is deployed
- Check Vercel Dashboard → Cron Jobs
- Verify endpoint is accessible

**Status transitions not working:**
- Check API endpoint logs
- Verify Prisma client is regenerated
- Check database enum values

## 📚 Documentation

All documentation is in:
- `docs/development/STATUS_FLOW.md` - Complete status flow architecture
- `docs/development/STATUS_FLOW_IMPLEMENTATION.md` - Implementation details
- `docs/deployment/CRON_SETUP.md` - CRON job setup
- `docs/deployment/CRON_SECRET_SETUP.md` - Secret setup guide



