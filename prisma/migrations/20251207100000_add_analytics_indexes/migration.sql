-- Add indexes for analytics query performance

-- Index for filtering schedules by status and planned date
CREATE INDEX IF NOT EXISTS "Schedule_status_r1PlannedDate_idx" ON "Schedule"("status", "r1PlannedDate");

-- Composite index for zone-filtered analytics
CREATE INDEX IF NOT EXISTS "Schedule_zoneId_status_completionDate_idx" ON "Schedule"("zoneId", "status", "completionDate");

-- Index for reschedule lookups
CREATE INDEX IF NOT EXISTS "Reschedule_scheduleId_status_idx" ON "Reschedule"("scheduleId", "status");


