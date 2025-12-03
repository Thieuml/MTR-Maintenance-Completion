import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * DELETE /api/admin/work-orders/[id]
 * Delete a work order (schedule)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scheduleId = params.id

    // Check if schedule exists
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    // Check if schedule can be deleted (only PLANNED, PENDING, SKIPPED can be deleted)
    if (schedule.status === 'MISSED' || schedule.status === 'COMPLETED') {
      return NextResponse.json(
        {
          error: 'Cannot delete MISSED or COMPLETED work orders. Statistics integrity must be maintained.',
          currentStatus: schedule.status,
        },
        { status: 400 }
      )
    }

    if (!['PLANNED', 'PENDING', 'SKIPPED'].includes(schedule.status)) {
      return NextResponse.json(
        {
          error: `Cannot delete work order with status: ${schedule.status}. Only PLANNED, PENDING, or SKIPPED work orders can be deleted.`,
          currentStatus: schedule.status,
        },
        { status: 400 }
      )
    }

    // Soft delete: Set status to CANCELLED (preserves audit trail)
    await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        status: 'CANCELLED',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Work Order DELETE] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

