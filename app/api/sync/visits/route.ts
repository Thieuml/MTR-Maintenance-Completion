import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchMaintenanceVisitsFromLooker } from '@/lib/looker'
import { createHKTDate } from '@/lib/utils/timezone'

/**
 * POST /api/sync/visits
 * Sync maintenance visits from Looker (Look ID 168)
 * 
 * Fetches maintenance visits from last 3 months and creates/updates MaintenanceVisit records
 * Links visits to schedules and auto-classifies them
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const dryRun = body.dryRun === true

    console.log('[Sync Visits] Starting sync...', { dryRun })

    // Fetch visits from Looker
    const lookerVisits = await fetchMaintenanceVisitsFromLooker()
    console.log(`[Sync Visits] Fetched ${lookerVisits.length} visits from Looker`)

    if (lookerVisits.length === 0) {
      return NextResponse.json({
        success: true,
        results: { created: 0, updated: 0, errors: [] },
        visitsProcessed: 0,
        message: 'No visits found in Looker',
      })
    }

    // Map Looker data to our schema
    // Expected fields: device_id, completed_date, done_by_engineer, task_type, end_status, global_comment, pdf_report
    const visitsToSync = lookerVisits
      .filter((visit: any) => {
        // Only process REGULAR maintenance visits
        const taskType = visit.task_type || visit.type
        return taskType === 'REGULAR' || taskType === 'Regular'
      })
      .map((visit: any) => {
        const deviceId = visit.device_id || visit.deviceId
        const equipmentNumber = visit['device.location'] || visit.device_location || visit.equipment_number
        const completedDate = visit.completed_date || visit.completedDate
        const engineerName = visit.done_by_engineer || visit.engineer_name || visit.engineerName
        const endStatus = visit.end_status || visit.endStatus || visit.status
        const globalComment = visit.global_comment || visit.comment || visit.notes
        const pdfReport = visit.pdf_report || visit.pdfReport || visit.report

        if (!completedDate || !equipmentNumber) {
          throw new Error(`Invalid visit data: missing completed_date or equipment_number. Data: ${JSON.stringify(visit)}`)
        }

        return {
          deviceId: deviceId ? String(deviceId) : null,
          equipmentNumber: equipmentNumber.trim(),
          completedDate: new Date(completedDate),
          engineerName: engineerName ? engineerName.trim() : null,
          endStatus: endStatus || null,
          globalComment: globalComment || null,
          pdfReport: pdfReport || null,
        }
      })

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        visitsFound: visitsToSync.length,
        visits: visitsToSync.slice(0, 10), // Return first 10 as sample
        message: 'Dry run - no changes made',
      })
    }

    // Get all equipment and engineers for linking
    const equipment = await prisma.equipment.findMany()
    const engineers = await prisma.engineer.findMany()

    const equipmentByDeviceId = new Map(
      equipment.filter(e => e.deviceId).map(e => [e.deviceId!, e])
    )
    const equipmentByNumber = new Map(
      equipment.map(e => [e.equipmentNumber, e])
    )
    const engineersByName = new Map(
      engineers.map(e => [e.name.toLowerCase(), e])
    )

    // Sync visits to database
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    }

    // Process each visit
    for (const visitData of visitsToSync) {
      try {
        // Find equipment
        let equipmentRecord = null
        if (visitData.deviceId) {
          equipmentRecord = equipmentByDeviceId.get(visitData.deviceId)
        }
        if (!equipmentRecord) {
          equipmentRecord = equipmentByNumber.get(visitData.equipmentNumber)
        }

        if (!equipmentRecord) {
          results.errors.push(`Equipment not found: ${visitData.equipmentNumber}`)
          continue
        }

        // Find engineer (required field)
        let engineer = null
        if (visitData.engineerName) {
          engineer = engineersByName.get(visitData.engineerName.toLowerCase())
        }

        if (!engineer) {
          results.errors.push(`Engineer not found: ${visitData.engineerName || 'Unknown'}`)
          results.skipped++
          continue // Skip visit if engineer is required but not found
        }

        // Find related schedule (if exists)
        // Look for schedule with matching equipment and date close to completed date
        const schedule = await prisma.schedule.findFirst({
          where: {
            equipmentId: equipmentRecord.id,
            r1PlannedDate: {
              gte: new Date(visitData.completedDate.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days before
              lte: new Date(visitData.completedDate.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days after
            },
          },
          orderBy: {
            r1PlannedDate: 'asc',
          },
        })

        // Auto-classify visit
        let classification: 'COMMITTED_DATE' | 'ON_TIME' | 'LATE' | 'OVERDUE' | 'NOT_COMPLETED' = 'NOT_COMPLETED'
        if (schedule) {
          const committedDate = schedule.r1PlannedDate
          if (!committedDate) {
            classification = 'NOT_COMPLETED'
          } else {
            const daysDiff = Math.floor(
              (visitData.completedDate.getTime() - committedDate.getTime()) / (24 * 60 * 60 * 1000)
            )

            if (daysDiff === 0) {
              classification = 'COMMITTED_DATE'
            } else if (Math.abs(daysDiff) <= 5) {
              classification = 'ON_TIME'
            } else if (daysDiff > 5 && visitData.completedDate <= schedule.dueDate) {
              classification = 'LATE'
            } else if (visitData.completedDate > schedule.dueDate) {
              classification = 'OVERDUE'
            }
          }

        // Check if visit already exists (by equipment and completion date)
        const existingVisit = await prisma.maintenanceVisit.findFirst({
          where: {
            equipmentId: equipmentRecord.id,
            actualStartDate: {
              gte: new Date(visitData.completedDate.getTime() - 24 * 60 * 60 * 1000),
              lte: new Date(visitData.completedDate.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        })

        // Skip visit creation if required fields are missing
        // According to schema, scheduleId and engineerId are required
        if (!schedule?.id || !engineer?.id) {
          results.skipped++
          continue
        }

        const visitDataToSave = {
          scheduleId: schedule.id,
          equipmentId: equipmentRecord.id,
          actualStartDate: visitData.completedDate,
          actualEndDate: visitData.completedDate, // Use same date if no end date
          engineerId: engineer.id,
          completed: true,
          completionDate: visitData.completedDate,
          pmFormSubmitted: !!visitData.pdfReport,
          pmFormSubmittedAt: visitData.pdfReport ? visitData.completedDate : null,
          classification,
          notes: visitData.globalComment || null,
        }

        if (existingVisit) {
          // Update existing visit
          await prisma.maintenanceVisit.update({
            where: { id: existingVisit.id },
            data: visitDataToSave,
          })
          results.updated++
        } else {
          // Create new visit
          await prisma.maintenanceVisit.create({
            data: visitDataToSave,
          })
          results.created++
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        results.errors.push(`Failed to sync visit for ${visitData.equipmentNumber}: ${errorMsg}`)
        console.error(`[Sync Visits] Error syncing visit:`, error)
      }
    }

    console.log('[Sync Visits] Sync completed:', results)

    return NextResponse.json({
      success: true,
      results,
      visitsProcessed: visitsToSync.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Sync Visits] Sync failed:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sync/visits
 * Test Looker connection
 */
export async function GET() {
  try {
    const visits = await fetchMaintenanceVisitsFromLooker()
    return NextResponse.json({
      connected: true,
      visitsFound: visits.length,
      message: 'Looker connection successful',
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        connected: false,
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}

