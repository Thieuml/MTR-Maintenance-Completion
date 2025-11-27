# Work Order Status Flow

## Status Definitions

### 1. **PLANNED**
- **When**: WM Planned Date is in the future or same day as today
- **Display**: Blue badge "Planned"
- **Location**: Not shown in Work Order Tracking tabs (still in future)

### 2. **PENDING** (Display Status)
- **When**: WM Planned Date is in the past, but not yet validated by user
- **Database Status**: Still `PLANNED`, `IN_PROGRESS`, or `RESCHEDULED`
- **Display**: Yellow badge "Pending"
- **Location**: Shown in "To be validated" tab
- **Note**: This is a display status, not a database enum value

### 3. **COMPLETED**
- **When**: User validates as "Completed" AND completion date is on or before Due Date
- **Database Status**: `COMPLETED`
- **Display**: Green badge "Completed"
- **Location**: Shown in "Completed" tab

### 4. **COMPLETED_LATE**
- **When**: User validates as "Completed" BUT completion date is after Due Date
- **Database Status**: `COMPLETED_LATE`
- **Display**: Green badge "Completed (Late)"
- **Location**: Shown in "Completed" tab

### 5. **MISSED** / **Rescheduling**
- **When**: User explicitly marks as "To Reschedule" from validation page
- **Database Status**: `MISSED`
- **Display**: Orange badge "Rescheduling"
- **Location**: Shown in "To be rescheduled" tab

### 6. **RESCHEDULED**
- **When**: User completes the rescheduling action (selects new date/slot)
- **Database Status**: `RESCHEDULED`
- **Display**: Orange badge "Rescheduling"
- **Location**: 
  - If new date is in future: Not shown in any tab (it's planned for future)
  - If new date has passed: Shown in "To be rescheduled" tab (needs validation again)

## Status Transitions

```
┌─────────────────────────────────────────────────────────────┐
│                    STATUS FLOW DIAGRAM                      │
└─────────────────────────────────────────────────────────────┘

PLANNED (future date)
    │
    │ [Date passes]
    ▼
PENDING (past date, not validated)
    │
    ├─────────────────┬─────────────────┐
    │                 │                 │
    ▼                 ▼                 ▼
COMPLETED    COMPLETED_LATE      MISSED
(on time)    (after due date)    (user marks "To Reschedule")
    │                 │                 │
    │                 │                 │
    └─────────────────┴─────────────────┘
                      │
                      ▼
              RESCHEDULED
              (user reschedules)
                      │
                      ├─ [New date in future] → Not shown (PLANNED)
                      │
                      └─ [New date passes] → PENDING (cycle repeats)
```

## Detailed Flow

### Initial State: PLANNED
- **Condition**: `r1PlannedDate >= today`
- **Status**: `PLANNED`
- **Display**: "Planned" (blue badge)
- **Action**: None (future work order)

### Transition to PENDING
- **Trigger**: `r1PlannedDate < today` (date passes)
- **Status**: Still `PLANNED` in database, but displayed as "Pending"
- **Display**: "Pending" (yellow badge)
- **Location**: Appears in "To be validated" tab
- **Action Required**: User must validate (Completed or To Reschedule)

### Validation: COMPLETED
- **Trigger**: User clicks "Completed" button
- **Condition**: `today <= dueDate`
- **Status**: `COMPLETED`
- **Display**: "Completed" (green badge)
- **Location**: Moves to "Completed" tab

### Validation: COMPLETED_LATE
- **Trigger**: User clicks "Completed" button
- **Condition**: `today > dueDate`
- **Status**: `COMPLETED_LATE`
- **Display**: "Completed (Late)" (green badge)
- **Location**: Moves to "Completed" tab

### Validation: MISSED
- **Trigger**: User clicks "To Reschedule" button
- **Status**: `MISSED`
- **Display**: "Rescheduling" (orange badge)
- **Location**: Moves to "To be rescheduled" tab
- **Action Required**: User must reschedule to new date

### Rescheduling: RESCHEDULED
- **Trigger**: User completes rescheduling action (selects new date/slot)
- **Status**: `RESCHEDULED`
- **Display**: "Rescheduling" (orange badge)
- **Location**: 
  - If new date is in future: Not shown in tabs (it's PLANNED for future)
  - If new date has passed: Shown in "To be rescheduled" tab (needs validation)
- **Note**: When new date passes and not completed, it becomes PENDING again (cycle repeats)

## Key Rules

1. **No automatic status changes**: All status changes require manual user action
2. **PENDING is display-only**: Not a database status, just how we show unvalidated past dates
3. **Due Date matters**: Only affects whether completion is "COMPLETED" or "COMPLETED_LATE"
4. **Rescheduling requires explicit action**: Work orders don't automatically become "To Reschedule" based on due date
5. **Future dates stay PLANNED**: Work orders with future planned dates don't appear in tracking tabs

## Button Colors

All action buttons**: Blue (`bg-blue-600`) for consistency
- **Completed**: Blue button
- **To Reschedule**: Blue button  
- **Reschedule**: Blue button

## Tab Logic

### "To be validated" Tab
- Shows: Work orders with `r1PlannedDate < today` AND status is `PLANNED`, `IN_PROGRESS`, or `RESCHEDULED`
- Status Display: "Pending" (yellow)
- Actions: "Completed" or "To Reschedule" buttons

### "To be rescheduled" Tab
- Shows: 
  - Work orders with status `MISSED`
  - Work orders with status `RESCHEDULED` where the new date has passed (needs validation again)
- Status Display: "Rescheduling" (orange badge)
- Actions: "Reschedule" button (links directly to slot selection for that work order)

### "Completed" Tab
- Shows: Work orders with status `COMPLETED` or `COMPLETED_LATE`
- Status Display: "Completed" or "Completed (Late)" (green)
- Actions: None (read-only)

