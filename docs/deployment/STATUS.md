# Project Status - MTR Maintenance Tracking

**Last Updated:** January 2025

## ✅ Completed Features

### 1. **Core Infrastructure**
- ✅ Next.js 14 App Router setup with TypeScript
- ✅ PostgreSQL database with Prisma ORM
- ✅ Tailwind CSS for styling
- ✅ Looker SDK integration for data sync
- ✅ Novu SDK integration (workflows configured)
- ✅ Environment variables configuration
- ✅ Database schema design and migrations

### 2. **Data Management**
- ✅ Looker sync endpoints for engineers, devices, and visits
- ✅ Equipment management (create, update, list)
- ✅ Equipment zone mapping (zone + batch assignment)
- ✅ 23:00 slot eligibility management
- ✅ Device normalization (zero-padded format)

### 3. **Schedule Management**
- ✅ Visual 14-day calendar with zone filtering
- ✅ Schedule CRUD operations
- ✅ 14-day cycle validation
- ✅ Drag-and-drop rescheduling (move and swap)
- ✅ Schedule assignment/unassignment
- ✅ Bulk schedule creation
- ✅ Status tracking (PLANNED, IN_PROGRESS, COMPLETED, MISSED, RESCHEDULED, etc.)

### 4. **Work Order Management**
- ✅ CSV upload with drag-and-drop interface
- ✅ Automatic slot distribution:
  - 11pm-eligible units → SLOT_2300
  - Other units → distributed across SLOT_0130 and SLOT_0330
- ✅ Work Order validation (duplicate check, device existence, mapping validation)
- ✅ Upload history and details display
- ✅ Work Order tracking page with three tabs:
  - To be validated (past unactioned services)
  - To be rescheduled (MISSED status)
  - Completed (COMPLETED/COMPLETED_LATE)

### 5. **Maintenance Validation**
- ✅ Completion validation workflow
- ✅ Bulk validation actions (mark multiple as completed/to reschedule)
- ✅ Status indicators on schedule cards
- ✅ Pending/completed/to reschedule tracking
- ✅ Past services validation (last 30 days)

### 6. **Rescheduling**
- ✅ Rescheduling interface with visual slot picker
- ✅ Free slot highlighting (green background)
- ✅ Deadline date display
- ✅ Warning for occupied slots
- ✅ Swap functionality when moving to occupied slots

### 7. **Admin Panel**
- ✅ Devices management:
  - View all devices from Looker (HK only)
  - Inline editing of zone and batch mapping
  - 23:00 slot eligibility toggle
  - Search and filter functionality
- ✅ Work Order upload and management:
  - CSV upload with validation
  - Filter by date range (last 7 days, 30 days, all time)
  - Search by Work Order number or Equipment number
  - Last upload details display
- ✅ Zone-engineer assignment interface

### 8. **Daily Report & Work Order Tracking**
- ✅ Daily Backlog Report with PDF export
- ✅ Three sections:
  - Items Pending Rescheduling (TO_RESCHEDULE status)
  - Newly Rescheduled Maintenance (rescheduled yesterday)
  - Other Rescheduled Maintenance (rescheduled earlier)
  - Completed Yesterday
- ✅ Date field standardization:
  - WM Planned Date → WM Initial Scheduled Date
  - Last Missed Service (lastSkippedDate)
  - MTR Planned Date (r1PlannedDate)
  - MTR Start Date (mtrPlannedStartDate)
- ✅ Proper categorization of TO_RESCHEDULE items
- ✅ Refresh icon link (replaced button with icon)

### 9. **UI/UX**
- ✅ Navigation sidebar with WeMaintain logo
- ✅ Badge indicators for items needing action
- ✅ Responsive calendar grid
- ✅ Color-coded status indicators
- ✅ Compact schedule cards with all relevant information
- ✅ 23:00 slot clock icon indicators
- ✅ Empty slot highlighting (green background)
- ✅ Deadline date display on cards
- ✅ Refresh icon link with hover tooltip

## 🚧 In Progress / Pending

### 1. **Notifications**
- ⚠️ Novu workflows configured but not yet triggered
- [ ] Implement "Tonight Schedule" notifications (Chinese)
- [ ] Implement "Missed Committed Date" notifications (Chinese)
- [ ] Schedule notification triggers based on schedule dates

### 2. **Compliance & Reporting**
- [ ] Overdue units per engineer view
- [ ] Percentage of late visits (6-month history)
- [ ] Export full audit history (CSV/PDF)
- [ ] Compliance dashboard

### 3. **EAMS Integration**
- [ ] EAMS API integration (when available)
- [ ] Automatic work order sync from EAMS
- [ ] PM form submission tracking

### 4. **Advanced Features**
- [ ] Engineer performance metrics
- [ ] Risk detection and early warnings
- [ ] Automated rescheduling suggestions
- [ ] MTR approval workflow for reschedules

## 📊 Current Statistics

### Database Models
- **Zones**: 6 zones (MTR-01 to MTR-06)
- **Equipment**: Synced from Looker (HK only)
- **Engineers**: Synced from Looker (HK only)
- **Schedules**: 14-day cycle maintenance schedules
- **Work Orders**: Uploaded via CSV with automatic slot assignment

### API Endpoints
- **22 API endpoints** implemented
- **4 main pages** (Schedule, Work Order Tracking, Admin, Reschedule)
- **6 admin components** for device and work order management

## 🔧 Configuration

### Environment Variables
```env
DATABASE_URL=postgresql://...
LOOKER_API_BASE_URL=https://wemaintain.cloud.looker.com
LOOKER_CLIENT_ID=...
LOOKER_CLIENT_SECRET=...
LOOKER_ENGINEERS_LOOK_ID=160
LOOKER_DEVICES_LOOK_ID=167
LOOKER_VISITS_LOOK_ID=168
NOVU_API_KEY=...
NOVU_API_HOSTNAME=https://eu.api.novu.co
PORT=3004
```

### Looker Integration
- ✅ Engineers: Look ID 160 (filtered on HK)
- ✅ Devices: Look ID 167 (HK only)
- ✅ Visits: Look ID 168 (last 3 months)

### Novu Integration
- ✅ SDK configured
- ✅ Workflows created (not yet triggered)
- ⚠️ Chinese-language templates need to be configured

## 🐛 Known Issues

### 1. **Device Duplication**
- ✅ **RESOLVED**: Normalized equipment numbers to prevent duplicates (e.g., HOK-E1 vs HOK-E01)
- ✅ **RESOLVED**: API now normalizes equipment numbers before comparison

### 2. **23:00 Slot Icon Display**
- ✅ **RESOLVED**: Icon now displays correctly for eligible units
- ✅ **RESOLVED**: Cache invalidation ensures immediate UI updates

### 3. **Work Order Upload Slot Distribution**
- ✅ **RESOLVED**: Work orders now properly distributed across slots
- ✅ **RESOLVED**: 11pm-eligible units correctly assigned to SLOT_2300

### 4. **Timezone Handling in Reschedule Dialog**
- ✅ **RESOLVED**: Fixed HKT timezone handling to prevent showing past dates
- ✅ **RESOLVED**: Consistent date comparisons using HKT date strings
- ✅ **RESOLVED**: Occupied slots now match main schedule view

### 5. **"To Be Rescheduled" Tab Not Showing Items**
- ✅ **RESOLVED**: Fixed filtering logic to show TO_RESCHEDULE items with r1PlannedDate = null
- ✅ **RESOLVED**: API now correctly includes TO_RESCHEDULE items in queries
- ✅ **RESOLVED**: Added backfill script for missing lastSkippedDate on rescheduled items

### 6. **Date Field Labels and Display**
- ✅ **RESOLVED**: Standardized date field labels across the system
- ✅ **RESOLVED**: Updated Daily Report column order and visibility
- ✅ **RESOLVED**: Fixed "Last Missed Service" display in To Be Rescheduled tab

## 📋 Next Steps

**📄 See [NEXT_STEPS.md](./NEXT_STEPS.md) for detailed implementation plan**

### Critical Path (Priority 1)
1. **Automated Notifications** ⚠️
   - Set up scheduled jobs to trigger notifications
   - "Tonight Schedule" notifications (daily at 6 PM HKT)
   - "Missed Committed Date" notifications (daily at 7 AM HKT)
   - Test notification delivery

2. **Maintenance Visit Classification** ⚠️
   - Implement auto-classification logic
   - Calculate classification when visit is created/updated
   - Display classification in UI

### Important (Priority 2)
3. **Compliance Dashboard**
   - Overdue units per engineer view
   - Engineer performance metrics (% late visits)
   - Compliance summary

4. **Audit History Export**
   - CSV/PDF export functionality
   - Filter by date range, zone, engineer, status

### Enhancements (Priority 3)
5. **Performance Optimization**
   - Query optimization and caching
   - Bulk operations improvements

6. **UI/UX Improvements**
   - Better error handling
   - Mobile responsiveness
   - Loading states

### Future (Priority 4)
7. **EAMS Integration** (when API available)
8. **Advanced Features** (risk detection, automated rescheduling)

## 🎯 Success Criteria

- [x] Visual 14-day calendar for all MTR units
- [x] Drag-and-drop schedule rescheduling
- [x] Work Order upload and tracking
- [x] Maintenance completion validation
- [x] Admin panel for device management
- [x] 14-day cycle validation
- [ ] Chinese-language notifications (configured, not triggered)
- [ ] Compliance reporting
- [ ] Audit history export

## 📝 Notes

- **Port**: Development server runs on port 3004
- **Timezone**: All times handled in HKT (UTC+8)
- **Seed Data**: November 2025 schedule data included in seed script
- **Work Orders**: Use dummy OR numbers in format `5000xxxxxx`
- **Certified Engineers**: Static list of 6 certified engineers (one per zone)

