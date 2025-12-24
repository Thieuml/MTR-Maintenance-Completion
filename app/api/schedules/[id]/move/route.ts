import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  createHKTDate,
  getHKTDateKey,
  addDaysToHKTDateKey,
  compareHKTDateKeys,
  getHKTTodayKey,
} from '@/lib/utils/timezone'

const moveScheduleSchema = z.object({
  newDate: z.string().datetime(),
  newTimeSlot: z.enum(['SLOT_2300', 'SLOT_0130', 'SLOT_0330']),
  swapWithScheduleId: z.string().optional(), // If provided, push that schedule forward
  allowInvalid2300Slot: z.boolean().optional(), // Allow move to 23:00 even if not eligible (warning only)
  targetDateStr: z.string().optional(), // Date string (YYYY-MM-DD) for direct comparison
})

const SLOT_TIME = {
  SLOT_2300: { hour: 23, minute: 0 },
  SLOT_0130: { hour: 1, minute: 30 },
  SLOT_0330: { hour: 3, minute: 30 },
} as const

const MAX_PUSH_WINDOW_DAYS = 60

function dateKeyToDate(key: string, hour: number = 0, minute: number = 0) {
  const [year, month, day] = key.split('-').map(Number)
  return createHKTDate(year, month, day, hour, minute)
}

async function findNextAvailableSlot(params: {
  zoneId: string
  startKey: string
  endKey: string
  excludeIds: string[]
  canUse2300Slot: boolean
}): Promise<{ dateKey: string; timeSlot: keyof typeof SLOT_TIME } | null> {
  const { zoneId, startKey, endKey, excludeIds, canUse2300Slot } = params

  // Fetch all conflicts for this zone in the date range (all time slots)
  const conflicts = await prisma.schedule.findMany({
    where: {
      zoneId,
      id: { notIn: excludeIds },
      r1PlannedDate: {
        gte: dateKeyToDate(startKey),
        lte: dateKeyToDate(endKey, 23, 59),
      },
    },
    select: {
      id: true,
      r1PlannedDate: true,
      timeSlot: true,
    },
  })

  // Build a map of occupied slots: dateKey -> Set of occupied time slots
  const occupiedSlotsByDate = new Map<string, Set<string>>()
  conflicts.forEach((s) => {
    if (s.r1PlannedDate) {
      const dateKey = getHKTDateKey(new Date(s.r1PlannedDate))
      if (!occupiedSlotsByDate.has(dateKey)) {
        occupiedSlotsByDate.set(dateKey, new Set())
      }
      occupiedSlotsByDate.get(dateKey)!.add(s.timeSlot)
    }
  })

  // Define time slots to check (skip 23:00 if equipment can't use it)
  const slotsToCheck: Array<keyof typeof SLOT_TIME> = ['SLOT_0130', 'SLOT_0330']
  if (canUse2300Slot) {
    slotsToCheck.unshift('SLOT_2300') // Check 23:00 first if available
  }

  // Check each date, and for each date check all time slots
  let cursorKey = startKey
  while (compareHKTDateKeys(cursorKey, endKey) <= 0) {
    const occupiedSlots = occupiedSlotsByDate.get(cursorKey) || new Set()
    
    // Check if there's at least one empty slot on this date
    let firstEmptySlot: keyof typeof SLOT_TIME | null = null
    for (const slot of slotsToCheck) {
      if (!occupiedSlots.has(slot)) {
        firstEmptySlot = slot
        break
      }
    }
    
    // If there's at least one empty slot, use it
    if (firstEmptySlot) {
      return { dateKey: cursorKey, timeSlot: firstEmptySlot }
    } else {
      // No empty slot on this date - default to SLOT_0130 (1:30 AM)
      return { dateKey: cursorKey, timeSlot: 'SLOT_0130' }
    }
    
    cursorKey = addDaysToHKTDateKey(cursorKey, 1)
  }

  // If we've checked all dates and found nothing, return null
  return null
}

/**
 * POST /api/schedules/[id]/move
 * Move a schedule to a new date/time slot, optionally pushing the existing occupant forward
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

    const { newDate, newTimeSlot, swapWithScheduleId, allowInvalid2300Slot, targetDateStr } = validation.data
    
    // Use targetDateStr to create newDateObj for consistency
    let newDateObj: Date
    if (targetDateStr) {
      const { hour, minute } = SLOT_TIME[newTimeSlot]
      const [year, month, day] = targetDateStr.split('-').map(Number)
      newDateObj = createHKTDate(year, month, day, hour, minute)
    } else {
      newDateObj = new Date(newDate)
    }
    
    if (Number.isNaN(newDateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid date provided.' }, { status: 400 })
    }

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

    // Prevent moving completed or missed schedules
    if (scheduleToMove.status === 'COMPLETED' || scheduleToMove.status === 'MISSED') {
      return NextResponse.json(
        { error: 'Cannot move completed or missed schedules.' },
        { status: 400 }
      )
    }

    // SKIPPED, PENDING, and PLANNED schedules can be moved
    // PENDING schedules will be automatically skipped first, then rescheduled
    // PLANNED schedules can be moved without status change (just updating planned date)
    // Note: We allow all PLANNED items to be moved (not just future ones) since the calendar allows moving planned items
    const isPlanned = scheduleToMove.status === 'PLANNED'
    
    if (scheduleToMove.status !== 'SKIPPED' && scheduleToMove.status !== 'PENDING' && !isPlanned) {
      return NextResponse.json(
        { error: 'Only skipped, pending, or planned schedules can be moved. Current status: ' + scheduleToMove.status },
        { status: 400 }
      )
    }

    const requestedDateKey = targetDateStr ?? getHKTDateKey(newDateObj)
    const todayKey = getHKTTodayKey()
    const isPastDate = compareHKTDateKeys(requestedDateKey, todayKey) < 0

    console.error('[Schedule Move] DEBUG:', {
      scheduleId,
      scheduleStatus: scheduleToMove.status,
      requestedDateKey,
      todayKey,
      isPastDate,
      newTimeSlot,
      targetDateStr,
    })

    // If PENDING, first mark as SKIPPED (auto-skip), then reschedule
    // This combines the skip and reschedule steps into one operation
    // PLANNED items just update the date without status change
    // Note: These are used in both past and future date handling
    const wasPending = scheduleToMove.status === 'PENDING'
    const skippedCountIncrement = wasPending ? 1 : 0
    const lastSkippedDateValue = wasPending ? scheduleToMove.r1PlannedDate : scheduleToMove.lastSkippedDate

    // Handle past date moves - mark as completed
    if (isPastDate) {
      // Check what's in the target slot (same equipment, same date, same time slot)
      // Match by date key (day) and time slot, since r1PlannedDate stores full datetime
      const targetSlotStart = dateKeyToDate(requestedDateKey, 0, 0)
      const nextDayStart = addDaysToHKTDateKey(requestedDateKey, 1)
      const targetSlotEnd = dateKeyToDate(nextDayStart, 0, 0)
      
      console.log('[Schedule Move] Looking for target slot schedule:', {
        equipmentId: scheduleToMove.equipmentId,
        zoneId: scheduleToMove.zoneId,
        targetSlotStart: targetSlotStart.toISOString(),
        targetSlotEnd: targetSlotEnd.toISOString(),
        requestedDateKey,
        newTimeSlot,
        scheduleId,
      })

      // Query by zone, date, and time slot (not equipmentId) since we want to find ANY schedule in that slot
      // But we need to make sure it's for the same equipment OR handle the swap correctly
      // Actually, wait - if we're moving within the same calendar row (same equipment), the PENDING should be same equipment
      // But let's check both: same equipment first, then same zone as fallback
      let targetSlotSchedule = await prisma.schedule.findFirst({
        where: {
          equipmentId: scheduleToMove.equipmentId,
          r1PlannedDate: {
            gte: targetSlotStart,
            lt: targetSlotEnd,
          },
          timeSlot: newTimeSlot,
          id: { not: scheduleId },
        },
        include: {
          equipment: true,
        },
      })

      // If not found with same equipment, try same zone (in case of calendar display issue)
      if (!targetSlotSchedule) {
        targetSlotSchedule = await prisma.schedule.findFirst({
          where: {
            zoneId: scheduleToMove.zoneId,
            r1PlannedDate: {
              gte: targetSlotStart,
              lt: targetSlotEnd,
            },
            timeSlot: newTimeSlot,
            id: { not: scheduleId },
            status: { in: ['PENDING', 'COMPLETED'] }, // Only check for these statuses in past dates
          },
          include: {
            equipment: true,
          },
        })
      }

      console.log('[Schedule Move] Target slot schedule found:', {
        found: !!targetSlotSchedule,
        id: targetSlotSchedule?.id,
        status: targetSlotSchedule?.status,
        r1PlannedDate: targetSlotSchedule?.r1PlannedDate?.toISOString(),
        timeSlot: targetSlotSchedule?.timeSlot,
        equipmentNumber: targetSlotSchedule?.equipment?.equipmentNumber,
      })

      // Get original date for swap scenarios
      // Need to ensure we have a proper date with the correct time slot
      let originalDate: Date | null = null
      const originalTimeSlot = scheduleToMove.timeSlot
      
      if (scheduleToMove.r1PlannedDate) {
        originalDate = new Date(scheduleToMove.r1PlannedDate)
      } else if (scheduleToMove.r0PlannedDate) {
        // If no r1PlannedDate, use r0PlannedDate but apply the current timeSlot
        const r0Date = new Date(scheduleToMove.r0PlannedDate)
        const { hour, minute } = SLOT_TIME[originalTimeSlot]
        const year = r0Date.getFullYear()
        const month = r0Date.getMonth() + 1
        const day = r0Date.getDate()
        originalDate = createHKTDate(year, month, day, hour, minute)
      }

      if (!targetSlotSchedule) {
        // Case 1: Empty slot - mark as COMPLETED
        const updated = await prisma.schedule.update({
          where: { id: scheduleId },
          data: {
            r1PlannedDate: newDateObj,
            timeSlot: newTimeSlot,
            status: 'COMPLETED',
            completionDate: newDateObj,
            skippedCount: wasPending ? { increment: skippedCountIncrement } : undefined,
            lastSkippedDate: wasPending ? lastSkippedDateValue : undefined,
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
            completionDate: true,
          },
        })
        return NextResponse.json({ schedule: updated })
      } else if (targetSlotSchedule.status === 'PENDING') {
        // Case 2: PENDING slot - mark moved item as COMPLETED, swap PENDING to original slot as PLANNED
        if (!originalDate) {
          return NextResponse.json(
            { error: 'Cannot swap: original schedule has no planned date.' },
            { status: 400 }
          )
        }

        // Check if original date is in the future (required for PLANNED status)
        const originalDateKey = getHKTDateKey(originalDate)
        if (compareHKTDateKeys(originalDateKey, todayKey) < 0) {
          return NextResponse.json(
            { error: 'Cannot swap: original date is in the past. PENDING item cannot be moved to past date.' },
            { status: 400 }
          )
        }

        // Check if the original slot is already occupied (shouldn't happen, but safety check)
        const { hour, minute } = SLOT_TIME[originalTimeSlot]
        const originalYear = originalDate.getFullYear()
        const originalMonth = originalDate.getMonth() + 1
        const originalDay = originalDate.getDate()
        const originalDateWithSlot = createHKTDate(originalYear, originalMonth, originalDay, hour, minute)
        
        // Check for conflicts at the original slot (excluding the schedule we're moving and the one we're swapping)
        const originalSlotConflict = await prisma.schedule.findFirst({
          where: {
            equipmentId: scheduleToMove.equipmentId,
            r1PlannedDate: {
              gte: dateKeyToDate(originalDateKey, 0, 0),
              lt: dateKeyToDate(addDaysToHKTDateKey(originalDateKey, 1), 0, 0),
            },
            timeSlot: originalTimeSlot,
            id: { notIn: [scheduleId, targetSlotSchedule.id] },
          },
          include: {
            equipment: {
              select: {
                equipmentNumber: true,
              },
            },
          },
        })

        if (originalSlotConflict) {
          return NextResponse.json(
            { error: `Cannot swap: original slot is already occupied by ${originalSlotConflict.equipment.equipmentNumber}.` },
            { status: 400 }
          )
        }

        // Calculate isLate for swapped PENDING schedule
        let isLateSwap = false
        if (targetSlotSchedule.dueDate) {
          const scheduledDate = new Date(originalDateWithSlot)
          const dueDate = new Date(targetSlotSchedule.dueDate)
          scheduledDate.setHours(0, 0, 0, 0)
          dueDate.setHours(0, 0, 0, 0)
          const lateThreshold = new Date(dueDate)
          lateThreshold.setDate(lateThreshold.getDate() - 5)
          isLateSwap = scheduledDate >= lateThreshold
        }

        console.log('[Schedule Move] Swapping PENDING item:', {
          movingScheduleId: scheduleId,
          targetPendingScheduleId: targetSlotSchedule.id,
          targetPendingStatus: targetSlotSchedule.status,
          originalDateWithSlot: originalDateWithSlot.toISOString(),
          originalTimeSlot,
          newStatus: 'PLANNED',
        })

        try {
          const [updated1, updated2] = await prisma.$transaction([
            // Mark moved item as COMPLETED
            prisma.schedule.update({
              where: { id: scheduleId },
              data: {
                r1PlannedDate: newDateObj,
                timeSlot: newTimeSlot,
                status: 'COMPLETED',
                completionDate: newDateObj,
                skippedCount: wasPending ? { increment: skippedCountIncrement } : undefined,
                lastSkippedDate: wasPending ? lastSkippedDateValue : undefined,
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
                completionDate: true,
              },
            }),
            // Swap PENDING to original slot as PLANNED
            // Clear any PENDING-related state and set to PLANNED
            prisma.schedule.update({
              where: { id: targetSlotSchedule.id },
              data: {
                r1PlannedDate: originalDateWithSlot,
                timeSlot: originalTimeSlot,
                status: 'PLANNED',
                isLate: isLateSwap,
                // Ensure completionDate is cleared (shouldn't be set for PENDING, but just in case)
                completionDate: null,
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

          console.log('[Schedule Move] Swap successful:', {
            movedSchedule: { id: updated1.id, status: updated1.status, r1PlannedDate: updated1.r1PlannedDate },
            swappedSchedule: { id: updated2.id, status: updated2.status, r1PlannedDate: updated2.r1PlannedDate },
          })

          return NextResponse.json({
            movedSchedule: updated1,
            swappedSchedule: updated2,
          })
        } catch (error) {
          console.error('[Schedule Move] Transaction failed:', error)
          throw error
        }
      } else if (targetSlotSchedule.status === 'COMPLETED') {
        // Case 3: COMPLETED slot - mark moved item as COMPLETED, keep other unchanged
        // Both items stay in the same slot - no swap needed
        console.log('[Schedule Move] Moving to COMPLETED slot - keeping both items:', {
          movingScheduleId: scheduleId,
          targetCompletedScheduleId: targetSlotSchedule.id,
          targetSlotStatus: targetSlotSchedule.status,
        })
        
        const updated = await prisma.schedule.update({
          where: { id: scheduleId },
          data: {
            r1PlannedDate: newDateObj,
            timeSlot: newTimeSlot,
            status: 'COMPLETED',
            completionDate: newDateObj,
            skippedCount: wasPending ? { increment: skippedCountIncrement } : undefined,
            lastSkippedDate: wasPending ? lastSkippedDateValue : undefined,
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
            completionDate: true,
          },
        })
        return NextResponse.json({ schedule: updated })
      } else {
        // Other statuses in past date slot - shouldn't happen, but handle gracefully
        return NextResponse.json(
          { error: `Cannot move to past date: target slot has status ${targetSlotSchedule.status}. Only empty, PENDING, or COMPLETED slots are allowed.` },
          { status: 400 }
        )
      }
    }

    // Warn about 23:00 slot eligibility but allow if allowInvalid2300Slot is true
    if (
      newTimeSlot === 'SLOT_2300' &&
      !scheduleToMove.equipment.canUse2300Slot &&
      !allowInvalid2300Slot
    ) {
      return NextResponse.json(
        {
          error:
            'This equipment cannot be serviced at 23:00. Only equipment with the clock icon can be scheduled at 23:00.',
        },
        { status: 400 }
      )
    }

    // If there is a conflicting schedule (only for future dates - past dates handle conflicts themselves)
    let scheduleToConflict: any = null
    if (swapWithScheduleId && !isPastDate) {
      scheduleToConflict = await prisma.schedule.findUnique({
        where: { id: swapWithScheduleId },
        include: {
          equipment: true,
        },
      })

      if (!scheduleToConflict) {
        return NextResponse.json(
          { error: 'Schedule occupying the slot was not found.' },
          { status: 404 }
        )
      }
    }

    // Calculate isLate flag: r1PlannedDate >= dueDate - 5 days (same logic as at risk)
    // This means: scheduled less than 6 days before the due date
    let isLate = false
    if (scheduleToMove.dueDate) {
      const scheduledDate = new Date(newDateObj)
      const dueDate = new Date(scheduleToMove.dueDate)
      
      // Normalize to midnight for date comparison
      scheduledDate.setHours(0, 0, 0, 0)
      dueDate.setHours(0, 0, 0, 0)
      
      // Calculate dueDate - 5 days
      const lateThreshold = new Date(dueDate)
      lateThreshold.setDate(lateThreshold.getDate() - 5)
      
      // Late if scheduledDate >= dueDate - 5 days (scheduled less than 6 days before due date)
      isLate = scheduledDate >= lateThreshold
    }

    // Determine behavior: swap vs push-forward
    // - If moving schedule is PLANNED (has r1PlannedDate), swap positions
    // - If moving schedule is PENDING/SKIPPED/MISSED (being rescheduled), push forward
    // Note: Future slots can only be occupied by PLANNED items, so conflict will always be PLANNED
    const scheduleIsPlanned = scheduleToMove.status === 'PLANNED' && Boolean(scheduleToMove.r1PlannedDate)

    if (scheduleToConflict && scheduleIsPlanned) {
      // Swap scenario: both schedules are PLANNED, swap their positions
      const originalDate = new Date(scheduleToMove.r1PlannedDate!)

      // Calculate isLate for swapped schedule: r1PlannedDate >= dueDate - 5 days
      let isLateSwap = false
      if (scheduleToConflict.dueDate) {
        const scheduledDate = new Date(originalDate)
        const dueDate = new Date(scheduleToConflict.dueDate)
        
        // Normalize to midnight for date comparison
        scheduledDate.setHours(0, 0, 0, 0)
        dueDate.setHours(0, 0, 0, 0)
        
        // Calculate dueDate - 5 days
        const lateThreshold = new Date(dueDate)
        lateThreshold.setDate(lateThreshold.getDate() - 5)
        
        // Late if scheduledDate >= dueDate - 5 days
        isLateSwap = scheduledDate >= lateThreshold
      }

      const [updated1, updated2] = await prisma.$transaction([
        prisma.schedule.update({
          where: { id: scheduleId },
          data: {
            r1PlannedDate: newDateObj,
            timeSlot: newTimeSlot,
            status: 'PLANNED',
            isLate,
            skippedCount: wasPending ? { increment: skippedCountIncrement } : undefined,
            lastSkippedDate: wasPending ? lastSkippedDateValue : undefined,
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
          where: { id: scheduleToConflict.id },
          data: {
            r1PlannedDate: originalDate,
            timeSlot: scheduleToMove.timeSlot,
            status: scheduleToConflict.status,
            isLate: isLateSwap,
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
    }

    // Push-forward scenario
    let pushedScheduleNextKey: string | null = null
    let pushedScheduleDate: Date | null = null
    let pushedScheduleTimeSlot: keyof typeof SLOT_TIME | null = null
    let pushedScheduleIsLate = false

    if (scheduleToConflict) {
      const startKey = addDaysToHKTDateKey(requestedDateKey, 1)
      let endKey = scheduleToConflict.dueDate
        ? getHKTDateKey(new Date(scheduleToConflict.dueDate))
        : addDaysToHKTDateKey(startKey, MAX_PUSH_WINDOW_DAYS)

      if (compareHKTDateKeys(startKey, endKey) > 0) {
        endKey = startKey
      }

      const nextSlot = await findNextAvailableSlot({
        zoneId: scheduleToConflict.zoneId,
        startKey,
        endKey,
        excludeIds: [scheduleId, scheduleToConflict.id],
        canUse2300Slot: scheduleToConflict.equipment.canUse2300Slot,
      })

      if (!nextSlot) {
        return NextResponse.json(
          {
            error:
              'The next available slot for the existing work order could not be found before its deadline. Please free up capacity manually.',
          },
          { status: 400 }
        )
      }

      const slotTime = SLOT_TIME[nextSlot.timeSlot]
      pushedScheduleDate = dateKeyToDate(nextSlot.dateKey, slotTime.hour, slotTime.minute)
      pushedScheduleNextKey = nextSlot.dateKey
      pushedScheduleTimeSlot = nextSlot.timeSlot

      // Calculate isLate for pushed schedule: r1PlannedDate >= dueDate - 5 days
      if (scheduleToConflict.dueDate && pushedScheduleDate) {
        const scheduledDate = new Date(pushedScheduleDate)
        const dueDate = new Date(scheduleToConflict.dueDate)
        
        // Normalize to midnight for date comparison
        scheduledDate.setHours(0, 0, 0, 0)
        dueDate.setHours(0, 0, 0, 0)
        
        // Calculate dueDate - 5 days
        const lateThreshold = new Date(dueDate)
        lateThreshold.setDate(lateThreshold.getDate() - 5)
        
        // Late if scheduledDate >= dueDate - 5 days
        pushedScheduleIsLate = scheduledDate >= lateThreshold
      } else {
        pushedScheduleIsLate = scheduleToConflict.isLate ?? false
      }
    }

    const operations: any[] = [
      prisma.schedule.update({
        where: { id: scheduleId },
        data: {
          r1PlannedDate: newDateObj,
          timeSlot: newTimeSlot,
          status: 'PLANNED',
          isLate,
          skippedCount: wasPending ? { increment: skippedCountIncrement } : undefined,
          lastSkippedDate: wasPending ? lastSkippedDateValue : undefined,
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
    ]

    if (scheduleToConflict && pushedScheduleDate && pushedScheduleTimeSlot) {
      operations.push(
        prisma.schedule.update({
          where: { id: scheduleToConflict.id },
          data: {
            r1PlannedDate: pushedScheduleDate,
            timeSlot: pushedScheduleTimeSlot,
            status: scheduleToConflict.status === 'SKIPPED' ? 'PLANNED' : scheduleToConflict.status,
            isLate: pushedScheduleIsLate,
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
      )
    }

    const results = await prisma.$transaction(operations)

    if (results.length === 2) {
      return NextResponse.json({
        movedSchedule: results[0],
        pushedSchedule: results[1],
        pushedToDate: pushedScheduleNextKey,
      })
    }

    return NextResponse.json({ schedule: results[0] })
  } catch (error) {
    console.error('[Schedule Move] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

