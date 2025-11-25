import { NextResponse } from 'next/server'
import { fetchMTRDevicesFromLooker } from '@/lib/looker'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/equipment
 * Get all equipment from Looker (for mapping)
 */
export async function GET() {
  try {
    // Fetch from Looker
    const lookerDevices = await fetchMTRDevicesFromLooker()

    // Also get equipment already in database
    const dbEquipment = await prisma.equipment.findMany({
      select: {
        id: true,
        equipmentNumber: true,
        name: true,
        type: true,
        deviceId: true,
        canUse2300Slot: true,
      },
    })

    // Merge and deduplicate
    const equipmentMap = new Map<string, any>()
    
    // Add DB equipment first
    dbEquipment.forEach((eq) => {
      equipmentMap.set(eq.equipmentNumber, {
        id: eq.id,
        equipmentNumber: eq.equipmentNumber,
        name: eq.name || eq.equipmentNumber,
        type: eq.type,
        deviceId: eq.deviceId,
        canUse2300Slot: eq.canUse2300Slot,
        inDatabase: true,
      })
    })

    // Add Looker devices (may not be in DB yet)
    lookerDevices.forEach((device: any) => {
      const equipmentNumber = device['device.location'] || device.device_location || device.equipment_number || device.location
      if (equipmentNumber && !equipmentMap.has(equipmentNumber)) {
        equipmentMap.set(equipmentNumber, {
          id: null, // Not in DB yet
          equipmentNumber: equipmentNumber.trim(),
          name: equipmentNumber,
          type: device.device_type?.toUpperCase().includes('ESCALATOR') ? 'ESCALATOR' : 'ELEVATOR',
          deviceId: device.device_id || device.deviceId || null,
          canUse2300Slot: false,
          inDatabase: false,
        })
      }
    })

    return NextResponse.json({
      equipment: Array.from(equipmentMap.values()),
    })
  } catch (error) {
    console.error('[Equipment GET] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

