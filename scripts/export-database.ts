/**
 * Export all data from local database to SQL dump
 * This script exports all tables in the correct order to avoid foreign key violations
 */

import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { config } from 'dotenv'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

interface TableData {
  table: string
  data: any[]
}

async function exportTable(tableName: string): Promise<any[]> {
  // @ts-ignore - Dynamic table access
  const data = await prisma[tableName].findMany()
  return data
}

async function exportAllData() {
  console.log('Starting database export...')

  // Export tables in order (respecting foreign key dependencies)
  const tables = [
    'maintenanceVisit',
    'reschedule',
    'schedule',
    'equipmentZoneMapping',
    'zoneEngineerAssignment',
    'equipment',
    'engineer',
    'zone',
  ]

  const exportData: Record<string, any[]> = {}

  for (const table of tables) {
    try {
      console.log(`Exporting ${table}...`)
      const data = await exportTable(table)
      exportData[table] = data
      console.log(`  ✓ Exported ${data.length} records from ${table}`)
    } catch (error) {
      console.error(`  ✗ Error exporting ${table}:`, error)
    }
  }

  // Write to JSON file
  const outputPath = resolve(process.cwd(), 'database-export.json')
  writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8')
  console.log(`\n✓ Export complete! Data saved to: ${outputPath}`)
  console.log(`\nTotal records exported:`)
  Object.entries(exportData).forEach(([table, data]) => {
    console.log(`  ${table}: ${data.length}`)
  })
}

exportAllData()
  .catch((error) => {
    console.error('Export failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

