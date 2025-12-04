#!/bin/bash
# This script updates the ScheduleStatus enum in production to include the new statuses
# Run this script after setting the DATABASE_URL environment variable

set -e

echo "Updating ScheduleStatus enum in production database..."

# SQL to add missing enum values
SQL="
DO \$\$ 
BEGIN
    -- Add PENDING if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'PENDING' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ScheduleStatus')
    ) THEN
        ALTER TYPE \"ScheduleStatus\" ADD VALUE 'PENDING';
        RAISE NOTICE 'Added PENDING to ScheduleStatus enum';
    ELSE
        RAISE NOTICE 'PENDING already exists in ScheduleStatus enum';
    END IF;

    -- Add SKIPPED if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'SKIPPED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ScheduleStatus')
    ) THEN
        ALTER TYPE \"ScheduleStatus\" ADD VALUE 'SKIPPED';
        RAISE NOTICE 'Added SKIPPED to ScheduleStatus enum';
    ELSE
        RAISE NOTICE 'SKIPPED already exists in ScheduleStatus enum';
    END IF;

    -- Add MISSED if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'MISSED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ScheduleStatus')
    ) THEN
        ALTER TYPE \"ScheduleStatus\" ADD VALUE 'MISSED';
        RAISE NOTICE 'Added MISSED to ScheduleStatus enum';
    ELSE
        RAISE NOTICE 'MISSED already exists in ScheduleStatus enum';
    END IF;

    -- CANCELLED should already exist, but check anyway
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'CANCELLED' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ScheduleStatus')
    ) THEN
        ALTER TYPE \"ScheduleStatus\" ADD VALUE 'CANCELLED';
        RAISE NOTICE 'Added CANCELLED to ScheduleStatus enum';
    ELSE
        RAISE NOTICE 'CANCELLED already exists in ScheduleStatus enum';
    END IF;
END \$\$;
"

# Execute SQL command
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set."
    echo "Please set it first:"
    echo "  export DATABASE_URL='postgresql://neondb_owner:npg_sOGgE5quI7ab@ep-ancient-sunset-a16tps9b-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'"
    exit 1
fi

psql "$DATABASE_URL" -c "$SQL"

echo ""
echo "✅ Enum update complete!"
echo ""
echo "Current enum values:"
psql "$DATABASE_URL" -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ScheduleStatus') ORDER BY enumsortorder;"

