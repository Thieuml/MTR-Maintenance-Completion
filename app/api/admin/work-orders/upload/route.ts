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
    
    // Parse CSV manually (simple CSV parser)
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length < 2) {
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
        if (char === '"') {
          inQuotes = !inQuotes
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

    // Skip empty header rows (some CSVs have metadata rows)
    // Look for the header row that contains both "Equipment" and "WO Number"
    let headerLineIndex = 0
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const parsed = parseCSVLine(lines[i])
      const lineLower = parsed.join(' ').toLowerCase()
      if (lineLower.includes('equipment') && lineLower.includes('wo number')) {
        headerLineIndex = i
        break
      }
    }

    // Parse header
    const headerLine = lines[headerLineIndex]
    const headers = parseCSVLine(headerLine).map(h => h.trim())
    
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
    const wmDateIndex = getColumnIndex(['WM Planned Start Date', 'WM Planned Start Date ', 'WM Planned', 'wm planned start date'])
    const mtrStartIndex = getColumnIndex(['MTR plan start date', 'MTR plan start', 'mtr plan start date'])
    const mtrCompletionIndex = getColumnIndex(['MTR Planned Completion Date', 'MTR Planned Completion', 'mtr planned completion date'])

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
    // Start from the line after the header
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      const line = lines[i]
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

      // Assign 11pm-eligible units to SLOT_2300
      for (const record of eligible2300) {
        try {
          await prisma.schedule.create({
            data: {
              equipmentId: record.equipment.id,
              zoneId: record.equipment.zoneMapping.zoneId,
              r0PlannedDate: record.wmPlannedDate,
              r1PlannedDate: record.wmPlannedDate,
              dueDate: record.dueDate,
              batch: record.equipment.zoneMapping.batch,
              timeSlot: 'SLOT_2300',
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
      const slots = ['SLOT_0130', 'SLOT_0330'] as const
      let slotIndex = 0

      for (const record of notEligible2300) {
        const timeSlot = slots[slotIndex % slots.length]
        slotIndex++

        try {
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

