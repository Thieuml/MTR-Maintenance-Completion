/**
 * Script to update isLate flag for all schedules using the new logic:
 * isLate = true if r1PlannedDate >= dueDate - 5 days (scheduled less than 6 days before due date)
 * 
 * IMPORTANT: This script is designed for LOCAL database only by default.
 * 
 * Run with: npx tsx scripts/update-islate-flag.ts
 * 
 * To use with PRODUCTION database (requires explicit confirmation):
 *   DATABASE_URL="your-production-url" npx tsx scripts/update-islate-flag.ts
 */

import { prisma } from '@/lib/prisma'
import * as readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve)
  })
}

async function updateIsLateFlags() {
  // Safety check: Verify we're connecting to the intended database
  const dbUrl = process.env.DATABASE_URL || ''
  
  // Check if it's a local database
  const isLocal = dbUrl.includes('localhost') || 
                  dbUrl.includes('127.0.0.1') || 
                  (dbUrl.includes(':5432') && !dbUrl.includes('neon') && !dbUrl.includes('vercel') && !dbUrl.includes('pooler'))
  
  // Check if it's clearly production (neon, vercel, or pooler)
  const isProduction = dbUrl.includes('neon') || 
                       dbUrl.includes('vercel') || 
                       dbUrl.includes('pooler') ||
                       dbUrl.includes('ep-') // Neon endpoint pattern
  
  if (isProduction) {
    console.error('⚠️  WARNING: DATABASE_URL appears to be a PRODUCTION database!')
    console.error('   Database URL:', dbUrl.substring(0, 80) + '...')
    console.error('')
    console.error('   This script will update isLate flags for ALL schedules in the database.')
    console.error('')
    
    const proceed = await question('Are you absolutely sure you want to proceed with PRODUCTION? (type "YES" to continue): ')
    if (proceed.trim() !== 'YES') {
      console.log('❌ Cancelled. Script aborted for safety.')
      rl.close()
      process.exit(0)
    }
  } else if (isLocal) {
    console.log('✅ Safety check: Connecting to LOCAL database')
    console.log('   Database URL:', dbUrl.substring(0, 80) + '...')
    console.log('')
  } else {
    console.warn('⚠️  WARNING: Could not determine if database is LOCAL or PRODUCTION')
    console.warn('   Database URL:', dbUrl.substring(0, 80) + '...')
    console.warn('')
    const proceed = await question('Do you want to proceed? (type "yes" to continue): ')
    if (proceed.trim().toLowerCase() !== 'yes') {
      console.log('❌ Cancelled. Script aborted for safety.')
      rl.close()
      process.exit(0)
    }
  }

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
    rl.close()
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    rl.close()
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    rl.close()
  })

