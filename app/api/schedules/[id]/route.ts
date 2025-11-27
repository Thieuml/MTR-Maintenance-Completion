import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateScheduleSchema } from '@/lib/validations/schedule'
import { calculateDueDate } from '@/lib/utils/schedule'

/**
 * GET /api/schedules/[id]
 * Get a single schedule with all related data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
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
        reschedules: {
          orderBy: {
            createdAt: 'desc',
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

    return NextResponse.json({ schedule })
  } catch (error) {
    console.error('[Schedule GET] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/schedules/[id]
 * Update a schedule
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if schedule exists
    const existing = await prisma.schedule.findUnique({
      where: { id: params.id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    const body = await request.json()

    // Validate request body
    const validation = updateScheduleSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const data = validation.data
    const updateData: any = {}

    // Update R1 date if provided
    if (data.r1PlannedDate !== undefined) {
      const r1PlannedDate = typeof data.r1PlannedDate === 'string'
        ? new Date(data.r1PlannedDate)
        : data.r1PlannedDate

      updateData.r1PlannedDate = r1PlannedDate
    }

    // Update other fields
    if (data.batch !== undefined) {
      updateData.batch = data.batch
    }
    if (data.timeSlot !== undefined) {
      updateData.timeSlot = data.timeSlot
    }
    if (data.fixedEngineerId !== undefined) {
      // Validate fixed engineer has certificates
      if (data.fixedEngineerId) {
        const fixedEngineer = await prisma.engineer.findUnique({
          where: { id: data.fixedEngineerId },
        })

        if (!fixedEngineer) {
          return NextResponse.json(
            { error: 'Fixed engineer not found' },
            { status: 404 }
          )
        }

        if (!fixedEngineer.hasCPCert || !fixedEngineer.hasRWCert) {
          return NextResponse.json(
            {
              error: 'Fixed engineer must have CP and RW certificates',
            },
            { status: 400 }
          )
        }
      }
      updateData.fixedEngineerId = data.fixedEngineerId
    }
    if (data.rotatingEngineerId !== undefined) {
      updateData.rotatingEngineerId = data.rotatingEngineerId
    }
    if (data.workOrderNumber !== undefined) {
      // Check for duplicate OR number
      if (data.workOrderNumber) {
        const duplicate = await prisma.schedule.findFirst({
          where: {
            workOrderNumber: data.workOrderNumber,
            id: { not: params.id },
          },
        })
        if (duplicate) {
          return NextResponse.json(
            { error: `Work order number ${data.workOrderNumber} already exists` },
            { status: 400 }
          )
        }
      }
      updateData.workOrderNumber = data.workOrderNumber
    }
    if (data.status !== undefined) {
      updateData.status = data.status
    }

    // Update schedule
    const schedule = await prisma.schedule.update({
      where: { id: params.id },
      data: updateData,
      include: {
        equipment: {
          select: {
            id: true,
            equipmentNumber: true,
            name: true,
            type: true,
          },
        },
        zone: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        fixedEngineer: {
          select: {
            id: true,
            name: true,
          },
        },
        rotatingEngineer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({ schedule })
  } catch (error) {
    console.error('[Schedule PUT] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/schedules/[id]
 * Delete a schedule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if schedule exists
    const existing = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: {
        visits: true,
        reschedules: true,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Check if schedule has visits or reschedules
    if (existing.visits.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete schedule with existing visits',
          visitsCount: existing.visits.length,
        },
        { status: 400 }
      )
    }

    // Delete schedule
    await prisma.schedule.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: 'Schedule deleted successfully',
    })
  } catch (error) {
    console.error('[Schedule DELETE] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

