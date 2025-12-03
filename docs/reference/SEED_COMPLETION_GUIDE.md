# Seed Data Completion Guide

## Current Status

The seed file currently contains **262 schedule entries** extracted from the MTR schedule images.

## What's Included

- ✅ MTR-01: Complete (Weeks 45-48)
- ✅ MTR-02: Mostly complete (Weeks 45-48) 
- ✅ MTR-03: Complete (Weeks 45-48)
- ⚠️ MTR-04: Partial (needs more entries from images)
- ⚠️ MTR-05: Partial (needs more entries from images)
- ⚠️ MTR-06: Partial (needs more entries from images)

## Missing Entries

Based on the images, there are still many entries missing. To complete the seed file:

1. **Extract ALL entries** from each image systematically
2. **Include SPARE entries** - these should be skipped (they're placeholders)
3. **Verify OR numbers** match the images exactly
4. **Check deadlines** match the images

## How to Add Missing Entries

1. Open the image for each zone
2. Go through each week (45-48) and each day
3. Extract every entry with:
   - Equipment number (機號)
   - OR number
   - Deadline (期限)
   - Time slot (23:00, 1:30, 3:30)
   - Batch (A or B)

4. Add to `prisma/seed.ts` in the `scheduleData` array

## Running the Seed

Once complete, run:
```bash
npm run db:seed
```

This will:
- Create all equipment automatically
- Create all schedules
- Skip duplicate OR numbers (with warning)

## Notes

- Equipment is auto-created from schedule entries
- Dates are in HKT timezone
- Deadlines are parsed and converted to due dates (R0 + 14 days)
- SPARE entries should be skipped (not added to seed data)

