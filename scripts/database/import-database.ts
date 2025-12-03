/**
 * Import data from exported JSON file to production database
 * Usage: DATABASE_URL=<production-url> tsx scripts/import-database.ts
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { config } from 'dotenv'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

async function importData() {
  const exportPath = resolve(process.cwd(), 'database-export.json')
  
  console.log(`Reading export file: ${exportPath}`)
  const exportData = JSON.parse(readFileSync(exportPath, 'utf-8'))

  console.log('\n⚠️  WARNING: This will DELETE all existing data and import from export file!')
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...')
  await new Promise(resolve => setTimeout(resolve, 5000))

  try {
    // Delete in reverse order (respecting foreign key dependencies)
    console.log('\nClearing existing data...')
    await prisma.maintenanceVisit.deleteMany()
    await prisma.reschedule.deleteMany()
    await prisma.schedule.deleteMany()
    await prisma.equipmentZoneMapping.deleteMany()
    await prisma.zoneEngineerAssignment.deleteMany()
    await prisma.equipment.deleteMany()
    await prisma.engineer.deleteMany()
    await prisma.zone.deleteMany()
    console.log('✓ Existing data cleared')

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
        console.log(`  Skipping ${table} (no data)`)
        continue
      }

      console.log(`\nImporting ${table}...`)
      
      // @ts-ignore - Dynamic table access
      const model = prisma[table]
      
      // Use createMany for better performance
      if (data.length > 0) {
        // Handle createMany (doesn't support all relations)
        if (table === 'zone' || table === 'engineer' || table === 'equipment') {
          for (const record of data) {
            try {
              // @ts-ignore
              await model.create({ data: record })
            } catch (error: any) {
              // If record exists, try update
              if (error.code === 'P2002') {
                // @ts-ignore
                await model.update({
                  where: { id: record.id },
                  data: record,
                })
              } else {
                console.error(`  Error importing record:`, error.message)
              }
            }
          }
        } else {
          // For tables with relations, use individual creates
          for (const record of data) {
            try {
              // @ts-ignore
              await model.create({ data: record })
            } catch (error: any) {
              console.error(`  Error importing record:`, error.message)
              console.error(`  Record:`, JSON.stringify(record, null, 2))
            }
          }
        }
        console.log(`  ✓ Imported ${data.length} records to ${table}`)
      }
    }

    console.log('\n✓ Import complete!')
  } catch (error) {
    console.error('\n✗ Import failed:', error)
    throw error
  }
}

importData()
  .catch((error) => {
    console.error('Import failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })


