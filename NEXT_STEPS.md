# Next Steps - MTR Maintenance Tracking

This document outlines the implementation plan for building out the MTR Maintenance Tracking application.

## Current Status ✅

**Completed:**
- ✅ Project structure (Next.js 14, TypeScript, Prisma, Tailwind)
- ✅ Database schema design (all models defined)
- ✅ Looker integration utilities (engineers, devices, visits)
- ✅ Novu integration utilities (Chinese notifications)
- ✅ Environment variables setup and documentation
- ✅ Basic app structure and health check endpoint
- ✅ Git repository initialized and connected to GitHub

## Implementation Roadmap

### Phase 1: Data Sync & Foundation (Priority: High)

#### 1.1 Looker Data Sync API Routes
**Goal**: Sync data from Looker into the database

**Tasks:**
- [ ] Create `/api/sync/engineers` endpoint
  - Fetch engineers from Looker (Look ID 160)
  - Create/update engineers in database
  - Handle deactivation of engineers no longer in Looker
  - Map Looker fields to database schema

- [ ] Create `/api/sync/devices` endpoint
  - Fetch MTR devices from Looker (Look ID 167)
  - Create/update equipment in database
  - Assign equipment to zones (MTR-01 to MTR-06)
  - Handle equipment status (active/inactive)

- [ ] Create `/api/sync/visits` endpoint
  - Fetch maintenance visits from Looker (Look ID 168)
  - Create/update MaintenanceVisit records
  - Link visits to schedules
  - Auto-classify visits (COMMITTED_DATE, ON_TIME, LATE, OVERDUE)

- [ ] Create `/api/sync/work-orders` endpoint (optional)
  - Bulk import OR numbers from EAMS
  - Pre-populate schedules with work order numbers
  - Validate OR numbers

**Files to create:**
- `app/api/sync/engineers/route.ts`
- `app/api/sync/devices/route.ts`
- `app/api/sync/visits/route.ts`
- `app/api/sync/work-orders/route.ts`

**Dependencies:**
- Looker credentials configured
- Database schema ready

---

### Phase 2: Schedule Management API (Priority: High)

#### 2.1 Schedule CRUD Operations
**Goal**: Manage maintenance schedules (14-day cycles)

**Tasks:**
- [ ] Create `/api/schedules` endpoint (GET, POST)
  - GET: List schedules with filters (zone, date range, status, equipment)
  - POST: Create new schedule
  - Validate 14-day cycle constraint (US12)
  - Calculate due dates (R0 + 14 days)

- [ ] Create `/api/schedules/[id]` endpoint (GET, PUT, DELETE)
  - GET: Get single schedule with related data
  - PUT: Update schedule
  - DELETE: Soft delete schedule

- [ ] Create `/api/schedules/bulk-create` endpoint
  - Generate schedules for multiple equipment
  - Handle A/B batch assignment
  - Assign time slots (23:00, 1:30, 3:30)

**Files to create:**
- `app/api/schedules/route.ts`
- `app/api/schedules/[id]/route.ts`
- `app/api/schedules/bulk-create/route.ts`
- `lib/validations/schedule.ts` (Zod schemas)

**Business Logic:**
- Enforce 14-day cycle: prevent schedules >14 days apart
- Auto-calculate due dates from R0 dates
- Validate time slots (only pink-marked units at 23:00)

---

### Phase 3: Engineer Assignment (Priority: High)

#### 3.1 Engineer Assignment API
**Goal**: Assign engineers to schedules (2-man teams)

**Tasks:**
- [ ] Create `/api/schedules/[id]/assign` endpoint
  - Assign fixed engineer (must have CP & RW certs)
  - Assign rotating engineer
  - Validate engineer availability
  - Validate certifications for fixed engineer

- [ ] Create `/api/schedules/[id]/unassign` endpoint
  - Unassign engineers from schedule
  - Handle both fixed and rotating engineers

- [ ] Create `/api/engineers` endpoint
  - GET: List engineers with filters (zone, active, certifications)
  - GET: Get engineer availability for date range
  - GET: Get engineer compliance stats (US14, US15)

**Files to create:**
- `app/api/schedules/[id]/assign/route.ts`
- `app/api/schedules/[id]/unassign/route.ts`
- `app/api/engineers/route.ts`
- `lib/utils/engineer-availability.ts`

**Business Logic:**
- Fixed engineer must have CP & RW certificates
- Check engineer workload (max 3 units per night)
- Validate engineer is active

---

### Phase 4: Calendar & Schedule UI (Priority: High)

#### 4.1 Schedule Calendar View
**Goal**: Visual 14-day calendar for all MTR units (US1)

**Tasks:**
- [ ] Create `/schedule` page
  - Calendar view showing schedules by zone
  - Filter by zone (MTR-01 to MTR-06)
  - Filter by date range
  - Color coding by status (planned, completed, missed, overdue)
  - Show equipment number, time slot, engineers

- [ ] Create calendar component
  - 14-day cycle visualization
  - Day-by-day breakdown
  - Time slot indicators (23:00, 1:30, 3:30)
  - Batch indicators (A/B)

**Files to create:**
- `app/schedule/page.tsx`
- `components/ScheduleCalendar.tsx`
- `components/ScheduleCard.tsx`
- `components/ZoneFilter.tsx`
- `lib/hooks/useSchedule.ts` (SWR hook)

**UI Requirements:**
- Group by zone
- Show committed dates clearly
- Highlight missed/overdue units
- Responsive design

---

### Phase 5: Maintenance Completion Tracking (Priority: Medium)

#### 5.1 Completion Tracking API & UI
**Goal**: Track actual maintenance execution (US3, US4, US13)

**Tasks:**
- [ ] Create `/api/visits` endpoint
  - POST: Create maintenance visit record
  - PUT: Update visit (mark as completed)
  - Auto-classify visit (COMMITTED_DATE, ON_TIME, LATE, OVERDUE)
  - Calculate deviation from committed date

- [ ] Create `/api/visits/[id]/complete` endpoint
  - Mark visit as completed
  - Record completion date
  - Update schedule status
  - Track PM form submission

- [ ] Create `/completion` page
  - List of pending completions
  - Mark visits as completed
  - Upload PM forms (optional)
  - Track EAMS entry status

**Files to create:**
- `app/api/visits/route.ts`
- `app/api/visits/[id]/complete/route.ts`
- `app/completion/page.tsx`
- `components/CompletionForm.tsx`
- `lib/utils/visit-classification.ts`

**Business Logic:**
- Auto-classify based on committed date vs actual date
- ±3-5 day tolerance window
- Update schedule status automatically

---

### Phase 6: Rescheduling Workflow (Priority: Medium)

#### 6.1 Rescheduling API & UI
**Goal**: Manage rescheduling requests (US6, US7)

**Tasks:**
- [ ] Create `/api/reschedules` endpoint
  - POST: Create reschedule request
  - GET: List reschedules (pending, approved, rejected)
  - PUT: Update reschedule status
  - Track MTR approval

- [ ] Create `/api/reschedules/[id]/approve` endpoint
  - Approve reschedule (MTR side)
  - Update schedule dates
  - Notify engineers

- [ ] Create `/reschedules` page
  - List pending reschedules
  - Show original vs new dates
  - Approve/reject reschedules
  - Track approval status

**Files to create:**
- `app/api/reschedules/route.ts`
- `app/api/reschedules/[id]/approve/route.ts`
- `app/reschedules/page.tsx`
- `components/RescheduleRequest.tsx`
- `components/RescheduleModal.tsx`

**Business Logic:**
- Validate new date is within due date window
- Require MTR approval for reschedules
- Update schedule automatically on approval

---

### Phase 7: Notifications (Priority: Medium)

#### 7.1 Automated Notifications
**Goal**: Chinese-language notifications for engineers (US9, US10)

**Tasks:**
- [ ] Create cron job for tonight's schedule
  - Daily at 18:00 HKT (6 PM local time)
  - Send notification to engineers with tonight's units
  - Include equipment numbers, stations, time slots, OR numbers

- [ ] Create cron job for missed committed dates
  - Daily at 09:00 HKT (9 AM local time)
  - Check for missed committed dates from previous night
  - Send alert to engineer

- [ ] Create `/api/cron/notify-tonight` endpoint
  - Triggered by Vercel cron or external scheduler
  - Fetch schedules for tonight
  - Send notifications via Novu

- [ ] Create `/api/cron/notify-missed` endpoint
  - Check for missed committed dates
  - Send alerts

**Files to create:**
- `app/api/cron/notify-tonight/route.ts`
- `app/api/cron/notify-missed/route.ts`
- `lib/utils/notification-helpers.ts`
- `vercel.json` (cron configuration)

**Business Logic:**
- Only notify engineers assigned to schedules
- Include all relevant details (equipment, station, time, OR number)
- Chinese language templates

---

### Phase 8: Compliance & Reporting (Priority: Low)

#### 8.1 Compliance Dashboard
**Goal**: Compliance monitoring and reporting (US5, US14, US15, US16)

**Tasks:**
- [ ] Create `/compliance` page
  - Overview dashboard
  - Units missed committed date (US5)
  - Units requiring rescheduling (US6)
  - Units already rescheduled (US7)
  - Overdue units per engineer (US14)

- [ ] Create `/compliance/engineers` page
  - Engineer compliance stats
  - % late visits over 6 months (US15)
  - Overdue units count
  - Trend charts

- [ ] Create `/api/compliance/export` endpoint
  - Export full audit history (US16)
  - CSV/Excel export
  - Include: committed date, execution date, status, deviation

**Files to create:**
- `app/compliance/page.tsx`
- `app/compliance/engineers/page.tsx`
- `app/api/compliance/export/route.ts`
- `components/ComplianceDashboard.tsx`
- `components/EngineerStats.tsx`
- `lib/utils/export.ts`

**Business Logic:**
- Calculate compliance metrics
- Aggregate data by engineer, zone, time period
- Generate exportable reports

---

## Recommended Implementation Order

### Sprint 1: Foundation (Week 1-2)
1. **Data Sync** (Phase 1.1)
   - Sync engineers, devices, visits from Looker
   - Test data import

2. **Schedule API** (Phase 2.1)
   - Basic CRUD operations
   - 14-day cycle validation

### Sprint 2: Core Features (Week 3-4)
3. **Engineer Assignment** (Phase 3.1)
   - Assign engineers to schedules
   - Validation logic

4. **Calendar UI** (Phase 4.1)
   - Visual schedule view
   - Zone filtering

### Sprint 3: Execution Tracking (Week 5-6)
5. **Completion Tracking** (Phase 5.1)
   - Mark visits as completed
   - Auto-classification

6. **Rescheduling** (Phase 6.1)
   - Create reschedule requests
   - Approval workflow

### Sprint 4: Automation & Reporting (Week 7-8)
7. **Notifications** (Phase 7.1)
   - Automated daily reminders
   - Missed date alerts

8. **Compliance Dashboard** (Phase 8.1)
   - Reporting and analytics
   - Export functionality

## Quick Wins (Can Start Immediately)

1. **Data Sync Endpoints** - Start syncing data from Looker
2. **Basic Schedule API** - Create/read schedules
3. **Simple Calendar View** - Display schedules in a basic calendar
4. **Engineer List** - Display engineers with filters

## Technical Considerations

### Database Migrations
- Run migrations as schema evolves
- Use `npm run db:migrate` for production
- Use `npm run db:push` for development

### API Design
- Use RESTful conventions
- Return consistent JSON responses
- Handle errors gracefully
- Add request validation (Zod)

### UI/UX
- Mobile-responsive design
- Chinese language support
- Clear status indicators
- Loading states and error handling

### Testing
- Unit tests for business logic
- API endpoint tests
- Integration tests for data sync

## Dependencies to Set Up

1. **Database**: Ensure PostgreSQL is running and accessible
2. **Looker**: Verify API credentials and Look IDs
3. **Novu**: Set up workflows and test notifications
4. **Cron Jobs**: Configure Vercel cron or external scheduler

## Questions Resolved ✅

1. **OR Numbers**: Use dummy OR numbers (format: 5000XXXXXX) for now. Manual import later.
2. **Certifications**: Static list of certified engineers per zone (seeded in database).
3. **PM Forms**: No form upload - just track completion status. Forms still via WhatsApp.
4. **EAMS Integration**: Not in first couple of versions.
5. **Timezone**: All times in HKT (Hong Kong Time, UTC+8).

**See**: `DECISIONS.md` for detailed technical decisions.

## Getting Started

To start implementing:

1. **Choose a phase** from above
2. **Create the API routes** first (backend logic)
3. **Test with API client** (Postman, curl, or test script)
4. **Build the UI** components
5. **Integrate** with existing code
6. **Test end-to-end**

Example: Start with Phase 1.1 (Data Sync)
```bash
# Create the sync endpoint
touch app/api/sync/engineers/route.ts

# Implement the sync logic
# Test with: curl http://localhost:3000/api/sync/engineers
```

## Support & Documentation

- **PRD**: See `PRD.md` for detailed requirements
- **Setup**: See `SETUP.md` for environment setup
- **Looker**: See `LOOKER_LOOKS.md` for Look ID documentation
- **API Docs**: Will be generated as endpoints are created

---

**Last Updated**: Initial version
**Next Review**: After Sprint 1 completion

