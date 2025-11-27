/**
 * Script to create fixed engineer assignments for all zones
 * All engineers are FIXED_QUALIFIED (require CP & RW certificates)
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

const fixedAssignments = [
  { zoneCode: 'MTR-01', engineerName: 'Yip Ho Yin' },
  { zoneCode: 'MTR-02', engineerName: 'Lee Kin Kay' },
  { zoneCode: 'MTR-03', engineerName: 'Lai Yiu Ming' },
  { zoneCode: 'MTR-04', engineerName: 'Ho Ka Kit' },
  { zoneCode: 'MTR-05', engineerName: 'Tang Ho Fai' },
  { zoneCode: 'MTR-06', engineerName: 'Cheung Chun Pong' },
]

async function main() {
  console.log('Creating fixed engineer assignments...')

  let created = 0
  let updated = 0
  let errors = 0

  for (const assignment of fixedAssignments) {
    try {
      // Find zone
      const zone = await prisma.zone.findFirst({
        where: { code: assignment.zoneCode },
      })

      if (!zone) {
        console.error(`✗ Zone ${assignment.zoneCode} not found`)
        errors++
        continue
      }

      // Find engineer
      const engineer = await prisma.engineer.findFirst({
        where: { name: assignment.engineerName },
      })

      if (!engineer) {
        console.error(`✗ Engineer ${assignment.engineerName} not found`)
        errors++
        continue
      }

      // Create or update assignment
      const result = await prisma.zoneEngineerAssignment.upsert({
        where: {
          zoneId_engineerId: {
            zoneId: zone.id,
            engineerId: engineer.id,
          },
        },
        update: {
          role: 'FIXED_QUALIFIED',
          active: true,
          updatedAt: new Date(),
        },
        create: {
          zoneId: zone.id,
          engineerId: engineer.id,
          role: 'FIXED_QUALIFIED',
          active: true,
        },
      })

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++
        console.log(`✓ Created: ${assignment.zoneCode} - ${assignment.engineerName}`)
      } else {
        updated++
        console.log(`✓ Updated: ${assignment.zoneCode} - ${assignment.engineerName}`)
      }
    } catch (error) {
      errors++
      console.error(
        `✗ Error creating assignment ${assignment.zoneCode} - ${assignment.engineerName}:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  console.log(`\nCompleted: ${created} created, ${updated} updated, ${errors} errors`)
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

