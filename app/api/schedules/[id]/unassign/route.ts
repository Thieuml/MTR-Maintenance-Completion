import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { unassignEngineerSchema } from '@/lib/validations/assignment'

/**
 * POST /api/schedules/[id]/unassign
 * Unassign an engineer from a schedule
 * 
 * Can unassign:
 * - Fixed engineer (role: 'fixed')
 * - Rotating engineer (role: 'rotating')
 * - All engineers (role: 'all' or omit engineerId)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}))
    
    // Validate request body (all fields optional)
    const validation = unassignEngineerSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { role } = validation.data

    // Check if schedule exists
    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id },
      include: {
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

    const updateData: any = {}

    // Determine what to unassign
    if (role === 'all' || (!body.engineerId && !body.role)) {
      // Unassign all engineers
      updateData.fixedEngineerId = null
      updateData.rotatingEngineerId = null
      
      // If no engineers assigned, set status back to PLANNED
      if (!schedule.fixedEngineerId && !schedule.rotatingEngineerId) {
        // Already unassigned
      } else if (schedule.status === 'PLANNED' || schedule.status === 'IN_PROGRESS') {
        // Keep status as is when unassigning
      }
    } else if (role === 'fixed') {
      // Unassign fixed engineer only
      updateData.fixedEngineerId = null
      
      // If no engineers left, status remains as is
      // (No need to change status when unassigning)
    } else if (role === 'rotating') {
      // Unassign rotating engineer only
      updateData.rotatingEngineerId = null
      
      // If no engineers left, status remains as is
      // (No need to change status when unassigning)
    }

    // Update schedule
    const updatedSchedule = await prisma.schedule.update({
      where: { id: params.id },
      data: updateData,
      include: {
        equipment: {
          select: {
            id: true,
            equipmentNumber: true,
            name: true,
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

    return NextResponse.json({
      schedule: updatedSchedule,
      message: `Engineer(s) unassigned successfully`,
    })
  } catch (error) {
    console.error('[Unassign Engineer] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

