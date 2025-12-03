/**
 * Script to create ALL missing devices from Looker that aren't in the database
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fetchMTRDevicesFromLooker } from '../lib/looker'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function createAllMissingDevices() {
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

      if (!existingSet.has(trimmedNumber)) {
        // Determine zone based on prefix
        let zoneCode = 'MTR-01' // Default
        if (trimmedNumber.startsWith('HOK-')) {
          zoneCode = 'MTR-01' // Could be MTR-01 or MTR-02, defaulting to MTR-01
        } else if (trimmedNumber.startsWith('KOW-')) {
          zoneCode = 'MTR-03'
        } else if (trimmedNumber.startsWith('TSY-') || trimmedNumber.startsWith('TY-')) {
          zoneCode = 'MTR-04'
        } else if (trimmedNumber.startsWith('OLY-') || trimmedNumber.startsWith('SBY-') || trimmedNumber.startsWith('DIS-') || trimmedNumber.startsWith('LKP-') || trimmedNumber.startsWith('LHP-') || trimmedNumber.startsWith('LAK-') || trimmedNumber.startsWith('SUN-')) {
          zoneCode = 'MTR-05'
        } else if (trimmedNumber.startsWith('TUC-') || trimmedNumber.startsWith('AIR-') || trimmedNumber.startsWith('TUM-')) {
          zoneCode = 'MTR-06'
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

    if (devicesToCreate.length === 0) {
      console.log('✅ All devices already exist in database')
      return
    }

    console.log(`\n📦 Found ${devicesToCreate.length} missing devices:`)
    // Group by zone
    const byZone = new Map<string, string[]>()
    for (const device of devicesToCreate) {
      const zone = Array.from(zoneMap.entries()).find(([_, z]) => z.id === device.zoneId)?.[0] || 'Unknown'
      if (!byZone.has(zone)) {
        byZone.set(zone, [])
      }
      byZone.get(zone)!.push(device.equipmentNumber)
    }

    for (const [zone, devices] of Array.from(byZone.entries()).sort()) {
      console.log(`\n  ${zone}:`)
      for (const deviceNum of devices.sort()) {
        const device = devicesToCreate.find(d => d.equipmentNumber === deviceNum)!
        console.log(`    - ${deviceNum} (${device.type})`)
      }
    }

    console.log(`\n📦 Creating ${devicesToCreate.length} devices...`)

    // Create devices
    let created = 0
    let errors = 0
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
        created++
      } catch (error: any) {
        if (error.code === 'P2002') {
          // Unique constraint violation - device was created between check and create
          console.log(`  ⚠️  ${deviceData.equipmentNumber} already exists (skipped)`)
        } else {
          console.error(`  ❌ Error creating ${deviceData.equipmentNumber}:`, error.message)
          errors++
        }
      }
    }

    console.log(`\n✅ Created ${created} devices`)
    if (errors > 0) {
      console.log(`⚠️  ${errors} errors occurred`)
    }
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createAllMissingDevices()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })

