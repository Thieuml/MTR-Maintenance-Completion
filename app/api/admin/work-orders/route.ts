import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const workOrderSchema = z.object({
  workOrderNumber: z.string(),
  equipmentId: z.string(),
  date: z.string().datetime().or(z.date()),
})

/**
 * GET /api/admin/work-orders
 * List work orders
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const equipmentId = searchParams.get('equipmentId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: any = {}
    if (equipmentId) where.equipmentId = equipmentId
    if (from || to) {
      where.r1PlannedDate = {}
      if (from) where.r1PlannedDate.gte = new Date(from)
      if (to) where.r1PlannedDate.lte = new Date(to)
    }

    const schedules = await prisma.schedule.findMany({
      where: {
        ...where,
        workOrderNumber: { not: null },
      },
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
            code: true,
            name: true,
          },
        },
      },
      orderBy: {
        r1PlannedDate: 'desc',
      },
    })

    return NextResponse.json({ workOrders: schedules })
  } catch (error) {
    console.error('[Work Orders GET] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/work-orders
 * Assign work order to equipment/date
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = workOrderSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { workOrderNumber, equipmentId, date } = validation.data
    const scheduleDate = typeof date === 'string' ? new Date(date) : date

    // Find or create schedule for this equipment and date
    const schedule = await prisma.schedule.findFirst({
      where: {
        equipmentId,
        r1PlannedDate: {
          gte: new Date(scheduleDate.setHours(0, 0, 0, 0)),
          lt: new Date(scheduleDate.setHours(23, 59, 59, 999)),
        },
      },
    })

    if (schedule) {
      // Update existing schedule
      const updated = await prisma.schedule.update({
        where: { id: schedule.id },
        data: { workOrderNumber },
        include: {
          equipment: {
            select: {
              id: true,
              equipmentNumber: true,
            },
          },
        },
      })
      return NextResponse.json({ schedule: updated })
    } else {
      // Create new schedule (requires equipment mapping)
      const equipment = await prisma.equipment.findUnique({
        where: { id: equipmentId },
        include: {
          zoneMapping: true,
        },
      })

      if (!equipment) {
        return NextResponse.json(
          { error: 'Equipment not found' },
          { status: 404 }
        )
      }

      if (!equipment.zoneMapping) {
        return NextResponse.json(
          { error: 'Equipment must be mapped to a zone and week first' },
          { status: 400 }
        )
      }

      // Calculate dates
      const r0PlannedDate = new Date(scheduleDate)
      r0PlannedDate.setHours(0, 0, 0, 0)
      const r1PlannedDate = new Date(scheduleDate)
      r1PlannedDate.setHours(0, 0, 0, 0)
      const dueDate = new Date(r0PlannedDate)
      dueDate.setDate(dueDate.getDate() + 14)

      const newSchedule = await prisma.schedule.create({
        data: {
          equipmentId,
          zoneId: equipment.zoneId,
          r0PlannedDate,
          r1PlannedDate,
          dueDate,
          batch: equipment.zoneMapping.batch,
          timeSlot: 'SLOT_0130', // Default
          workOrderNumber,
          status: 'PLANNED',
        },
        include: {
          equipment: {
            select: {
              id: true,
              equipmentNumber: true,
            },
          },
        },
      })

      return NextResponse.json({ schedule: newSchedule }, { status: 201 })
    }
  } catch (error) {
    console.error('[Work Orders POST] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

