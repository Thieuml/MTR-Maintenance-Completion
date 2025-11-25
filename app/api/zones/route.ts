import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/zones
 * List all MTR zones
 */
export async function GET() {
  try {
    const zones = await prisma.zone.findMany({
      where: {
        active: true,
      },
      orderBy: {
        code: 'asc',
      },
      include: {
        _count: {
          select: {
            equipment: true,
            schedules: true,
          },
        },
      },
    })

    return NextResponse.json({
      zones,
      count: zones.length,
    })
  } catch (error) {
    console.error('[Zones GET] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

