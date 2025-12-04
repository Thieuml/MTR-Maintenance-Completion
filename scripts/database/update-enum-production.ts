import { prisma } from '@/lib/prisma'

async function updateEnum() {
  console.log('Updating ScheduleStatus enum in production database...\n')

  try {
    // SQL to add missing enum values
    const sql = `
      DO $$ 
      BEGIN
          -- Add PENDING if it doesn't exist
          IF NOT EXISTS (
              SELECT 1 FROM pg_enum 
              WHERE enumlabel = 'PENDING' 
              AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ScheduleStatus')
          ) THEN
              ALTER TYPE "ScheduleStatus" ADD VALUE 'PENDING';
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
              ALTER TYPE "ScheduleStatus" ADD VALUE 'SKIPPED';
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
              ALTER TYPE "ScheduleStatus" ADD VALUE 'MISSED';
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
              ALTER TYPE "ScheduleStatus" ADD VALUE 'CANCELLED';
              RAISE NOTICE 'Added CANCELLED to ScheduleStatus enum';
          ELSE
              RAISE NOTICE 'CANCELLED already exists in ScheduleStatus enum';
          END IF;
      END $$;
    `

    await prisma.$executeRawUnsafe(sql)
    console.log('✅ Enum update complete!\n')

    // Show current enum values
    const enumValues = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(
      `SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ScheduleStatus') ORDER BY enumsortorder;`
    )

    console.log('Current enum values:')
    enumValues.forEach((row) => {
      console.log(`  - ${row.enumlabel}`)
    })
  } catch (error) {
    console.error('❌ Error updating enum:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

updateEnum()

