import { NextRequest, NextResponse } from 'next/server'
import { getEngineerWorkload } from '@/lib/utils/engineer-availability'

/**
 * GET /api/engineers/[id]/workload
 * Get engineer workload for a date range
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json(
        { error: 'from and to query parameters are required (ISO date strings)' },
        { status: 400 }
      )
    }

    const fromDate = new Date(from)
    const toDate = new Date(to)

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO date strings (e.g., 2025-01-01T00:00:00Z)' },
        { status: 400 }
      )
    }

    const workload = await getEngineerWorkload(params.id, fromDate, toDate)

    return NextResponse.json({
      engineerId: params.id,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      ...workload,
    })
  } catch (error) {
    console.error('[Engineer Workload] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

