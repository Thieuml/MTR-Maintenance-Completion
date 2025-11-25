import { z } from 'zod'

/**
 * Validation schemas for Schedule API endpoints
 */

export const scheduleBatchSchema = z.enum(['A', 'B'])

export const timeSlotSchema = z.enum(['SLOT_2300', 'SLOT_0130', 'SLOT_0330'])

export const scheduleStatusSchema = z.enum([
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'COMPLETED_LATE',
  'MISSED',
  'RESCHEDULED',
  'OVERDUE',
  'CANCELLED',
])

/**
 * Schema for creating a new schedule
 */
export const createScheduleSchema = z.object({
  equipmentId: z.string().min(1, 'Equipment ID is required'),
  zoneId: z.string().min(1, 'Zone ID is required'),
  r0PlannedDate: z.string().datetime().or(z.date()), // ISO string or Date
  r1PlannedDate: z.string().datetime().or(z.date()), // ISO string or Date
  batch: scheduleBatchSchema,
  timeSlot: timeSlotSchema,
  fixedEngineerId: z.string().optional(),
  rotatingEngineerId: z.string().optional(),
  workOrderNumber: z.string().optional(),
  status: scheduleStatusSchema.optional().default('PLANNED'),
})

/**
 * Schema for updating a schedule
 */
export const updateScheduleSchema = z.object({
  r1PlannedDate: z.string().datetime().or(z.date()).optional(),
  batch: scheduleBatchSchema.optional(),
  timeSlot: timeSlotSchema.optional(),
  fixedEngineerId: z.string().nullable().optional(),
  rotatingEngineerId: z.string().nullable().optional(),
  workOrderNumber: z.string().nullable().optional(),
  status: scheduleStatusSchema.optional(),
})

/**
 * Schema for query parameters (GET /api/schedules)
 */
export const scheduleQuerySchema = z.object({
  zoneId: z.string().optional(),
  equipmentId: z.string().optional(),
  from: z.string().optional(), // ISO date string
  to: z.string().optional(), // ISO date string
  status: scheduleStatusSchema.optional(),
  batch: scheduleBatchSchema.optional(),
})

/**
 * Schema for bulk create
 */
export const bulkCreateScheduleSchema = z.object({
  equipmentIds: z.array(z.string()).min(1, 'At least one equipment ID is required'),
  startDate: z.string().datetime().or(z.date()), // Start date for schedules
  endDate: z.string().datetime().or(z.date()), // End date for schedules
  batch: scheduleBatchSchema.optional(), // If not provided, will alternate A/B
  defaultTimeSlot: timeSlotSchema.optional().default('SLOT_0130'),
  workOrderNumbers: z.array(z.string()).optional(), // Optional OR numbers
})

