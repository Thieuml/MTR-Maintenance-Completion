import { z } from 'zod'

/**
 * Validation schemas for Engineer Assignment API endpoints
 */

/**
 * Schema for assigning an engineer to a schedule
 */
export const assignEngineerSchema = z.object({
  engineerId: z.string().min(1, 'Engineer ID is required'),
  role: z.enum(['fixed', 'rotating']).optional().default('rotating'),
})

/**
 * Schema for unassigning an engineer from a schedule
 */
export const unassignEngineerSchema = z.object({
  engineerId: z.string().optional(), // If not provided, unassigns all engineers
  role: z.enum(['fixed', 'rotating', 'all']).optional().default('all'),
})

/**
 * Schema for query parameters (GET /api/engineers)
 */
export const engineersQuerySchema = z.object({
  zoneId: z.string().optional(),
  active: z.string().optional().transform((val) => val === 'true'),
  hasCertificates: z.string().optional().transform((val) => val === 'true'),
  search: z.string().optional(), // Search by name
})

