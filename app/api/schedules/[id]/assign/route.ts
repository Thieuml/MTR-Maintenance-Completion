import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assignEngineerSchema } from '@/lib/validations/assignment'
import { checkEngineerAvailability } from '@/lib/utils/engineer-availability'

/**
 * POST /api/schedules/[id]/assign
 * Assign an engineer to a schedule
 * 
 * Role can be 'fixed' (must have CP & RW certs) or 'rotating'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = assignEngineerSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { engineerId, role } = validation.data

    // Check if schedule exists
    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: {
        equipment: true,
        fixedEngineer: true,
        rotatingEngineer: true,
      },
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Check if engineer exists
    const engineer = await prisma.engineer.findUnique({
      where: { id: engineerId },
    })

    if (!engineer) {
      return NextResponse.json(
        { error: 'Engineer not found' },
        { status: 404 }
      )
    }

    if (!engineer.active) {
      return NextResponse.json(
        { error: 'Engineer is not active' },
        { status: 400 }
      )
    }

    // Validate fixed engineer has CP & RW certificates
    if (role === 'fixed') {
      if (!engineer.hasCPCert || !engineer.hasRWCert) {
        return NextResponse.json(
          {
            error: 'Fixed engineer must have CP and RW certificates',
            engineer: engineer.name,
            hasCPCert: engineer.hasCPCert,
            hasRWCert: engineer.hasRWCert,
          },
          { status: 400 }
        )
      }
    }

    // Check engineer availability
    if (!schedule.r1PlannedDate) {
      return NextResponse.json(
        { error: 'Schedule does not have a planned date' },
        { status: 400 }
      )
    }
    
    const availability = await checkEngineerAvailability(
      engineerId,
      schedule.r1PlannedDate,
      schedule.timeSlot
    )

    if (!availability.available) {
      return NextResponse.json(
        {
          error: 'Engineer not available',
          reason: availability.reason,
          conflictingSchedule: availability.conflictingSchedule,
        },
        { status: 400 }
      )
    }

    // Update schedule with engineer assignment
    const updateData: any = {}
    
    if (role === 'fixed') {
      updateData.fixedEngineerId = engineerId
    } else {
      updateData.rotatingEngineerId = engineerId
    }

    // Status remains as is when assigning engineers
    // (No need to change status)

    const updatedSchedule = await prisma.schedule.update({
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
            hasCPCert: true,
            hasRWCert: true,
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

    return NextResponse.json({
      schedule: updatedSchedule,
      message: `Engineer ${engineer.name} assigned as ${role} engineer`,
    })
  } catch (error) {
    console.error('[Assign Engineer] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

