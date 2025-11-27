import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const moveScheduleSchema = z.object({
  newDate: z.string().datetime(),
  newTimeSlot: z.enum(['SLOT_2300', 'SLOT_0130', 'SLOT_0330']),
  swapWithScheduleId: z.string().optional(), // If provided, swap schedules
})

/**
 * POST /api/schedules/[id]/move
 * Move a schedule to a new date/time slot, optionally swapping with another schedule
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scheduleId = params.id
    const body = await request.json()

    // Validate request body
    const validation = moveScheduleSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { newDate, newTimeSlot, swapWithScheduleId } = validation.data

    // Get the schedule to move
    const scheduleToMove = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        equipment: true,
      },
    })

    if (!scheduleToMove) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    const newDateObj = new Date(newDate)

    // Validate that equipment can use 23:00 slot if moving to 23:00
    if (newTimeSlot === 'SLOT_2300' && !scheduleToMove.equipment.canUse2300Slot) {
      return NextResponse.json(
        {
          error: 'This equipment cannot be serviced at 23:00. Only equipment with the clock icon can be scheduled at 23:00.',
        },
        { status: 400 }
      )
    }


    // If swapping, get the other schedule
    let scheduleToSwap: any = null
    if (swapWithScheduleId) {
      scheduleToSwap = await prisma.schedule.findUnique({
        where: { id: swapWithScheduleId },
        include: {
          equipment: true,
        },
      })

      if (!scheduleToSwap) {
        return NextResponse.json(
          { error: 'Schedule to swap with not found' },
          { status: 404 }
        )
      }

      // When swapping, scheduleToSwap moves to scheduleToMove's original slot
      // If that original slot is 23:00, validate that scheduleToSwap's equipment can use it
      if (scheduleToMove.timeSlot === 'SLOT_2300' && !scheduleToSwap.equipment.canUse2300Slot) {
        return NextResponse.json(
          {
            error: 'Cannot swap: The equipment being swapped cannot be serviced at 23:00. Only equipment with the clock icon can be scheduled at 23:00.',
          },
          { status: 400 }
        )
      }

    }

    // Perform the move/swap in a transaction
    if (swapWithScheduleId && scheduleToSwap) {
      // Swap: move both schedules
      const [updated1, updated2] = await prisma.$transaction([
        prisma.schedule.update({
          where: { id: scheduleId },
          data: {
            r1PlannedDate: newDateObj,
            timeSlot: newTimeSlot,
            status: 'RESCHEDULED',
          },
          select: {
            id: true,
            r0PlannedDate: true,
            r1PlannedDate: true,
            dueDate: true,
            batch: true,
            timeSlot: true,
            status: true,
            workOrderNumber: true,
            equipment: true,
            zone: true,
            fixedEngineer: true,
            rotatingEngineer: true,
          },
        }),
        prisma.schedule.update({
          where: { id: swapWithScheduleId },
          data: {
            r1PlannedDate: scheduleToMove.r1PlannedDate,
            timeSlot: scheduleToMove.timeSlot,
            status: 'RESCHEDULED',
          },
          select: {
            id: true,
            r0PlannedDate: true,
            r1PlannedDate: true,
            dueDate: true,
            batch: true,
            timeSlot: true,
            status: true,
            workOrderNumber: true,
            equipment: true,
            zone: true,
            fixedEngineer: true,
            rotatingEngineer: true,
          },
        }),
      ])

      return NextResponse.json({
        movedSchedule: updated1,
        swappedSchedule: updated2,
      })
    } else {
      // Simple move: just update the schedule
      const updated = await prisma.schedule.update({
        where: { id: scheduleId },
        data: {
          r1PlannedDate: newDateObj,
          timeSlot: newTimeSlot,
          status: 'RESCHEDULED',
        },
        select: {
          id: true,
          r0PlannedDate: true,
          r1PlannedDate: true,
          dueDate: true,
          batch: true,
          timeSlot: true,
          status: true,
          workOrderNumber: true,
          equipment: true,
          zone: true,
          fixedEngineer: true,
          rotatingEngineer: true,
        },
      })

      return NextResponse.json({ schedule: updated })
    }
  } catch (error) {
    console.error('[Schedule Move] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

