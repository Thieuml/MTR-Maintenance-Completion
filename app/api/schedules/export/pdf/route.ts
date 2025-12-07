import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsPDF } from 'jspdf'
import { getHKTDateKey, formatHKTDateKey, parseHKTDateKey, addDaysToHKTDateKey } from '@/lib/utils/timezone'

/**
 * GET /api/schedules/export/pdf
 * Export schedule as PDF for a configurable period
 * Query params:
 *   - startWeek: YYYY-MM-DD (start of the week, defaults to current week)
 *   - numWeeks: number of weeks to include (1-4, defaults to 4)
 *   - zones: comma-separated zone IDs to include (defaults to all zones)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const startWeekParam = searchParams.get('startWeek')
    const numWeeksParam = searchParams.get('numWeeks')
    const zonesParam = searchParams.get('zones')

    const numWeeks = numWeeksParam ? Math.min(Math.max(1, parseInt(numWeeksParam, 10)), 4) : 4
    const selectedZoneIds = zonesParam ? zonesParam.split(',').filter(Boolean) : null

    // Calculate period
    // Parse startWeek as HKT date (YYYY-MM-DD)
    // parseHKTDateKey returns a Date object that represents midnight HKT as a UTC Date
    let startDateUTC: Date
    if (startWeekParam) {
      startDateUTC = parseHKTDateKey(startWeekParam)
    } else {
      // Default to current week (Sunday) in HKT
      const today = new Date()
      // Get current date in HKT
      const hktDateStr = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' })
      const hktDate = parseHKTDateKey(hktDateStr)
      const dayOfWeek = hktDate.getUTCDay()
      startDateUTC = new Date(hktDate)
      startDateUTC.setUTCDate(hktDate.getUTCDate() - dayOfWeek) // Go to Sunday
      startDateUTC.setUTCHours(0, 0, 0, 0)
    }

    const endDateUTC = new Date(startDateUTC)
    endDateUTC.setUTCDate(startDateUTC.getUTCDate() + (numWeeks * 7 - 1)) // numWeeks * 7 days - 1
    endDateUTC.setUTCHours(23, 59, 59, 999)

    // Convert to ISO strings for database query
    const from = startDateUTC.toISOString().split('T')[0]
    const to = endDateUTC.toISOString().split('T')[0]

    // Fetch zones (filtered if specified)
    const zones = await prisma.zone.findMany({
      where: {
        active: true,
        ...(selectedZoneIds ? { id: { in: selectedZoneIds } } : {}),
      },
      orderBy: { code: 'asc' },
    })

    // Fetch schedules for the period
    const schedules = await prisma.schedule.findMany({
      where: {
        OR: [
          // PLANNED items with r1PlannedDate in range
          {
            status: 'PLANNED',
            r1PlannedDate: {
              gte: startDateUTC,
              lte: endDateUTC,
            },
          },
          // COMPLETED items with r1PlannedDate in range (or updatedAt for migrated)
          {
            status: 'COMPLETED',
            OR: [
              {
                r1PlannedDate: {
                  gte: startDateUTC,
                  lte: endDateUTC,
                },
              },
              {
                r1PlannedDate: null,
                updatedAt: {
                  gte: startDateUTC,
                  lte: endDateUTC,
                },
              },
            ],
          },
          // SKIPPED items with lastSkippedDate in range
          {
            status: 'SKIPPED',
            lastSkippedDate: {
              gte: startDateUTC,
              lte: endDateUTC,
            },
          },
        ],
      },
      select: {
        id: true,
        r1PlannedDate: true,
        updatedAt: true,
        lastSkippedDate: true,
        dueDate: true,
        isLate: true,
        timeSlot: true,
        status: true,
        workOrderNumber: true,
        batch: true,
        equipment: {
          select: {
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
            name: true,
          },
        },
        rotatingEngineer: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        r1PlannedDate: 'asc',
      },
    })

    // Group schedules by zone
    const schedulesByZone = new Map<string, typeof schedules>()
    zones.forEach((zone) => {
      schedulesByZone.set(zone.id, [])
    })
    schedules.forEach((schedule) => {
      const zoneId = schedule.zone.id
      if (schedulesByZone.has(zoneId)) {
        schedulesByZone.get(zoneId)!.push(schedule)
      }
    })

    // Generate PDF
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    // Helper to get schedule date
    const getScheduleDate = (schedule: typeof schedules[0]): Date | null => {
      if (schedule.status === 'COMPLETED') {
        return schedule.r1PlannedDate ?? schedule.updatedAt ?? null
      }
      if (schedule.status === 'SKIPPED') {
        return schedule.lastSkippedDate ?? null
      }
      return schedule.r1PlannedDate ?? null
    }

    // Generate date keys for the period (in HKT)
    // Convert UTC date back to HKT date key for display
    const totalDays = numWeeks * 7
    const dateKeys: string[] = []
    let currentDate = new Date(startDateUTC)
    for (let i = 0; i < totalDays; i++) {
      dateKeys.push(getHKTDateKey(currentDate))
      currentDate = new Date(currentDate)
      currentDate.setUTCDate(currentDate.getUTCDate() + 1)
    }

    // Group dates into weeks (Sunday to Saturday)
    const weeks: string[][] = []
    for (let i = 0; i < totalDays; i += 7) {
      weeks.push(dateKeys.slice(i, i + 7))
    }

    // Time slots
    const timeSlots = [
      { slot: 'SLOT_2300', label: '23:00' },
      { slot: 'SLOT_0130', label: '01:30' },
      { slot: 'SLOT_0330', label: '03:30' },
    ] as const

    // Group schedules by date and time slot
    const groupSchedulesByDateAndSlot = (zoneSchedules: typeof schedules) => {
      const grouped = new Map<string, Map<string, typeof schedules>>()
      dateKeys.forEach((dateKey) => {
        grouped.set(dateKey, new Map())
        timeSlots.forEach((ts) => {
          grouped.get(dateKey)!.set(ts.slot, [])
        })
      })

      zoneSchedules.forEach((schedule) => {
        const scheduleDate = getScheduleDate(schedule)
        if (!scheduleDate) return

        const dateKey = getHKTDateKey(scheduleDate)
        if (!grouped.has(dateKey)) return

        const slot = schedule.timeSlot
        const slotMap = grouped.get(dateKey)!
        if (slotMap.has(slot)) {
          slotMap.get(slot)!.push(schedule)
        }
      })

      return grouped
    }

    // Generate PDF pages (one per zone)
    let pageNumber = 1
    const totalZones = zones.length

    zones.forEach((zone, zoneIndex) => {
      if (zoneIndex > 0) {
        pdf.addPage()
        pageNumber++
      }

      const zoneSchedules = schedulesByZone.get(zone.id) || []
      const schedulesByDateAndSlot = groupSchedulesByDateAndSlot(zoneSchedules)

      // Page dimensions (landscape A4)
      const pageWidth = 297 // mm
      const pageHeight = 210 // mm
      const margin = 15 // Increased margin for better printable view
      const contentWidth = pageWidth - 2 * margin
      const contentHeight = pageHeight - 2 * margin

      // Brand colors (RGB)
      const wmBlue = [39, 44, 108] // #272C6C
      const wmLightBlue = [0, 129, 197] // #0081C5
      const wmOrange = [241, 101, 60] // #F1653C

      // Header
      pdf.setFontSize(18)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(wmBlue[0], wmBlue[1], wmBlue[2])
      pdf.text(`${zone.code} - ${zone.name}`, margin, margin + 8)
      pdf.setTextColor(0, 0, 0) // Reset to black

      // Period
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      const lastDateIndex = dateKeys.length - 1
      const periodText = `${formatHKTDateKey(dateKeys[0], { month: 'short', day: 'numeric' })} - ${formatHKTDateKey(dateKeys[lastDateIndex], { month: 'short', day: 'numeric', year: 'numeric' })}`
      pdf.text(periodText, margin, margin + 15)

      // Calculate available height for content
      const headerHeight = 20 // Zone header + period
      const footerHeight = 8
      const availableHeight = pageHeight - margin * 2 - headerHeight - footerHeight
      
      // We need to fit: numWeeks week headers + numWeeks day headers + (numWeeks * 3) time slot rows
      // Add some spacing between weeks
      const weekSpacing = 1 // mm between weeks
      const totalSpacing = weekSpacing * (numWeeks - 1) // gaps between weeks
      const availableForRows = availableHeight - totalSpacing
      
      // Calculate row heights to fit
      const weekHeaderHeight = 7 // Reduced height
      const dayHeaderHeight = 6 // Reduced height for time/date row
      const totalTimeSlotRows = numWeeks * 3
      // Calculate base time slot row height, then add extra space saved from day header reduction
      const savedHeightFromDayHeader = (8 - dayHeaderHeight) * numWeeks // Height saved from reducing day header
      const baseTimeSlotRowHeight = Math.floor((availableForRows - (numWeeks * weekHeaderHeight) - (numWeeks * dayHeaderHeight)) / totalTimeSlotRows)
      const timeSlotRowHeight = baseTimeSlotRowHeight + Math.floor(savedHeightFromDayHeader / totalTimeSlotRows)
      
      const timeSlotColWidth = 18
      const dayColWidth = (contentWidth - timeSlotColWidth) / 7 // 7 days per week
      let currentY = margin + headerHeight

      // Consistent border settings
      pdf.setDrawColor(180, 180, 180) // Light gray borders
      pdf.setLineWidth(0.2)

      // Draw each week
      weeks.forEach((weekDates, weekIndex) => {
        // Week number (1-numWeeks)
        const weekNumber = weekIndex + 1
        
        // Determine batch for this week (check schedules in this week)
        const weekSchedules = weekDates.flatMap((dateKey) => {
          const daySchedules: typeof schedules = []
          timeSlots.forEach((ts) => {
            const schedules = schedulesByDateAndSlot.get(dateKey)?.get(ts.slot) || []
            daySchedules.push(...schedules)
          })
          return daySchedules
        })
        const batches = new Set(weekSchedules.map((s) => s.batch).filter(Boolean))
        const batchLabel = batches.size === 1 ? ` ${Array.from(batches)[0]}` : batches.size > 1 ? ' Mixed' : ''
        
        // Week header with brand colors alternating
        const weekBgColor = weekIndex % 2 === 0 
          ? [wmLightBlue[0], wmLightBlue[1], wmLightBlue[2]] // WM Light Blue
          : [wmBlue[0], wmBlue[1], wmBlue[2]] // WM Blue
        pdf.setFillColor(weekBgColor[0], weekBgColor[1], weekBgColor[2])
        pdf.rect(margin, currentY, contentWidth, weekHeaderHeight, 'FD') // Fill and draw border
        
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(255, 255, 255) // White text on colored background
        const weekStartDate = formatHKTDateKey(weekDates[0], { month: 'short', day: 'numeric' })
        const weekEndDate = formatHKTDateKey(weekDates[6], { month: 'short', day: 'numeric' })
        pdf.text(`Week ${weekNumber}${batchLabel} (${weekStartDate} - ${weekEndDate})`, margin + 5, currentY + 5)
        pdf.setTextColor(0, 0, 0) // Reset to black

        currentY += weekHeaderHeight

        // Day headers (Sunday to Saturday)
        pdf.setFillColor(245, 245, 245) // Light gray background
        pdf.rect(margin, currentY, timeSlotColWidth, dayHeaderHeight, 'FD') // Fill and draw border
        pdf.setFontSize(8)
        pdf.setFont('helvetica', 'bold')
        pdf.text('Time', margin + timeSlotColWidth / 2, currentY + dayHeaderHeight / 2, {
          align: 'center',
        })

        weekDates.forEach((dateKey, dayIndex) => {
          const x = margin + timeSlotColWidth + dayIndex * dayColWidth
          pdf.setFillColor(245, 245, 245) // Light gray background
          pdf.rect(x, currentY, dayColWidth, dayHeaderHeight, 'FD') // Fill and draw border

          // Day of week and date on one line with same font
          pdf.setFontSize(7)
          pdf.setFont('helvetica', 'bold')
          const dayOfWeek = formatHKTDateKey(dateKey, { weekday: 'short' })
          const dateStr = formatHKTDateKey(dateKey, { month: 'short', day: 'numeric' })
          const dayDateText = `${dayOfWeek} ${dateStr}`
          pdf.text(dayDateText, x + dayColWidth / 2, currentY + dayHeaderHeight / 2, { align: 'center' })
        })

        currentY += dayHeaderHeight

        // Time slot rows
        timeSlots.forEach((timeSlot, slotIndex) => {
          const rowY = currentY + slotIndex * timeSlotRowHeight

          // Time slot label - use #D8D8EF
          const rowHeaderColor = [216, 216, 239] // #D8D8EF
          pdf.setFillColor(rowHeaderColor[0], rowHeaderColor[1], rowHeaderColor[2])
          pdf.rect(margin, rowY, timeSlotColWidth, timeSlotRowHeight, 'FD') // Fill and draw border
          pdf.setFontSize(7)
          pdf.setFont('helvetica', 'bold')
          pdf.text(timeSlot.label, margin + timeSlotColWidth / 2, rowY + timeSlotRowHeight / 2, {
            align: 'center',
          })

          // Day cells
          weekDates.forEach((dateKey, dayIndex) => {
            const x = margin + timeSlotColWidth + dayIndex * dayColWidth
            const cellSchedules = schedulesByDateAndSlot.get(dateKey)?.get(timeSlot.slot) || []

            // Draw schedule content with consistent borders
            if (cellSchedules.length > 0) {
              // Use different colors based on status with brand colors
              if (cellSchedules[0].status === 'COMPLETED') {
                // Light green tint for completed
                pdf.setFillColor(230, 255, 230)
              } else if (cellSchedules[0].status === 'SKIPPED') {
                // Use WM Orange tint for skipped
                pdf.setFillColor(255, 240, 230)
              } else {
                // White for planned
                pdf.setFillColor(255, 255, 255)
              }
              // Always draw border (FD = Fill and Draw)
              pdf.rect(x, rowY, dayColWidth, timeSlotRowHeight, 'FD')

              const schedule = cellSchedules[0]
              
              // Use consistent margins all around (similar to horizontal margins)
              const cellMargin = 1.5 // Consistent margin from all borders
              const leftMargin = cellMargin
              const rightMargin = cellMargin
              const topMargin = cellMargin
              const bottomMargin = cellMargin
              
              // Font sizes and spacing
              const equipmentFontSize = 7
              const workOrderFontSize = 6
              const dueDateFontSize = 6
              const lineSpacing = 2.2 // Space between lines
              
              // Calculate line positions from top
              const firstLineY = rowY + topMargin + 2.5 // First line baseline (equipment + due date)
              const secondLineY = firstLineY + lineSpacing + 1.2 // Second line baseline (work order)
              
              // Due date on the same line as equipment number (top right)
              if (schedule.dueDate) {
                pdf.setFontSize(dueDateFontSize)
                pdf.setFont('helvetica', 'normal')
                const dueDate = new Date(schedule.dueDate)
                const dueDateStr = formatHKTDateKey(getHKTDateKey(dueDate), { month: 'short', day: 'numeric' })
                const dueTextX = x + dayColWidth - rightMargin
                pdf.text(`Due: ${dueDateStr}`, dueTextX, firstLineY, { align: 'right', maxWidth: dayColWidth - leftMargin - rightMargin })
              }
              
              // Equipment number (top left, bold)
              pdf.setFontSize(equipmentFontSize)
              pdf.setFont('helvetica', 'bold')
              const equipmentNum = schedule.equipment.equipmentNumber
              
              // Add warning indicator for planned late units
              if (schedule.isLate && schedule.status === 'PLANNED') {
                // Draw a small red square as warning indicator
                pdf.setFillColor(255, 0, 0) // Red
                const indicatorSize = 1.5
                const indicatorX = x + leftMargin
                const indicatorY = firstLineY - 2 // Position above text baseline
                pdf.rect(indicatorX, indicatorY, indicatorSize, indicatorSize, 'F')
                // Equipment number, adjusted for indicator
                const equipmentX = x + leftMargin + indicatorSize + 0.5
                pdf.text(equipmentNum, equipmentX, firstLineY, { align: 'left', maxWidth: dayColWidth - equipmentX - rightMargin })
              } else {
                // Equipment number without indicator
                pdf.text(equipmentNum, x + leftMargin, firstLineY, { align: 'left', maxWidth: dayColWidth - leftMargin - rightMargin })
              }

              // Work order number if available (second line, left, with better spacing from bottom)
              if (schedule.workOrderNumber) {
                pdf.setFontSize(workOrderFontSize)
                pdf.setFont('helvetica', 'normal')
                pdf.text(`OR: ${schedule.workOrderNumber}`, x + leftMargin, secondLineY, { align: 'left', maxWidth: dayColWidth - leftMargin - rightMargin })
              }

              // Multiple schedules indicator
              if (cellSchedules.length > 1) {
                pdf.setFontSize(6)
                pdf.setFont('helvetica', 'bold')
                pdf.text(`+${cellSchedules.length - 1}`, x + dayColWidth - 4, rowY + 2)
              }
            } else {
              // Empty cell - show SPARE with border
              pdf.setFillColor(255, 255, 255) // White background
              pdf.rect(x, rowY, dayColWidth, timeSlotRowHeight, 'FD') // Fill and draw border
              pdf.setFontSize(6)
              pdf.setFont('helvetica', 'italic')
              pdf.setTextColor(150, 150, 150)
              pdf.text('SPARE', x + dayColWidth / 2, rowY + timeSlotRowHeight / 2, {
                align: 'center',
              })
              pdf.setTextColor(0, 0, 0) // Reset color
            }
          })
        })

        currentY += timeSlotRowHeight * 3 + weekSpacing // Move to next week with spacing
      })

      // Footer
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(100, 100, 100) // Gray text
      pdf.text(
        `Page ${pageNumber} of ${totalZones} - Generated ${new Date().toLocaleDateString()}`,
        pageWidth / 2,
        pageHeight - margin / 2,
        { align: 'center' }
      )
      pdf.setTextColor(0, 0, 0) // Reset to black
    })

    // Generate PDF buffer
    const pdfBlob = pdf.output('arraybuffer')
    const pdfBuffer = Buffer.from(pdfBlob)

    // Return PDF
    const lastDateIndex = dateKeys.length - 1
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="mtr-schedule-${dateKeys[0]}-to-${dateKeys[lastDateIndex]}.pdf"`,
      },
    })
  } catch (error) {
    console.error('[PDF Export] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: errorMessage },
      { status: 500 }
    )
  }
}

