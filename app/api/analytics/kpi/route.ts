import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const kpiQuerySchema = z.object({
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(), // YYYY-MM-DD
  zoneId: z.string().optional(),
  includeDetails: z.string().optional(), // 'all' or specific indicator like '1', '2', '3', '4'
})

/**
 * GET /api/analytics/kpi
 * Get KPI metrics for analytics dashboard
 * 
 * Indicators:
 * 1. As-Planned Completion Rate
 * 2. % of Work Orders Rescheduled
 * 3. Deviation from MTR Scheduled Date
 * 4. % of Late Completion
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const zoneId = searchParams.get('zoneId')
    const includeDetails = searchParams.get('includeDetails') // 'all', '1', '2', '3', '4', or null

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required (YYYY-MM-DD format)' },
        { status: 400 }
      )
    }

    const startDateObj = new Date(startDate)
    const endDateObj = new Date(endDate)
    endDateObj.setHours(23, 59, 59, 999)

    // Build where clause for zone filter
    const zoneFilter = zoneId ? { zoneId } : {}

    // ========================================
    // INDICATOR 1: As-Planned Completion Rate
    // ========================================
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Yesterday (last day we should count pending items)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(23, 59, 59, 999)

    // Get all dates in range
    const dates: string[] = []
    let currentDate = new Date(startDateObj)
    while (currentDate <= endDateObj) {
      dates.push(currentDate.toISOString().split('T')[0])
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Optimized: Get all data in 3 queries instead of N queries per day
    // 1. Get all completed items in the period
    const completedItems = await prisma.schedule.findMany({
      where: {
        ...zoneFilter,
        status: 'COMPLETED',
        r1PlannedDate: {
          gte: startDateObj,
          lte: endDateObj,
        },
      },
      select: {
        r1PlannedDate: true,
        completionDate: true,
      },
    })

    // 2. Get all pending items in the period (only up to yesterday, not today)
    const pendingItems = await prisma.schedule.findMany({
      where: {
        ...zoneFilter,
        r1PlannedDate: {
          gte: startDateObj,
          lte: yesterday,  // Changed from 'today' to 'yesterday'
        },
        status: { in: ['PLANNED', 'PENDING'] },
      },
      select: {
        r1PlannedDate: true,
      },
    })

    // 3. Get all skipped items (reschedules) in the period
    const skippedItems = await prisma.reschedule.findMany({
      where: {
        originalDate: {
          gte: startDateObj,
          lte: endDateObj,
        },
        ...(zoneId
          ? {
              schedule: {
                zoneId,
              },
            }
          : {}),
      },
      select: {
        originalDate: true,
      },
    })

    // Group data by date
    const completedByDateMap = new Map<string, number>()
    const pendingByDateMap = new Map<string, number>()
    const skippedByDateMap = new Map<string, number>()

    completedItems.forEach(item => {
      if (item.r1PlannedDate && item.completionDate) {
        const plannedDate = item.r1PlannedDate.toISOString().split('T')[0]
        const completedDate = item.completionDate.toISOString().split('T')[0]
        // Count as "completed as planned" only if completed on the same day as planned
        if (plannedDate === completedDate) {
          completedByDateMap.set(plannedDate, (completedByDateMap.get(plannedDate) || 0) + 1)
        }
      }
    })

    pendingItems.forEach(item => {
      if (item.r1PlannedDate) {
        const dateStr = item.r1PlannedDate.toISOString().split('T')[0]
        pendingByDateMap.set(dateStr, (pendingByDateMap.get(dateStr) || 0) + 1)
      }
    })

    skippedItems.forEach(item => {
      if (item.originalDate) {
        const dateStr = item.originalDate.toISOString().split('T')[0]
        skippedByDateMap.set(dateStr, (skippedByDateMap.get(dateStr) || 0) + 1)
      }
    })

    // Build daily completion rates from aggregated data
    const dateCompletionRates = dates.map(dateStr => {
      const completedAsPlanned = completedByDateMap.get(dateStr) || 0
      const pending = pendingByDateMap.get(dateStr) || 0
      const skipped = skippedByDateMap.get(dateStr) || 0
      const total = completedAsPlanned + pending + skipped
      const completionRate = total > 0 ? (completedAsPlanned / total) * 100 : 0

      return {
        date: dateStr,
        completedAsPlanned,
        skipped,
        pending,
        total,
        completionRate,
      }
    })

    // Aggregate for period
    const totalCompleted = dateCompletionRates.reduce((sum, d) => sum + d.completedAsPlanned, 0)
    const totalSkipped = dateCompletionRates.reduce((sum, d) => sum + d.skipped, 0)
    const totalPending = dateCompletionRates.reduce((sum, d) => sum + d.pending, 0)
    const totalScheduled = totalCompleted + totalSkipped + totalPending
    const overallCompletionRate = totalScheduled > 0 ? (totalCompleted / totalScheduled) * 100 : 0

    // Get list of all skipped items in the period (only if details requested)
    let skippedItemsDetails: any[] = []
    if (includeDetails === 'all' || includeDetails === '1') {
      const skippedItemsData = await prisma.reschedule.findMany({
        where: {
          originalDate: {
            gte: startDateObj,
            lte: endDateObj,
          },
          ...(zoneId
            ? {
                schedule: {
                  zoneId,
                },
              }
            : {}),
        },
        select: {
          scheduleId: true,
          originalDate: true,
          newDate: true,
          createdAt: true,
          schedule: {
            select: {
              workOrderNumber: true,
              equipment: {
                select: {
                  equipmentNumber: true,
                },
              },
              zone: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ originalDate: 'asc' }, { createdAt: 'asc' }],
      })
      
      skippedItemsDetails = skippedItemsData
    }

    // ========================================
    // INDICATOR 2: % of Work Orders Rescheduled
    // ========================================
    // First, get counts only (lightweight)
    const totalCompletedCount = await prisma.schedule.count({
      where: {
        ...zoneFilter,
        status: 'COMPLETED',
        completionDate: {
          gte: startDateObj,
          lte: endDateObj,
        },
      },
    })

    const neverRescheduledCount = await prisma.schedule.count({
      where: {
        ...zoneFilter,
        status: 'COMPLETED',
        completionDate: {
          gte: startDateObj,
          lte: endDateObj,
        },
        skippedCount: 0,
      },
    })

    // Only fetch detailed data for rescheduled items if details requested
    let rescheduledOnceList: any[] = []
    let rescheduledTwiceList: any[] = []
    let rescheduledThreePlusList: any[] = []
    let anyReschedule = 0
    
    if (includeDetails === 'all' || includeDetails === '2') {
      const rescheduledItems = await prisma.schedule.findMany({
        where: {
          ...zoneFilter,
          status: 'COMPLETED',
          completionDate: {
            gte: startDateObj,
            lte: endDateObj,
          },
          skippedCount: { gt: 0 },
        },
        select: {
          id: true,
          workOrderNumber: true,
          skippedCount: true,
          completionDate: true,
          equipment: {
            select: {
              equipmentNumber: true,
            },
          },
          zone: {
            select: {
              name: true,
            },
          },
        },
      })
      
      // Categorize by reschedule count
      rescheduledOnceList = rescheduledItems.filter((s) => s.skippedCount === 1)
      rescheduledTwiceList = rescheduledItems.filter((s) => s.skippedCount === 2)
      rescheduledThreePlusList = rescheduledItems.filter((s) => s.skippedCount >= 3)
      anyReschedule = rescheduledItems.length
    } else {
      // Just get the count without details
      anyReschedule = await prisma.schedule.count({
        where: {
          ...zoneFilter,
          status: 'COMPLETED',
          completionDate: {
            gte: startDateObj,
            lte: endDateObj,
          },
          skippedCount: { gt: 0 },
        },
      })
    }
    
    const rescheduleRate = totalCompletedCount > 0 ? (anyReschedule / totalCompletedCount) * 100 : 0

    // ========================================
    // INDICATOR 3: Deviation from MTR Scheduled Date
    // ========================================
    // Always get counts for summary
    const itemsWithMTRDateCount = await prisma.schedule.count({
      where: {
        ...zoneFilter,
        status: 'COMPLETED',
        completionDate: {
          gte: startDateObj,
          lte: endDateObj,
        },
        mtrPlannedStartDate: { not: null },
      },
    })

    let deviationsWithDetails: any[] = []
    let deviations: number[] = []
    let nonSameDayCompletions: any[] = []
    
    if (includeDetails === 'all' || includeDetails === '4') {
      const completedWithMTRDate = await prisma.schedule.findMany({
        where: {
          ...zoneFilter,
          status: 'COMPLETED',
          completionDate: {
            gte: startDateObj,
            lte: endDateObj,
          },
          mtrPlannedStartDate: { not: null },
        },
        select: {
          id: true,
          workOrderNumber: true,
          completionDate: true,
          mtrPlannedStartDate: true,
          equipment: {
            select: {
              equipmentNumber: true,
            },
          },
          zone: {
            select: {
              name: true,
            },
          },
        },
      })

      deviationsWithDetails = completedWithMTRDate.map((s) => {
        const completionDateObj = new Date(s.completionDate!)
        const mtrDateObj = new Date(s.mtrPlannedStartDate!)

        // Normalize to midnight
        completionDateObj.setHours(0, 0, 0, 0)
        mtrDateObj.setHours(0, 0, 0, 0)

        // Calculate difference in days
        const deviationDays = Math.floor(
          (completionDateObj.getTime() - mtrDateObj.getTime()) / (1000 * 60 * 60 * 24)
        )

        return {
          ...s,
          deviationDays,
          category: deviationDays < 0 ? 'early' : deviationDays === 0 ? 'onTime' : 'late',
        }
      })

      deviations = deviationsWithDetails.map((d) => d.deviationDays)
      nonSameDayCompletions = deviationsWithDetails.filter((d) => d.deviationDays !== 0)
    } else {
      // Just calculate counts for distribution without full details
      const completedWithMTRDateMinimal = await prisma.schedule.findMany({
        where: {
          ...zoneFilter,
          status: 'COMPLETED',
          completionDate: {
            gte: startDateObj,
            lte: endDateObj,
          },
          mtrPlannedStartDate: { not: null },
        },
        select: {
          completionDate: true,
          mtrPlannedStartDate: true,
        },
      })

      deviations = completedWithMTRDateMinimal.map((s) => {
        const completionDateObj = new Date(s.completionDate!)
        const mtrDateObj = new Date(s.mtrPlannedStartDate!)
        completionDateObj.setHours(0, 0, 0, 0)
        mtrDateObj.setHours(0, 0, 0, 0)
        return Math.floor(
          (completionDateObj.getTime() - mtrDateObj.getTime()) / (1000 * 60 * 60 * 24)
        )
      })
    }

    const avgDeviation =
      deviations.length > 0 ? deviations.reduce((a, b) => a + b, 0) / deviations.length : 0

    // Count early/on-time/late
    const earlyCount = deviations.filter((d) => d < 0).length
    const onTimeCount = deviations.filter((d) => d === 0).length
    const lateCount = deviations.filter((d) => d > 0).length

    const itemsWithMTRDate = itemsWithMTRDateCount
    const itemsWithoutMTRDate = totalCompletedCount - itemsWithMTRDate

    // ========================================
    // INDICATOR 4: % of Late Completion
    // ========================================
    // Get count for summary
    const lateCompletionCount = await prisma.schedule.count({
      where: {
        ...zoneFilter,
        status: 'COMPLETED',
        completionDate: {
          gte: startDateObj,
          lte: endDateObj,
        },
        isLate: true,
      },
    })

    // Fetch late completions with details only if requested
    let lateCompletionItems: any[] = []
    if (includeDetails === 'all' || includeDetails === '3') {
      lateCompletionItems = await prisma.schedule.findMany({
        where: {
          ...zoneFilter,
          status: 'COMPLETED',
          completionDate: {
            gte: startDateObj,
            lte: endDateObj,
          },
          isLate: true,
        },
        select: {
          id: true,
          workOrderNumber: true,
          completionDate: true,
          r1PlannedDate: true,
          dueDate: true,
          equipment: {
            select: {
              equipmentNumber: true,
            },
          },
          zone: {
            select: {
              name: true,
            },
          },
        },
      })
    }

    const lateCompletionRate =
      totalCompletedCount > 0 ? (lateCompletionCount / totalCompletedCount) * 100 : 0

    // ========================================
    // Return aggregated KPIs
    // ========================================
    return NextResponse.json({
      period: {
        startDate,
        endDate,
        zoneId: zoneId || 'all',
      },
      indicator1_asPlannedCompletion: {
        overall: {
          completedAsPlanned: totalCompleted,
          skipped: totalSkipped,
          pending: totalPending,
          total: totalScheduled,
          completionRate: Math.round(overallCompletionRate * 10) / 10, // 1 decimal
        },
        byDate: dateCompletionRates.map((d) => ({
          ...d,
          completionRate: Math.round(d.completionRate * 10) / 10,
        })),
        ...(includeDetails === 'all' || includeDetails === '1'
          ? {
              skippedItems: skippedItemsDetails.map((r) => ({
                scheduleId: r.scheduleId,
                workOrderNumber: r.schedule.workOrderNumber,
                equipmentNumber: r.schedule.equipment.equipmentNumber,
                zoneName: r.schedule.zone.name,
                originalDate: r.originalDate.toISOString().split('T')[0],
                newDate: r.newDate ? r.newDate.toISOString().split('T')[0] : null,
                skippedDate: r.createdAt.toISOString().split('T')[0],
              })),
            }
          : {}),
      },
      indicator2_rescheduleRate: {
        totalCompleted: totalCompletedCount,
        neverRescheduled: neverRescheduledCount,
        rescheduledOnce: includeDetails === 'all' || includeDetails === '2' ? rescheduledOnceList.length : 0,
        rescheduledTwice: includeDetails === 'all' || includeDetails === '2' ? rescheduledTwiceList.length : 0,
        rescheduledThreePlus: includeDetails === 'all' || includeDetails === '2' ? rescheduledThreePlusList.length : 0,
        anyReschedule,
        rescheduleRate: Math.round(rescheduleRate * 10) / 10,
        ...(includeDetails === 'all' || includeDetails === '2'
          ? {
              details: {
                // Don't include neverRescheduled details - too heavy
                rescheduledOnce: rescheduledOnceList.map((s) => ({
                  workOrderNumber: s.workOrderNumber,
                  equipmentNumber: s.equipment.equipmentNumber,
                  zoneName: s.zone.name,
                  completionDate: s.completionDate?.toISOString().split('T')[0],
                  skippedCount: s.skippedCount,
                })),
                rescheduledTwice: rescheduledTwiceList.map((s) => ({
                  workOrderNumber: s.workOrderNumber,
                  equipmentNumber: s.equipment.equipmentNumber,
                  zoneName: s.zone.name,
                  completionDate: s.completionDate?.toISOString().split('T')[0],
                  skippedCount: s.skippedCount,
                })),
                rescheduledThreePlus: rescheduledThreePlusList.map((s) => ({
                  workOrderNumber: s.workOrderNumber,
                  equipmentNumber: s.equipment.equipmentNumber,
                  zoneName: s.zone.name,
                  completionDate: s.completionDate?.toISOString().split('T')[0],
                  skippedCount: s.skippedCount,
                })),
              },
            }
          : {}),
      },
      indicator3_deviationFromMTR: {
        itemsIncluded: itemsWithMTRDate,
        itemsExcluded: itemsWithoutMTRDate,
        avgDeviationDays: Math.round(avgDeviation * 10) / 10,
        distribution: {
          early: earlyCount,
          onTime: onTimeCount,
          late: lateCount,
        },
        ...(includeDetails === 'all' || includeDetails === '4'
          ? {
              details: {
                nonSameDayCompletions: nonSameDayCompletions.map((s) => ({
                  workOrderNumber: s.workOrderNumber,
                  equipmentNumber: s.equipment.equipmentNumber,
                  zoneName: s.zone.name,
                  mtrPlannedDate: s.mtrPlannedStartDate?.toISOString().split('T')[0],
                  completionDate: s.completionDate?.toISOString().split('T')[0],
                  deviationDays: s.deviationDays,
                  category: s.category,
                })),
              },
            }
          : {}),
      },
      indicator4_lateCompletionRate: {
        totalCompleted: totalCompletedCount,
        lateCompletions: lateCompletionCount,
        lateCompletionRate: Math.round(lateCompletionRate * 10) / 10,
        ...(includeDetails === 'all' || includeDetails === '3'
          ? {
              details: {
                lateCompletionItems: lateCompletionItems.map((s) => ({
                  workOrderNumber: s.workOrderNumber,
                  equipmentNumber: s.equipment.equipmentNumber,
                  zoneName: s.zone.name,
                  r1PlannedDate: s.r1PlannedDate?.toISOString().split('T')[0],
                  dueDate: s.dueDate?.toISOString().split('T')[0],
                  completionDate: s.completionDate?.toISOString().split('T')[0],
                })),
              },
            }
          : {}),
      },
    })
  } catch (error) {
    console.error('[Analytics KPI] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

