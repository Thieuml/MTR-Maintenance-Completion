/**
 * Check current database state
 */
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function checkState() {
  try {
    // Check if rescheduleCount exists
    const columnCheck = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'Schedule' 
      AND column_name IN ('status', 'rescheduleCount');
    `)
    console.log('Columns:', columnCheck)

    // Check enum values
    const enumCheck = await prisma.$queryRawUnsafe(`
      SELECT unnest(enum_range(NULL::"ScheduleStatus")) AS enum_value;
    `)
    console.log('\nEnum values:', enumCheck)

    // Check status distribution
    const statusDist = await prisma.$queryRawUnsafe(`
      SELECT status, COUNT(*) as count 
      FROM "Schedule" 
      GROUP BY status 
      ORDER BY count DESC;
    `)
    console.log('\nStatus distribution:', statusDist)

    // Check rescheduleCount distribution
    const rescheduleDist = await prisma.$queryRawUnsafe(`
      SELECT "rescheduleCount", COUNT(*) as count 
      FROM "Schedule" 
      GROUP BY "rescheduleCount" 
      ORDER BY "rescheduleCount";
    `)
    console.log('\nRescheduleCount distribution:', rescheduleDist)
  } catch (error: any) {
    console.error('Error:', error.message)
  }
}

checkState()
  .finally(async () => {
    await prisma.$disconnect()
  })

