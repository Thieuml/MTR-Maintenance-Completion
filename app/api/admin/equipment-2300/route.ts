import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/equipment-2300
 * Get all equipment that can use 23:00 slot (optimized single query)
 */
export async function GET() {
  try {
    // Fetch all equipment with canUse2300Slot enabled in a single optimized query
    // Note: We fetch ALL equipment with canUse2300Slot=true, regardless of active status
    // The active filter was removed to ensure we see all 23:00-capable equipment
    
    // First, let's check what's actually in the database
    const allEquipmentCount = await prisma.equipment.count()
    const equipment2300Count = await prisma.equipment.count({
      where: { canUse2300Slot: true },
    })
    console.log(`[Equipment 2300] Total equipment: ${allEquipmentCount}, with canUse2300Slot=true: ${equipment2300Count}`)
    
    const equipment = await prisma.equipment.findMany({
      where: {
        canUse2300Slot: true,
      },
      include: {
        zone: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        zoneMapping: {
          include: {
            zone: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        equipmentNumber: 'asc',
      },
    })

    // Transform to match the expected format
    const formattedEquipment = equipment.map((eq) => ({
      id: eq.id,
      equipmentNumber: eq.equipmentNumber,
      name: eq.name,
      type: eq.type,
      canUse2300Slot: eq.canUse2300Slot,
      zone: eq.zoneMapping?.zone || eq.zone || null,
      batch: eq.zoneMapping?.batch || null,
    }))

    // Debug: Log equipment numbers for troubleshooting
    console.log(`[Equipment 2300] Found ${formattedEquipment.length} equipment with canUse2300Slot=true`)
    console.log(`[Equipment 2300] Equipment numbers:`, formattedEquipment.map(eq => eq.equipmentNumber).join(', '))

    return NextResponse.json({
      equipment: formattedEquipment,
      count: formattedEquipment.length,
    })
  } catch (error) {
    console.error('[Equipment 2300 GET] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

