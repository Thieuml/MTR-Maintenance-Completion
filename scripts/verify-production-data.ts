/**
 * Verify production database has correct data
 * Usage: DATABASE_URL=<production-url> npx tsx scripts/verify-production-data.ts
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

// Get production DATABASE_URL from environment
const productionDatabaseUrl = process.env.DATABASE_URL

if (!productionDatabaseUrl) {
  console.error('❌ Error: DATABASE_URL environment variable not set!')
  console.error('   Please set it to your production database URL:')
  console.error('   DATABASE_URL="postgresql://..." npx tsx scripts/verify-production-data.ts')
  process.exit(1)
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: productionDatabaseUrl,
    },
  },
})

async function verifyData() {
  if (!productionDatabaseUrl) {
    console.error('❌ Error: DATABASE_URL is not set!')
    process.exit(1)
  }
  
  console.log('🔍 Verifying production database...')
  console.log(`   Database: ${productionDatabaseUrl.substring(0, 50)}...`)
  console.log('')

  try {
    const [zones, engineers, equipment, schedules, mappings, assignments] = await Promise.all([
      prisma.zone.count(),
      prisma.engineer.count(),
      prisma.equipment.count(),
      prisma.schedule.count(),
      prisma.equipmentZoneMapping.count(),
      prisma.zoneEngineerAssignment.count(),
    ])

    console.log('📊 Database Contents:')
    console.log(`   Zones: ${zones}`)
    console.log(`   Engineers: ${engineers}`)
    console.log(`   Equipment: ${equipment}`)
    console.log(`   Schedules: ${schedules}`)
    console.log(`   Equipment Zone Mappings: ${mappings}`)
    console.log(`   Zone Engineer Assignments: ${assignments}`)
    console.log('')

    // Sample data
    const sampleSchedules = await prisma.schedule.findMany({
      take: 5,
      include: {
        equipment: { select: { equipmentNumber: true } },
        zone: { select: { code: true } },
      },
      orderBy: { r1PlannedDate: 'desc' },
    })

    console.log('📅 Sample Schedules (most recent):')
    sampleSchedules.forEach((s) => {
      console.log(
        `   - ${s.equipment.equipmentNumber} | ${s.zone.code} | ${s.r1PlannedDate.toISOString().split('T')[0]} | ${s.timeSlot}`
      )
    })

    console.log('')
    console.log('✅ Verification complete!')
    
    if (schedules === 0) {
      console.log('⚠️  WARNING: No schedules found! Database might be empty.')
    } else {
      console.log(`✅ Database has ${schedules} schedules - data is present!`)
    }
  } catch (error: any) {
    console.error('❌ Error verifying database:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verifyData()

