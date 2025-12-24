import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for updating equipment
const updateEquipmentSchema = z.object({
  canUse2300Slot: z.boolean().optional(),
  zoneId: z.string().optional(),
  type: z.enum(['ELEVATOR', 'ESCALATOR']).optional(),
})

/**
 * PUT /api/admin/equipment/[id]
 * Update equipment by ID
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const equipmentId = params.id

    // Fetch the request body
    const body = await request.json()
    const validation = updateEquipmentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { canUse2300Slot, zoneId, type } = validation.data

    // Check if equipment exists
    const existing = await prisma.equipment.findUnique({
      where: { id: equipmentId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    // Build update data object (only update provided fields)
    const updateData: any = {}
    if (canUse2300Slot !== undefined) {
      updateData.canUse2300Slot = canUse2300Slot
    }
    if (zoneId !== undefined) {
      updateData.zoneId = zoneId
    }
    if (type !== undefined) {
      updateData.type = type
    }

    // Update equipment
    const updated = await prisma.equipment.update({
      where: { id: equipmentId },
      data: updateData,
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
  } catch (error) {
    console.error('[Equipment PUT] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update equipment' },
      { status: 500 }
    )
  }
}

