# Complete Schedule Data Extraction Guide

This document tracks the extraction of all schedule data from the MTR schedule images.

## Status

- ✅ MTR-01: Complete (Weeks 45-48)
- ✅ MTR-02: Partial (needs completion for all weeks)
- ✅ MTR-03: Complete (Weeks 45-48)
- ⚠️ MTR-04: Sample entries only (needs all weeks 45-48)
- ⚠️ MTR-05: Sample entries only (needs all weeks 45-48)
- ⚠️ MTR-06: Sample entries only (needs all weeks 45-48)

## Next Steps

To complete the seed file, extract all schedule entries from the images for:
- MTR-02: Complete remaining weeks
- MTR-04: All weeks 45-48
- MTR-05: All weeks 45-48  
- MTR-06: All weeks 45-48

Each entry should include:
- zoneCode
- week (45-48)
- batch (A or B)
- date (YYYY-MM-DD)
- timeSlot (SLOT_2300, SLOT_0130, SLOT_0330)
- equipmentNumber
- orNumber
- deadline (DD-Mon format)

## Running the Seed

Once complete, run:
```bash
npm run db:seed
```

