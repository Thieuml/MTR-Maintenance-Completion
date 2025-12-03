/**
 * Copy data from production database to local database
 * Usage: PROD_DATABASE_URL=<production-url> tsx scripts/database/copy-from-production.ts
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const prodDatabaseUrl = process.env.PROD_DATABASE_URL || process.env.PRODUCTION_DATABASE_URL
const localDatabaseUrl = process.env.DATABASE_URL

if (!prodDatabaseUrl) {
  console.error('❌ Error: PROD_DATABASE_URL or PRODUCTION_DATABASE_URL environment variable is required')
  console.error('   Usage: PROD_DATABASE_URL=<production-url> tsx scripts/database/copy-from-production.ts')
  process.exit(1)
}

if (!localDatabaseUrl) {
  console.error('❌ Error: DATABASE_URL environment variable is required')
  process.exit(1)
}

// Create Prisma clients for both databases
const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: prodDatabaseUrl,
    },
  },
})

const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: localDatabaseUrl,
    },
  },
})

interface TableData {
  table: string
  data: any[]
}

async function exportFromProduction(tableName: string): Promise<any[]> {
  console.log(`  Exporting ${tableName} from production...`)
  
  // Special handling for Schedule table due to enum mismatch
  if (tableName === 'schedule') {
    // Use raw SQL to avoid enum validation issues
    const data = await prodPrisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "Schedule"
    `)
    console.log(`    ✓ Found ${data.length} records`)
    return data
  }
  
  // @ts-ignore - Dynamic table access
  const data = await prodPrisma[tableName].findMany()
  console.log(`    ✓ Found ${data.length} records`)
  return data
}

async function importToLocal(tableName: string, data: any[]): Promise<void> {
  if (data.length === 0) {
    console.log(`  Skipping ${tableName} (no data)`)
    return
  }

  console.log(`  Importing ${data.length} records to ${tableName}...`)
  
  // @ts-ignore - Dynamic table access
  const model = localPrisma[tableName]
  
  let successCount = 0
  let errorCount = 0
  
  // Use createMany for better performance where possible
  if (tableName === 'zone' || tableName === 'engineer' || tableName === 'equipment') {
    // For simple tables, try createMany first, then upsert individual records
    for (const record of data) {
      try {
        // @ts-ignore
        await model.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
        successCount++
      } catch (error: any) {
        errorCount++
        if (!error.message.includes('RESCHEDULED')) {
          console.error(`    ✗ Error importing record ${record.id}:`, error.message)
        }
      }
    }
  } else {
    // For tables with relations, use individual upserts
    for (const record of data) {
      try {
        // Map old enum values to new ones for Schedule table
        if (tableName === 'schedule' && record.status) {
          const statusMap: Record<string, string> = {
            'COMPLETED_LATE': 'COMPLETED',
            'RESCHEDULED': 'PLANNED',
            'TO_RESCHEDULE': 'SKIPPED', // Will be corrected based on dueDate later
            'IN_PROGRESS': 'PENDING',
            'OVERDUE': 'MISSED',
          }
          if (statusMap[record.status]) {
            record.status = statusMap[record.status]
            // If mapping RESCHEDULED to PLANNED, set skippedCount
            if (record.status === 'PLANNED' && statusMap[record.status] === 'PLANNED') {
              record.skippedCount = (record.skippedCount || 0) + 1
            }
          }
        }
        
        // @ts-ignore
        await model.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
        successCount++
      } catch (error: any) {
        errorCount++
        if (error.message.includes('Unique constraint')) {
          // Try update instead
          try {
            // Map status again for update
            if (tableName === 'schedule' && record.status) {
              const statusMap: Record<string, string> = {
                'COMPLETED_LATE': 'COMPLETED',
                'RESCHEDULED': 'PLANNED',
                'TO_RESCHEDULE': 'SKIPPED',
                'IN_PROGRESS': 'PENDING',
                'OVERDUE': 'MISSED',
              }
              if (statusMap[record.status]) {
                record.status = statusMap[record.status]
              }
            }
            
            // @ts-ignore
            await model.update({
              where: { id: record.id },
              data: record,
            })
            successCount++
            errorCount--
          } catch (updateError: any) {
            console.error(`    ✗ Error updating record ${record.id}:`, updateError.message)
          }
        } else {
          console.error(`    ✗ Error importing record ${record.id}:`, error.message)
        }
      }
    }
  }
  console.log(`    ✓ Imported ${successCount} records${errorCount > 0 ? ` (${errorCount} failed)` : ''}`)
}

async function copyFromProduction() {
  console.log('🔄 Copying data from production to local database...\n')
  console.log(`📤 Source: Production database`)
  console.log(`📥 Destination: Local database\n`)

  console.log('⚠️  WARNING: This will DELETE all existing data in local database!')
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n')
  await new Promise(resolve => setTimeout(resolve, 5000))

  try {
    // Clear local database first (in reverse order of dependencies)
    console.log('\n🗑️  Clearing local database...')
    await localPrisma.maintenanceVisit.deleteMany()
    await localPrisma.reschedule.deleteMany()
    await localPrisma.schedule.deleteMany()
    await localPrisma.equipmentZoneMapping.deleteMany()
    await localPrisma.zoneEngineerAssignment.deleteMany()
    await localPrisma.equipment.deleteMany()
    await localPrisma.engineer.deleteMany()
    await localPrisma.zone.deleteMany()
    console.log('✓ Local database cleared\n')

    // Export and import tables in order (respecting foreign key dependencies)
    const tables = [
      'zone',
      'engineer',
      'equipment',
      'zoneEngineerAssignment',
      'equipmentZoneMapping',
      'schedule',
      'reschedule',
      'maintenanceVisit',
    ]

    const exportData: Record<string, any[]> = {}

    // Step 1: Export all data from production
    console.log('📤 Step 1: Exporting from production...')
    for (const table of tables) {
      try {
        const data = await exportFromProduction(table)
        exportData[table] = data
      } catch (error: any) {
        console.error(`  ✗ Error exporting ${table}:`, error.message)
        exportData[table] = []
      }
    }

    console.log('\n📥 Step 2: Importing to local database...')
    // Step 2: Import to local
    for (const table of tables) {
      try {
        await importToLocal(table, exportData[table])
      } catch (error: any) {
        console.error(`  ✗ Error importing ${table}:`, error.message)
      }
    }

    console.log('\n✅ Copy complete!')
    console.log('\n📊 Summary:')
    Object.entries(exportData).forEach(([table, data]) => {
      console.log(`  ${table}: ${data.length} records`)
    })
  } catch (error) {
    console.error('\n❌ Copy failed:', error)
    throw error
  }
}

copyFromProduction()
  .catch((error) => {
    console.error('Copy failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prodPrisma.$disconnect()
    await localPrisma.$disconnect()
  })

