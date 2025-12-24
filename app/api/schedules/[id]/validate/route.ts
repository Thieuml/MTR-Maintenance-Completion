import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const validateScheduleSchema = z.object({
  action: z.enum(['completed', 'to_reschedule', 'completed_different_date']),
  completedDate: z.string().optional(), // ISO date string for completed_different_date action
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

    const { action, completedDate } = validation.data

    // Get the schedule with equipment details (needed for 23:00 slot eligibility)
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: {
        equipment: {
          select: {
            id: true,
            canUse2300Slot: true,
          },
        },
      },
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Calculate isLate flag only for completed action
    // isLate = true if r1PlannedDate >= dueDate - 5 days (same logic as at risk)
    // This means: scheduled less than 6 days before the due date
    let isLate = false
    
    if (action === 'completed') {
      if (schedule.r1PlannedDate && schedule.dueDate) {
        const scheduledDate = new Date(schedule.r1PlannedDate)
        const dueDate = new Date(schedule.dueDate)
        
        // Normalize to midnight for date comparison
        scheduledDate.setHours(0, 0, 0, 0)
        dueDate.setHours(0, 0, 0, 0)
        
        // Calculate dueDate - 5 days
        const lateThreshold = new Date(dueDate)
        lateThreshold.setDate(lateThreshold.getDate() - 5)
        
        // Late if scheduledDate >= dueDate - 5 days (scheduled less than 6 days before due date)
        isLate = scheduledDate >= lateThreshold
      }
    }

    // Update schedule based on action
    let updateData: any = {}
    let rescheduleRecord: any = null
    
    if (action === 'completed') {
      updateData.status = 'COMPLETED' as const
      updateData.completionDate = schedule.r1PlannedDate // Set to scheduled date
      updateData.isLate = isLate
    } else if (action === 'completed_different_date') {
      // Completed on a different date (skipped originally, but completed later)
      if (!completedDate) {
        return NextResponse.json(
          { error: 'completedDate is required for completed_different_date action' },
          { status: 400 }
        )
      }
      
      // Parse the date string (YYYY-MM-DD format from date picker)
      // Store as UTC date at midnight to avoid timezone issues
      const completedDateObj = new Date(completedDate + 'T00:00:00.000Z')
      
      // Validate completedDate is in the past (not today or future)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (completedDateObj >= today) {
        return NextResponse.json(
          { error: 'Completed date cannot be today or in the future' },
          { status: 400 }
        )
      }
      
      // Find available slot on the completion date
      const { getHKTDateKey, createHKTDate } = await import('@/lib/utils/timezone')
      const [year, month, day] = completedDate.split('-').map(Number)
      const completionDateKey = getHKTDateKey(completedDateObj)
      
      // Get all schedules in the zone and check which slots appear on this calendar date
      // We need to check a broader range because existing schedules might have 01:30/03:30
      // stored on the next day (with day adjustment)
      const checkStart = new Date(completedDateObj)
      checkStart.setDate(checkStart.getDate() - 1) // Check from previous day
      const checkEnd = new Date(completedDateObj)
      checkEnd.setDate(checkEnd.getDate() + 2) // Check until 2 days later
      
      const schedulesInRange = await prisma.schedule.findMany({
        where: {
          zoneId: schedule.zoneId,
          id: { not: scheduleId },
          status: { not: 'CANCELLED' },
          r1PlannedDate: {
            gte: checkStart,
            lt: checkEnd,
          },
        },
        select: {
          id: true,
          r1PlannedDate: true,
          timeSlot: true,
        },
      })
      
      // Filter to find which slots are actually displayed on the target date
      const occupiedSlotSet = new Set<string>()
      schedulesInRange.forEach(s => {
        if (s.r1PlannedDate) {
          const scheduleDateKey = getHKTDateKey(new Date(s.r1PlannedDate))
          // If this schedule appears on the same calendar date, mark its slot as occupied
          if (scheduleDateKey === completionDateKey) {
            occupiedSlotSet.add(s.timeSlot)
          }
        }
      })
      
      // Determine available slots (considering equipment's 2300 eligibility)
      const canUse2300 = schedule.equipment?.canUse2300Slot === true
      const slotsToCheck: Array<'SLOT_2300' | 'SLOT_0130' | 'SLOT_0330'> = ['SLOT_0130', 'SLOT_0330']
      if (canUse2300) {
        slotsToCheck.unshift('SLOT_2300')
      }
      
      // Find first available slot, or default to SLOT_0130 if all occupied
      let selectedSlot: 'SLOT_2300' | 'SLOT_0130' | 'SLOT_0330' = 'SLOT_0130'
      for (const slot of slotsToCheck) {
        if (!occupiedSlotSet.has(slot)) {
          selectedSlot = slot
          break
        }
      }
      
      // Map slot to time
      const SLOT_TIME = {
        SLOT_2300: { hour: 23, minute: 0 },
        SLOT_0130: { hour: 1, minute: 30 },
        SLOT_0330: { hour: 3, minute: 30 },
      }
      
      const { hour, minute } = SLOT_TIME[selectedSlot]
      // For "completed on different date", keep the date as selected by user
      // Don't add a day even for 01:30/03:30 slots - the date is more important than time accuracy
      let completionDateTime = createHKTDate(year, month, day, hour, minute)
      
      updateData.status = 'COMPLETED' as const
      updateData.completionDate = completedDateObj // Store the actual completion date at midnight UTC
      updateData.r1PlannedDate = completionDateTime // Store with selected date and slot time (no day adjustment)
      updateData.timeSlot = selectedSlot // Assign to selected slot
      updateData.isLate = isLate
      updateData.skippedCount = { increment: 1 } // Increment as if rescheduled in field
      updateData.lastSkippedDate = schedule.r1PlannedDate || null // Original planned date was skipped
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
          
          // Create Reschedule record for tracking
          if (schedule.r1PlannedDate) {
            rescheduleRecord = {
              scheduleId: schedule.id,
              originalDate: schedule.r1PlannedDate, // Date it was scheduled for before skip
              newDate: schedule.r1PlannedDate, // Placeholder - will be updated when rescheduled
              reason: 'Skipped during validation',
              status: 'PENDING' as const,
            }
          }
        }
      } else {
        // No dueDate - default to SKIPPED
        updateData.status = 'SKIPPED' as const
        updateData.lastSkippedDate = schedule.r1PlannedDate || null
        updateData.r1PlannedDate = null
        updateData.skippedCount = { increment: 1 }
        
        // Create Reschedule record for tracking
        if (schedule.r1PlannedDate) {
          rescheduleRecord = {
            scheduleId: schedule.id,
            originalDate: schedule.r1PlannedDate,
            newDate: schedule.r1PlannedDate, // Placeholder
            reason: 'Skipped during validation',
            status: 'PENDING' as const,
          }
        }
      }
    }

    // Update schedule and create reschedule record in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update schedule
      const updated = await tx.schedule.update({
        where: { id: scheduleId },
        data: updateData,
        select: {
          id: true,
          status: true,
          r1PlannedDate: true,
          completionDate: true,
          lastSkippedDate: true,
          skippedCount: true,
          isLate: true,
        },
      })
      
      // Create reschedule record if needed
      if (rescheduleRecord) {
        await tx.reschedule.create({
          data: rescheduleRecord,
        })
      }
      
      return updated
    })

    return NextResponse.json({ schedule: result })
  } catch (error) {
    console.error('[Schedule Validate] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}



