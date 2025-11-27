/**
 * Script to create missing devices from Looker that aren't in the database
 * Specifically for TSY-E10, TSY-E11, TSY-E12, TSY-E13, TSY-E14
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fetchMTRDevicesFromLooker } from '../lib/looker'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function createMissingDevices() {
  try {
    console.log('🔍 Fetching devices from Looker...')
    const lookerDevices = await fetchMTRDevicesFromLooker()
    console.log(`Found ${lookerDevices.length} devices in Looker`)

    // Get all zones
    const zones = await prisma.zone.findMany({ where: { active: true } })
    const zoneMap = new Map(zones.map(z => [z.code, z]))

    // Get existing equipment
    const existingEquipment = await prisma.equipment.findMany({
      select: { equipmentNumber: true },
    })
    const existingSet = new Set(existingEquipment.map(eq => eq.equipmentNumber))

    console.log(`\n📋 Checking for missing devices...`)

    const devicesToCreate: Array<{
      equipmentNumber: string
      zoneId: string
      type: 'ELEVATOR' | 'ESCALATOR'
    }> = []

    for (const device of lookerDevices) {
      const equipmentNumber = 
        device['device.location'] || 
        device.device_location || 
        device.equipment_number || 
        device.location

      if (!equipmentNumber) continue

      const trimmedNumber = equipmentNumber.trim()

      // Check if it's one of the missing devices
      if (['TSY-E10', 'TSY-E11', 'TSY-E12', 'TSY-E13', 'TSY-E14'].includes(trimmedNumber)) {
        if (!existingSet.has(trimmedNumber)) {
          // Determine zone
          let zoneCode = 'MTR-04' // TSY devices are in MTR-04
          if (trimmedNumber.startsWith('TSY-') || trimmedNumber.startsWith('TY-')) {
            zoneCode = 'MTR-04'
          }

          const zone = zoneMap.get(zoneCode)
          if (!zone) {
            console.error(`❌ Zone ${zoneCode} not found for ${trimmedNumber}`)
            continue
          }

          // Determine type
          const deviceType = device.device_type || device.type || device.deviceType
          let type: 'ELEVATOR' | 'ESCALATOR' = 'ELEVATOR'
          if (deviceType) {
            const typeUpper = String(deviceType).toUpperCase()
            if (typeUpper.includes('ESCALATOR') || typeUpper.includes('ESC')) {
              type = 'ESCALATOR'
            }
          }

          devicesToCreate.push({
            equipmentNumber: trimmedNumber,
            zoneId: zone.id,
            type,
          })
        }
      }
    }

    if (devicesToCreate.length === 0) {
      console.log('✅ All devices already exist in database')
      return
    }

    console.log(`\n📦 Creating ${devicesToCreate.length} missing devices:`)
    for (const device of devicesToCreate) {
      console.log(`  - ${device.equipmentNumber} (${device.type})`)
    }

    // Create devices
    for (const deviceData of devicesToCreate) {
      try {
        await prisma.equipment.create({
          data: {
            equipmentNumber: deviceData.equipmentNumber,
            name: deviceData.equipmentNumber,
            type: deviceData.type,
            zoneId: deviceData.zoneId,
            active: true,
            canUse2300Slot: false,
          },
        })
        console.log(`  ✅ Created: ${deviceData.equipmentNumber}`)
      } catch (error) {
        console.error(`  ❌ Error creating ${deviceData.equipmentNumber}:`, error)
      }
    }

    console.log(`\n✅ Created ${devicesToCreate.length} devices`)
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createMissingDevices()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })


