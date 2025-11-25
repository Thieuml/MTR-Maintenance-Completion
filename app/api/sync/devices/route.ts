import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchMTRDevicesFromLooker } from '@/lib/looker'

/**
 * POST /api/sync/devices
 * Sync MTR devices/equipment from Looker (Look ID 167)
 * 
 * Fetches devices from Looker and creates/updates them in the database
 * Assigns devices to zones based on building/location data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const dryRun = body.dryRun === true

    console.log('[Sync Devices] Starting sync...', { dryRun })

    // Fetch devices from Looker
    const lookerDevices = await fetchMTRDevicesFromLooker()
    console.log(`[Sync Devices] Fetched ${lookerDevices.length} devices from Looker`)

    if (lookerDevices.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No devices found in Looker',
      }, { status: 400 })
    }

    // Get all zones for zone assignment
    const zones = await prisma.zone.findMany({ where: { active: true } })
    const zoneMap = new Map(zones.map(z => [z.code, z]))

    // Map Looker data to our schema
    // Expected fields: device_id, device.location (equipment_number), building_id, building_name, full_address, device.type
    const devicesToSync = lookerDevices.map((device: any) => {
      const deviceId = device.device_id || device.deviceId
      const equipmentNumber = device['device.location'] || device.device_location || device.equipment_number || device.location
      const buildingId = device.building_id || device.buildingId
      const buildingName = device.building_name || device.buildingName
      const fullAddress = device.full_address || device.fullAddress
      const deviceType = device.device_type || device.type || device.deviceType
      const location = device.location || equipmentNumber

      if (!equipmentNumber) {
        throw new Error(`Invalid device data: missing equipment_number. Data: ${JSON.stringify(device)}`)
      }

      // Determine zone based on equipment number prefix
      // HOK = MTR-01 or MTR-02, KOW = MTR-03, etc.
      let zoneCode = 'MTR-01' // Default
      if (equipmentNumber.startsWith('HOK-')) {
        zoneCode = 'MTR-01' // Could be MTR-01 or MTR-02, defaulting to MTR-01
      } else if (equipmentNumber.startsWith('KOW-')) {
        zoneCode = 'MTR-03'
      } else if (equipmentNumber.startsWith('TSY-') || equipmentNumber.startsWith('TY-')) {
        zoneCode = 'MTR-04'
      } else if (equipmentNumber.startsWith('OLY-') || equipmentNumber.startsWith('SBY-') || equipmentNumber.startsWith('DIS-') || equipmentNumber.startsWith('LKP-')) {
        zoneCode = 'MTR-05'
      } else if (equipmentNumber.startsWith('TUC-') || equipmentNumber.startsWith('AIR-') || equipmentNumber.startsWith('TUM-')) {
        zoneCode = 'MTR-06'
      }

      const zone = zoneMap.get(zoneCode)
      if (!zone) {
        throw new Error(`Zone ${zoneCode} not found for device ${equipmentNumber}`)
      }

      // Map device type
      let type: 'ELEVATOR' | 'ESCALATOR' = 'ELEVATOR'
      if (deviceType) {
        const typeUpper = String(deviceType).toUpperCase()
        if (typeUpper.includes('ESCALATOR') || typeUpper.includes('ESC')) {
          type = 'ESCALATOR'
        } else {
          type = 'ELEVATOR'
        }
      }

      return {
        deviceId: deviceId ? String(deviceId) : null,
        equipmentNumber: equipmentNumber.trim(),
        name: equipmentNumber, // Use equipment number as name
        type,
        location,
        buildingId: buildingId ? String(buildingId) : null,
        buildingName: buildingName || null,
        fullAddress: fullAddress || null,
        zoneId: zone.id,
        active: true,
      }
    })

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        devicesFound: devicesToSync.length,
        devices: devicesToSync,
        message: 'Dry run - no changes made',
      })
    }

    // Sync devices to database
    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    }

    // Get all existing devices
    const existingDevices = await prisma.equipment.findMany({
      where: {
        OR: [
          { deviceId: { not: null } },
          { equipmentNumber: { in: devicesToSync.map(d => d.equipmentNumber) } },
        ],
      },
    })

    const existingByDeviceId = new Map(
      existingDevices.filter(d => d.deviceId).map(d => [d.deviceId!, d])
    )
    const existingByEquipmentNumber = new Map(
      existingDevices.map(d => [d.equipmentNumber, d])
    )

    // Process each device
    for (const deviceData of devicesToSync) {
      try {
        let existing = null

        // Try to find by deviceId first, then by equipmentNumber
        if (deviceData.deviceId) {
          existing = existingByDeviceId.get(deviceData.deviceId)
        }
        if (!existing) {
          existing = existingByEquipmentNumber.get(deviceData.equipmentNumber)
        }

        if (existing) {
          // Update existing device
          await prisma.equipment.update({
            where: { id: existing.id },
            data: {
              deviceId: deviceData.deviceId || existing.deviceId,
              equipmentNumber: deviceData.equipmentNumber,
              name: deviceData.name,
              type: deviceData.type,
              location: deviceData.location,
              buildingId: deviceData.buildingId || existing.buildingId,
              buildingName: deviceData.buildingName || existing.buildingName,
              fullAddress: deviceData.fullAddress || existing.fullAddress,
              zoneId: deviceData.zoneId,
              active: deviceData.active,
              updatedAt: new Date(),
            },
          })
          results.updated++
        } else {
          // Create new device
          await prisma.equipment.create({
            data: deviceData,
          })
          results.created++
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        results.errors.push(`Failed to sync ${deviceData.equipmentNumber}: ${errorMsg}`)
        console.error(`[Sync Devices] Error syncing ${deviceData.equipmentNumber}:`, error)
      }
    }

    console.log('[Sync Devices] Sync completed:', results)

    return NextResponse.json({
      success: true,
      results,
      devicesProcessed: devicesToSync.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Sync Devices] Sync failed:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sync/devices
 * Test Looker connection
 */
export async function GET() {
  try {
    const devices = await fetchMTRDevicesFromLooker()
    return NextResponse.json({
      connected: true,
      devicesFound: devices.length,
      message: 'Looker connection successful',
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        connected: false,
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}

