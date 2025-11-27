/**
 * Maintenance Visit Classification Logic
 * 
 * Classification rules:
 * - Missed Maintenance: Not completed past Due Date (MTR Planned Completion Date)
 * - On-Time Maintenance: Completion date within 6 days from MTR Planned Start Date
 * - Late Maintenance: Completion date 7+ days after MTR Planned Start Date (but before due date)
 */

export type MaintenanceClassification = 'MISSED' | 'ON_TIME' | 'LATE' | 'NOT_COMPLETED'

export interface ClassificationInput {
  mtrPlannedStartDate: Date | null
  r1PlannedDate: Date
  dueDate: Date | null
  completionDate: Date | null
  today?: Date
}

/**
 * Classify a maintenance visit based on dates
 * Note: "Missed" is calculated as total - completed, not based on due date
 */
export function classifyMaintenance(input: ClassificationInput): MaintenanceClassification {
  const {
    mtrPlannedStartDate,
    r1PlannedDate,
    dueDate,
    completionDate,
    today = new Date(),
  } = input

  // If no completion date, it's not completed
  if (!completionDate) {
    return 'NOT_COMPLETED'
  }

  // If no MTR planned start date, use WM planned date as fallback
  const referenceDate = mtrPlannedStartDate || r1PlannedDate

  // Calculate days difference from MTR Planned Start Date
  const daysDiff = Math.floor(
    (completionDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  // On-Time: within 6 days (0-6 days)
  if (daysDiff >= 0 && daysDiff <= 6) {
    return 'ON_TIME'
  }

  // Late: 7+ days after MTR planned start date
  // (We don't check due date here - that's handled separately)
  if (daysDiff >= 7) {
    return 'LATE'
  }

  // If completion date is before planned start (negative days), still consider it on-time
  // This handles cases where maintenance was done early
  return 'ON_TIME'
}

/**
 * Calculate planning deviation (days between WM Start Date and MTR Start Date)
 * Returns 0 or positive (no negative values)
 */
export function calculatePlanningDeviation(
  r1PlannedDate: Date,
  mtrPlannedStartDate: Date | null
): number | null {
  if (!mtrPlannedStartDate) {
    return null
  }

  const deviation = Math.floor(
    (r1PlannedDate.getTime() - mtrPlannedStartDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Don't go negative - we don't care if scheduled before MTR date
  return Math.max(0, deviation)
}

/**
 * Calculate execution deviation (days between completion date and WM Planned Start Date)
 * Returns 0 or positive (no negative values)
 */
export function calculateExecutionDeviation(
  r1PlannedDate: Date,
  completionDate: Date | null
): number | null {
  if (!completionDate) {
    return null
  }

  const deviation = Math.floor(
    (completionDate.getTime() - r1PlannedDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Don't go negative - we don't care if done before planned
  return Math.max(0, deviation)
}

