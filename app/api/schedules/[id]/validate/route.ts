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

    // Get the schedule (optimized: only fetch visits if marking as completed)
    const scheduleQuery: any = {
      where: { id: scheduleId },
    }
    
    if (action === 'completed') {
      scheduleQuery.include = {
        visits: {
          take: 1,
          orderBy: { completionDate: 'desc' },
          select: { completionDate: true },
        },
      }
    }
    
    const schedule = await prisma.schedule.findUnique(scheduleQuery)

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Calculate isLate flag only for completed action
    let isLate = false
    let completionDate = new Date()
    
    if (action === 'completed') {
      completionDate = (schedule as any).visits?.[0]?.completionDate || new Date()
      if (schedule.mtrPlannedStartDate && completionDate) {
        const mtrDate = new Date(schedule.mtrPlannedStartDate)
        const completion = new Date(completionDate)
        const sixDaysInMs = 6 * 24 * 60 * 60 * 1000
        isLate = completion.getTime() > (mtrDate.getTime() + sixDaysInMs)
      }
    }

    // Update schedule based on action
    let updateData: any = {}
    if (action === 'completed') {
      updateData.status = 'COMPLETED' as const
      updateData.isLate = isLate
    } else if (action === 'to_reschedule') {
      // Determine if MISSED (dueDate passed) or SKIPPED (dueDate still in future)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dueDate = schedule.dueDate ? new Date(schedule.dueDate) : null
      
      if (dueDate) {
        dueDate.setHours(0, 0, 0, 0)
        if (today > dueDate) {
          // MISSED: deadline has passed (final status)
          updateData.status = 'MISSED' as const
          updateData.lastSkippedDate = schedule.r1PlannedDate || null
          updateData.r1PlannedDate = null // Empty scheduled date
          // Do NOT increment skippedCount for MISSED
        } else {
          // SKIPPED: deadline still in future (can reschedule)
          updateData.status = 'SKIPPED' as const
          updateData.lastSkippedDate = schedule.r1PlannedDate || null
          updateData.r1PlannedDate = null // Empty scheduled date
          updateData.skippedCount = { increment: 1 } // Increment skipped count
        }
      } else {
        // No dueDate - default to SKIPPED
        updateData.status = 'SKIPPED' as const
        updateData.lastSkippedDate = schedule.r1PlannedDate || null
        updateData.r1PlannedDate = null
        updateData.skippedCount = { increment: 1 }
      }
    }

    // Update schedule (minimal select for performance - only return what's needed)
    const updated = await prisma.schedule.update({
      where: { id: scheduleId },
      data: updateData,
      select: {
        id: true,
        status: true,
        r1PlannedDate: true,
        lastSkippedDate: true,
        skippedCount: true,
        isLate: true,
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



