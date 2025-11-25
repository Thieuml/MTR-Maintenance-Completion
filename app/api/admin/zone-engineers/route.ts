import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const assignEngineerSchema = z.object({
  zoneId: z.string(),
  engineerId: z.string(),
  role: z.enum(['FIXED_QUALIFIED', 'FIXED']),
})

/**
 * GET /api/admin/zone-engineers
 * List engineer assignments by zone
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const zoneId = searchParams.get('zoneId')

    const where: any = { active: true }
    if (zoneId) where.zoneId = zoneId

    const assignments = await prisma.zoneEngineerAssignment.findMany({
      where,
      include: {
        zone: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        engineer: {
          select: {
            id: true,
            name: true,
            hasCPCert: true,
            hasRWCert: true,
            active: true,
          },
        },
      },
      orderBy: [
        { zone: { code: 'asc' } },
        { role: 'asc' },
      ],
    })

    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('[Zone Engineers GET] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/zone-engineers
 * Assign engineer to zone
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = assignEngineerSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { zoneId, engineerId, role } = validation.data

    // Validate FIXED_QUALIFIED requires CP & RW certs
    if (role === 'FIXED_QUALIFIED') {
      const engineer = await prisma.engineer.findUnique({
        where: { id: engineerId },
      })

      if (!engineer) {
        return NextResponse.json(
          { error: 'Engineer not found' },
          { status: 404 }
        )
      }

      if (!engineer.hasCPCert || !engineer.hasRWCert) {
        return NextResponse.json(
          {
            error: 'FIXED_QUALIFIED engineer must have CP and RW certificates',
            engineer: engineer.name,
            hasCPCert: engineer.hasCPCert,
            hasRWCert: engineer.hasRWCert,
          },
          { status: 400 }
        )
      }
    }

    // Create or update assignment
    const assignment = await prisma.zoneEngineerAssignment.upsert({
      where: {
        zoneId_engineerId: {
          zoneId,
          engineerId,
        },
      },
      update: {
        role,
        active: true,
        updatedAt: new Date(),
      },
      create: {
        zoneId,
        engineerId,
        role,
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
        engineer: {
          select: {
            id: true,
            name: true,
            hasCPCert: true,
            hasRWCert: true,
          },
        },
      },
    })

    return NextResponse.json({ assignment }, { status: 201 })
  } catch (error) {
    console.error('[Zone Engineers POST] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/zone-engineers
 * Remove engineer assignment from zone
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const zoneId = searchParams.get('zoneId')
    const engineerId = searchParams.get('engineerId')

    if (!zoneId || !engineerId) {
      return NextResponse.json(
        { error: 'zoneId and engineerId are required' },
        { status: 400 }
      )
    }

    await prisma.zoneEngineerAssignment.delete({
      where: {
        zoneId_engineerId: {
          zoneId,
          engineerId,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Zone Engineers DELETE] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

