/**
 * Database seed script for MTR Maintenance Tracking
 * 
 * Seeds:
 * - MTR Zones (MTR-01 to MTR-06)
 * - Certified Engineers (fixed engineers for each zone with CP & RW certs)
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

  const createdZones: { [key: string]: string } = {}

  for (const zoneData of zones) {
    const zone = await prisma.zone.upsert({
      where: { code: zoneData.code },
      update: {},
      create: zoneData,
    })
    createdZones[zoneData.code] = zone.id
    console.log(`✅ Created zone: ${zoneData.code}`)
  }

  // Create Certified Engineers (Fixed Engineers for each zone)
  // These engineers have CP & RW certificates required for MTR sites
  const certifiedEngineers = [
    { name: 'Yip Ho Yin', zoneCode: 'MTR-01' },
    { name: 'Lee Kin Kay', zoneCode: 'MTR-02' },
    { name: 'Lai Yiu Ming', zoneCode: 'MTR-03' },
    { name: 'Ho Ka Kit', zoneCode: 'MTR-04' },
    { name: 'Tang Ho Fai', zoneCode: 'MTR-05' },
    { name: 'Cheung Chun Pong', zoneCode: 'MTR-06' },
  ]

  for (const engineerData of certifiedEngineers) {
    const zoneId = createdZones[engineerData.zoneCode]
    if (!zoneId) {
      console.warn(`⚠️  Zone ${engineerData.zoneCode} not found, skipping engineer ${engineerData.name}`)
      continue
    }

    // Check if engineer already exists (by name)
    const existing = await prisma.engineer.findFirst({
      where: { name: engineerData.name },
    })

    if (existing) {
      // Update existing engineer with certificates
      await prisma.engineer.update({
        where: { id: existing.id },
        data: {
          hasCPCert: true,
          hasRWCert: true,
          active: true,
        },
      })
      console.log(`✅ Updated certified engineer: ${engineerData.name} (${engineerData.zoneCode})`)
    } else {
      // Create new engineer with CP & RW certificates
      await prisma.engineer.create({
        data: {
          name: engineerData.name,
          hasCPCert: true, // CP certificate
          hasRWCert: true, // RW certificate
          active: true,
          role: 'ENGINEER',
        },
      })
      console.log(`✅ Created certified engineer: ${engineerData.name} (${engineerData.zoneCode})`)
    }
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

