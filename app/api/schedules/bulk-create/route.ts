import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bulkCreateScheduleSchema } from '@/lib/validations/schedule'
import { calculateDueDate, determineBatch, getTimeSlotFromTime } from '@/lib/utils/schedule'
import { createHKTDate } from '@/lib/utils/timezone'
import { generateDummyORNumbers } from '@/lib/utils/or-numbers'

/**
 * POST /api/schedules/bulk-create
 * Generate schedules for multiple equipment over a date range
 * 
 * Creates schedules with:
 * - 14-day intervals
 * - A/B batch alternation
 * - Time slot assignment
 * - Auto-generated OR numbers (if not provided)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = bulkCreateScheduleSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const data = validation.data

    // Convert date strings to Date objects
    const startDate = typeof data.startDate === 'string'
      ? new Date(data.startDate)
      : data.startDate
    const endDate = typeof data.endDate === 'string'
      ? new Date(data.endDate)
      : data.endDate

    // Validate date range
    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      )
    }

    // Validate equipment exists
    const equipment = await prisma.equipment.findMany({
      where: {
        id: { in: data.equipmentIds },
        active: true,
      },
      include: {
        zone: true,
      },
    })

    if (equipment.length !== data.equipmentIds.length) {
      const foundIds = equipment.map(e => e.id)
      const missingIds = data.equipmentIds.filter(id => !foundIds.includes(id))
      return NextResponse.json(
        {
          error: 'Some equipment not found',
          missingIds,
        },
        { status: 404 }
      )
    }

    // Calculate total number of schedules to create (estimate)
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
    const schedulesPerEquipment = Math.ceil(daysDiff / 14)
    const totalSchedules = equipment.length * schedulesPerEquipment

    // Generate OR numbers if not provided (one per schedule)
    let workOrderNumbers = data.workOrderNumbers || generateDummyORNumbers(totalSchedules)

    if (workOrderNumbers.length < totalSchedules) {
      // Generate more if needed
      const additional = generateDummyORNumbers(totalSchedules - workOrderNumbers.length)
      workOrderNumbers.push(...additional)
    }

    let orNumberIndex = 0

    const schedulesToCreate: any[] = []
    const errors: string[] = []

    // For each equipment, generate schedules every 14 days
    for (let i = 0; i < equipment.length; i++) {
      const eq = equipment[i]
      let currentDate = new Date(startDate)
      let batchCounter = 0

      // Determine starting batch
      const startBatch = data.batch || determineBatch(startDate)

      while (currentDate <= endDate) {
        try {
          // Calculate R0 date (same as R1 for new schedules, or use a base date)
          // For bulk create, we'll use R1 as the base
          const r0PlannedDate = new Date(currentDate)
          const r1PlannedDate = new Date(currentDate)
          const dueDate = calculateDueDate(r0PlannedDate)

          // Determine batch (alternate A/B every 14 days)
          const batch = data.batch || determineBatch(currentDate, startDate)

          // Determine time slot
          // Default to provided time slot, or rotate: 23:00, 1:30, 3:30
          let timeSlot = data.defaultTimeSlot || 'SLOT_0130'
          if (!data.defaultTimeSlot) {
            // Rotate time slots: 0=23:00, 1=1:30, 2=3:30
            const slotIndex = batchCounter % 3
            if (slotIndex === 0) timeSlot = 'SLOT_2300'
            else if (slotIndex === 1) timeSlot = 'SLOT_0130'
            else timeSlot = 'SLOT_0330'
          }

          // Check if schedule already exists for this equipment and date
          const existing = await prisma.schedule.findFirst({
            where: {
              equipmentId: eq.id,
              r1PlannedDate: {
                gte: new Date(currentDate.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day before
                lte: new Date(currentDate.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day after
              },
            },
          })

          if (!existing) {
            // Calculate isLate flag: r1PlannedDate >= dueDate - 5 days (same logic as at risk)
            const scheduledDate = new Date(r1PlannedDate)
            const dueDateObj = new Date(dueDate)
            scheduledDate.setHours(0, 0, 0, 0)
            dueDateObj.setHours(0, 0, 0, 0)
            const lateThreshold = new Date(dueDateObj)
            lateThreshold.setDate(lateThreshold.getDate() - 5)
            const isLate = scheduledDate >= lateThreshold

            schedulesToCreate.push({
              equipmentId: eq.id,
              zoneId: eq.zoneId,
              r0PlannedDate,
              r1PlannedDate,
              dueDate,
              batch,
              timeSlot,
              workOrderNumber: workOrderNumbers[orNumberIndex] || generateDummyORNumbers(1)[0],
              status: 'PLANNED',
              isLate: isLate,
            })
            orNumberIndex++
          }

          // Move to next 14-day interval
          currentDate = new Date(currentDate)
          currentDate.setDate(currentDate.getDate() + 14)
          batchCounter++
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          errors.push(`Failed to create schedule for ${eq.equipmentNumber} on ${currentDate.toISOString()}: ${errorMsg}`)
        }
      }
    }

    // Create schedules in bulk
    const created = await prisma.schedule.createMany({
      data: schedulesToCreate,
      skipDuplicates: true, // Skip if duplicate work order number
    })

    console.log(`[Bulk Create] Created ${created.count} schedules`)

    return NextResponse.json({
      success: true,
      created: created.count,
      totalRequested: schedulesToCreate.length,
      errors: errors.length > 0 ? errors : undefined,
      schedules: schedulesToCreate.slice(0, 10), // Return first 10 as sample
    }, { status: 201 })
  } catch (error) {
    console.error('[Bulk Create] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

