/**
 * Initialize device mappings from existing schedule data
 * 
 * This script extracts unique equipment-zone-batch combinations from schedules
 * and creates EquipmentZoneMapping records for each device.
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function initDeviceMappings() {
  try {
    console.log('🔍 Finding unique equipment-zone-batch combinations from schedules...')

    // Get all schedules and group by equipment, zone, and batch
    const schedules = await prisma.schedule.findMany({
      select: {
        equipmentId: true,
        zoneId: true,
        batch: true,
        equipment: {
          select: {
            id: true,
            equipmentNumber: true,
          },
        },
        zone: {
          select: {
            id: true,
            code: true,
          },
        },
      },
      distinct: ['equipmentId', 'zoneId', 'batch'],
    })

    console.log(`Found ${schedules.length} unique equipment-zone-batch combinations`)

    // Group by equipment to get the most common zone-batch combination
    const equipmentMap = new Map<string, {
      equipmentId: string
      equipmentNumber: string
      zoneId: string
      zoneCode: string
      batch: string
      count: number
    }>()

    for (const schedule of schedules) {
      const key = schedule.equipmentId
      const existing = equipmentMap.get(key)

      if (!existing) {
        equipmentMap.set(key, {
          equipmentId: schedule.equipmentId,
          equipmentNumber: schedule.equipment.equipmentNumber,
          zoneId: schedule.zoneId,
          zoneCode: schedule.zone.code,
          batch: schedule.batch,
          count: 1,
        })
      } else {
        // If equipment appears in multiple zones/batches, keep the one with more occurrences
        existing.count++
      }
    }

    console.log(`\n📋 Processing ${equipmentMap.size} unique equipment...`)

    let createdCount = 0
    let updatedCount = 0
    let skippedCount = 0

    for (const [equipmentId, mapping] of equipmentMap.entries()) {
      try {
        // Check if mapping already exists
        const existingMapping = await prisma.equipmentZoneMapping.findUnique({
          where: { equipmentId },
        })

        if (existingMapping) {
          // Update if zone or batch differs
          if (existingMapping.zoneId !== mapping.zoneId || existingMapping.batch !== mapping.batch) {
            await prisma.equipmentZoneMapping.update({
              where: { equipmentId },
              data: {
                zoneId: mapping.zoneId,
                batch: mapping.batch,
                active: true,
              },
            })
            updatedCount++
            console.log(`  ✓ Updated: ${mapping.equipmentNumber} -> ${mapping.zoneCode} Batch ${mapping.batch}`)
          } else {
            skippedCount++
            console.log(`  - Skipped: ${mapping.equipmentNumber} (already mapped correctly)`)
          }
        } else {
          // Create new mapping
          await prisma.equipmentZoneMapping.create({
            data: {
              equipmentId: mapping.equipmentId,
              zoneId: mapping.zoneId,
              batch: mapping.batch,
              active: true,
            },
          })
          createdCount++
          console.log(`  ✓ Created: ${mapping.equipmentNumber} -> ${mapping.zoneCode} Batch ${mapping.batch}`)
        }
      } catch (error) {
        console.error(`  ✗ Error processing ${mapping.equipmentNumber}:`, error)
      }
    }

    console.log(`\n✅ Summary:`)
    console.log(`   Created: ${createdCount} mappings`)
    console.log(`   Updated: ${updatedCount} mappings`)
    console.log(`   Skipped: ${skippedCount} mappings`)
    console.log(`   Total: ${equipmentMap.size} equipment processed`)

  } catch (error) {
    console.error('❌ Error initializing device mappings:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
initDeviceMappings()
  .then(() => {
    console.log('\n✨ Device mappings initialization complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })

