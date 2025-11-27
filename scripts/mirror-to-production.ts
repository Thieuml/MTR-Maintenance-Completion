/**
 * Mirror local database to production database
 * 
 * This script:
 * 1. Exports all data from local database (using .env.local)
 * 2. Imports all data to production database (using production DATABASE_URL)
 * 
 * Usage:
 *   DATABASE_URL=<production-url> npx tsx scripts/mirror-to-production.ts
 */

import { PrismaClient } from '@prisma/client'
import { writeFileSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { config } from 'dotenv'

// Load local environment variables
config({ path: resolve(process.cwd(), '.env.local') })

// Get production DATABASE_URL from environment (should be set when running script)
const productionDatabaseUrl = process.env.DATABASE_URL

if (!productionDatabaseUrl) {
  console.error('❌ Error: DATABASE_URL environment variable not set!')
  console.error('   Please set it to your production database URL:')
  console.error('   DATABASE_URL="postgresql://..." npx tsx scripts/mirror-to-production.ts')
  process.exit(1)
}

// Check if this is production URL (should not be localhost)
if (productionDatabaseUrl.includes('localhost') || productionDatabaseUrl.includes('127.0.0.1')) {
  console.error('❌ Error: DATABASE_URL appears to be a local database!')
  console.error('   Please use your production database URL.')
  process.exit(1)
}

const localPrisma = new PrismaClient()
const productionPrisma = new PrismaClient({
  datasources: {
    db: {
      url: productionDatabaseUrl,
    },
  },
})

async function exportFromLocal() {
  console.log('📤 Step 1: Exporting data from LOCAL database...')
  console.log(`   Using: ${process.env.DATABASE_URL?.substring(0, 30)}...`)

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

  for (const table of tables) {
    try {
      // @ts-ignore - Dynamic table access
      const data = await localPrisma[table].findMany()
      exportData[table] = data
      console.log(`   ✓ ${table}: ${data.length} records`)
    } catch (error: any) {
      console.error(`   ✗ Error exporting ${table}:`, error.message)
      exportData[table] = []
    }
  }

  const totalRecords = Object.values(exportData).reduce((sum, arr) => sum + arr.length, 0)
  console.log(`\n   Total records to export: ${totalRecords}`)

  if (totalRecords === 0) {
    console.error('\n❌ No data found in local database!')
    console.error('   Please seed your local database first:')
    console.error('   npm run db:seed')
    await localPrisma.$disconnect()
    process.exit(1)
  }

  return exportData
}

async function importToProduction(exportData: Record<string, any[]>) {
  if (!productionDatabaseUrl) {
    throw new Error('Production DATABASE_URL is not set')
  }
  
  console.log('\n📥 Step 2: Importing data to PRODUCTION database...')
  console.log(`   Using: ${productionDatabaseUrl.substring(0, 50)}...`)

  console.log('\n⚠️  WARNING: This will DELETE all existing data in production!')
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...')
  await new Promise(resolve => setTimeout(resolve, 5000))

  try {
    // Delete in reverse order (respecting foreign key dependencies)
    console.log('\n   Clearing existing production data...')
    await productionPrisma.maintenanceVisit.deleteMany()
    await productionPrisma.reschedule.deleteMany()
    await productionPrisma.schedule.deleteMany()
    await productionPrisma.equipmentZoneMapping.deleteMany()
    await productionPrisma.zoneEngineerAssignment.deleteMany()
    await productionPrisma.equipment.deleteMany()
    await productionPrisma.engineer.deleteMany()
    await productionPrisma.zone.deleteMany()
    console.log('   ✓ Production data cleared')

    // Import in order
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

    for (const table of tables) {
      const data = exportData[table] || []
      if (data.length === 0) {
        console.log(`   ⏭️  Skipping ${table} (no data)`)
        continue
      }

      console.log(`\n   Importing ${table}...`)
      
      // @ts-ignore - Dynamic table access
      const model = productionPrisma[table]
      
      let imported = 0
      let errors = 0

      for (const record of data) {
        try {
          // Remove id to let database generate new ones, or keep if you want same IDs
          // For now, we'll keep IDs to maintain relationships
          await model.create({ data: record })
          imported++
        } catch (error: any) {
          if (error.code === 'P2002') {
            // Unique constraint violation - try update instead
            try {
              // @ts-ignore
              await model.update({
                where: { id: record.id },
                data: record,
              })
              imported++
            } catch (updateError: any) {
              console.error(`     ✗ Error updating record ${record.id}:`, updateError.message)
              errors++
            }
          } else {
            console.error(`     ✗ Error importing record:`, error.message)
            if (error.message.includes('Foreign key')) {
              console.error(`       Record:`, JSON.stringify(record, null, 2).substring(0, 200))
            }
            errors++
          }
        }
      }

      console.log(`     ✓ Imported ${imported} records${errors > 0 ? ` (${errors} errors)` : ''}`)
    }

    console.log('\n✅ Import complete!')
  } catch (error: any) {
    console.error('\n❌ Import failed:', error.message)
    throw error
  }
}

async function main() {
  try {
    // Export from local
    const exportData = await exportFromLocal()

    // Import to production
    await importToProduction(exportData)

    console.log('\n🎉 Mirror complete! Your production database now matches local.')
  } catch (error: any) {
    console.error('\n❌ Mirror failed:', error)
    process.exit(1)
  } finally {
    await localPrisma.$disconnect()
    await productionPrisma.$disconnect()
  }
}

main()

