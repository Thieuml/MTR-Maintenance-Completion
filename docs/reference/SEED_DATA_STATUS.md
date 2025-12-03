# Seed Data Status

## Current Status

The seed file (`prisma/seed.ts`) currently contains:

- ✅ **MTR-01**: Complete (Weeks 45-48, all entries)
- ⚠️ **MTR-02**: Partial (has entries but may be missing some)
- ✅ **MTR-03**: Complete (Weeks 45-48, all entries)
- ❌ **MTR-04**: Sample entries only (needs ALL weeks 45-48)
- ❌ **MTR-05**: Sample entries only (needs ALL weeks 45-48)
- ❌ **MTR-06**: Sample entries only (needs ALL weeks 45-48)

## What Needs to Be Done

To complete the seed file, extract ALL schedule entries from the images for:

1. **MTR-02**: Verify completeness, add any missing entries
2. **MTR-04**: Extract ALL entries for weeks 45-48 (Batch A/B)
3. **MTR-05**: Extract ALL entries for weeks 45-48 (Batch A/B)
4. **MTR-06**: Extract ALL entries for weeks 45-48 (Batch A/B)

## Entry Format

Each entry should follow this format:
```typescript
{ 
  zoneCode: 'MTR-XX', 
  week: 45-48, 
  batch: 'A' | 'B', 
  date: 'YYYY-MM-DD', 
  timeSlot: 'SLOT_2300' | 'SLOT_0130' | 'SLOT_0330', 
  equipmentNumber: 'XXX-XXX', 
  orNumber: '5000XXXXXX', 
  deadline: 'DD-Mon' 
}
```

## Next Steps

1. Extract all entries from MTR-04, MTR-05, MTR-06 images
2. Add them to `prisma/seed.ts` in the `scheduleData` array
3. Run `npm run db:seed` to populate the database

## Notes

- Equipment will be auto-created from schedule entries
- Duplicate OR numbers will be skipped (with warning)
- Dates should be in HKT timezone
- Deadlines are parsed and converted to due dates (R0 + 14 days)

