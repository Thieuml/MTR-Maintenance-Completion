import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createWorkOrderSchema = z.object({
  equipmentNumber: z.string(),
  workOrderNumber: z.string(),
  wmPlannedDate: z.string(), // ISO date string
  mtrPlannedStartDate: z.string().optional().nullable(),
  mtrPlannedCompletionDate: z.string(), // ISO date string
})

/**
 * POST /api/admin/work-orders/create
 * Create a single work order manually
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = createWorkOrderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { equipmentNumber, workOrderNumber, wmPlannedDate, mtrPlannedStartDate, mtrPlannedCompletionDate } = validation.data

    // Check if WO already exists
    const existingSchedule = await prisma.schedule.findUnique({
      where: { workOrderNumber },
    })

    if (existingSchedule) {
      return NextResponse.json(
        { error: `Work Order ${workOrderNumber} already exists` },
        { status: 400 }
      )
    }

    // Find equipment and validate it's ready for Work Orders
    const equipment = await prisma.equipment.findUnique({
      where: { equipmentNumber },
      include: {
        zoneMapping: {
          include: {
            zone: true,
          },
        },
      },
    })

    if (!equipment) {
      return NextResponse.json(
        { error: `Equipment ${equipmentNumber} not found` },
        { status: 404 }
      )
    }

    if (!equipment.zoneMapping || !equipment.zoneMapping.zoneId || !equipment.zoneMapping.batch) {
      return NextResponse.json(
        { error: `Equipment ${equipmentNumber} is not ready for Work Orders (missing zone/batch mapping)` },
        { status: 400 }
      )
    }

    // Parse dates
    let wmPlannedDateObj: Date
    let mtrPlannedDateObj: Date | null = null
    let dueDateObj: Date

    try {
      wmPlannedDateObj = new Date(wmPlannedDate)
      if (isNaN(wmPlannedDateObj.getTime())) {
        throw new Error('Invalid WM Planned Date')
      }

      if (mtrPlannedStartDate) {
        mtrPlannedDateObj = new Date(mtrPlannedStartDate)
        if (isNaN(mtrPlannedDateObj.getTime())) {
          mtrPlannedDateObj = null
        }
      }

      dueDateObj = new Date(mtrPlannedCompletionDate)
      if (isNaN(dueDateObj.getTime())) {
        throw new Error('Invalid MTR Planned Completion Date')
      }
    } catch (error) {
      return NextResponse.json(
        { error: `Invalid date format: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 400 }
      )
    }

    // Determine time slot based on equipment eligibility
    const timeSlot = equipment.canUse2300Slot ? 'SLOT_2300' : 'SLOT_0130'

    // Create schedule
    const schedule = await prisma.schedule.create({
      data: {
        equipmentId: equipment.id,
        zoneId: equipment.zoneMapping.zoneId,
        r0PlannedDate: wmPlannedDateObj,
        r1PlannedDate: wmPlannedDateObj,
        dueDate: dueDateObj,
        batch: equipment.zoneMapping.batch,
        timeSlot: timeSlot,
        workOrderNumber: workOrderNumber,
        mtrPlannedStartDate: mtrPlannedDateObj,
        status: 'PLANNED',
      },
      include: {
        equipment: {
          select: {
            equipmentNumber: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        schedule,
        message: `Work order ${workOrderNumber} created successfully`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[Work Order Create] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

