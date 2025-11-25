/**
 * Database seed script for MTR Maintenance Tracking
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create MTR Zones
  const zones = [
    { code: 'MTR-01', name: 'HK Station', description: 'Hong Kong Station' },
    { code: 'MTR-02', name: 'HK Station', description: 'Hong Kong Station (Secondary)' },
    { code: 'MTR-03', name: 'Kowloon Station', description: 'Kowloon Station' },
    { code: 'MTR-04', name: 'Tsing Yi Station', description: 'Tsing Yi Station' },
    { code: 'MTR-05', name: 'Olympic/Disney/Lai King', description: 'Olympic Station, Sunny Bay Station, Disney Station, Lai King Station, Lohas Park' },
    { code: 'MTR-06', name: 'Tung Chung/Airport/Tuen Mun', description: 'Tung Chung Station, Airport Station, Airport Expo Station, Tuen Mun Station' },
  ]

  for (const zoneData of zones) {
    await prisma.zone.upsert({
      where: { code: zoneData.code },
      update: {},
      create: zoneData,
    })
    console.log(`✅ Created zone: ${zoneData.code}`)
  }

  console.log('✅ Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

