import { prisma } from '@/lib/prisma'
import { createHKTDate } from '@/lib/utils/timezone'

async function updateWorkOrderStatus() {
  const workOrderNumber = '5000606987'
  const newStatus = 'PENDING'

  try {
    // First, check if the work order exists using raw SQL
    const existing = await prisma.$queryRaw<Array<{ id: string; status: string; "workOrderNumber": string; "r1PlannedDate": Date | null }>>`
      SELECT id, status, "workOrderNumber", "r1PlannedDate"
      FROM "Schedule"
      WHERE "workOrderNumber" = ${workOrderNumber}
      LIMIT 1
    `

    if (existing.length === 0) {
      console.error(`Work order ${workOrderNumber} not found`)
      process.exit(1)
    }

    const schedule = existing[0]
    console.log(`Found work order ${workOrderNumber}:`)
    console.log(`  Current status: ${schedule.status}`)
    console.log(`  Current r1PlannedDate: ${schedule.r1PlannedDate}`)
    console.log(`  ID: ${schedule.id}`)

    // Set r1PlannedDate to Dec 3, 2025 at 03:30 HKT (preserving the original time slot)
    // Dec 3, 2025 03:30 HKT = Dec 2, 2025 19:30 UTC
    const scheduledDate = createHKTDate(2025, 12, 3, 3, 30, 0)

    // Update status to PENDING and restore r1PlannedDate to Dec 3, 2025 at 01:30 HKT
    await prisma.$executeRaw`
      UPDATE "Schedule"
      SET 
        status = ${newStatus}::"ScheduleStatus",
        "r1PlannedDate" = ${scheduledDate}
      WHERE "workOrderNumber" = ${workOrderNumber}
    `

    console.log(`\n✅ Successfully updated work order ${workOrderNumber}:`)
    console.log(`   Status: ${schedule.status} → ${newStatus}`)
    console.log(`   r1PlannedDate: ${schedule.r1PlannedDate?.toISOString()} → ${scheduledDate.toISOString()}`)
    console.log(`   (Dec 3, 2025 at 03:30 HKT)`)
  } catch (error) {
    console.error('Error updating work order:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

updateWorkOrderStatus()

