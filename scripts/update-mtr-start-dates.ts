/**
 * Script to update MTR Planned Start Date for work orders that don't have one
 * Sets MTR start date = dueDate - 14 days
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function main() {
  console.log('Starting MTR start date update...')

  // Find all schedules with dueDate but no mtrPlannedStartDate
  const schedules = await prisma.schedule.findMany({
    where: {
      mtrPlannedStartDate: null,
    },
    select: {
      id: true,
      workOrderNumber: true,
      equipment: {
        select: {
          equipmentNumber: true,
        },
      },
      dueDate: true,
    },
  })

  // Filter to only those with dueDate (not null)
  const schedulesWithDueDate = schedules.filter((s) => s.dueDate !== null)

  console.log(`Found ${schedulesWithDueDate.length} schedules without MTR start date (with due date)`)

  let updated = 0
  let errors = 0

  for (const schedule of schedulesWithDueDate) {
    if (!schedule.dueDate) continue

    try {
      // Calculate MTR start date = dueDate - 14 days
      const mtrStartDate = new Date(schedule.dueDate)
      mtrStartDate.setDate(mtrStartDate.getDate() - 14)

      await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          mtrPlannedStartDate: mtrStartDate,
        },
      })

      updated++
      console.log(
        `✓ Updated ${schedule.equipment.equipmentNumber} (WO: ${schedule.workOrderNumber || 'N/A'}) - MTR Start: ${mtrStartDate.toISOString().split('T')[0]}`
      )
    } catch (error) {
      errors++
      console.error(
        `✗ Error updating ${schedule.equipment.equipmentNumber}:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  console.log(`\nCompleted: ${updated} updated, ${errors} errors`)
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

