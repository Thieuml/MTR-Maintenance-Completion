/**
 * Debug script to check a specific work order
 */
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function debugWorkOrder() {
  const workOrderNumber = '5000407687'
  
  console.log(`🔍 Checking work order: ${workOrderNumber}`)
  
  try {
    const schedule = await prisma.schedule.findFirst({
      where: {
        workOrderNumber,
      },
      include: {
        equipment: true,
        zone: true,
        visits: {
          select: {
            completionDate: true,
          },
          orderBy: {
            completionDate: 'desc',
          },
          take: 1,
        },
      },
    })

    if (!schedule) {
      console.log('❌ Work order not found')
      return
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    console.log('\n📊 Schedule Data:')
    console.log('  Status:', schedule.status)
    console.log('  rescheduleCount:', schedule.rescheduleCount)
    console.log('  r0PlannedDate:', schedule.r0PlannedDate)
    console.log('  r1PlannedDate:', schedule.r1PlannedDate)
    console.log('  lastSkippedDate:', schedule.lastSkippedDate)
    console.log('  dueDate:', schedule.dueDate)

    console.log('\n📅 Date Analysis:')
    console.log('  Today:', today.toISOString().split('T')[0])
    console.log('  Yesterday:', yesterday.toISOString().split('T')[0])
    
    if (schedule.r1PlannedDate) {
      const r1Date = new Date(schedule.r1PlannedDate)
      r1Date.setHours(0, 0, 0, 0)
      console.log('  r1PlannedDate (normalized):', r1Date.toISOString().split('T')[0])
      console.log('  r1PlannedDate >= today:', r1Date >= today)
    } else {
      console.log('  r1PlannedDate: NULL')
    }

    if (schedule.lastSkippedDate) {
      const skippedDate = new Date(schedule.lastSkippedDate)
      skippedDate.setUTCHours(0, 0, 0, 0)
      const yesterdayUTC = new Date(yesterday)
      yesterdayUTC.setUTCHours(0, 0, 0, 0)
      console.log('  lastSkippedDate (normalized UTC):', skippedDate.toISOString().split('T')[0])
      console.log('  yesterday (normalized UTC):', yesterdayUTC.toISOString().split('T')[0])
      console.log('  lastSkippedDate === yesterday:', skippedDate.getTime() === yesterdayUTC.getTime())
    } else {
      console.log('  lastSkippedDate: NULL')
    }

    console.log('\n✅ Section Checks:')
    const isCompleted = schedule.status === 'COMPLETED' || schedule.status === 'COMPLETED_LATE'
    const isMissed = schedule.status === 'MISSED'
    const wasRescheduled = (schedule.rescheduleCount || 0) > 0
    
    let hasFutureRescheduledDate = false
    if (schedule.r1PlannedDate) {
      const r1Date = new Date(schedule.r1PlannedDate)
      r1Date.setHours(0, 0, 0, 0)
      hasFutureRescheduledDate = r1Date >= today
    }
    
    let skippedYesterday = false
    if (schedule.lastSkippedDate) {
      const skippedDate = new Date(schedule.lastSkippedDate)
      skippedDate.setHours(0, 0, 0, 0)
      skippedYesterday = skippedDate.getTime() === yesterday.getTime()
    }

    console.log('  isCompleted:', isCompleted)
    console.log('  isMissed:', isMissed)
    console.log('  wasRescheduled:', wasRescheduled)
    console.log('  hasFutureRescheduledDate:', hasFutureRescheduledDate)
    console.log('  skippedYesterday:', skippedYesterday)

    console.log('\n📋 Section Assignment:')
    if (!isCompleted && !isMissed && schedule.status === 'TO_RESCHEDULE' && !wasRescheduled) {
      console.log('  → Section 1: Items Pending Rescheduling')
    } else if (!isCompleted && wasRescheduled && hasFutureRescheduledDate) {
      if (skippedYesterday) {
        console.log('  → Section 2a: Newly Rescheduled Maintenance')
      } else {
        console.log('  → Section 2b: Other Rescheduled Maintenance')
      }
    } else {
      console.log('  → Not in any section')
      console.log('    Reasons:')
      if (isCompleted) console.log('      - Is completed')
      if (isMissed) console.log('      - Is missed')
      if (!wasRescheduled) console.log('      - Not rescheduled (rescheduleCount = 0)')
      if (!hasFutureRescheduledDate) console.log('      - r1PlannedDate is not in the future')
      if (wasRescheduled && hasFutureRescheduledDate && !skippedYesterday && schedule.lastSkippedDate) {
        console.log('      - lastSkippedDate is not yesterday')
      }
    }
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

debugWorkOrder()
  .finally(async () => {
    await prisma.$disconnect()
  })

