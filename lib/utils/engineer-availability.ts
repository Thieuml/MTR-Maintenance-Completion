/**
 * Engineer availability utilities
 * Check if engineers are available for assignment
 */

import { prisma } from '@/lib/prisma'

/**
 * Check if engineer is available for a specific date/time
 * 
 * @param engineerId - Engineer ID
 * @param date - Date to check
 * @param timeSlot - Time slot (SLOT_2300, SLOT_0130, SLOT_0330)
 * @returns { available: boolean, reason?: string, conflictingSchedule?: any }
 */
export async function checkEngineerAvailability(
  engineerId: string,
  date: Date,
  timeSlot: 'SLOT_2300' | 'SLOT_0130' | 'SLOT_0330'
): Promise<{ available: boolean; reason?: string; conflictingSchedule?: any }> {
  // Get time slot hours
  const slotHours = {
    SLOT_2300: { start: 23, end: 1 }, // 23:00 to 01:00 next day
    SLOT_0130: { start: 1, end: 3 },  // 01:30 to 03:30
    SLOT_0330: { start: 3, end: 5 }, // 03:30 to 05:30
  }

  const slot = slotHours[timeSlot]
  
  // Calculate start and end times for the schedule
  const startTime = new Date(date)
  startTime.setHours(slot.start, slot.start === 23 ? 0 : 30, 0, 0)
  
  const endTime = new Date(date)
  if (slot.end < slot.start) {
    // Next day
    endTime.setDate(endTime.getDate() + 1)
  }
  endTime.setHours(slot.end, slot.end === 1 ? 30 : 30, 0, 0)

  // Check for conflicting schedules (fixed or rotating engineer)
  const conflictingSchedules = await prisma.schedule.findMany({
    where: {
      OR: [
        { fixedEngineerId: engineerId },
        { rotatingEngineerId: engineerId },
      ],
      r1PlannedDate: {
        gte: new Date(startTime.getTime() - 2 * 60 * 60 * 1000), // 2 hours before
        lte: new Date(endTime.getTime() + 2 * 60 * 60 * 1000),   // 2 hours after
      },
      status: {
        notIn: ['CANCELLED'],
      },
    },
    include: {
      equipment: {
        select: {
          equipmentNumber: true,
        },
      },
    },
  })

  if (conflictingSchedules.length > 0) {
    return {
      available: false,
      reason: `Engineer has conflicting schedule(s)`,
      conflictingSchedule: conflictingSchedules[0],
    }
  }

  // Check workload - max 3 units per night
  const nightStart = new Date(date)
  nightStart.setHours(0, 0, 0, 0)
  const nightEnd = new Date(date)
  nightEnd.setHours(23, 59, 59, 999)
  
  const sameNightSchedules = await prisma.schedule.findMany({
    where: {
      OR: [
        { fixedEngineerId: engineerId },
        { rotatingEngineerId: engineerId },
      ],
      r1PlannedDate: {
        gte: nightStart,
        lte: nightEnd,
      },
      status: {
        notIn: ['CANCELLED'],
      },
    },
  })

  if (sameNightSchedules.length >= 3) {
    return {
      available: false,
      reason: `Engineer already has ${sameNightSchedules.length} schedules for this night (max 3)`,
    }
  }

  return { available: true }
}

/**
 * Get engineer workload for a date range
 */
export async function getEngineerWorkload(
  engineerId: string,
  from: Date,
  to: Date
): Promise<{
  totalSchedules: number
  schedules: any[]
  byDate: Map<string, number>
}> {
  const schedules = await prisma.schedule.findMany({
    where: {
      OR: [
        { fixedEngineerId: engineerId },
        { rotatingEngineerId: engineerId },
      ],
      r1PlannedDate: {
        gte: from,
        lte: to,
      },
      status: {
        notIn: ['CANCELLED'],
      },
    },
    include: {
      equipment: {
        select: {
          equipmentNumber: true,
        },
      },
      zone: {
        select: {
          code: true,
          name: true,
        },
      },
    },
    orderBy: {
      r1PlannedDate: 'asc',
    },
  })

  // Group by date
  const byDate = new Map<string, number>()
  schedules.forEach(schedule => {
    const dateKey = schedule.r1PlannedDate.toISOString().split('T')[0]
    byDate.set(dateKey, (byDate.get(dateKey) || 0) + 1)
  })

  return {
    totalSchedules: schedules.length,
    schedules,
    byDate,
  }
}

