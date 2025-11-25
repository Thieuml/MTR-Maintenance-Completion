# Technical Decisions & Assumptions

This document captures key technical decisions and assumptions made during the development of MTR Maintenance Tracking.

## Data & Integration Decisions

### 1. OR Numbers (Work Orders)
**Decision**: Use dummy OR numbers for now, following the format from November schedule.

**Format**: 10-digit numbers starting with 5 (e.g., `5000355448`)

**Implementation**:
- Utility function `generateDummyORNumber()` creates random OR numbers
- Format validation: `/^5\d{9}$/`
- Real OR numbers will be imported from EAMS system later (not in first version)

**See**: `lib/utils/or-numbers.ts`

### 2. Certified Engineers
**Decision**: Use static list of certified engineers per zone.

**Certified Engineers (Fixed Engineers)**:
- **MTR-01**: Yip Ho Yin
- **MTR-02**: Lee Kin Kay
- **MTR-03**: Lai Yiu Ming
- **MTR-04**: Ho Ka Kit
- **MTR-05**: Tang Ho Fai
- **MTR-06**: Cheung Chun Pong

**Implementation**:
- Engineers are seeded with `hasCPCert: true` and `hasRWCert: true`
- Fixed engineer assignment requires these certificates
- Engineers will be synced from Looker later, but certifications are manually set

**See**: `prisma/seed.ts`

### 3. PM Forms (Maintenance Forms)
**Decision**: No form upload handling in the system at this point.

**Implementation**:
- System only tracks completion status (`completed: boolean`)
- No file upload functionality
- PM forms still submitted via WhatsApp (existing process)
- Admin marks visits as completed in the system after receiving WhatsApp confirmation

**Schema**: `MaintenanceVisit` model has:
- `completed: Boolean` - Whether visit is completed
- `completionDate: DateTime?` - When marked as completed
- `pmFormSubmitted: Boolean` - Whether PM form was submitted (via WhatsApp)
- No file upload fields

### 4. EAMS Integration
**Decision**: No EAMS integration in first couple of versions.

**Current Process**:
- OR numbers downloaded manually from EAMS monthly
- Admin enters completion records into EAMS manually
- System tracks completion status independently

**Future**: EAMS API integration may be added later.

### 5. Timezone
**Decision**: All times in HKT (Hong Kong Time, UTC+8).

**Implementation**:
- All dates/times stored in database as UTC
- Conversion utilities for HKT display and input
- Cron jobs scheduled in HKT
- Notifications sent at HKT times (e.g., 18:00 HKT for tonight's schedule)

**See**: `lib/utils/timezone.ts`

**Key Functions**:
- `toHKT(date)` - Convert date to HKT
- `nowHKT()` - Get current HKT time
- `formatHKT(date, includeTime)` - Format for display
- `createHKTDate(year, month, day, hour, minute)` - Create date at HKT time

## Business Logic Decisions

### Schedule Validation
- **14-day cycle**: Enforced at schedule creation (US12)
- **Time slots**: 23:00, 1:30, 3:30 (HKT)
- **Due dates**: R0 date + 14 days (calculated automatically)

### Engineer Assignment
- **Fixed engineer**: Must have CP & RW certificates
- **Rotating engineer**: No certificate requirement
- **2-man team**: Always required (fixed + rotating)

### Completion Classification
Auto-classification based on committed date vs actual date:
- **COMMITTED_DATE**: Completed on exact committed date (best case)
- **ON_TIME**: Completed within ±3-5 day tolerance window
- **LATE**: Completed after tolerance but before due date
- **OVERDUE**: Completed after due date (14 days expired)
- **NOT_COMPLETED**: Not completed

### Notifications
- **Tonight's schedule**: Sent daily at 18:00 HKT (6 PM local time)
- **Missed committed date**: Sent daily at 09:00 HKT (9 AM local time)
- **Language**: Chinese (Simplified/Traditional)
- **Channel**: In-app notifications via Novu (email optional)

## Technical Architecture Decisions

### Database
- **PostgreSQL**: Via Prisma ORM
- **Dates**: Stored in UTC, converted to HKT for display
- **Soft deletes**: Not implemented (hard deletes for now)

### API Design
- **RESTful**: Standard REST conventions
- **Validation**: Zod schemas for request validation
- **Error handling**: Consistent error responses

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **State management**: SWR for data fetching
- **Language**: English UI, Chinese notifications

### Data Sync
- **Looker**: Daily sync for engineers, devices, visits
- **Frequency**: 
  - Engineers: Daily at 2 AM UTC
  - Devices: Initial + periodic updates
  - Visits: Daily at 2 AM UTC

## Future Considerations

### Phase 2+ Features
- EAMS API integration for OR numbers
- Digital PM form upload
- Direct EAMS entry (bypass WhatsApp)
- Real-time sync with Looker
- Mobile app for engineers

### Performance
- Caching strategy for Looker data
- Batch operations for schedule creation
- Optimistic UI updates

### Security
- Authentication (NextAuth)
- Role-based access control
- Audit logging

## Questions Resolved

✅ **OR Numbers**: Dummy format for now, manual import later  
✅ **Certifications**: Static list, manually set  
✅ **PM Forms**: No upload, just completion tracking  
✅ **EAMS**: No integration in first versions  
✅ **Timezone**: All HKT  

## Open Questions

- [ ] Should we support multiple timezones for reporting?
- [ ] How to handle public holidays in HKT?
- [ ] Should we track engineer availability/leave?
- [ ] How to handle equipment status changes (maintenance, out of service)?

---

**Last Updated**: Initial version  
**Next Review**: After Phase 1 implementation

