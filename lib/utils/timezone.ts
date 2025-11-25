/**
 * Timezone utilities for MTR Maintenance Tracking
 * All times are in HKT (Hong Kong Time) - UTC+8
 */

/**
 * Convert a date to HKT (Hong Kong Time)
 * @param date - Date to convert (defaults to now)
 * @returns Date in HKT timezone
 */
export function toHKT(date: Date = new Date()): Date {
  // HKT is UTC+8
  const hktOffset = 8 * 60 * 60 * 1000 // 8 hours in milliseconds
  const utcTime = date.getTime()
  const hktTime = utcTime + hktOffset
  return new Date(hktTime)
}

/**
 * Get current date/time in HKT
 */
export function nowHKT(): Date {
  return toHKT()
}

/**
 * Format date in HKT for display
 * @param date - Date to format
 * @param includeTime - Whether to include time
 * @returns Formatted date string
 */
export function formatHKT(date: Date, includeTime: boolean = false): string {
  const hktDate = toHKT(date)
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
  
  if (includeTime) {
    options.hour = '2-digit'
    options.minute = '2-digit'
    options.hour12 = false
  }
  
  return hktDate.toLocaleString('en-US', options)
}

/**
 * Create a date at specific HKT time
 * @param year - Year
 * @param month - Month (1-12)
 * @param day - Day (1-31)
 * @param hour - Hour (0-23)
 * @param minute - Minute (0-59)
 * @returns Date object
 */
export function createHKTDate(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0
): Date {
  // Create date string in HKT format
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
  
  // Parse as if it's UTC, then adjust for HKT offset
  const utcDate = new Date(dateStr + 'Z')
  const hktOffset = 8 * 60 * 60 * 1000 // 8 hours in milliseconds
  return new Date(utcDate.getTime() - hktOffset)
}

/**
 * Get HKT timezone string
 */
export function getHKTTimezone(): string {
  return 'Asia/Hong_Kong'
}

