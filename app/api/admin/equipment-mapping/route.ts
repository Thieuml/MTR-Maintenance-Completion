import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createMappingSchema = z.object({
  equipmentId: z.string(),
  zoneId: z.string(),
  batch: z.enum(['A', 'B']),
})

/**
 * GET /api/admin/equipment-mapping
 * List all equipment mappings
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const zoneId = searchParams.get('zoneId')
    const batch = searchParams.get('batch')

    const where: any = { active: true }
    if (zoneId) where.zoneId = zoneId
    if (batch) where.batch = batch

    const mappings = await prisma.equipmentZoneMapping.findMany({
      where,
      include: {
        equipment: {
          select: {
            id: true,
            equipmentNumber: true,
            name: true,
            type: true,
          },
        },
        zone: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: {
        equipment: {
          equipmentNumber: 'asc',
        },
      },
    })

    return NextResponse.json({ mappings })
  } catch (error) {
    console.error('[Equipment Mapping GET] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/equipment-mapping
 * Create or update equipment mapping
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = createMappingSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { equipmentId, zoneId, batch } = validation.data

    // Check if equipment exists
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
    })

    if (!equipment) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    // Create or update mapping
    const mapping = await prisma.equipmentZoneMapping.upsert({
      where: { equipmentId },
      update: {
        zoneId,
        batch,
        active: true,
        updatedAt: new Date(),
      },
      create: {
        equipmentId,
        zoneId,
        batch,
        active: true,
      },
      include: {
        equipment: {
          select: {
            id: true,
            equipmentNumber: true,
            name: true,
            type: true,
          },
        },
        zone: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({ mapping }, { status: 201 })
  } catch (error) {
    console.error('[Equipment Mapping POST] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}


