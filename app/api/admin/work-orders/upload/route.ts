import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface CSVRow {
  equipmentNumber: string
  woNumber: string
  wmPlannedStartDate: string
  mtrPlannedStartDate: string
  mtrPlannedCompletionDate: string
}

interface ValidationError {
  line: number
  equipmentNumber: string
  woNumber: string
  error: string
}

interface UploadResult {
  success: boolean
  totalLines: number
  validLines: number
  errors: ValidationError[]
  uploaded: Array<{
    equipmentNumber: string
    woNumber: string
    uploadTimestamp: string
  }>
  message: string
}

/**
 * POST /api/admin/work-orders/upload
 * Upload work orders from CSV file
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Read file content
    const text = await file.text()
    
    // Parse CSV manually handling multi-line quoted fields
    // First, split by newlines but preserve them for multi-line field reconstruction
    const rawLines = text.split(/\r?\n/)
    
    // Reconstruct lines handling multi-line quoted fields
    // When a field is quoted and contains newlines, the CSV standard allows the newline
    // to be part of the field value. We need to reconstruct these properly.
    const lines: string[] = []
    let currentLine = ''
    let inQuotes = false
    
    for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
      const rawLine = rawLines[lineIdx]
      
      // Track quote state: count unescaped quotes
      let quoteCount = 0
      let escaped = false
      for (let i = 0; i < rawLine.length; i++) {
        if (rawLine[i] === '\\' && !escaped) {
          escaped = true
          continue
        }
        if (rawLine[i] === '"' && !escaped) {
          quoteCount++
        }
        escaped = false
      }
      
      // If we're already in quotes, this line continues the previous field
      if (inQuotes) {
        currentLine += '\n' + rawLine
        // If we have an odd number of quotes, we've closed the quoted field
        if (quoteCount % 2 === 1) {
          inQuotes = false
        }
      } else {
        // Check if this line starts a quoted field that's not closed
        // A line that starts with a quote and has an odd number of quotes
        // means the quoted field continues on the next line
        const startsWithQuote = rawLine.trim().startsWith('"')
        const hasUnclosedQuote = quoteCount % 2 === 1
        
        if (startsWithQuote && hasUnclosedQuote) {
          // This starts a multi-line quoted field
          currentLine = rawLine
          inQuotes = true
        } else {
          // This is a complete line (or continuation of previous)
          if (currentLine) {
            lines.push(currentLine)
          }
          currentLine = rawLine
        }
      }
    }
    
    // Add the last line if any
    if (currentLine) {
      lines.push(currentLine)
    }
    
    // Filter out empty lines
    const nonEmptyLines = lines.filter(line => line.trim())
    
    if (nonEmptyLines.length < 2) {
      return NextResponse.json(
        { 
          success: false,
          totalLines: 0,
          validLines: 0,
          errors: [],
          uploaded: [],
          message: 'CSV file must have at least a header and one data row'
        },
        { status: 400 }
      )
    }

    // Parse CSV line handling quoted values
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        // Handle escaped quotes (but CSV standard typically uses "" for escaped quotes, not \")
        if (char === '"') {
          // Check if this is an escaped quote (two quotes in a row)
          if (i + 1 < line.length && line[i + 1] === '"' && inQuotes) {
            current += '"'
            i++ // Skip the next quote
          } else {
            inQuotes = !inQuotes
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    // Find the header row (look for line containing both "Equipment" and "WO Number")
    // The header might span multiple lines, so we need to check if we need to combine lines
    let headerLineIndex = 0
    let headerLineCount = 1
    
    for (let i = 0; i < Math.min(5, nonEmptyLines.length); i++) {
      // Try parsing this line and the next few lines to see if header spans multiple
      let combinedHeader = nonEmptyLines[i]
      let j = i + 1
      
      // Check if this line contains header keywords
      const lineLower = combinedHeader.toLowerCase()
      if (lineLower.includes('equipment') && lineLower.includes('wo number')) {
        headerLineIndex = i
        
        // Check if header continues on next lines (common when CSV exports wrap headers)
        // Look ahead up to 3 more lines to see if they're part of the header
        while (j < Math.min(i + 4, nonEmptyLines.length)) {
          const nextLine = nonEmptyLines[j]
          const nextLineLower = nextLine.toLowerCase()
          
          // If next line looks like data (starts with equipment pattern), stop
          if (nextLine.match(/^[A-Z]{3,4}-[A-Z0-9]+/i)) {
            break
          }
          
          // If next line has header-like keywords but no data, it might be header continuation
          const hasHeaderKeywords = nextLineLower.includes('date') || 
                                   nextLineLower.includes('format') || 
                                   nextLineLower.includes('completion') ||
                                   nextLineLower.includes('deviation') ||
                                   nextLineLower.includes('week') ||
                                   nextLineLower.includes('team') ||
                                   nextLineLower.includes('remarks') ||
                                   nextLineLower.includes('rescheduled')
          
          if (hasHeaderKeywords && !nextLine.match(/^[A-Z]{3,4}-/i)) {
            combinedHeader += ' ' + nextLine
            headerLineCount++
            j++
          } else {
            break
          }
        }
        break
      }
    }

    // Parse header (may be combined from multiple lines)
    const headerLine = nonEmptyLines.slice(headerLineIndex, headerLineIndex + headerLineCount).join(' ')
    const headers = parseCSVLine(headerLine).map(h => h.trim().replace(/\s+/g, ' '))
    
    console.log('[Upload] CSV Headers found at line', headerLineIndex + 1, ':', headers)
    
    // Find column indices (handle trailing spaces and variations)
    const getColumnIndex = (possibleNames: string[]): number => {
      for (const name of possibleNames) {
        const index = headers.findIndex(h => {
          const normalized = h.toLowerCase().trim()
          const searchName = name.toLowerCase().trim()
          return normalized === searchName || normalized.includes(searchName) || searchName.includes(normalized)
        })
        if (index >= 0) return index
      }
      return -1
    }

    const equipmentIndex = getColumnIndex(['Equipment No', 'Equipment No.', 'equipment no'])
    const woIndex = getColumnIndex(['WO Number', 'WO', 'wo number'])
    const wmDateIndex = getColumnIndex(['WM Planned Start Date', 'WM Planned Start Date ', 'WM Planned Date', 'WM Planned', 'wm planned start date', 'wm planned date'])
    const mtrStartIndex = getColumnIndex(['MTR plan start date', 'MTR plan start', 'MTR Planned Date', 'MTR Planned Start Date', 'mtr plan start date', 'mtr planned date'])
    const mtrCompletionIndex = getColumnIndex(['MTR Planned Completion Date', 'MTR Planned Completion', 'Due Date', 'mtr planned completion date', 'due date'])

    console.log('[Upload] Column indices:', {
      equipmentIndex,
      woIndex,
      wmDateIndex,
      mtrStartIndex,
      mtrCompletionIndex,
    })

    if (equipmentIndex < 0 || woIndex < 0 || wmDateIndex < 0 || mtrCompletionIndex < 0) {
      return NextResponse.json(
        { 
          success: false,
          totalLines: 0,
          validLines: 0,
          errors: [{
            line: headerLineIndex + 1,
            equipmentNumber: 'N/A',
            woNumber: 'N/A',
            error: `Missing required columns. Found headers: ${headers.join(', ')}`
          }],
          uploaded: [],
          message: `CSV file missing required columns. Found headers: ${headers.join(', ')}`
        },
        { status: 400 }
      )
    }

    const records: any[] = []
    // Start from the line after the header (accounting for multi-line header)
    for (let i = headerLineIndex + headerLineCount; i < nonEmptyLines.length; i++) {
      const line = nonEmptyLines[i]
      if (!line.trim()) continue
      
      const values = parseCSVLine(line)
      // Skip rows that don't have enough columns or are clearly header/metadata rows
      if (values.length < Math.max(equipmentIndex, woIndex, wmDateIndex, mtrCompletionIndex) + 1) {
        continue
      }
      
      records.push({
        equipmentNumber: values[equipmentIndex] || '',
        woNumber: values[woIndex] || '',
        wmPlannedStartDate: values[wmDateIndex] || '',
        mtrPlannedStartDate: mtrStartIndex >= 0 ? (values[mtrStartIndex] || '') : '',
        mtrPlannedCompletionDate: values[mtrCompletionIndex] || '',
      })
    }

    const result: UploadResult = {
      success: false,
      totalLines: records.length,
      validLines: 0,
      errors: [],
      uploaded: [],
      message: '',
    }

    // First pass: Validate all records and collect valid ones
    interface ValidRecord {
      lineNumber: number
      equipmentNumber: string
      woNumber: string
      wmPlannedDate: Date
      mtrPlannedDate: Date | null
      dueDate: Date
      equipment: any
    }

    const validRecords: ValidRecord[] = []

    for (let i = 0; i < records.length; i++) {
      const row = records[i]
      const lineNumber = i + 2 // +2 because CSV has header and 0-indexed

      // Extract columns
      const equipmentNumber = row.equipmentNumber
      const woNumber = row.woNumber
      const wmPlannedStartDate = row.wmPlannedStartDate
      const mtrPlannedStartDate = row.mtrPlannedStartDate
      const mtrPlannedCompletionDate = row.mtrPlannedCompletionDate

      // Validate required fields
      if (!equipmentNumber || !woNumber || !wmPlannedStartDate || !mtrPlannedCompletionDate) {
        result.errors.push({
          line: lineNumber,
          equipmentNumber: equipmentNumber || 'N/A',
          woNumber: woNumber || 'N/A',
          error: 'Missing required fields',
        })
        continue
      }

      // Check if WO already exists
      const existingSchedule = await prisma.schedule.findUnique({
        where: { workOrderNumber: woNumber },
      })

      if (existingSchedule) {
        result.errors.push({
          line: lineNumber,
          equipmentNumber,
          woNumber,
          error: `Work Order ${woNumber} already exists`,
        })
        continue
      }

      // Find equipment and validate it's ready for Work Orders
      const equipment = await prisma.equipment.findUnique({
        where: { equipmentNumber },
        include: {
          zoneMapping: {
            include: {
              zone: true,
            },
          },
        },
      })

      if (!equipment) {
        result.errors.push({
          line: lineNumber,
          equipmentNumber,
          woNumber,
          error: `Equipment ${equipmentNumber} not found`,
        })
        continue
      }

      if (!equipment.zoneMapping || !equipment.zoneMapping.zoneId || !equipment.zoneMapping.batch) {
        result.errors.push({
          line: lineNumber,
          equipmentNumber,
          woNumber,
          error: `Equipment ${equipmentNumber} is not ready for Work Orders (missing zone/batch mapping)`,
        })
        continue
      }

      // Parse dates
      let wmPlannedDate: Date
      let mtrPlannedDate: Date | null = null
      let dueDate: Date

      try {
        wmPlannedDate = new Date(wmPlannedStartDate)
        if (isNaN(wmPlannedDate.getTime())) {
          throw new Error('Invalid WM Planned Start Date')
        }

        if (mtrPlannedStartDate) {
          mtrPlannedDate = new Date(mtrPlannedStartDate)
          if (isNaN(mtrPlannedDate.getTime())) {
            mtrPlannedDate = null
          }
        }

        dueDate = new Date(mtrPlannedCompletionDate)
        if (isNaN(dueDate.getTime())) {
          throw new Error('Invalid MTR Planned Completion Date')
        }
      } catch (error) {
        result.errors.push({
          line: lineNumber,
          equipmentNumber,
          woNumber,
          error: `Invalid date format: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
        continue
      }

      // Add to valid records
      validRecords.push({
        lineNumber,
        equipmentNumber,
        woNumber,
        wmPlannedDate,
        mtrPlannedDate,
        dueDate,
        equipment,
      })
    }

    // Second pass: Group by date and assign time slots
    // Group records by date (normalize to date string for grouping)
    const recordsByDate = new Map<string, ValidRecord[]>()
    
    for (const record of validRecords) {
      const dateKey = record.wmPlannedDate.toISOString().split('T')[0] // YYYY-MM-DD
      if (!recordsByDate.has(dateKey)) {
        recordsByDate.set(dateKey, [])
      }
      recordsByDate.get(dateKey)!.push(record)
    }

    // Process each date group
    for (const [dateKey, dateRecords] of recordsByDate.entries()) {
      // Separate 11pm-eligible units from others
      const eligible2300: ValidRecord[] = []
      const notEligible2300: ValidRecord[] = []

      for (const record of dateRecords) {
        if (record.equipment.canUse2300Slot) {
          eligible2300.push(record)
        } else {
          notEligible2300.push(record)
        }
      }

      // Helper function to find an available slot for a given date and zone
      const findAvailableSlot = async (
        date: Date,
        zoneId: string,
        preferredSlots: readonly string[]
      ): Promise<string | null> => {
        // Normalize date to start of day for comparison
        const dateStart = new Date(date)
        dateStart.setHours(0, 0, 0, 0)
        const dateEnd = new Date(date)
        dateEnd.setHours(23, 59, 59, 999)

        // Check each preferred slot in order
        for (const slot of preferredSlots) {
          const existing = await prisma.schedule.findFirst({
            where: {
              zoneId,
              r1PlannedDate: {
                gte: dateStart,
                lte: dateEnd,
              },
              timeSlot: slot,
              status: {
                not: 'CANCELLED',
              },
            },
          })

          if (!existing) {
            return slot
          }
        }

        return null
      }

      // Assign 11pm-eligible units to SLOT_2300, but check for conflicts
      // If SLOT_2300 is occupied, try SLOT_0130 or SLOT_0330 as fallback
      for (const record of eligible2300) {
        try {
          // Preferred slots for 23:00-eligible units: SLOT_2300 first, then SLOT_0130, SLOT_0330
          const preferredSlots = ['SLOT_2300', 'SLOT_0130', 'SLOT_0330'] as const
          const availableSlot = await findAvailableSlot(
            record.wmPlannedDate,
            record.equipment.zoneMapping.zoneId,
            preferredSlots
          )

          if (!availableSlot) {
            result.errors.push({
              line: record.lineNumber,
              equipmentNumber: record.equipmentNumber,
              woNumber: record.woNumber,
              error: `No available time slot found for date ${dateKey} in zone ${record.equipment.zoneMapping.zone.code}`,
            })
            continue
          }

          await prisma.schedule.create({
            data: {
              equipmentId: record.equipment.id,
              zoneId: record.equipment.zoneMapping.zoneId,
              r0PlannedDate: record.wmPlannedDate,
              r1PlannedDate: record.wmPlannedDate,
              dueDate: record.dueDate,
              batch: record.equipment.zoneMapping.batch,
              timeSlot: availableSlot,
              workOrderNumber: record.woNumber,
              mtrPlannedStartDate: record.mtrPlannedDate,
              status: 'PLANNED',
            },
          })

          result.uploaded.push({
            equipmentNumber: record.equipmentNumber,
            woNumber: record.woNumber,
            uploadTimestamp: new Date().toISOString(),
          })
          result.validLines++
        } catch (error: any) {
          result.errors.push({
            line: record.lineNumber,
            equipmentNumber: record.equipmentNumber,
            woNumber: record.woNumber,
            error: `Failed to create schedule: ${error.message}`,
          })
        }
      }

      // Distribute non-11pm units across SLOT_0130 and SLOT_0330 in round-robin
      // But check for conflicts and use next available slot if needed
      const slots = ['SLOT_0130', 'SLOT_0330'] as const
      let slotIndex = 0

      for (const record of notEligible2300) {
        try {
          // Start with round-robin slot, but check if it's available
          let timeSlot = slots[slotIndex % slots.length]
          slotIndex++

          // Check if the round-robin slot is available, if not try the other one
          const availableSlot = await findAvailableSlot(
            record.wmPlannedDate,
            record.equipment.zoneMapping.zoneId,
            slots
          )

          if (!availableSlot) {
            result.errors.push({
              line: record.lineNumber,
              equipmentNumber: record.equipmentNumber,
              woNumber: record.woNumber,
              error: `No available time slot found for date ${dateKey} in zone ${record.equipment.zoneMapping.zone.code}`,
            })
            continue
          }

          timeSlot = availableSlot

          await prisma.schedule.create({
            data: {
              equipmentId: record.equipment.id,
              zoneId: record.equipment.zoneMapping.zoneId,
              r0PlannedDate: record.wmPlannedDate,
              r1PlannedDate: record.wmPlannedDate,
              dueDate: record.dueDate,
              batch: record.equipment.zoneMapping.batch,
              timeSlot: timeSlot,
              workOrderNumber: record.woNumber,
              mtrPlannedStartDate: record.mtrPlannedDate,
              status: 'PLANNED',
            },
          })

          result.uploaded.push({
            equipmentNumber: record.equipmentNumber,
            woNumber: record.woNumber,
            uploadTimestamp: new Date().toISOString(),
          })
          result.validLines++
        } catch (error: any) {
          result.errors.push({
            line: record.lineNumber,
            equipmentNumber: record.equipmentNumber,
            woNumber: record.woNumber,
            error: `Failed to create schedule: ${error.message}`,
          })
        }
      }
    }

    // Build result message
    if (result.errors.length === 0) {
      result.success = true
      result.message = `Successfully uploaded ${result.validLines} work order(s)`
    } else if (result.validLines > 0) {
      result.success = true
      result.message = `Uploaded ${result.validLines} work order(s) with ${result.errors.length} error(s)`
    } else {
      result.message = `Upload failed: ${result.errors.length} error(s) found`
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Work Order Upload] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

