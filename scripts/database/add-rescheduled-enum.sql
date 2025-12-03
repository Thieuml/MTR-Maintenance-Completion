-- Add RESCHEDULED to ScheduleStatus enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'RESCHEDULED' 
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'ScheduleStatus'
        )
    ) THEN
        ALTER TYPE "ScheduleStatus" ADD VALUE 'RESCHEDULED';
    END IF;
END $$;

-- Also add TO_RESCHEDULE if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'TO_RESCHEDULE' 
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'ScheduleStatus'
        )
    ) THEN
        ALTER TYPE "ScheduleStatus" ADD VALUE 'TO_RESCHEDULE';
    END IF;
END $$;

