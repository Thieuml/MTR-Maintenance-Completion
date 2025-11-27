import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  classifyMaintenance,
  calculatePlanningDeviation,
  calculateExecutionDeviation,
  type MaintenanceClassification,
} from '@/lib/analytics/classification'

interface AnalyticsQuery {
  from?: string
  to?: string
  zoneId?: string
  batch?: 'A' | 'B'
  period?: 'month' | 'batch' | 'zone'
}

/**
 * GET /api/analytics/maintenance
 * Get maintenance completion analytics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const zoneId = searchParams.get('zoneId')
    const batch = searchParams.get('batch') as 'A' | 'B' | null
    const period = searchParams.get('period') as 'month' | 'batch' | 'zone' | null

    // Build where clause
    // We'll fetch schedules matching zone/batch filters, then filter by date in post-processing
    // This allows us to properly handle both "scheduled in range" and "completed in range" filters
    const where: any = {}

    if (zoneId) {
      where.zoneId = zoneId
    }

    if (batch) {
      where.batch = batch
    }

    // If date range is provided, we need to fetch schedules that are either:
    // 1. Scheduled in the date range (for Completion Rate and Planning Deviation)
    // 2. Completed in the date range (for On-Time Rate and Execution Deviation)
    // Since completion date comes from visits, we'll fetch a broader set and filter in post-processing
    if (from || to) {
      // Fetch schedules scheduled in range OR with COMPLETED status
      // We'll filter by actual completion date in post-processing
      const dateConditions: any[] = []
      
      // Condition 1: Scheduled in date range
      if (from || to) {
        const scheduledCondition: any = {}
        if (from) {
          scheduledCondition.r1PlannedDate = {
            gte: new Date(from),
          }
        }
        if (to) {
          scheduledCondition.r1PlannedDate = {
            ...scheduledCondition.r1PlannedDate,
            lte: new Date(to),
          }
        }
        if (Object.keys(scheduledCondition).length > 0) {
          dateConditions.push(scheduledCondition)
        }
      }

      // Condition 2: Include completed schedules (we'll filter by completion date later)
      // Expand the range slightly to catch schedules completed near the boundaries
      const expandedFrom = from ? new Date(from) : null
      const expandedTo = to ? new Date(to) : null
      if (expandedFrom) expandedFrom.setDate(expandedFrom.getDate() - 30) // Look back 30 days
      if (expandedTo) expandedTo.setDate(expandedTo.getDate() + 30) // Look forward 30 days
      
      const completedCondition: any = {
        status: {
          in: ['COMPLETED', 'COMPLETED_LATE'],
        },
      }
      if (expandedFrom || expandedTo) {
        completedCondition.r1PlannedDate = {}
        if (expandedFrom) {
          completedCondition.r1PlannedDate.gte = expandedFrom
        }
        if (expandedTo) {
          completedCondition.r1PlannedDate.lte = expandedTo
        }
      }
      dateConditions.push(completedCondition)

      // Use OR to include schedules that match either condition
      if (dateConditions.length > 0) {
        where.OR = dateConditions
      }
    }

    // Fetch schedules with visits and work order numbers
    const schedules = await prisma.schedule.findMany({
      where,
      select: {
        id: true,
        equipment: {
          select: {
            equipmentNumber: true,
          },
        },
        zone: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        r1PlannedDate: true,
        mtrPlannedStartDate: true,
        dueDate: true,
        batch: true,
        workOrderNumber: true,
        status: true,
        visits: {
          select: {
            id: true,
            actualStartDate: true,
            actualEndDate: true,
            completionDate: true,
            completed: true,
          },
          orderBy: {
            actualStartDate: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        r1PlannedDate: 'asc',
      },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Parse date range for filtering
    const fromDate = from ? new Date(from) : null
    const toDate = to ? new Date(to) : null
    if (fromDate) fromDate.setHours(0, 0, 0, 0)
    if (toDate) toDate.setHours(23, 59, 59, 999)

    // Process each schedule
    const processed = schedules.map((schedule) => {
      const mostRecentVisit = schedule.visits[0]
      // Use completionDate if available, otherwise actualEndDate
      // If schedule is marked as COMPLETED but no visit, use r1PlannedDate as fallback
      let completionDate =
        mostRecentVisit?.completionDate || mostRecentVisit?.actualEndDate || null
      
      // If schedule status is COMPLETED/COMPLETED_LATE but no visit record, use r1PlannedDate
      if (!completionDate && (schedule.status === 'COMPLETED' || schedule.status === 'COMPLETED_LATE')) {
        completionDate = schedule.r1PlannedDate
      }

      const classification = classifyMaintenance({
        mtrPlannedStartDate: schedule.mtrPlannedStartDate,
        r1PlannedDate: schedule.r1PlannedDate,
        dueDate: schedule.dueDate,
        completionDate: completionDate ? new Date(completionDate) : null,
        today,
      })

      const planningDeviation = calculatePlanningDeviation(
        schedule.r1PlannedDate,
        schedule.mtrPlannedStartDate
      )

      const executionDeviation = calculateExecutionDeviation(
        schedule.r1PlannedDate,
        completionDate ? new Date(completionDate) : null
      )

      // Get period keys for grouping
      const r1Date = new Date(schedule.r1PlannedDate)
      const monthKey = `${r1Date.getFullYear()}-${String(r1Date.getMonth() + 1).padStart(2, '0')}`
      const batchKey = `${monthKey}-${schedule.batch}`
      const zoneKey = schedule.zone.code

      return {
        scheduleId: schedule.id,
        equipmentNumber: schedule.equipment.equipmentNumber,
        zoneId: schedule.zone.id,
        zoneCode: schedule.zone.code,
        batch: schedule.batch,
        r1PlannedDate: schedule.r1PlannedDate,
        mtrPlannedStartDate: schedule.mtrPlannedStartDate,
        dueDate: schedule.dueDate,
        workOrderNumber: schedule.workOrderNumber,
        completionDate,
        classification,
        planningDeviation,
        executionDeviation,
        monthKey,
        batchKey,
        zoneKey,
      }
    })

    // Filter processed schedules based on date range:
    // - For Completion Rate and Planning Deviation: filter by r1PlannedDate (scheduled date)
    // - For On-Time Rate and Execution Deviation: filter by completionDate (execution date)
    // We'll apply these filters when calculating each indicator
    const scheduledInRange = fromDate && toDate
      ? processed.filter((p) => {
          const scheduled = new Date(p.r1PlannedDate)
          scheduled.setHours(0, 0, 0, 0)
          return scheduled >= fromDate! && scheduled <= toDate!
        })
      : processed

    const completedInRange = fromDate && toDate
      ? processed.filter((p) => {
          if (!p.completionDate) return false
          const completed = new Date(p.completionDate)
          completed.setHours(0, 0, 0, 0)
          return completed >= fromDate! && completed <= toDate!
        })
      : processed.filter((p) => p.completionDate !== null)

    // Debug logging
    console.log('[Analytics] Date range:', { from, to, fromDate, toDate })
    console.log('[Analytics] Total schedules fetched:', schedules.length)
    console.log('[Analytics] Total processed:', processed.length)
    console.log('[Analytics] Scheduled in range:', scheduledInRange.length)
    console.log('[Analytics] Completed in range:', completedInRange.length)
    console.log('[Analytics] Sample schedules:', processed.slice(0, 3).map(p => ({
      equipment: p.equipmentNumber,
      scheduled: p.r1PlannedDate,
      completed: p.completionDate,
      status: p.classification,
    })))

    // Calculate indicators
    // For Completion Rate and Planning Deviation: use schedules scheduled in range
    // For On-Time Rate and Execution Deviation: use schedules completed in range
    
    // Indicator 1: Completion Rate - based on schedules scheduled in range
    const totalScheduled = scheduledInRange.length
    const totalDue = scheduledInRange.filter((p) => {
      if (!p.dueDate) return false
      const due = new Date(p.dueDate)
      due.setHours(0, 0, 0, 0)
      return due < today
    }).length
    
    const completedDue = scheduledInRange.filter((p) => {
      if (!p.completionDate || !p.dueDate) return false
      const due = new Date(p.dueDate)
      due.setHours(0, 0, 0, 0)
      return due < today
    }).length
    
    const missed = totalDue - completedDue
    const completionRate = totalDue > 0 ? (completedDue / totalDue) * 100 : 0

    // Indicator 2: On-Time Rate - based on schedules completed in range
    const completedInRangeList = completedInRange
    const onTime = completedInRangeList.filter((p) => p.classification === 'ON_TIME').length
    const late = completedInRangeList.filter((p) => p.classification === 'LATE').length
    const onTimeRate = completedInRangeList.length > 0 ? (onTime / completedInRangeList.length) * 100 : 0

    // Indicator 3: Planning Deviation - based on schedules scheduled in range
    const planningDeviations = scheduledInRange
      .map((p) => p.planningDeviation)
      .filter((d): d is number => d !== null)
    const avgPlanningDeviation =
      planningDeviations.length > 0
        ? planningDeviations.reduce((a, b) => a + b, 0) / planningDeviations.length
        : null

    // Indicator 4: Execution Deviation - based on schedules completed in range
    const executionDeviations = completedInRangeList
      .map((p) => p.executionDeviation)
      .filter((d): d is number => d !== null)
    const avgExecutionDeviation =
      executionDeviations.length > 0
        ? executionDeviations.reduce((a, b) => a + b, 0) / executionDeviations.length
        : null

    // Get lists for details
    // Missed work orders: due date in the past but not completed (from scheduled in range)
    const missedWorkOrders = scheduledInRange.filter((p) => {
      if (!p.dueDate || p.completionDate) return false
      const due = new Date(p.dueDate)
      due.setHours(0, 0, 0, 0)
      return due < today
    }).map((p) => ({
      scheduleId: p.scheduleId,
      equipmentNumber: p.equipmentNumber,
      zoneCode: p.zoneCode,
      r1PlannedDate: p.r1PlannedDate,
      dueDate: p.dueDate,
      workOrderNumber: p.workOrderNumber,
    }))
    
    // Late work orders: from completed in range
    const lateWorkOrders = completedInRangeList.filter((p) => p.classification === 'LATE').map((p) => ({
      scheduleId: p.scheduleId,
      equipmentNumber: p.equipmentNumber,
      zoneCode: p.zoneCode,
      r1PlannedDate: p.r1PlannedDate,
      completionDate: p.completionDate,
      executionDeviation: p.executionDeviation,
      workOrderNumber: p.workOrderNumber,
    }))

    // Planning deviation work orders: schedules with planning deviation > 0 (from scheduled in range)
    const planningDeviationWorkOrders = scheduledInRange
      .filter((p) => p.planningDeviation !== null && p.planningDeviation > 0)
      .map((p) => ({
        scheduleId: p.scheduleId,
        equipmentNumber: p.equipmentNumber,
        zoneCode: p.zoneCode,
        r1PlannedDate: p.r1PlannedDate,
        mtrPlannedStartDate: p.mtrPlannedStartDate,
        planningDeviation: p.planningDeviation,
        workOrderNumber: p.workOrderNumber,
      }))

    // Execution deviation work orders: schedules with execution deviation > 0 (from completed in range)
    const executionDeviationWorkOrders = completedInRangeList
      .filter((p) => p.executionDeviation !== null && p.executionDeviation > 0)
      .map((p) => ({
        scheduleId: p.scheduleId,
        equipmentNumber: p.equipmentNumber,
        zoneCode: p.zoneCode,
        r1PlannedDate: p.r1PlannedDate,
        completionDate: p.completionDate,
        executionDeviation: p.executionDeviation,
        workOrderNumber: p.workOrderNumber,
      }))

    // Group by period if requested
    let groupedData: any = null
    if (period) {
      groupedData = {}

      processed.forEach((item) => {
        let key: string
        if (period === 'month') {
          key = item.monthKey
        } else if (period === 'batch') {
          key = item.batchKey
        } else {
          key = item.zoneKey
        }

        if (!groupedData[key]) {
          groupedData[key] = {
            key,
            total: 0,
            completed: 0,
            missed: 0,
            onTime: 0,
            late: 0,
            planningDeviations: [],
            executionDeviations: [],
          }
        }

        const group = groupedData[key]
        group.total++
        if (item.completionDate) group.completed++
        if (item.classification === 'MISSED') group.missed++
        if (item.classification === 'ON_TIME') group.onTime++
        if (item.classification === 'LATE') group.late++
        if (item.planningDeviation !== null) group.planningDeviations.push(item.planningDeviation)
        if (item.executionDeviation !== null) group.executionDeviations.push(item.executionDeviation)
      })

      // Calculate rates for each group
      // For 2-week periods:
      // - Completion Rate/Missed and Planning Deviation: calculated on all WOs scheduled that week
      // - On-Time %/Late and Execution Deviation: calculated on all WOs executed that week
      Object.keys(groupedData).forEach((key) => {
        const group = groupedData[key]
        
        // Get items in this group
        const groupItems = processed.filter((item) => {
          let itemKey: string
          if (period === 'month') {
            itemKey = item.monthKey
          } else if (period === 'batch') {
            itemKey = item.batchKey
          } else {
            itemKey = item.zoneKey
          }
          return itemKey === key
        })
        
        // Calculate total due (due date in the past) for this group
        const groupTotalDue = groupItems.filter((p) => {
          if (!p.dueDate) return false
          const due = new Date(p.dueDate)
          due.setHours(0, 0, 0, 0)
          return due < today
        }).length
        
        const groupCompletedDue = groupItems.filter((p) => {
          if (!p.completionDate || !p.dueDate) return false
          const due = new Date(p.dueDate)
          due.setHours(0, 0, 0, 0)
          return due < today
        }).length
        
        // Completion Rate and Missed: based on WOs with due date in the past
        group.completionRate = groupTotalDue > 0 ? (groupCompletedDue / groupTotalDue) * 100 : 0
        group.missed = groupTotalDue - groupCompletedDue // Missed = total due - completed due
        
        // Planning Deviation: based on all scheduled WOs (that have MTR start date)
        group.avgPlanningDeviation =
          group.planningDeviations.length > 0
            ? group.planningDeviations.reduce((a: number, b: number) => a + b, 0) /
              group.planningDeviations.length
            : null
        
        // On-Time Rate and Late: based on completed WOs only
        group.onTimeRate = group.completed > 0 ? (group.onTime / group.completed) * 100 : 0
        
        // Execution Deviation: based on completed WOs only
        group.avgExecutionDeviation =
          group.executionDeviations.length > 0
            ? group.executionDeviations.reduce((a: number, b: number) => a + b, 0) /
              group.executionDeviations.length
            : null
        
        delete group.planningDeviations
        delete group.executionDeviations
      })
    }

    return NextResponse.json({
      summary: {
        total: totalScheduled, // Total scheduled in range
        totalDue, // Total work orders with due date in the past (from scheduled in range)
        completed: completedInRangeList.length, // Total completed in range
        completedDue, // Completed work orders with due date in the past (from scheduled in range)
        missed,
        onTime,
        late,
        completionRate: Math.round(completionRate * 100) / 100,
        onTimeRate: Math.round(onTimeRate * 100) / 100,
        avgPlanningDeviation: avgPlanningDeviation ? Math.round(avgPlanningDeviation * 100) / 100 : null,
        avgExecutionDeviation: avgExecutionDeviation ? Math.round(avgExecutionDeviation * 100) / 100 : null,
      },
      grouped: groupedData,
      details: {
        missedWorkOrders,
        lateWorkOrders,
        planningDeviationWorkOrders,
        executionDeviationWorkOrders,
      },
      raw: processed,
    })
  } catch (error) {
    console.error('[Analytics] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

