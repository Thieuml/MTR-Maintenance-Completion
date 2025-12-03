/**
 * Schedule utility functions
 * Business logic for schedule management
 */

import { ScheduleBatch, TimeSlot } from '@prisma/client'

/**
 * Calculate due date from R0 planned date (R0 + 14 days)
 */
export function calculateDueDate(r0PlannedDate: Date): Date {
  const dueDate = new Date(r0PlannedDate)
  dueDate.setDate(dueDate.getDate() + 14)
  return dueDate
}


/**
 * Get time slot enum from hour and minute
 */
export function getTimeSlotFromTime(hour: number, minute: number): TimeSlot {
  if (hour === 23 && minute === 0) {
    return 'SLOT_2300'
  } else if (hour === 1 && minute === 30) {
    return 'SLOT_0130'
  } else if (hour === 3 && minute === 30) {
    return 'SLOT_0330'
  }
  // Default to 1:30 if not matching
  return 'SLOT_0130'
}

/**
 * Get hour and minute from time slot enum
 */
export function getTimeFromSlot(timeSlot: TimeSlot): { hour: number; minute: number } {
  switch (timeSlot) {
    case 'SLOT_2300':
      return { hour: 23, minute: 0 }
    case 'SLOT_0130':
      return { hour: 1, minute: 30 }
    case 'SLOT_0330':
      return { hour: 3, minute: 30 }
    default:
      return { hour: 1, minute: 30 }
  }
}

/**
 * Determine batch (A or B) based on date
 * Alternates every 2 weeks
 */
export function determineBatch(date: Date, startDate?: Date): ScheduleBatch {
  if (!startDate) {
    // Default: use epoch or a fixed start date
    startDate = new Date('2025-01-01')
  }

  const daysSinceStart = Math.floor(
    (date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
  )

  // Alternate every 2 weeks (14 days)
  const batchNumber = Math.floor(daysSinceStart / 14) % 2
  return batchNumber === 0 ? 'A' : 'B'
}

/**
 * Check if equipment can use 23:00 time slot
 * Only units with canUse2300Slot flag are allowed at 23:00
 */
export async function canUse2300Slot(equipmentId: string): Promise<boolean> {
  const { prisma } = await import('@/lib/prisma')
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { canUse2300Slot: true },
  })
  return equipment?.canUse2300Slot || false
}

/**
 * Check if a schedule is "At Risk" of not being completed on time
 * Criteria: r1PlannedDate >= dueDate - 5 days
 * Only applies to PLANNED items (not SKIPPED/MISSED/COMPLETED)
 * 
 * @param r1PlannedDate - The scheduled date (r1PlannedDate)
 * @param dueDate - The due date (deadline)
 * @param status - The schedule status
 * @returns true if the schedule is at risk
 */
export function isAtRisk(
  r1PlannedDate: Date | string | null,
  dueDate: Date | string | null,
  status: string
): boolean {
  // Only PLANNED items can be at risk
  if (status !== 'PLANNED') {
    return false
  }

  // Need both dates to calculate
  if (!r1PlannedDate || !dueDate) {
    return false
  }

  const scheduleDate = typeof r1PlannedDate === 'string' ? new Date(r1PlannedDate) : r1PlannedDate
  const deadline = typeof dueDate === 'string' ? new Date(dueDate) : dueDate

  // Normalize to midnight for date comparison
  scheduleDate.setHours(0, 0, 0, 0)
  deadline.setHours(0, 0, 0, 0)

  // Calculate dueDate - 5 days
  const riskThreshold = new Date(deadline)
  riskThreshold.setDate(riskThreshold.getDate() - 5)

  // At risk if scheduleDate >= dueDate - 5 days
  return scheduleDate >= riskThreshold
}

