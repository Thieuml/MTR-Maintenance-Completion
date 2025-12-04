/**
 * Script to update isLate flag for all schedules using the new logic:
 * isLate = true if r1PlannedDate >= dueDate - 5 days (scheduled less than 6 days before due date)
 * 
 * Run with: npx tsx scripts/update-islate-flag.ts
 */

import { prisma } from '@/lib/prisma'

async function updateIsLateFlags() {
  console.log('Fetching all schedules with r1PlannedDate and dueDate...')
  
  // Fetch all schedules that have both r1PlannedDate and dueDate
  const allSchedules = await prisma.schedule.findMany({
    select: {
      id: true,
      workOrderNumber: true,
      status: true,
      r1PlannedDate: true,
      dueDate: true,
      isLate: true,
    },
  })

  // Filter to only schedules with both r1PlannedDate and dueDate
  const schedules = allSchedules.filter(s => s.r1PlannedDate && s.dueDate)

  console.log(`Found ${schedules.length} schedules to check (out of ${allSchedules.length} total)\n`)

  let updatedCount = 0
  let lateCount = 0
  let notLateCount = 0

  for (const schedule of schedules) {
    if (!schedule.r1PlannedDate || !schedule.dueDate) {
      continue
    }

    const scheduledDate = new Date(schedule.r1PlannedDate)
    const dueDate = new Date(schedule.dueDate)
    
    // Normalize to midnight for date comparison
    scheduledDate.setHours(0, 0, 0, 0)
    dueDate.setHours(0, 0, 0, 0)
    
    // Calculate dueDate - 5 days
    const lateThreshold = new Date(dueDate)
    lateThreshold.setDate(lateThreshold.getDate() - 5)
    
    // Late if scheduledDate >= dueDate - 5 days (scheduled less than 6 days before due date)
    const shouldBeLate = scheduledDate >= lateThreshold

    // Only update if the value has changed
    if (schedule.isLate !== shouldBeLate) {
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: { isLate: shouldBeLate },
      })
      updatedCount++
      
      if (shouldBeLate) {
        lateCount++
        console.log(`✅ Updated ${schedule.workOrderNumber || schedule.id}: ${schedule.isLate} → ${shouldBeLate} (LATE)`)
      } else {
        notLateCount++
        console.log(`✅ Updated ${schedule.workOrderNumber || schedule.id}: ${schedule.isLate} → ${shouldBeLate} (NOT LATE)`)
      }
    } else {
      if (shouldBeLate) {
        lateCount++
      } else {
        notLateCount++
      }
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`  Total schedules checked: ${schedules.length}`)
  console.log(`  Updated: ${updatedCount}`)
  console.log(`  Late: ${lateCount}`)
  console.log(`  Not Late: ${notLateCount}`)
  console.log(`  Already correct: ${schedules.length - updatedCount}`)
}

updateIsLateFlags()
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

