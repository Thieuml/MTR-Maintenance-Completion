import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/work-orders/count
 * Get lightweight counts for navigation badge
 * Only returns counts, not full work order data
 */
export async function GET(request: NextRequest) {
  // Check authentication
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // Get counts efficiently with aggregation
    // This is much faster than fetching all work orders
    // Trust the database status as single source of truth (no date calculations)
    const [toValidateCount, toRescheduleCount] = await Promise.all([
      // PENDING items (cron job moves PLANNED → PENDING for past dates)
      prisma.schedule.count({
        where: {
          workOrderNumber: { not: null },
          status: 'PENDING',
        },
      }),
      // SKIPPED or MISSED items
      prisma.schedule.count({
        where: {
          workOrderNumber: { not: null },
          status: { in: ['SKIPPED', 'MISSED'] },
        },
      }),
    ])

    return NextResponse.json({
      toValidate: toValidateCount,
      toReschedule: toRescheduleCount,
      total: toValidateCount + toRescheduleCount,
    })
  } catch (error) {
    console.error('[Work Orders Count] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

