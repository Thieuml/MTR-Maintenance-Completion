import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scheduleQuerySchema, createScheduleSchema } from '@/lib/validations/schedule'
import { calculateDueDate, getTimeFromSlot } from '@/lib/utils/schedule'
import { createHKTDate } from '@/lib/utils/timezone'
import { generateDummyORNumber } from '@/lib/utils/or-numbers'

/**
 * GET /api/schedules
 * List schedules with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = {
      zoneId: searchParams.get('zoneId') || undefined,
      equipmentId: searchParams.get('equipmentId') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      status: searchParams.get('status') || undefined,
      batch: searchParams.get('batch') || undefined,
    }

    // Validate query parameters
    const validation = scheduleQuerySchema.safeParse(query)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { zoneId, equipmentId, from, to, status, batch } = validation.data

    // Check if visits should be included (default: true for backward compatibility)
    const includeVisits = searchParams.get('includeVisits') !== 'false'

    // Build where clause
    const where: any = {}

    if (zoneId) {
      where.zoneId = zoneId
    }

    if (equipmentId) {
      where.equipmentId = equipmentId
    }

    // Exclude CANCELLED schedules by default (unless explicitly requested)
    if (!status) {
      where.status = { not: 'CANCELLED' }
    }

    // Only filter by r1PlannedDate if dates are provided AND status is not SKIPPED/MISSED
    // SKIPPED/MISSED items have null r1PlannedDate, so date filtering would exclude them
    // COMPLETED items should be filtered by completionDate OR r1PlannedDate (for old records without completionDate)
    if ((from || to) && status !== 'SKIPPED' && status !== 'MISSED') {
      const dateFilters: any[] = []

      // Primary filter: by r1PlannedDate (works for PLANNED, PENDING items)
      const plannedDateFilter: any = {}
      if (from) {
        // Subtract one day to ensure we capture all HKT times that span into previous UTC day
        // E.g., Dec 9 00:00-07:59 HKT is stored as Dec 8 16:00-23:59 UTC
        const fromDate = new Date(from + 'T00:00:00Z')
        fromDate.setUTCDate(fromDate.getUTCDate() - 1)
        plannedDateFilter.gte = fromDate
      }
      if (to) {
        plannedDateFilter.lte = new Date(to + 'T23:59:59.999Z')
      }
      if (Object.keys(plannedDateFilter).length > 0) {
        dateFilters.push({ r1PlannedDate: plannedDateFilter })
        
        // For COMPLETED items: also check completionDate (actual completion date)
        const completedDateFilter: any = {
          status: 'COMPLETED',
          completionDate: plannedDateFilter,
        }
        dateFilters.push(completedDateFilter)
        
        // Fallback: include COMPLETED items with null completionDate and null r1PlannedDate but updatedAt in range (migrated items only)
        const legacyCompletedFilter: any = {
          status: 'COMPLETED',
          r1PlannedDate: null,
          completionDate: null,
          updatedAt: plannedDateFilter,
        }
        dateFilters.push(legacyCompletedFilter)
      }

      const skippedDateFilter: any = { status: 'SKIPPED' }
      const skippedRange: any = {}
      if (from) {
        // Subtract one day for same reason as plannedDateFilter
        const fromDate = new Date(from + 'T00:00:00Z')
        fromDate.setUTCDate(fromDate.getUTCDate() - 1)
        skippedRange.gte = fromDate
      }
      if (to) {
        skippedRange.lte = new Date(to + 'T23:59:59.999Z')
      }
      if (Object.keys(skippedRange).length > 0) {
        skippedDateFilter.lastSkippedDate = skippedRange
        dateFilters.push(skippedDateFilter)
      }

      if (dateFilters.length > 0) {
        where.AND = where.AND || []
        where.AND.push({ OR: dateFilters })
      }
    }

    if (status) {
      where.status = status
    }

    if (batch) {
      where.batch = batch
    }

    // Fetch schedules with related data
    const schedules = await prisma.schedule.findMany({
      where,
      select: {
        id: true,
        r0PlannedDate: true,
        r1PlannedDate: true,
        dueDate: true,
        batch: true,
        timeSlot: true,
        status: true,
        workOrderNumber: true,
        lastSkippedDate: true,
        skippedCount: true,
        completionDate: true,
        isLate: true,
        updatedAt: true,
        equipment: {
          select: {
            id: true,
            equipmentNumber: true,
            name: true,
            type: true,
            location: true,
            canUse2300Slot: true,
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
        ...(includeVisits ? {
          visits: {
            select: {
              id: true,
              actualStartDate: true,
              completed: true,
              classification: true,
            },
            orderBy: {
              actualStartDate: 'desc',
            },
            take: 1, // Most recent visit
          },
        } : {}),
      },
      orderBy: {
        r1PlannedDate: 'asc',
      },
    })

    return NextResponse.json({
      schedules,
      count: schedules.length,
    })
  } catch (error) {
    console.error('[Schedules GET] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * POST /api/schedules
 * Create a new schedule
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = createScheduleSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const data = validation.data

    // Convert date strings to Date objects
    const r0PlannedDate = typeof data.r0PlannedDate === 'string' 
      ? new Date(data.r0PlannedDate) 
      : data.r0PlannedDate
    const r1PlannedDate = typeof data.r1PlannedDate === 'string'
      ? new Date(data.r1PlannedDate)
      : data.r1PlannedDate

    // Calculate due date (R0 + 14 days)
    const dueDate = calculateDueDate(r0PlannedDate)

    // Validate fixed engineer has CP & RW certificates (if provided)
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
            engineer: fixedEngineer.name,
            hasCPCert: fixedEngineer.hasCPCert,
            hasRWCert: fixedEngineer.hasRWCert,
          },
          { status: 400 }
        )
      }
    }

    // Generate OR number if not provided
    const workOrderNumber = data.workOrderNumber || generateDummyORNumber()

    // Check for duplicate OR number
    if (workOrderNumber) {
      const existing = await prisma.schedule.findUnique({
        where: { workOrderNumber },
      })
      if (existing) {
        return NextResponse.json(
          { error: `Work order number ${workOrderNumber} already exists` },
          { status: 400 }
        )
      }
    }

    // Calculate isLate flag: r1PlannedDate >= dueDate - 5 days (same logic as at risk)
    let isLate = false
    if (r1PlannedDate && dueDate) {
      const scheduledDate = new Date(r1PlannedDate)
      const dueDateObj = new Date(dueDate)
      scheduledDate.setHours(0, 0, 0, 0)
      dueDateObj.setHours(0, 0, 0, 0)
      const lateThreshold = new Date(dueDateObj)
      lateThreshold.setDate(lateThreshold.getDate() - 5)
      isLate = scheduledDate >= lateThreshold
    }

    // Create schedule
    const schedule = await prisma.schedule.create({
      data: {
        equipmentId: data.equipmentId,
        zoneId: data.zoneId,
        r0PlannedDate,
        r1PlannedDate,
        dueDate,
        batch: data.batch,
        timeSlot: data.timeSlot,
        fixedEngineerId: data.fixedEngineerId || null,
        rotatingEngineerId: data.rotatingEngineerId || null,
        workOrderNumber: workOrderNumber || null,
        status: data.status || 'PLANNED',
        isLate: isLate,
      },
      include: {
        equipment: {
          select: {
            id: true,
            equipmentNumber: true,
            name: true,
            type: true,
            canUse2300Slot: true,
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
      schedule,
    }, { status: 201 })
  } catch (error) {
    console.error('[Schedules POST] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

