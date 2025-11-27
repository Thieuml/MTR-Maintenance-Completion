import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const validateScheduleSchema = z.object({
  action: z.enum(['completed', 'to_reschedule']),
})

/**
 * POST /api/schedules/[id]/validate
 * Validate a maintenance service (mark as completed or flag for rescheduling)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scheduleId = params.id
    const body = await request.json()

    // Validate request body
    const validation = validateScheduleSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { action } = validation.data

    // Get the schedule
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Update schedule based on action
    let updateData: any = {}
    if (action === 'completed') {
      // Check if completion is late (after due date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (schedule.dueDate) {
        const dueDate = new Date(schedule.dueDate)
        dueDate.setHours(0, 0, 0, 0)
        if (today > dueDate) {
          updateData.status = 'COMPLETED_LATE'
        } else {
          updateData.status = 'COMPLETED'
        }
      } else {
        updateData.status = 'COMPLETED'
      }
    } else if (action === 'to_reschedule') {
      updateData.status = 'MISSED'
    }

    const updated = await prisma.schedule.update({
      where: { id: scheduleId },
      data: updateData,
      include: {
        equipment: true,
        zone: true,
        fixedEngineer: true,
        rotatingEngineer: true,
        visits: {
          orderBy: {
            actualStartDate: 'desc',
          },
        },
      },
    })

    return NextResponse.json({ schedule: updated })
  } catch (error) {
    console.error('[Schedule Validate] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}



