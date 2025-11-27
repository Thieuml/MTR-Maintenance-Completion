import { NextRequest, NextResponse } from 'next/server'
import { fetchMTRDevicesFromLooker } from '@/lib/looker'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createEquipmentSchema = z.object({
  equipmentNumber: z.string().min(1),
  zoneId: z.string().min(1),
  type: z.enum(['ELEVATOR', 'ESCALATOR']),
  canUse2300Slot: z.boolean().optional().default(false),
})

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

    /**
     * Normalize equipment number by removing leading zeros from numbers
     * E.g., HOK-E01 -> HOK-E1, TSY-E10 -> TSY-E10 (no change)
     */
    const normalizeEquipmentNumber = (num: string): string => {
      return num.replace(/([A-Z]+-)([A-Z]*)(0+)(\d+)/g, (match, prefix, middle, zeros, digits) => {
        // Remove leading zeros (E01 -> E1, but E10 stays E10)
        if (zeros.length >= 1) {
          return `${prefix}${middle}${digits}`
        }
        return match
      })
    }

    // Create a map of normalized equipment numbers to actual equipment numbers in DB
    const normalizedDbMap = new Map<string, string>()
    dbEquipment.forEach((eq) => {
      const normalized = normalizeEquipmentNumber(eq.equipmentNumber)
      normalizedDbMap.set(normalized, eq.equipmentNumber)
    })

    // Add Looker devices (may not be in DB yet)
    lookerDevices.forEach((device: any) => {
      // Try multiple possible field names for equipment number
      const equipmentNumber = 
        device['device.location'] || 
        device['device.location '] || // Handle trailing space
        device.device_location || 
        device['device_location'] ||
        device.equipment_number || 
        device.equipmentNumber ||
        device.location ||
        device.Location ||
        device['Location']
      
      if (!equipmentNumber) {
        return
      }
      
      const trimmedNumber = equipmentNumber.trim()
      const normalized = normalizeEquipmentNumber(trimmedNumber)
      
      // Check if this normalized number already exists in DB
      const existingDbNumber = normalizedDbMap.get(normalized)
      if (existingDbNumber) {
        // Device exists in DB (possibly with different zero-padding)
        // Use the DB version
        const dbEq = dbEquipment.find(eq => eq.equipmentNumber === existingDbNumber)
        if (dbEq && !equipmentMap.has(existingDbNumber)) {
          equipmentMap.set(existingDbNumber, {
            id: dbEq.id,
            equipmentNumber: dbEq.equipmentNumber,
            name: dbEq.name || dbEq.equipmentNumber,
            type: dbEq.type,
            deviceId: dbEq.deviceId,
            canUse2300Slot: dbEq.canUse2300Slot,
            inDatabase: true,
          })
        }
      } else if (trimmedNumber && !equipmentMap.has(trimmedNumber)) {
        // New device not in DB
        equipmentMap.set(trimmedNumber, {
          id: null, // Not in DB yet
          equipmentNumber: trimmedNumber,
          name: trimmedNumber,
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

/**
 * POST /api/admin/equipment
 * Create new equipment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = createEquipmentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { equipmentNumber, zoneId, type, canUse2300Slot } = validation.data

    // Check if equipment already exists
    const existing = await prisma.equipment.findUnique({
      where: { equipmentNumber },
    })

    if (existing) {
      // Update existing equipment
      const updated = await prisma.equipment.update({
        where: { id: existing.id },
        data: {
          canUse2300Slot: canUse2300Slot ?? existing.canUse2300Slot,
          zoneId: zoneId !== existing.zoneId ? zoneId : undefined,
          type: type !== existing.type ? type : undefined,
        },
        include: {
          zone: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      })
      return NextResponse.json({ equipment: updated })
    }

    // Create new equipment
    const equipment = await prisma.equipment.create({
      data: {
        equipmentNumber,
        name: equipmentNumber,
        type,
        zoneId,
        canUse2300Slot: canUse2300Slot ?? false,
        active: true,
      },
      include: {
        zone: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({ equipment }, { status: 201 })
  } catch (error) {
    console.error('[Equipment POST] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

