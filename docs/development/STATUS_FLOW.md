# Work Order Status Flow - Revised Architecture

## Overview

This document defines the complete status workflow, date tracking, and business rules for maintenance work orders. This is the **revised architecture** that streamlines the status system and ensures consistency.

---

## Key Dates - Definitions and Rules

### r0PlannedDate (WM Original Planned Date)
- **Definition**: Original planned date from WM system (may be updated during rescheduling)
- **Source**: Set during work order creation/upload, may change during rescheduling
- **Database Logic**: `Schedule.r0PlannedDate` (DateTime, required)
- **Business Rule**: Can be updated when item is rescheduled
- **UI Label**: "Original Planned Date" or "WM Original Planned Date"
- **Note**: This is NOT the same as `mtrPlannedStartDate` (which is immutable from MTR)

### r1PlannedDate (Scheduled Date)
- **Definition**: WM's proposed/updated schedule date (the date maintenance is actually scheduled)
- **Source**: Set by user during creation, upload, or rescheduling
- **Database Logic**: `Schedule.r1PlannedDate` (DateTime, required)
- **Business Rules**:
  - **When setting**: Date should always be in the future (validation at application level)
  - **Exception**: Can be in the past when status is `PENDING` (item awaiting validation)
  - **When marking as MISSED**: `r1PlannedDate` should be set to `NULL` (emptied)
  - **SKIPPED items**: `r1PlannedDate` is `NULL` (no scheduled date, needs rescheduling)
- **UI Label**: "Scheduled Date"
- **Validation**: Enforced at application level (not database level) to support dates in the past for workflow

### dueDate (Due Date)
- **Definition**: Latest acceptable completion date (calculated from original schedule)
- **Source**: Calculated during creation (typically `r0PlannedDate + 14 days` or from MTR Planned Completion Date)
- **Database Logic**: `Schedule.dueDate` (DateTime, required)
- **Business Rule**: Used to determine if work order was **missed** (deadline passed) or can still be **completed** (deadline in future). NOT used to check if completion is late.
- **UI Label**: "Due Date"
- **Purpose**: 
  - If `dueDate < today`: Work order is MISSED (final status, cannot be completed)
  - If `dueDate >= today`: Work order can be SKIPPED and rescheduled

### mtrPlannedStartDate (MTR Plan Start Date)
- **Definition**: MTR's planned start date from work order import (immutable)
- **Source**: From EAMS work order data during upload
- **Database Logic**: `Schedule.mtrPlannedStartDate` (DateTime, nullable)
- **Business Rule**: 
  - **Immutable**: Never changes after initial creation
  - **Used for LATE logic**: `isLate = true` if `completionDate > mtrPlannedStartDate + 6 days`
  - **Used for PLANNED late flag**: `isLate = true` if `r1PlannedDate > mtrPlannedStartDate + 6 days` (for planned items)
- **UI Label**: "MTR Plan Start Date"

### lastSkippedDate (Last Skipped Date)
- **Definition**: The last date when this item was skipped/rescheduled
- **Source**: Set when user marks item as "To Reschedule" (SKIPPED or MISSED)
- **Database Logic**: `Schedule.lastSkippedDate` (DateTime, nullable) - **NEEDS TO BE ADDED TO SCHEMA**
- **Business Rules**:
  - Set to `r1PlannedDate` when user marks item as "To Reschedule"
  - Before first reschedule: `NULL` (no last skipped date)
  - Used to track how long an item has been pending rescheduling
  - Does NOT change when item is rescheduled (only when skipped again)
- **UI Label**: "Last Skipped Date"

### completionDate (Completion Date)
- **Definition**: Actual date when maintenance was completed
- **Source**: Set when user validates as "Completed" or from MaintenanceVisit
- **Database Logic**: `MaintenanceVisit.completionDate` (DateTime, nullable)
- **Business Rule**: Used to calculate if completion was late (`completionDate > mtrPlannedStartDate + 6 days`)
- **UI Label**: "Completion Date"

### actualStartDate / actualEndDate
- **Definition**: Actual execution times from MaintenanceVisit
- **Source**: Set during visit recording
- **Database Logic**: `MaintenanceVisit.actualStartDate`, `MaintenanceVisit.actualEndDate`
- **Business Rule**: Used for execution tracking and analytics

---

## Status Definitions - Revised

### 1. PLANNED
- **When**: Item has a scheduled date (`r1PlannedDate`) in the future
- **Database Status**: `PLANNED`
- **Display**: Blue badge "Planned" (with optional "Late" indicator if `isLate = true`)
- **Location**: Shown in calendar (future dates)
- **Business Rule**: `r1PlannedDate >= today` AND `status = PLANNED`
- **Late Flag**: `isLate = true` if `r1PlannedDate > mtrPlannedStartDate + 6 days` (for planned items)

### 2. PENDING ⚠️ **DATABASE STATUS**
- **When**: Item has a scheduled date (`r1PlannedDate`) in the past, awaiting validation
- **Database Status**: `PENDING` (database status, not display-only)
- **Display**: Yellow badge "Pending"
- **Location**: Shown in "To be validated" tab
- **Business Rule**: `r1PlannedDate < today` AND `status = PENDING`
- **Auto-Transition**: `PLANNED → PENDING` via CRON job at 7am HK Time daily

### 3. COMPLETED
- **When**: User validates as "Completed"
- **Database Status**: `COMPLETED` (replaces both `COMPLETED` and `COMPLETED_LATE`)
- **Display**: Green badge "Completed" (with optional "Late" indicator if `isLate = true`)
- **Location**: Shown in "Completed" tab and calendar (non-editable)
- **Business Rule**: `status = COMPLETED`
- **Flag**: `isLate` (Boolean) - **NEEDS TO BE ADDED TO SCHEMA**
  - `isLate = true` if `completionDate > mtrPlannedStartDate + 6 days`
  - `isLate = false` otherwise
- **Final Status**: ✅ Yes - cannot transition from COMPLETED
- **Calendar**: ✅ Shown in calendar but non-editable (read-only)

### 4. MISSED ⚠️ **REVISED LOGIC**
- **When**: User clicks "To Reschedule" AND `dueDate < today` (deadline has passed)
- **Database Status**: `MISSED`
- **Display**: Red badge "Missed"
- **Location**: 
  - Shown in "Missed" section (separate from "To be rescheduled")
  - **Shown in calendar** (like COMPLETED) but non-editable
- **Business Rule**: `status = MISSED` AND `dueDate < today`
- **Actions**: 
  - `r1PlannedDate` set to `NULL` (emptied)
  - `lastSkippedDate` set to previous `r1PlannedDate` (if it existed)
- **Final Status**: ✅ Yes - cannot transition from MISSED
- **Calendar**: ✅ Shown in calendar but non-editable (read-only)

### 5. SKIPPED ⚠️ **NEW STATUS**
- **When**: User clicks "To Reschedule" AND `dueDate >= today` (deadline still in future)
- **Database Status**: `SKIPPED` (needs to be added to enum)
- **Display**: Orange badge "Skipped - Needs Rescheduling"
- **Location**: Shown in "To be rescheduled" tab
- **Business Rule**: `status = SKIPPED` AND `dueDate >= today` AND `r1PlannedDate IS NULL`
- **Actions**:
  - `r1PlannedDate` set to `NULL` (no scheduled date)
  - `lastSkippedDate` set to previous `r1PlannedDate`
  - `skippedCount` incremented by 1
- **Can Reschedule**: ✅ Yes - can transition back to PLANNED
- **Can Delete**: ✅ Yes - can be deleted

### 6. CANCELLED ⚠️ **NEW STATUS**
- **When**: User deletes a work order
- **Database Status**: `CANCELLED` (needs to be added to enum)
- **Display**: Gray badge "Cancelled"
- **Location**: Not shown in active tabs (archived)
- **Business Rule**: `status = CANCELLED`
- **Can Delete**: Only `PLANNED`, `PENDING`, or `SKIPPED` can be deleted (set to CANCELLED)
- **Cannot Delete**: `MISSED` and `COMPLETED` cannot be deleted (statistics integrity)
- **Final Status**: ✅ Yes - cannot transition from CANCELLED

---

## Status Transitions - Revised Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    STATUS FLOW DIAGRAM (REVISED)              │
└─────────────────────────────────────────────────────────────┘

PLANNED (r1PlannedDate >= today, skippedCount = 0)
    │
    │ [CRON: 7am HK Time, r1PlannedDate passes]
    ▼
PENDING (r1PlannedDate < today, awaiting validation)
    │
    ├─────────────────┬─────────────────┐
    │                 │                 │
    │ [Completed]      │ [To Reschedule] │ [To Reschedule]
    │                 │                 │ (dueDate < today)
    ▼                 ▼                 ▼
COMPLETED        SKIPPED            MISSED
(isLate flag)    (dueDate >= today) (dueDate < today)
    │                 │                 │
    │                 │ [Reschedule]    │
    │                 │ (set r1PlannedDate) │
    │                 │ skippedCount++   │
    │                 ▼                 │
    │            PLANNED                │
    │            (skippedCount > 0)      │
    │                 │                 │
    │                 │ [Cycle repeats] │
    │                 │                 │
    └─────────────────┴─────────────────┘
                      │
                      │ [Final States - No Transitions]
                      │
                      ▼
              COMPLETED, MISSED, CANCELLED
              (Cannot change)

[Delete Action]
PLANNED, PENDING, SKIPPED → CANCELLED
(MISSED and COMPLETED cannot be deleted)
```

### Detailed Transition Rules

#### PLANNED → PENDING (Automatic)
- **Trigger**: `r1PlannedDate < today` (date passes)
- **When**: CRON job runs daily at 7am HK Time
- **Database Logic**: 
  ```sql
  UPDATE Schedule 
  SET status = 'PENDING' 
  WHERE status = 'PLANNED' 
    AND r1PlannedDate < NOW()
    AND r1PlannedDate < CURRENT_DATE
  ```
- **Automatic**: ✅ Yes (CRON job)
- **Manual**: ❌ No

#### PENDING → COMPLETED
- **Trigger**: User clicks "Completed" button
- **Database Logic**: 
  ```sql
  UPDATE Schedule SET 
    status = 'COMPLETED',
    isLate = CASE 
      WHEN completionDate > mtrPlannedStartDate + INTERVAL '6 days' THEN true 
      ELSE false 
    END
  WHERE id = ?
  ```
- **Actions**:
  - Set `status = 'COMPLETED'`
  - Set `completionDate` (from MaintenanceVisit or current date)
  - Calculate and set `isLate` flag: `completionDate > mtrPlannedStartDate + 6 days`
- **Automatic**: ❌ No (requires user action)

#### PENDING → SKIPPED
- **Trigger**: User clicks "To Reschedule" AND `dueDate >= today`
- **Database Logic**:
  ```sql
  UPDATE Schedule SET 
    status = 'SKIPPED',
    lastSkippedDate = r1PlannedDate,
    r1PlannedDate = NULL,
    skippedCount = skippedCount + 1
  WHERE id = ? AND dueDate >= CURRENT_DATE
  ```
- **Actions**:
  - Set `status = 'SKIPPED'`
  - Set `lastSkippedDate = r1PlannedDate` (capture the date that was missed)
  - Set `r1PlannedDate = NULL` (no scheduled date)
  - Increment `skippedCount`

#### PENDING → MISSED
- **Trigger**: User clicks "To Reschedule" AND `dueDate < today`
- **Database Logic**:
  ```sql
  UPDATE Schedule SET 
    status = 'MISSED',
    lastSkippedDate = r1PlannedDate,
    r1PlannedDate = NULL
  WHERE id = ? AND dueDate < CURRENT_DATE
  ```
- **Actions**:
  - Set `status = 'MISSED'` (final status)
  - Set `lastSkippedDate = r1PlannedDate`
  - Set `r1PlannedDate = NULL`
  - **Do NOT increment skippedCount** (it's missed, not skipped)

#### SKIPPED → PLANNED (Rescheduling)
- **Trigger**: User completes rescheduling (selects new date/slot)
- **Database Logic**:
  ```sql
  UPDATE Schedule SET 
    status = 'PLANNED',
    r1PlannedDate = ? -- new date (must be in future, validated at app level)
  WHERE id = ? AND status = 'SKIPPED'
  ```
- **Actions**:
  - Set `status = 'PLANNED'`
  - Set `r1PlannedDate` to new scheduled date (must be in future, validated at application level)
  - **Keep `lastSkippedDate`** (don't change it)
  - **Keep `skippedCount`** (already incremented)
  - Calculate `isLate` flag: `isLate = (r1PlannedDate > mtrPlannedStartDate + 6 days)`

#### PLANNED/PENDING/SKIPPED → CANCELLED (Delete)
- **Trigger**: User deletes work order
- **Database Logic**:
  ```sql
  UPDATE Schedule SET 
    status = 'CANCELLED'
  WHERE id = ? AND status IN ('PLANNED', 'PENDING', 'SKIPPED')
  ```
- **Actions**:
  - Set `status = 'CANCELLED'` (soft delete)
  - Or: Hard delete if preferred (but CANCELLED status recommended for audit trail)
- **Restriction**: Cannot delete `MISSED` or `COMPLETED` work orders (statistics integrity)

#### Final States (No Transitions)
- **COMPLETED**: Cannot transition from COMPLETED
- **MISSED**: Cannot transition from MISSED
- **CANCELLED**: Cannot transition from CANCELLED

---

## Schema Changes Required

### 1. Add Fields to Schedule Model
```prisma
model Schedule {
  // ... existing fields ...
  
  // Status tracking
  status ScheduleStatus @default(PLANNED)
  
  // NEW: Late completion flag
  isLate Boolean @default(false) 
  // For COMPLETED: true if completionDate > mtrPlannedStartDate + 6 days
  // For PLANNED: true if r1PlannedDate > mtrPlannedStartDate + 6 days
  
  // NEW: Last skipped date
  lastSkippedDate DateTime? // Last date when item was skipped/rescheduled
  
  // NEW: Skipped count
  skippedCount Int @default(0) // Number of times item has been rescheduled
  
  // ... rest of fields ...
}
```

### 2. Update ScheduleStatus Enum
```prisma
enum ScheduleStatus {
  PLANNED        // Scheduled but not started
  PENDING        // Past scheduled date, awaiting validation ⚠️ NEW
  COMPLETED      // Completed (use isLate flag for late completion) ⚠️ REMOVED COMPLETED_LATE
  SKIPPED        // Skipped, needs rescheduling (dueDate still in future) ⚠️ NEW
  MISSED         // Missed deadline (dueDate passed) - FINAL STATUS ⚠️ REVISED LOGIC
  CANCELLED      // Cancelled/deleted ⚠️ NEW
  // REMOVED: COMPLETED_LATE, RESCHEDULED, TO_RESCHEDULE, IN_PROGRESS, OVERDUE
}
```

### 3. Migration Strategy

#### Step 1: Add New Fields
```sql
ALTER TABLE "Schedule" 
ADD COLUMN "isLate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastSkippedDate" TIMESTAMP,
ADD COLUMN "skippedCount" INTEGER NOT NULL DEFAULT 0;
```

#### Step 2: Migrate Existing Data
```sql
-- Migrate COMPLETED_LATE → COMPLETED with isLate = true
UPDATE "Schedule"
SET status = 'COMPLETED',
    "isLate" = CASE 
      WHEN "completionDate" IS NOT NULL 
        AND "mtrPlannedStartDate" IS NOT NULL
        AND "completionDate" > "mtrPlannedStartDate" + INTERVAL '6 days'
      THEN true
      ELSE false
    END
WHERE status = 'COMPLETED_LATE';

-- Migrate RESCHEDULED → PLANNED with skippedCount = 1
UPDATE "Schedule"
SET status = 'PLANNED',
    "skippedCount" = 1
WHERE status = 'RESCHEDULED';

-- Migrate TO_RESCHEDULE → SKIPPED (if dueDate >= today) or MISSED (if dueDate < today)
UPDATE "Schedule"
SET status = CASE 
      WHEN "dueDate" >= CURRENT_DATE THEN 'SKIPPED'
      ELSE 'MISSED'
    END,
    "lastSkippedDate" = "r1PlannedDate",
    "r1PlannedDate" = NULL,
    "skippedCount" = CASE 
      WHEN "dueDate" >= CURRENT_DATE THEN 1
      ELSE 0
    END
WHERE status = 'TO_RESCHEDULE';

-- Migrate IN_PROGRESS → PENDING (if past date) or PLANNED (if future date)
UPDATE "Schedule"
SET status = CASE 
      WHEN "r1PlannedDate" < CURRENT_DATE THEN 'PENDING'
      ELSE 'PLANNED'
    END
WHERE status = 'IN_PROGRESS';

-- Migrate OVERDUE → MISSED
UPDATE "Schedule"
SET status = 'MISSED',
    "lastSkippedDate" = "r1PlannedDate",
    "r1PlannedDate" = NULL
WHERE status = 'OVERDUE';
```

#### Step 3: Update Enum
```sql
-- Add new enum values
ALTER TYPE "ScheduleStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ScheduleStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';
ALTER TYPE "ScheduleStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- Note: Cannot remove enum values in PostgreSQL, but they won't be used
-- Document deprecated values: COMPLETED_LATE, RESCHEDULED, TO_RESCHEDULE, IN_PROGRESS, OVERDUE
```

---

## Customer Report (Daily Report) Logic

### Items Pending Rescheduling
- **Criteria**: 
  - `status = 'PENDING'` 
  - OR `status = 'SKIPPED'`
- **Display**:
  - Show `lastSkippedDate` instead of `r1PlannedDate` (scheduled date is empty)
  - Column: "Last Skipped Date"
  - Purpose: Indicates how long item has been pending rescheduling
- **Database Logic**: 
  ```sql
  WHERE status IN ('PENDING', 'SKIPPED')
    AND r1PlannedDate IS NULL
  ```

### Items Rescheduled, Pending Completion
- **Criteria**:
  - `status = 'PLANNED'`
  - `skippedCount > 0` (has been rescheduled at least once)
  - `r1PlannedDate IS NOT NULL` (has a scheduled date)
  - `lastSkippedDate IS NOT NULL` (has a last skipped date)
- **Display**:
  - Show both `lastSkippedDate` and `r1PlannedDate`
  - Columns: "Last Skipped Date" and "Scheduled Date"
- **Newly Rescheduled Items** (showing for first time):
  - `lastSkippedDate = yesterday` (rescheduled yesterday)
  - Distinguish from items rescheduled earlier
- **Database Logic**:
  ```sql
  WHERE status = 'PLANNED'
    AND skippedCount > 0
    AND r1PlannedDate IS NOT NULL
    AND lastSkippedDate IS NOT NULL
  ```

### Items Now Completed
- **Criteria**:
  - `status = 'COMPLETED'`
  - `completionDate = yesterday` (completed yesterday)
  - `skippedCount > 0` (was previously rescheduled)
- **Display**:
  - Show `completionDate`
  - Purpose: Items exiting the report (were in backlog, now completed)
- **Database Logic**:
  ```sql
  WHERE status = 'COMPLETED'
    AND completionDate >= DATE('yesterday')
    AND completionDate < DATE('today')
    AND skippedCount > 0
  ```

---

## Technical Implementation Notes

### 1. CRON Job for PLANNED → PENDING Transition
- **Schedule**: Daily at 7am HK Time (HKT)
- **Implementation**: 
  - Use a scheduled job (e.g., Vercel Cron, GitHub Actions, or external service)
  - Or: Next.js API route with scheduled execution
- **Logic**:
  ```typescript
  // Run at 7am HKT daily
  const hktNow = createHKTDate(new Date())
  const hkt7am = new Date(hktNow)
  hkt7am.setHours(7, 0, 0, 0)
  
  // Transition PLANNED → PENDING for items with past r1PlannedDate
  await prisma.schedule.updateMany({
    where: {
      status: 'PLANNED',
      r1PlannedDate: {
        lt: hktNow // Past date in HKT
      }
    },
    data: {
      status: 'PENDING'
    }
  })
  ```

### 2. LATE Flag Calculation

#### For COMPLETED Items:
```typescript
const isLate = completionDate && mtrPlannedStartDate &&
  completionDate > new Date(mtrPlannedStartDate.getTime() + 6 * 24 * 60 * 60 * 1000)
```

#### For PLANNED Items:
```typescript
const isLate = r1PlannedDate && mtrPlannedStartDate &&
  r1PlannedDate > new Date(mtrPlannedStartDate.getTime() + 6 * 24 * 60 * 60 * 1000)
```

### 3. Validation of r1PlannedDate
- **Enforcement**: Application level (not database level)
- **Reason**: Need to support dates in the past for workflow (PENDING status)
- **Validation Rule**: When setting `r1PlannedDate` during creation or rescheduling, validate it's in the future
- **Exception**: Allow past dates when status is `PENDING` (already in past)

### 4. Delete Restrictions
- **Can Delete**: `PLANNED`, `PENDING`, `SKIPPED` → Set to `CANCELLED`
- **Cannot Delete**: `MISSED`, `COMPLETED` (statistics integrity)
- **Implementation**:
  ```typescript
  if (schedule.status === 'MISSED' || schedule.status === 'COMPLETED') {
    throw new Error('Cannot delete MISSED or COMPLETED work orders')
  }
  await prisma.schedule.update({
    where: { id },
    data: { status: 'CANCELLED' }
  })
  ```

### 5. Calendar Display
- **Show**: `PLANNED`, `PENDING`, `COMPLETED`, `MISSED`, `SKIPPED` (if has `r1PlannedDate`)
- **Editable**: Only `PLANNED`, `PENDING`, `SKIPPED`
- **Read-only**: `COMPLETED`, `MISSED` (cannot modify)

---

## Migration Checklist

### Schema Changes
- [ ] Add `isLate` Boolean field to Schedule
- [ ] Add `lastSkippedDate` DateTime? field to Schedule
- [ ] Add `skippedCount` Int field to Schedule
- [ ] Add `PENDING` to ScheduleStatus enum
- [ ] Add `SKIPPED` to ScheduleStatus enum
- [ ] Add `CANCELLED` to ScheduleStatus enum
- [ ] Remove `COMPLETED_LATE` from ScheduleStatus enum (deprecate)
- [ ] Remove `RESCHEDULED` from ScheduleStatus enum (deprecate)
- [ ] Remove `TO_RESCHEDULE` from ScheduleStatus enum (deprecate)
- [ ] Remove `IN_PROGRESS` from ScheduleStatus enum (deprecate)
- [ ] Remove `OVERDUE` from ScheduleStatus enum (deprecate)

### Data Migration
- [ ] Migrate `COMPLETED_LATE` → `COMPLETED` + set `isLate = true`
- [ ] Migrate `RESCHEDULED` → `PLANNED` + set `skippedCount = 1`
- [ ] Migrate `TO_RESCHEDULE` → `SKIPPED` (if `dueDate >= today`) or `MISSED` (if `dueDate < today`)
- [ ] Migrate `IN_PROGRESS` → `PENDING` (if past date) or `PLANNED` (if future date)
- [ ] Migrate `OVERDUE` → `MISSED`
- [ ] Backfill `lastSkippedDate` for existing rescheduled items (if possible)

### Code Updates
- [ ] Update validation endpoint to set `SKIPPED` vs `MISSED` based on `dueDate`
- [ ] Update reschedule endpoint to transition `SKIPPED → PLANNED` (remove RESCHEDULED)
- [ ] Update completion endpoint to calculate `isLate` using `mtrPlannedStartDate + 6 days`
- [ ] Update PLANNED items to calculate `isLate` flag when `r1PlannedDate > mtrPlannedStartDate + 6 days`
- [ ] Update Daily Report logic to use new statuses and fields
- [ ] Implement CRON job for `PLANNED → PENDING` auto-transition at 7am HK Time
- [ ] Add delete restrictions (cannot delete MISSED or COMPLETED)
- [ ] Update calendar to show MISSED items (non-editable)
- [ ] Update calendar to show COMPLETED items (non-editable)
- [ ] Add validation for `r1PlannedDate` as future date at application level

### Testing
- [ ] Test PLANNED → PENDING auto-transition (CRON job)
- [ ] Test PENDING → COMPLETED with late flag calculation
- [ ] Test PENDING → SKIPPED (dueDate >= today)
- [ ] Test PENDING → MISSED (dueDate >= today)
- [ ] Test SKIPPED → PLANNED (rescheduling)
- [ ] Test delete restrictions (cannot delete MISSED/COMPLETED)
- [ ] Test calendar display (show MISSED/COMPLETED as read-only)
- [ ] Test Daily Report with new statuses
- [ ] Test multiple reschedules (skippedCount increments)

---

## Summary of Key Changes

1. **Status Simplification**: Removed `COMPLETED_LATE`, `RESCHEDULED`, `TO_RESCHEDULE`, `IN_PROGRESS`, `OVERDUE`
2. **New Statuses**: Added `PENDING` (database), `SKIPPED`, `CANCELLED`
3. **Late Logic**: Uses `mtrPlannedStartDate + 6 days` (not `r0PlannedDate`)
4. **Late Flag**: Can flag both `COMPLETED` and `PLANNED` items
5. **MISSED Logic**: Based on `dueDate < today` (deadline passed)
6. **SKIPPED Logic**: Based on `dueDate >= today` (deadline still in future)
7. **Auto-Transition**: CRON job at 7am HK Time for `PLANNED → PENDING`
8. **Delete Restrictions**: Only `PLANNED`, `PENDING`, `SKIPPED` can be deleted
9. **Calendar**: Show `MISSED` and `COMPLETED` items (non-editable)
10. **Date Validation**: Application level (not database level) for `r1PlannedDate`
