import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateEquipmentSchema = z.object({
  canUse2300Slot: z.boolean().optional(),
  active: z.boolean().optional(),
})

/**
 * GET /api/admin/equipment/[id]
 * Get single equipment details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id: params.id },
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
                code: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!equipment) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ equipment })
  } catch (error) {
    console.error('[Equipment GET] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/equipment/[id]
 * Update equipment settings (e.g., canUse2300Slot)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validation = updateEquipmentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (validation.data.canUse2300Slot !== undefined) {
      updateData.canUse2300Slot = validation.data.canUse2300Slot
    }
    if (validation.data.active !== undefined) {
      updateData.active = validation.data.active
    }

    const equipment = await prisma.equipment.update({
      where: { id: params.id },
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

    return NextResponse.json({ equipment })
  } catch (error) {
    console.error('[Equipment PUT] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

