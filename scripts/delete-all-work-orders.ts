/**
 * Script to delete all work orders (schedules) from the production database
 * 
 * WARNING: This will delete ALL schedules/work orders. Use with caution!
 * 
 * IMPORTANT: This script MUST be run with PRODUCTION DATABASE_URL explicitly set!
 * 
 * Run with:
 *   DATABASE_URL='your-production-database-url' npx tsx scripts/delete-all-work-orders.ts
 * 
 * Or export it first:
 *   export DATABASE_URL='your-production-database-url'
 *   npx tsx scripts/delete-all-work-orders.ts
 */

import { PrismaClient } from '@prisma/client'

// Create a new Prisma client that will use DATABASE_URL from environment
// This ensures we use the explicitly provided DATABASE_URL, not from .env.local
const prisma = new PrismaClient()
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

async function deleteAllWorkOrders() {
  console.log('⚠️  WARNING: This will delete ALL work orders (schedules) from the database!')
  console.log('')
  
  // Check if DATABASE_URL is set
  const dbUrl = process.env.DATABASE_URL || ''
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL environment variable is not set!')
    console.error('   Please set it to your production database URL:')
    console.error('   DATABASE_URL="postgresql://..." npx tsx scripts/delete-all-work-orders.ts')
    process.exit(1)
  }
  
  // Safety check: warn if it looks like local database
  const isLocal = dbUrl.includes('localhost') || 
                  dbUrl.includes('127.0.0.1') || 
                  (dbUrl.includes('5432') && !dbUrl.includes('neon') && !dbUrl.includes('vercel'))
  
  if (isLocal) {
    console.log('⚠️  WARNING: DATABASE_URL appears to be a local database!')
    console.log('   Database URL:', dbUrl.substring(0, 80) + '...')
    const proceed = await question('\nAre you sure you want to delete from this database? (yes/no): ')
    if (proceed.toLowerCase() !== 'yes') {
      console.log('❌ Cancelled.')
      process.exit(0)
    }
  } else {
    console.log('📊 Database URL:', dbUrl.substring(0, 80) + '...')
  }
  
  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ Database connection successful')
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    process.exit(1)
  }

  // Count existing schedules
  const count = await prisma.schedule.count()
  console.log(`\n📊 Current schedule count: ${count}`)
  
  if (count === 0) {
    console.log('✅ No schedules to delete. Database is already empty.')
    await prisma.$disconnect()
    process.exit(0)
  }

  // Show sample work orders
  const sample = await prisma.schedule.findMany({
    take: 5,
    select: {
      id: true,
      workOrderNumber: true,
      status: true,
      r1PlannedDate: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  console.log('\n📋 Sample work orders (first 5):')
  sample.forEach((wo, i) => {
    console.log(`  ${i + 1}. ${wo.workOrderNumber || wo.id} - ${wo.status} - ${wo.r1PlannedDate ? new Date(wo.r1PlannedDate).toLocaleDateString() : 'No date'}`)
  })

  // Confirmation
  console.log('\n⚠️  This operation cannot be undone!')
  const confirmation = await question('\nType "DELETE ALL" to confirm deletion: ')

  if (confirmation !== 'DELETE ALL') {
    console.log('❌ Deletion cancelled. No changes made.')
    await prisma.$disconnect()
    process.exit(0)
  }

  // Double confirmation
  const doubleCheck = await question('\nAre you absolutely sure? Type "YES" to proceed: ')

  if (doubleCheck !== 'YES') {
    console.log('❌ Deletion cancelled. No changes made.')
    await prisma.$disconnect()
    process.exit(0)
  }

  console.log('\n🗑️  Deleting all schedules and related records...')
  
  try {
    // Delete related records first (if they exist and don't cascade)
    // Note: These should cascade delete automatically, but we'll do it explicitly to be safe
    
    console.log('   Deleting maintenance visits...')
    const visitsDeleted = await prisma.maintenanceVisit.deleteMany({})
    console.log(`   ✅ Deleted ${visitsDeleted.count} visit(s)`)
    
    console.log('   Deleting reschedules...')
    const reschedulesDeleted = await prisma.reschedule.deleteMany({})
    console.log(`   ✅ Deleted ${reschedulesDeleted.count} reschedule(s)`)
    
    console.log('   Deleting all schedules...')
    const result = await prisma.schedule.deleteMany({})
    
    console.log(`\n✅ Successfully deleted ${result.count} work order(s)`)
    console.log('✅ Database is now empty and ready for new work order import')
  } catch (error) {
    console.error('❌ Error deleting schedules:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    rl.close()
  }
}

deleteAllWorkOrders()
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })

