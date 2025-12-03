/**
 * Script to delete all devices created in the last 10 minutes
 * This reverts the creation of devices from the "create-all-missing-devices" script
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function deleteRecentDevices() {
  try {
    // Find devices created in the last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    
    const recentDevices = await prisma.equipment.findMany({
      where: {
        createdAt: { gte: tenMinutesAgo },
      },
      select: {
        id: true,
        equipmentNumber: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (recentDevices.length === 0) {
      console.log('✅ No recent devices found to delete')
      return
    }

    console.log(`\n📋 Found ${recentDevices.length} devices created in the last 10 minutes:`)
    recentDevices.forEach(eq => {
      console.log(`  - ${eq.equipmentNumber} (created: ${eq.createdAt.toISOString()})`)
    })

    // Check for schedules or mappings
    const deviceIds = recentDevices.map(d => d.id)
    const schedulesCount = await prisma.schedule.count({
      where: {
        equipmentId: { in: deviceIds },
      },
    })

    const mappingsCount = await prisma.equipmentZoneMapping.count({
      where: {
        equipmentId: { in: deviceIds },
      },
    })

    if (schedulesCount > 0 || mappingsCount > 0) {
      console.log(`\n⚠️  Warning: Found ${schedulesCount} schedules and ${mappingsCount} mappings referencing these devices`)
      console.log('   These will be deleted as well (cascade delete)')
    }

    console.log(`\n🗑️  Deleting ${recentDevices.length} devices...`)

    const result = await prisma.equipment.deleteMany({
      where: {
        id: { in: deviceIds },
      },
    })

    console.log(`\n✅ Deleted ${result.count} devices`)
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

deleteRecentDevices()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })



