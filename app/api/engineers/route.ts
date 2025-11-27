import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { engineersQuerySchema } from '@/lib/validations/assignment'

/**
 * GET /api/engineers
 * List engineers with optional filters
 * 
 * Can filter by:
 * - zoneId: Filter by zone (via schedules)
 * - active: Filter by active status
 * - hasCertificates: Filter engineers with CP & RW certs
 * - search: Search by name
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = {
      zoneId: searchParams.get('zoneId') || undefined,
      active: searchParams.get('active') || undefined,
      hasCertificates: searchParams.get('hasCertificates') || undefined,
      search: searchParams.get('search') || undefined,
    }

    // Validate query parameters
    const validation = engineersQuerySchema.safeParse(query)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { zoneId, active, hasCertificates, search } = validation.data

    // Build where clause
    const where: any = {}

    if (active !== undefined) {
      where.active = active
    }

    if (hasCertificates === true) {
      where.hasCPCert = true
      where.hasRWCert = true
    }

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      }
    }

    // Fetch engineers
    const engineers = await prisma.engineer.findMany({
      where,
      include: {
        fixedSchedules: {
          where: zoneId ? { zoneId } : undefined,
          select: {
            id: true,
            r1PlannedDate: true,
            status: true,
            equipment: {
              select: {
                equipmentNumber: true,
              },
            },
          },
          orderBy: {
            r1PlannedDate: 'desc',
          },
          take: 5, // Recent schedules
        },
        rotatingSchedules: {
          where: zoneId ? { zoneId } : undefined,
          select: {
            id: true,
            r1PlannedDate: true,
            status: true,
            equipment: {
              select: {
                equipmentNumber: true,
              },
            },
          },
          orderBy: {
            r1PlannedDate: 'desc',
          },
          take: 5, // Recent schedules
        },
        visits: {
          select: {
            id: true,
            actualStartDate: true,
            completed: true,
            classification: true,
          },
          orderBy: {
            actualStartDate: 'desc',
          },
          take: 10, // Recent visits
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Filter by zone if specified (via schedules)
    let filteredEngineers = engineers
    if (zoneId) {
      filteredEngineers = engineers.filter(
        (eng) =>
          eng.fixedSchedules.length > 0 || eng.rotatingSchedules.length > 0
      )
    }

    // Calculate compliance stats for each engineer
    const engineersWithStats = filteredEngineers.map((eng) => {
      const allSchedules = [...eng.fixedSchedules, ...eng.rotatingSchedules]
      const allVisits = eng.visits || []

      // Count visits by classification
      const visitsByClassification = {
        COMMITTED_DATE: allVisits.filter((v) => v.classification === 'COMMITTED_DATE').length,
        ON_TIME: allVisits.filter((v) => v.classification === 'ON_TIME').length,
        LATE: allVisits.filter((v) => v.classification === 'LATE').length,
        OVERDUE: allVisits.filter((v) => v.classification === 'OVERDUE').length,
        NOT_COMPLETED: allVisits.filter((v) => v.classification === 'NOT_COMPLETED').length,
      }

      // Calculate late visit percentage (last 6 months)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      
      const recentVisits = allVisits.filter(
        (v) => v.actualStartDate >= sixMonthsAgo
      )
      const recentLateVisits = recentVisits.filter(
        (v) => v.classification === 'LATE' || v.classification === 'OVERDUE'
      )
      const lateVisitPercentage =
        recentVisits.length > 0
          ? (recentLateVisits.length / recentVisits.length) * 100
          : 0

      // Count overdue units
      const overdueSchedules = allSchedules.filter(
        (s) => s.status === 'OVERDUE'
      ).length

      return {
        ...eng,
        stats: {
          totalSchedules: allSchedules.length,
          overdueSchedules,
          totalVisits: allVisits.length,
          visitsByClassification,
          lateVisitPercentage: Math.round(lateVisitPercentage * 100) / 100,
        },
      }
    })

    return NextResponse.json({
      engineers: engineersWithStats,
      count: engineersWithStats.length,
    })
  } catch (error) {
    console.error('[Engineers GET] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
