-- Migration: Status Flow Refactor
-- Adds new fields and migrates existing statuses to new status system

-- Step 1: Add new columns
ALTER TABLE "Schedule" 
ADD COLUMN IF NOT EXISTS "isLate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "lastSkippedDate" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "skippedCount" INTEGER NOT NULL DEFAULT 0;

-- Step 2: Add new enum values (if they don't exist)
DO $$ 
BEGIN
    -- Add PENDING
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'PENDING' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ScheduleStatus')
    ) THEN
        ALTER TYPE "ScheduleStatus" ADD VALUE 'PENDING';
    END IF;

    -- Add SKIPPED
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'SKIPPED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ScheduleStatus')
    ) THEN
        ALTER TYPE "ScheduleStatus" ADD VALUE 'SKIPPED';
    END IF;

    -- CANCELLED already exists, so no need to add
END $$;

-- Step 3: Migrate COMPLETED_LATE → COMPLETED with isLate = true
-- First, check if COMPLETED_LATE exists in enum, if not skip this step
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'COMPLETED_LATE' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ScheduleStatus')
    ) THEN
        UPDATE "Schedule"
        SET status = 'COMPLETED',
            "isLate" = CASE 
              WHEN EXISTS (
                SELECT 1 FROM "MaintenanceVisit" mv
                WHERE mv."scheduleId" = "Schedule".id
                  AND mv."completionDate" IS NOT NULL
                  AND "Schedule"."mtrPlannedStartDate" IS NOT NULL
                  AND mv."completionDate" > "Schedule"."mtrPlannedStartDate" + INTERVAL '6 days'
              )
              THEN true
              ELSE false
            END
        WHERE status = 'COMPLETED_LATE';
    END IF;
END $$;

-- Step 4: Migrate RESCHEDULED → PLANNED with skippedCount = 1
-- Only if RESCHEDULED exists in the enum
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'RESCHEDULED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ScheduleStatus')
    ) THEN
        UPDATE "Schedule"
        SET status = 'PLANNED',
            "skippedCount" = 1
        WHERE status = 'RESCHEDULED';
    END IF;
END $$;

-- Step 5: Migrate TO_RESCHEDULE → SKIPPED (if dueDate >= today) or MISSED (if dueDate < today)
-- Wrapped in conditional block to handle case where TO_RESCHEDULE no longer exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'TO_RESCHEDULE' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ScheduleStatus')
    ) THEN
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
    END IF;
END $$;

-- Step 6: Migrate IN_PROGRESS → PENDING (if past date) or PLANNED (if future date)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'IN_PROGRESS' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ScheduleStatus')
    ) THEN
        UPDATE "Schedule"
        SET status = CASE 
              WHEN "r1PlannedDate" < CURRENT_DATE THEN 'PENDING'
              ELSE 'PLANNED'
            END
        WHERE status = 'IN_PROGRESS';
    END IF;
END $$;

-- Step 7: Migrate OVERDUE → MISSED
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'OVERDUE' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ScheduleStatus')
    ) THEN
        UPDATE "Schedule"
        SET status = 'MISSED',
            "lastSkippedDate" = "r1PlannedDate",
            "r1PlannedDate" = NULL
        WHERE status = 'OVERDUE';
    END IF;
END $$;

-- Step 8: Calculate isLate for existing COMPLETED items
UPDATE "Schedule"
SET "isLate" = CASE 
      WHEN EXISTS (
        SELECT 1 FROM "MaintenanceVisit" mv
        WHERE mv."scheduleId" = "Schedule".id
          AND mv."completionDate" IS NOT NULL
          AND "Schedule"."mtrPlannedStartDate" IS NOT NULL
          AND mv."completionDate" > "Schedule"."mtrPlannedStartDate" + INTERVAL '6 days'
      ) THEN true
      ELSE false
    END
WHERE status = 'COMPLETED' AND "isLate" = false;

-- Step 9: Calculate isLate for existing PLANNED items
UPDATE "Schedule"
SET "isLate" = CASE 
      WHEN "r1PlannedDate" IS NOT NULL 
        AND "mtrPlannedStartDate" IS NOT NULL
        AND "r1PlannedDate" > "mtrPlannedStartDate" + INTERVAL '6 days'
      THEN true
      ELSE false
    END
WHERE status = 'PLANNED';

-- Step 10: Backfill lastSkippedDate for items that were rescheduled
-- (Set to r0PlannedDate if different from r1PlannedDate and skippedCount > 0)
UPDATE "Schedule"
SET "lastSkippedDate" = "r0PlannedDate"
WHERE "skippedCount" > 0 
  AND "lastSkippedDate" IS NULL
  AND "r0PlannedDate" IS NOT NULL
  AND "r0PlannedDate" != "r1PlannedDate";

