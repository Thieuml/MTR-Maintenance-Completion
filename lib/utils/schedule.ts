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
 * Validate 14-day cycle constraint
 * Checks if the new schedule date is within 14 days of the previous schedule
 * 
 * @param equipmentId - Equipment ID
 * @param newR1Date - New R1 planned date
 * @param excludeScheduleId - Schedule ID to exclude from check (for updates)
 * @returns { valid: boolean, error?: string, previousSchedule?: any }
 */
export async function validate14DayCycle(
  equipmentId: string,
  newR1Date: Date,
  excludeScheduleId?: string
): Promise<{ valid: boolean; error?: string; previousSchedule?: any }> {
  const { prisma } = await import('@/lib/prisma')

  // Find the most recent schedule for this equipment
  const previousSchedule = await prisma.schedule.findFirst({
    where: {
      equipmentId,
      id: excludeScheduleId ? { not: excludeScheduleId } : undefined,
    },
    orderBy: {
      r1PlannedDate: 'desc',
    },
  })

  if (!previousSchedule) {
    // No previous schedule - always valid
    return { valid: true }
  }

  // Calculate days between previous and new schedule
  const daysDiff = Math.abs(
    Math.floor((newR1Date.getTime() - previousSchedule.r1PlannedDate.getTime()) / (24 * 60 * 60 * 1000))
  )

  if (daysDiff > 14) {
    return {
      valid: false,
      error: `Schedule violates 14-day cycle constraint. Previous schedule was ${daysDiff} days ago (max 14 days).`,
      previousSchedule,
    }
  }

  return { valid: true, previousSchedule }
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
 * Alternates every 14 days
 */
export function determineBatch(date: Date, startDate?: Date): ScheduleBatch {
  if (!startDate) {
    // Default: use epoch or a fixed start date
    startDate = new Date('2025-01-01')
  }

  const daysSinceStart = Math.floor(
    (date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
  )

  // Alternate every 14 days
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

