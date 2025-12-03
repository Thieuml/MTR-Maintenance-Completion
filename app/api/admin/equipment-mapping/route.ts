import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createMappingSchema = z.object({
  equipmentId: z.string().min(1),
  zoneId: z.string().min(1),
  batch: z.enum(['A', 'B']),
})

/**
 * GET /api/admin/equipment-mapping
 * Get all equipment zone mappings
 */
export async function GET() {
  try {
    const mappings = await prisma.equipmentZoneMapping.findMany({
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
        updatedAt: 'desc',
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
 * Create or update equipment zone mapping
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

    // Check if mapping already exists
    const existing = await prisma.equipmentZoneMapping.findUnique({
      where: { equipmentId },
    })

    if (existing) {
      // Update existing mapping
      const updated = await prisma.equipmentZoneMapping.update({
        where: { id: existing.id },
        data: {
          zoneId,
          batch,
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
      return NextResponse.json({ mapping: updated })
    }

    // Create new mapping
    const mapping = await prisma.equipmentZoneMapping.create({
      data: {
        equipmentId,
        zoneId,
        batch,
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

