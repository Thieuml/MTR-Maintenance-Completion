import { NextRequest, NextResponse } from 'next/server'
import { fetchMaintenanceVisitsFromLooker } from '@/lib/looker'
import { getHKTDateKey, parseHKTDateKey, addDaysToHKTDateKey } from '@/lib/utils/timezone'

// Simple in-memory cache for Looker visits (5 minute TTL)
let visitsCache: { data: any[]; timestamp: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * POST /api/visits/reports
 * Fetch maintenance visit reports from Looker for given schedules
 * 
 * Request body: { scheduleIds: string[] }
 * Returns: { [scheduleId]: { hasReport: boolean, pdfReportUrl: string | null, completedDate: string | null, isExactMatch: boolean } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scheduleIds } = body

    if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
      return NextResponse.json(
        { error: 'scheduleIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // Fetch schedules with equipment info
    const { prisma } = await import('@/lib/prisma')
    const schedules = await prisma.schedule.findMany({
      where: {
        id: { in: scheduleIds },
      },
      select: {
        id: true,
        workOrderNumber: true,
        r1PlannedDate: true,
        dueDate: true,
        equipment: {
          select: {
            equipmentNumber: true,
          },
        },
      },
    })

    if (schedules.length === 0) {
      return NextResponse.json({})
    }

    // Fetch visits from Looker (with caching to avoid calling on every request)
    let lookerVisits: any[]
    const now = Date.now()
    
    if (visitsCache && (now - visitsCache.timestamp) < CACHE_TTL_MS) {
      lookerVisits = visitsCache.data
    } else {
      lookerVisits = await fetchMaintenanceVisitsFromLooker()
      visitsCache = { data: lookerVisits, timestamp: now }
    }
    
    // Create a map for quick lookup: equipmentNumber (uppercase) -> dateKey -> visit
    // Use uppercase for case-insensitive matching
    const visitsByEquipmentAndDate = new Map<string, Map<string, any>>()
    
    for (const visit of lookerVisits) {
      // Priority: device.location (new field), then fallback to other fields
      // Handle both dot notation and bracket notation for nested fields
      const equipmentNumber = visit['device.location'] || 
                             visit['device_location'] || 
                             visit.device_location || 
                             visit.equipment_number || 
                             visit.equipmentNumber ||
                             (visit.device && visit.device.location) ||
                             (visit.device && visit.device_location)
      
      // Handle nested field names from Looker (task.completed_date, task.pdf_report)
      // Looker returns fields with dot notation as keys: 'task.completed_date'
      const completedDate = visit['task.completed_date'] || 
                            visit['task_completed_date'] ||
                            visit.completed_date || 
                            visit.completedDate ||
                            (visit.task && (visit.task.completed_date || visit.task.completedDate))
      const pdfReportRaw = visit['task.pdf_report'] ||
                          visit['task_pdf_report'] ||
                          visit.pdf_report || 
                          visit.pdfReport || 
                          visit.report ||
                          (visit.task && (visit.task.pdf_report || visit.task.pdfReport))
      
      // Construct full URL if pdfReportRaw is a UUID/file ID
      // PDF report URLs follow: https://admin.wemaintain.com/download-report/task/{file-id}
      let pdfReport: string | null = null
      if (pdfReportRaw) {
        if (typeof pdfReportRaw === 'string') {
          // If it's already a full URL, use it as-is
          if (pdfReportRaw.startsWith('http://') || pdfReportRaw.startsWith('https://')) {
            pdfReport = pdfReportRaw
          } else {
            // Construct the URL: https://admin.wemaintain.com/download-report/task/{file-id}
            pdfReport = `https://admin.wemaintain.com/download-report/task/${pdfReportRaw}`
          }
        } else {
          pdfReport = `https://admin.wemaintain.com/download-report/task/${String(pdfReportRaw)}`
        }
      }

      if (!equipmentNumber || !completedDate) {
        continue
      }

      // Normalize equipment number (trim whitespace, uppercase for case-insensitive matching)
      // Also normalize variations like KOW-SL5 -> KOW-SL05 (add zero if missing)
      let normalizedEquipment = String(equipmentNumber).trim().toUpperCase()
      
      // Handle equipment number variations:
      // - KOW-SL5 -> KOW-SL05 (add zero if missing)
      // - Remove spaces: "TUC FL01" -> "TUC-FL01" (normalize to use dash)
      normalizedEquipment = normalizedEquipment.replace(/KOW-SL(\d)$/, 'KOW-SL0$1')
      // Normalize spaces to dashes for consistency (e.g., "TUC FL01" -> "TUC-FL01")
      normalizedEquipment = normalizedEquipment.replace(/\s+/g, '-')
      
      // Get date key for the completed date (HKT)
      const completedDateObj = new Date(completedDate)
      const dateKey = getHKTDateKey(completedDateObj)

      if (!visitsByEquipmentAndDate.has(normalizedEquipment)) {
        visitsByEquipmentAndDate.set(normalizedEquipment, new Map())
      }
      
      const dateMap = visitsByEquipmentAndDate.get(normalizedEquipment)!
      
      // Store visit on its actual completion date
      // Prefer visit with PDF report if multiple exist for same date
      if (!dateMap.has(dateKey) || (pdfReport && !dateMap.get(dateKey)?.pdfReport)) {
        dateMap.set(dateKey, { pdfReport: pdfReport || null })
      }
    }

    // Match schedules to visits
    const results: Record<string, { 
      hasReport: boolean
      pdfReportUrl: string | null
      completedDate: string | null
      isExactMatch: boolean
    }> = {}

    for (const schedule of schedules) {
      if (!schedule.r1PlannedDate) {
        results[schedule.id] = { 
          hasReport: false, 
          pdfReportUrl: null, 
          completedDate: null,
          isExactMatch: false 
        }
        continue
      }

      const equipmentNumber = schedule.equipment.equipmentNumber
      // Normalize equipment number (handle variations like KOW-SL5 -> KOW-SL05)
      // Also normalize spaces to dashes for consistency
      let equipmentNumberUpper = equipmentNumber.toUpperCase().trim()
      equipmentNumberUpper = equipmentNumberUpper.replace(/KOW-SL(\d)$/, 'KOW-SL0$1')
      equipmentNumberUpper = equipmentNumberUpper.replace(/\s+/g, '-')
      const scheduleDateKey = getHKTDateKey(schedule.r1PlannedDate)

      // Check for visit on same date or up to 5 days later
      const equipmentVisits = visitsByEquipmentAndDate.get(equipmentNumberUpper)
      
      if (equipmentVisits) {
        // Check same day first (exact match)
        const visitSameDay = equipmentVisits.get(scheduleDateKey)
        if (visitSameDay) {
          results[schedule.id] = {
            hasReport: true,
            pdfReportUrl: visitSameDay.pdfReport || null,
            completedDate: scheduleDateKey,
            isExactMatch: true,
          }
          continue
        }

        // Check next day (still considered exact match for overnight work)
        const nextDateKey = addDaysToHKTDateKey(scheduleDateKey, 1)
        const visitNextDay = equipmentVisits.get(nextDateKey)
        if (visitNextDay) {
          results[schedule.id] = {
            hasReport: true,
            pdfReportUrl: visitNextDay.pdfReport || null,
            completedDate: nextDateKey,
            isExactMatch: true,
          }
          continue
        }

        // Check days 2-5 (non-exact match, highlight in orange)
        for (let daysOffset = 2; daysOffset <= 5; daysOffset++) {
          const checkDateKey = addDaysToHKTDateKey(scheduleDateKey, daysOffset)
          const visitLater = equipmentVisits.get(checkDateKey)
          if (visitLater) {
            results[schedule.id] = {
              hasReport: true,
              pdfReportUrl: visitLater.pdfReport || null,
              completedDate: checkDateKey,
              isExactMatch: false,
            }
            break // Use the earliest match found
          }
        }
        
        // If we found a match in the loop above, continue
        if (results[schedule.id]) {
          continue
        }
      }

      // No visit found
      results[schedule.id] = { 
        hasReport: false, 
        pdfReportUrl: null, 
        completedDate: null,
        isExactMatch: false 
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('[Visits Reports] Error fetching reports:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error: 'Failed to fetch visit reports',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

