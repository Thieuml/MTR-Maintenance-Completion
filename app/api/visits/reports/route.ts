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
 * Returns: { [scheduleId]: { hasReport: boolean, pdfReportUrl: string | null } }
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
      console.log('[Visits Reports] Using cached visits data')
      lookerVisits = visitsCache.data
    } else {
      console.log('[Visits Reports] Fetching fresh visits from Looker...')
      lookerVisits = await fetchMaintenanceVisitsFromLooker()
      visitsCache = { data: lookerVisits, timestamp: now }
      console.log(`[Visits Reports] Cached ${lookerVisits.length} visits`)
    }
    
    // Debug: Log sample visit structure to understand field names
    if (lookerVisits.length > 0) {
      console.log('[Visits Reports] Sample visit fields:', Object.keys(lookerVisits[0]))
      const sampleWithKOW = lookerVisits.find((v: any) => 
        (v['device.location'] || v.device_location || v.equipment_number || '').toString().includes('KOW')
      )
      if (sampleWithKOW) {
        console.log('[Visits Reports] Sample visit with KOW:', {
          'device.location': sampleWithKOW['device.location'],
          device_location: sampleWithKOW.device_location,
          equipment_number: sampleWithKOW.equipment_number,
          completed_date: sampleWithKOW.completed_date,
          'task.pdf_report': sampleWithKOW['task.pdf_report'],
          pdf_report: sampleWithKOW.pdf_report,
        })
      }
      
      // Debug: Show actual PDF report value for KOW-SL05
      const kowSl05Visit = lookerVisits.find((v: any) => {
        const eqNum = (v['device.location'] || '').toString().trim().toUpperCase()
        return eqNum === 'KOW-SL5' || eqNum === 'KOW-SL05'
      })
      if (kowSl05Visit) {
        console.log('[Visits Reports] KOW-SL05 visit PDF report value:', {
          'task.pdf_report': kowSl05Visit['task.pdf_report'],
          rawValue: kowSl05Visit['task.pdf_report'],
          type: typeof kowSl05Visit['task.pdf_report'],
        })
      }
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
      
      // Debug: Log visits for specific equipment (TUC-FL01, TUM-E14, KOW-SL05)
      const debugEquipment = ['TUC-FL01', 'TUM-E14', 'KOW-SL05', 'KOW-SL5']
      if (debugEquipment.includes(normalizedEquipment.toUpperCase())) {
        console.log(`[Visits Reports] Found visit for ${normalizedEquipment}:`, {
          originalEquipment: equipmentNumber,
          normalizedEquipment,
          dateKey,
          pdfReportRaw: pdfReportRaw || null,
          pdfReportUrl: pdfReport || null,
          completedDate: completedDate,
        })
      }

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
    const results: Record<string, { hasReport: boolean; pdfReportUrl: string | null }> = {}

    for (const schedule of schedules) {
      if (!schedule.r1PlannedDate) {
        results[schedule.id] = { hasReport: false, pdfReportUrl: null }
        continue
      }

      const equipmentNumber = schedule.equipment.equipmentNumber
      // Normalize equipment number (handle variations like KOW-SL5 -> KOW-SL05)
      // Also normalize spaces to dashes for consistency
      let equipmentNumberUpper = equipmentNumber.toUpperCase().trim()
      equipmentNumberUpper = equipmentNumberUpper.replace(/KOW-SL(\d)$/, 'KOW-SL0$1')
      equipmentNumberUpper = equipmentNumberUpper.replace(/\s+/g, '-')
      const scheduleDateKey = getHKTDateKey(schedule.r1PlannedDate)
      const nextDateKey = addDaysToHKTDateKey(scheduleDateKey, 1)

      // Debug: Log for specific work orders
      const targetWorkOrderNumbers = ['5000428272', '5000416600', '5000606987']
      const isTargetWO = targetWorkOrderNumbers.includes(schedule.workOrderNumber || '')
      if (isTargetWO) {
        console.log(`\n[Visits Reports Debug] Checking for work order ${schedule.workOrderNumber}:`)
        console.log('  Schedule ID:', schedule.id)
        console.log('  Equipment:', equipmentNumber)
        console.log('  Equipment (upper, normalized):', equipmentNumberUpper)
        console.log('  Schedule date key:', scheduleDateKey)
        console.log('  Next date key:', nextDateKey)
        console.log('  Total visits in map:', visitsByEquipmentAndDate.size)
        console.log('  Equipment visits available:', visitsByEquipmentAndDate.has(equipmentNumberUpper))
        
        // Show all equipment numbers in the map for debugging
        const allEquipmentNumbers = Array.from(visitsByEquipmentAndDate.keys())
        const matchingEquipment = allEquipmentNumbers.filter(eq => 
          eq.toUpperCase().includes(equipmentNumberUpper.substring(0, 3))
        )
        console.log('  Matching equipment in visits (first 10):', matchingEquipment.slice(0, 10))
        console.log('  Total equipment in visits:', allEquipmentNumbers.length)
        
        // Check if exact match exists
        if (visitsByEquipmentAndDate.has(equipmentNumberUpper)) {
          console.log('  ✅ Equipment found in visits map!')
          const equipmentVisits = visitsByEquipmentAndDate.get(equipmentNumberUpper)!
          console.log('  Available date keys for this equipment:', Array.from(equipmentVisits.keys()))
        } else {
          console.log('  ❌ Equipment NOT found in visits map')
          // Check for similar equipment
          if (matchingEquipment.length > 0) {
            console.log('  Similar equipment found:', matchingEquipment)
          }
          // Show all TUC and TUM equipment
          const tucTumEquipment = allEquipmentNumbers.filter(eq => 
            eq.toUpperCase().startsWith('TUC') || eq.toUpperCase().startsWith('TUM')
          )
          if (tucTumEquipment.length > 0) {
            console.log('  All TUC/TUM equipment in visits:', tucTumEquipment)
          }
        }
      }

      // Check for visit on same date or next date (use uppercase for matching)
      const equipmentVisits = visitsByEquipmentAndDate.get(equipmentNumberUpper)
      
      if (equipmentVisits) {
        if (isTargetWO) {
          console.log('  Equipment visits map size:', equipmentVisits.size)
          console.log('  Available date keys:', Array.from(equipmentVisits.keys()))
        }
        
        // Check same date first
        const visitSameDay = equipmentVisits.get(scheduleDateKey)
        if (visitSameDay) {
          if (isTargetWO) {
            console.log('  ✅ Found visit on same day:', scheduleDateKey)
          }
          results[schedule.id] = {
            hasReport: true,
            pdfReportUrl: visitSameDay.pdfReport || null,
          }
          continue
        }

        // Check next day
        const visitNextDay = equipmentVisits.get(nextDateKey)
        if (visitNextDay) {
          if (isTargetWO) {
            console.log('  ✅ Found visit on next day:', nextDateKey)
          }
          results[schedule.id] = {
            hasReport: true,
            pdfReportUrl: visitNextDay.pdfReport || null,
          }
          continue
        }
        
        if (isTargetWO) {
          console.log('  ❌ No visit found on', scheduleDateKey, 'or', nextDateKey)
        }
      } else {
        if (isTargetWO) {
          console.log('  ❌ No visits found for equipment:', equipmentNumber)
          // Check for similar equipment numbers
          const similarEquipment = Array.from(visitsByEquipmentAndDate.keys()).filter(
            eq => eq.includes('KOW') || eq.includes('SL05')
          )
          console.log('  Similar equipment numbers in visits:', similarEquipment)
        }
      }

      // No visit found
      results[schedule.id] = { hasReport: false, pdfReportUrl: null }
    }

    // Debug: Log summary for target work orders
    const targetWorkOrderNumbers = ['5000428272', '5000416600', '5000606987']
    const targetSchedules = schedules.filter(s => targetWorkOrderNumbers.includes(s.workOrderNumber || ''))
    if (targetSchedules.length > 0) {
      console.log('\n[Visits Reports Summary]')
      console.log(`Total equipment in visits map: ${visitsByEquipmentAndDate.size}`)
      const allEquipmentNumbers = Array.from(visitsByEquipmentAndDate.keys())
      const tucTumEquipment = allEquipmentNumbers.filter(eq => 
        eq.toUpperCase().startsWith('TUC') || eq.toUpperCase().startsWith('TUM')
      )
      console.log(`TUC/TUM equipment found in Looker: ${tucTumEquipment.length > 0 ? tucTumEquipment.join(', ') : 'NONE'}`)
      targetSchedules.forEach(s => {
        const result = results[s.id]
        console.log(`  ${s.workOrderNumber}: ${result.hasReport ? '✅ HAS REPORT' : '❌ NO REPORT'}`)
      })
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

