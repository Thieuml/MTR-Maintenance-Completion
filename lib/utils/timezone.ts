/**
 * Timezone utilities for MTR Maintenance Tracking
 * All times are in HKT (Hong Kong Time) - UTC+8
 */

/**
 * Convert a date to HKT (Hong Kong Time)
 * @param date - Date to convert (defaults to now)
 * @returns Date in HKT timezone
 */
const HKT_TIMEZONE = 'Asia/Hong_Kong'
const HKT_OFFSET = 8 * 60 * 60 * 1000 // 8 hours in milliseconds

const hktDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: HKT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Convert a date to HKT (Hong Kong Time)
 * NOTE: Returns a new Date shifted by the timezone offset. Use for calculations only,
 * prefer getHKTDateKey/formatHKTDateKey for display to avoid double shifting.
 */
export function toHKT(date: Date = new Date()): Date {
  // HKT is UTC+8
  const utcTime = date.getTime()
  const hktTime = utcTime + HKT_OFFSET
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
  return new Date(utcDate.getTime() - HKT_OFFSET)
}

/**
 * Get HKT timezone string
 */
export function getHKTTimezone(): string {
  return HKT_TIMEZONE
}

/**
 * Get YYYY-MM-DD key for a date in HKT
 */
export function getHKTDateKey(date: Date): string {
  return hktDateFormatter.format(date)
}

/**
 * Parse a YYYY-MM-DD key (HKT) back to a Date at midnight HKT
 */
export function parseHKTDateKey(key: string): Date {
  return new Date(`${key}T00:00:00+08:00`)
}

/**
 * Add days to an HKT date key
 */
export function addDaysToHKTDateKey(key: string, days: number): string {
  const date = parseHKTDateKey(key)
  date.setUTCDate(date.getUTCDate() + days)
  return getHKTDateKey(date)
}

/**
 * Format an HKT date key for display using Intl formatter
 */
export function formatHKTDateKey(
  key: string,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: HKT_TIMEZONE,
    ...options,
  })
  return formatter.format(parseHKTDateKey(key))
}

/**
 * Compare two HKT date keys (YYYY-MM-DD lexicographical compare)
 */
export function compareHKTDateKeys(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * Get today's HKT date key
 */
export function getHKTTodayKey(): string {
  return getHKTDateKey(new Date())
}

