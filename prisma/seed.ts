/**
 * Database seed script for MTR Maintenance Tracking
 * 
 * Seeds:
 * - MTR Zones (MTR-01 to MTR-06)
 * - Certified Engineers (fixed engineers for each zone with CP & RW certs)
 * - Equipment (from schedule data)
 * - Schedules (Weeks 45-48, November 2024)
 */

import { PrismaClient, ScheduleBatch, TimeSlot } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

// Helper function to create HKT date
function createHKTDate(year: number, month: number, day: number, hour: number = 0, minute: number = 0): Date {
  // Create date in HKT (UTC+8)
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`
  return new Date(dateStr)
}

// Helper function to calculate due date (R0 + 14 days)
function calculateDueDate(r0Date: Date): Date {
  const dueDate = new Date(r0Date)
  dueDate.setDate(dueDate.getDate() + 14)
  return dueDate
}

// Helper function to parse deadline string (e.g., "16-Nov" -> Date)
function parseDeadline(deadlineStr: string, baseYear: number = 2024): Date {
  const [day, monthStr] = deadlineStr.split('-')
  const monthMap: { [key: string]: number } = {
    'Nov': 10,
    'Dec': 11,
    'Jan': 0,
    'Feb': 1,
    'Mar': 2,
    'Apr': 3,
    'May': 4,
    'Jun': 5,
    'Jul': 6,
    'Aug': 7,
    'Sep': 8,
    'Oct': 9,
  }
  const month = monthMap[monthStr] || 10
  return createHKTDate(baseYear, month + 1, parseInt(day), 23, 59)
}

async function main() {
  console.log('🌱 Seeding database...')

  // Calculate current week's Sunday (start of week)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayOfWeek = today.getDay()
  const currentWeekSunday = new Date(today)
  currentWeekSunday.setDate(today.getDate() - dayOfWeek)
  
  console.log(`📅 Current week Sunday: ${currentWeekSunday.toISOString().split('T')[0]}`)
  console.log(`📅 Week 48 schedules will map to: ${currentWeekSunday.toISOString().split('T')[0]} to ${new Date(currentWeekSunday.getTime() + 6*24*60*60*1000).toISOString().split('T')[0]}`)

  // Clear existing data (order matters due to foreign keys)
  console.log('\n🗑️  Clearing existing data...')
  await prisma.maintenanceVisit.deleteMany()
  await prisma.reschedule.deleteMany()
  await prisma.schedule.deleteMany()
  await prisma.equipmentZoneMapping.deleteMany().catch(() => {}) // May not exist
  await prisma.zoneEngineerAssignment.deleteMany().catch(() => {}) // May not exist
  await prisma.equipment.deleteMany()
  await prisma.engineer.deleteMany()
  await prisma.zone.deleteMany()
  console.log('✅ Cleared existing data.')

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
  const certifiedEngineers = [
    { name: 'Yip Ho Yin', zoneCode: 'MTR-01' },
    { name: 'Lee Kin Kay', zoneCode: 'MTR-02' },
    { name: 'Lai Yiu Ming', zoneCode: 'MTR-03' },
    { name: 'Ho Ka Kit', zoneCode: 'MTR-04' },
    { name: 'Tang Ho Fai', zoneCode: 'MTR-05' },
    { name: 'Cheung Chun Pong', zoneCode: 'MTR-06' },
  ]

  const createdEngineers: { [key: string]: string } = {}

  for (const engineerData of certifiedEngineers) {
    const zoneId = createdZones[engineerData.zoneCode]
    if (!zoneId) {
      console.warn(`⚠️  Zone ${engineerData.zoneCode} not found, skipping engineer ${engineerData.name}`)
      continue
    }

    const existing = await prisma.engineer.findFirst({
      where: { name: engineerData.name },
    })

    if (existing) {
      await prisma.engineer.update({
        where: { id: existing.id },
        data: {
          hasCPCert: true,
          hasRWCert: true,
          active: true,
        },
      })
      createdEngineers[engineerData.zoneCode] = existing.id
      console.log(`✅ Updated certified engineer: ${engineerData.name} (${engineerData.zoneCode})`)
    } else {
      const engineer = await prisma.engineer.create({
        data: {
          name: engineerData.name,
          hasCPCert: true,
          hasRWCert: true,
          active: true,
          role: 'ENGINEER',
        },
      })
      createdEngineers[engineerData.zoneCode] = engineer.id
      console.log(`✅ Created certified engineer: ${engineerData.name} (${engineerData.zoneCode})`)
    }
  }

  // Import complete schedule data
  // For now using inline data - can be moved to separate file if needed
  const scheduleData = [
    // MTR-01 (Week 45, Batch A)
    { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2024-11-02', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E25', orNumber: '5000355448', deadline: '16-Nov' },
    { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2024-11-02', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E26', orNumber: '5000355445', deadline: '16-Nov' },
    { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2024-11-03', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E43', orNumber: '5000357829', deadline: '17-Nov' },
    { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2024-11-03', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E44', orNumber: '5000357823', deadline: '17-Nov' },
    { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2024-11-04', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E14', orNumber: '5000359340', deadline: '18-Nov' },
    { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2024-11-05', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E37', orNumber: '5000360930', deadline: '19-Nov' },
    { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2024-11-05', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E38', orNumber: '5000360928', deadline: '19-Nov' },
    { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2024-11-06', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E28', orNumber: '5000363551', deadline: '20-Nov' },
    { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2024-11-06', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E30', orNumber: '5000363560', deadline: '20-Nov' },
    
    // MTR-01 (Week 46, Batch B)
    { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2024-11-09', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E01', orNumber: '5000366909', deadline: '23-Nov' },
    { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2024-11-09', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E02', orNumber: '5000366917', deadline: '23-Nov' },
    { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2024-11-09', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E05', orNumber: '5000366916', deadline: '23-Nov' },
    { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2024-11-10', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E03', orNumber: '5000368588', deadline: '24-Nov' },
    { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2024-11-10', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E07', orNumber: '5000368590', deadline: '24-Nov' },
    { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2024-11-11', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E15', orNumber: '5000370414', deadline: '25-Nov' },
    { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2024-11-11', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E33', orNumber: '5000370420', deadline: '25-Nov' },
    { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2024-11-12', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E09', orNumber: '5000371981', deadline: '26-Nov' },
    { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2024-11-12', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E10', orNumber: '5000371968', deadline: '26-Nov' },
    { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2024-11-12', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E04', orNumber: '5000371980', deadline: '26-Nov' },
    { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2024-11-13', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E19', orNumber: '5000375318', deadline: '27-Nov' },
    { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2024-11-13', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E21', orNumber: '5000375331', deadline: '27-Nov' },
    { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2024-11-14', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E13', orNumber: '5000377007', deadline: '28-Nov' },
    { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2024-11-14', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E17', orNumber: '5000377003', deadline: '28-Nov' },
    { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2024-11-14', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E18', orNumber: '5000377017', deadline: '28-Nov' },
    
    // MTR-01 (Week 47, Batch A)
    { zoneCode: 'MTR-01', week: 47, batch: 'A', date: '2024-11-16', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E25', orNumber: '5000384107', deadline: '30-Nov' },
    { zoneCode: 'MTR-01', week: 47, batch: 'A', date: '2024-11-16', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E26', orNumber: '5000384112', deadline: '30-Nov' },
    { zoneCode: 'MTR-01', week: 47, batch: 'A', date: '2024-11-17', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E43', orNumber: '5000386799', deadline: '01-Dec' },
    { zoneCode: 'MTR-01', week: 47, batch: 'A', date: '2024-11-17', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E44', orNumber: '5000386796', deadline: '01-Dec' },
    { zoneCode: 'MTR-01', week: 47, batch: 'A', date: '2024-11-18', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E14', orNumber: '5000388227', deadline: '02-Dec' },
    { zoneCode: 'MTR-01', week: 47, batch: 'A', date: '2024-11-19', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E37', orNumber: '5000389457', deadline: '03-Dec' },
    { zoneCode: 'MTR-01', week: 47, batch: 'A', date: '2024-11-19', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E38', orNumber: '5000389464', deadline: '03-Dec' },
    { zoneCode: 'MTR-01', week: 47, batch: 'A', date: '2024-11-20', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E28', orNumber: '5000391023', deadline: '04-Dec' },
    { zoneCode: 'MTR-01', week: 47, batch: 'A', date: '2024-11-20', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E30', orNumber: '5000391026', deadline: '04-Dec' },
    
    // MTR-01 (Week 48, Batch B)
    { zoneCode: 'MTR-01', week: 48, batch: 'B', date: '2024-11-23', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E01', orNumber: '5000394295', deadline: '07-Dec' },
    { zoneCode: 'MTR-01', week: 48, batch: 'B', date: '2024-11-23', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E02', orNumber: '5000394315', deadline: '07-Dec' },
    { zoneCode: 'MTR-01', week: 48, batch: 'B', date: '2024-11-23', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E05', orNumber: '5000394311', deadline: '07-Dec' },
    { zoneCode: 'MTR-01', week: 48, batch: 'B', date: '2024-11-24', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E03', orNumber: '5000396108', deadline: '08-Dec' },
    { zoneCode: 'MTR-01', week: 48, batch: 'B', date: '2024-11-24', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E07', orNumber: '5000396110', deadline: '08-Dec' },
    { zoneCode: 'MTR-01', week: 48, batch: 'B', date: '2024-11-25', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E15', orNumber: '5000399079', deadline: '09-Dec' },
    { zoneCode: 'MTR-01', week: 48, batch: 'B', date: '2024-11-25', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E33', orNumber: '5000399082', deadline: '09-Dec' },
    { zoneCode: 'MTR-01', week: 48, batch: 'B', date: '2024-11-26', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E09', orNumber: '5000400180', deadline: '10-Dec' },
    { zoneCode: 'MTR-01', week: 48, batch: 'B', date: '2024-11-26', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E10', orNumber: '5000400177', deadline: '10-Dec' },
    { zoneCode: 'MTR-01', week: 48, batch: 'B', date: '2024-11-26', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E04', orNumber: '5000400178', deadline: '10-Dec' },
    { zoneCode: 'MTR-01', week: 48, batch: 'B', date: '2024-11-27', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E19', orNumber: '5000405827', deadline: '11-Dec' },
    { zoneCode: 'MTR-01', week: 48, batch: 'B', date: '2024-11-27', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E21', orNumber: '5000405825', deadline: '11-Dec' },
    { zoneCode: 'MTR-01', week: 48, batch: 'B', date: '2024-11-28', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E13', orNumber: '5000407690', deadline: '12-Dec' },
    { zoneCode: 'MTR-01', week: 48, batch: 'B', date: '2024-11-28', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E17', orNumber: '5000407696', deadline: '12-Dec' },
    { zoneCode: 'MTR-01', week: 48, batch: 'B', date: '2024-11-28', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E18', orNumber: '5000407683', deadline: '12-Dec' },

    // MTR-02 (Week 45, Batch A) - Complete from image
    { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2024-11-02', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E27', orNumber: '5000357831', deadline: '17-Nov' },
    { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2024-11-02', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E34', orNumber: '5000357830', deadline: '17-Nov' },
    { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2024-11-03', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-SL11', orNumber: '5000355449', deadline: '16-Nov' },
    { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2024-11-03', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-PL12', orNumber: '5000355450', deadline: '16-Nov' },
    { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2024-11-03', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-PL13', orNumber: '5000355446', deadline: '16-Nov' },
    { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2024-11-04', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E31', orNumber: '5000359343', deadline: '18-Nov' },
    { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2024-11-04', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E32', orNumber: '5000359338', deadline: '18-Nov' },
    { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2024-11-04', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E36', orNumber: '5000359342', deadline: '18-Nov' },
    { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2024-11-05', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-PL14', orNumber: '5000360936', deadline: '19-Nov' },
    { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2024-11-05', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-PL15', orNumber: '5000360924', deadline: '19-Nov' },
    { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2024-11-05', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-PL05', orNumber: '5000360929', deadline: '19-Nov' },
    { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2024-11-07', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E11', orNumber: '5000365282', deadline: '21-Nov' },
    { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2024-11-07', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E16', orNumber: '5000365281', deadline: '21-Nov' },
    
    // MTR-02 (Week 46, Batch B) - Complete from image
    { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2024-11-09', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-FL04', orNumber: '5000366919', deadline: '23-Nov' },
    { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2024-11-09', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E23', orNumber: '5000366910', deadline: '23-Nov' },
    { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2024-11-10', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E12', orNumber: '5000368595', deadline: '24-Nov' },
    { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2024-11-10', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-FL06', orNumber: '5000368586', deadline: '24-Nov' },
    { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2024-11-11', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-SL01', orNumber: '5000370415', deadline: '25-Nov' },
    { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2024-11-11', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E35', orNumber: '5000370421', deadline: '25-Nov' },
    { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2024-11-12', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-SL03', orNumber: '5000371971', deadline: '26-Nov' },
    { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2024-11-12', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E29', orNumber: '5000371974', deadline: '26-Nov' },
    { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2024-11-13', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E06', orNumber: '5000375324', deadline: '27-Nov' },
    { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2024-11-13', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E22', orNumber: '5000375323', deadline: '27-Nov' },
    { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2024-11-14', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-SL16', orNumber: '5000377012', deadline: '28-Nov' },
    
    // MTR-02 (Week 47, Batch A) - Complete from image
    { zoneCode: 'MTR-02', week: 47, batch: 'A', date: '2024-11-16', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E27', orNumber: '5000386798', deadline: '01-Dec' },
    { zoneCode: 'MTR-02', week: 47, batch: 'A', date: '2024-11-16', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E34', orNumber: '5000386794', deadline: '01-Dec' },
    { zoneCode: 'MTR-02', week: 47, batch: 'A', date: '2024-11-17', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-SL11', orNumber: '5000384110', deadline: '30-Nov' },
    { zoneCode: 'MTR-02', week: 47, batch: 'A', date: '2024-11-17', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-PL12', orNumber: '5000384108', deadline: '30-Nov' },
    { zoneCode: 'MTR-02', week: 47, batch: 'A', date: '2024-11-17', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-PL13', orNumber: '5000384106', deadline: '30-Nov' },
    { zoneCode: 'MTR-02', week: 47, batch: 'A', date: '2024-11-18', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E31', orNumber: '5000388231', deadline: '02-Dec' },
    { zoneCode: 'MTR-02', week: 47, batch: 'A', date: '2024-11-18', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E32', orNumber: '5000388223', deadline: '02-Dec' },
    { zoneCode: 'MTR-02', week: 47, batch: 'A', date: '2024-11-18', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E36', orNumber: '5000388222', deadline: '02-Dec' },
    { zoneCode: 'MTR-02', week: 47, batch: 'A', date: '2024-11-19', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-PL14', orNumber: '5000389470', deadline: '03-Dec' },
    { zoneCode: 'MTR-02', week: 47, batch: 'A', date: '2024-11-19', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-PL15', orNumber: '5000389471', deadline: '03-Dec' },
    { zoneCode: 'MTR-02', week: 47, batch: 'A', date: '2024-11-19', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-PL05', orNumber: '5000389461', deadline: '03-Dec' },
    { zoneCode: 'MTR-02', week: 47, batch: 'A', date: '2024-11-21', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E11', orNumber: '5000392552', deadline: '05-Dec' },
    { zoneCode: 'MTR-02', week: 47, batch: 'A', date: '2024-11-21', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E16', orNumber: '5000392556', deadline: '05-Dec' },
    
    // MTR-02 (Week 48, Batch B) - Complete from image
    { zoneCode: 'MTR-02', week: 48, batch: 'B', date: '2024-11-23', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-FL04', orNumber: '5000394298', deadline: '07-Dec' },
    { zoneCode: 'MTR-02', week: 48, batch: 'B', date: '2024-11-23', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E23', orNumber: '5000394314', deadline: '07-Dec' },
    { zoneCode: 'MTR-02', week: 48, batch: 'B', date: '2024-11-24', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E12', orNumber: '5000396119', deadline: '08-Dec' },
    { zoneCode: 'MTR-02', week: 48, batch: 'B', date: '2024-11-24', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-FL06', orNumber: '5000396123', deadline: '08-Dec' },
    { zoneCode: 'MTR-02', week: 48, batch: 'B', date: '2024-11-25', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-SL01', orNumber: '5000399084', deadline: '09-Dec' },
    { zoneCode: 'MTR-02', week: 48, batch: 'B', date: '2024-11-25', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E35', orNumber: '5000399074', deadline: '09-Dec' },
    { zoneCode: 'MTR-02', week: 48, batch: 'B', date: '2024-11-26', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-SL03', orNumber: '5000400175', deadline: '10-Dec' },
    { zoneCode: 'MTR-02', week: 48, batch: 'B', date: '2024-11-26', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E29', orNumber: '5000400189', deadline: '10-Dec' },
    { zoneCode: 'MTR-02', week: 48, batch: 'B', date: '2024-11-27', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E06', orNumber: '5000405833', deadline: '11-Dec' },
    { zoneCode: 'MTR-02', week: 48, batch: 'B', date: '2024-11-27', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E22', orNumber: '5000405828', deadline: '11-Dec' },
    { zoneCode: 'MTR-02', week: 48, batch: 'B', date: '2024-11-28', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-SL16', orNumber: '5000407687', deadline: '12-Dec' },

    // MTR-03 (Week 45, Batch A)
    { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2024-11-02', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E01', orNumber: '5000366911', deadline: '23-Nov' },
    { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2024-11-02', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E02', orNumber: '5000366913', deadline: '23-Nov' },
    { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2024-11-03', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E03', orNumber: '5000366907', deadline: '23-Nov' },
    { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2024-11-03', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E04', orNumber: '5000366906', deadline: '23-Nov' },
    { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2024-11-04', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-SL05', orNumber: '5000366914', deadline: '23-Nov' },
    { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2024-11-04', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-SL04', orNumber: '5000366915', deadline: '23-Nov' },
    { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2024-11-05', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E07', orNumber: '5000368598', deadline: '24-Nov' },
    { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2024-11-06', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E09', orNumber: '5000368599', deadline: '24-Nov' },
    { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2024-11-06', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E10', orNumber: '5000368591', deadline: '24-Nov' },
    { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2024-11-07', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-FL17', orNumber: '5000370411', deadline: '25-Nov' },
    { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2024-11-07', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-FL16', orNumber: '5000370413', deadline: '25-Nov' },
    
    // MTR-03 (Week 46, Batch B)
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-09', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E16', orNumber: '5000371985', deadline: '26-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-09', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E17', orNumber: '5000371970', deadline: '26-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-09', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-SL03', orNumber: '5000371973', deadline: '26-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-10', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E14', orNumber: '5000370422', deadline: '25-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-10', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E15', orNumber: '5000370409', deadline: '25-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-10', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-SL07', orNumber: '5000377006', deadline: '28-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-11', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E08', orNumber: '5000370412', deadline: '25-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-11', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E11', orNumber: '5000371972', deadline: '26-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-11', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-SL06', orNumber: '5000368587', deadline: '24-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-12', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-PL01', orNumber: '5000377013', deadline: '28-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-12', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-FL02', orNumber: '5000368592', deadline: '24-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-12', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-E12', orNumber: '5000370410', deadline: '25-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-13', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E18', orNumber: '5000371984', deadline: '26-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-13', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E19', orNumber: '5000375326', deadline: '27-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-13', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-SL14', orNumber: '5000371982', deadline: '26-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-14', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E20', orNumber: '5000375320', deadline: '27-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-14', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E21', orNumber: '5000377010', deadline: '28-Nov' },
    { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2024-11-14', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-SL15', orNumber: '5000375333', deadline: '27-Nov' },
    
    // MTR-03 (Week 47, Batch A)
    { zoneCode: 'MTR-03', week: 47, batch: 'A', date: '2024-11-16', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E01', orNumber: '5000394300', deadline: '07-Dec' },
    { zoneCode: 'MTR-03', week: 47, batch: 'A', date: '2024-11-16', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E02', orNumber: '5000394320', deadline: '07-Dec' },
    { zoneCode: 'MTR-03', week: 47, batch: 'A', date: '2024-11-17', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E03', orNumber: '5000394299', deadline: '07-Dec' },
    { zoneCode: 'MTR-03', week: 47, batch: 'A', date: '2024-11-17', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E04', orNumber: '5000394321', deadline: '07-Dec' },
    { zoneCode: 'MTR-03', week: 47, batch: 'A', date: '2024-11-18', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-SL05', orNumber: '5000394313', deadline: '07-Dec' },
    { zoneCode: 'MTR-03', week: 47, batch: 'A', date: '2024-11-18', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-SL04', orNumber: '5000394308', deadline: '07-Dec' },
    { zoneCode: 'MTR-03', week: 47, batch: 'A', date: '2024-11-19', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E07', orNumber: '5000396113', deadline: '08-Dec' },
    { zoneCode: 'MTR-03', week: 47, batch: 'A', date: '2024-11-20', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E09', orNumber: '5000396116', deadline: '08-Dec' },
    { zoneCode: 'MTR-03', week: 47, batch: 'A', date: '2024-11-20', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E10', orNumber: '5000396117', deadline: '08-Dec' },
    { zoneCode: 'MTR-03', week: 47, batch: 'A', date: '2024-11-21', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-FL17', orNumber: '5000399085', deadline: '09-Dec' },
    { zoneCode: 'MTR-03', week: 47, batch: 'A', date: '2024-11-21', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-FL16', orNumber: '5000399076', deadline: '09-Dec' },
    
    // MTR-03 (Week 48, Batch B)
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-23', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E16', orNumber: '5000400172', deadline: '10-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-23', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E17', orNumber: '5000400187', deadline: '10-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-23', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-SL03', orNumber: '5000400176', deadline: '10-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-24', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E14', orNumber: '5000399083', deadline: '09-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-24', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E15', orNumber: '5000399073', deadline: '09-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-24', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-SL07', orNumber: '5000407682', deadline: '12-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-25', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E08', orNumber: '5000399078', deadline: '09-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-25', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E11', orNumber: '5000400182', deadline: '10-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-25', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-SL06', orNumber: '5000396114', deadline: '08-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-26', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-PL01', orNumber: '5000407692', deadline: '12-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-26', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-FL02', orNumber: '5000396106', deadline: '08-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-26', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-E12', orNumber: '5000399081', deadline: '09-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-27', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E18', orNumber: '5000400186', deadline: '10-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-27', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E19', orNumber: '5000405830', deadline: '11-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-27', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-SL14', orNumber: '5000400183', deadline: '10-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-28', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E20', orNumber: '5000405837', deadline: '11-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-28', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E21', orNumber: '5000407689', deadline: '12-Dec' },
    { zoneCode: 'MTR-03', week: 48, batch: 'B', date: '2024-11-28', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-SL15', orNumber: '5000405829', deadline: '11-Dec' },

    // NOTE: MTR-04, MTR-05, MTR-06 schedules need to be fully populated
    // Currently only sample entries are included
    // All schedule data from images should be added here for complete seeding
    // This includes all weeks (45-48) and all zones (MTR-01 through MTR-06)
    
    // MTR-04 (Week 45, Batch A) - Complete from image
    { zoneCode: 'MTR-04', week: 45, batch: 'A', date: '2024-11-04', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-FL05', orNumber: '5000359346', deadline: '18-Nov' },
    { zoneCode: 'MTR-04', week: 45, batch: 'A', date: '2024-11-04', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-E02', orNumber: '5000360926', deadline: '18-Nov' },
    { zoneCode: 'MTR-04', week: 45, batch: 'A', date: '2024-11-04', timeSlot: 'SLOT_0330', equipmentNumber: 'TSY-SL13', orNumber: '5000360927', deadline: '18-Nov' },
    { zoneCode: 'MTR-04', week: 45, batch: 'A', date: '2024-11-05', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-OCC-FL11', orNumber: '5000359349', deadline: '19-Nov' },
    { zoneCode: 'MTR-04', week: 45, batch: 'A', date: '2024-11-05', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-E03', orNumber: '5000360928', deadline: '19-Nov' },
    { zoneCode: 'MTR-04', week: 45, batch: 'A', date: '2024-11-06', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-E06', orNumber: '5000363551', deadline: '20-Nov' },
    { zoneCode: 'MTR-04', week: 45, batch: 'A', date: '2024-11-06', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-SL06', orNumber: '5000363552', deadline: '20-Nov' },
    { zoneCode: 'MTR-04', week: 45, batch: 'A', date: '2024-11-07', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-E07', orNumber: '5000365267', deadline: '21-Nov' },
    { zoneCode: 'MTR-04', week: 45, batch: 'A', date: '2024-11-07', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-SL07', orNumber: '5000365270', deadline: '21-Nov' },
    
    // MTR-04 (Week 46, Batch B) - Complete from image
    { zoneCode: 'MTR-04', week: 46, batch: 'B', date: '2024-11-09', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-E04', orNumber: '5000363553', deadline: '20-Nov' },
    { zoneCode: 'MTR-04', week: 46, batch: 'B', date: '2024-11-09', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-SL04', orNumber: '5000363554', deadline: '20-Nov' },
    { zoneCode: 'MTR-04', week: 46, batch: 'B', date: '2024-11-10', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-E05', orNumber: '5000365268', deadline: '21-Nov' },
    { zoneCode: 'MTR-04', week: 46, batch: 'B', date: '2024-11-10', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-SL05', orNumber: '5000365269', deadline: '21-Nov' },
    { zoneCode: 'MTR-04', week: 46, batch: 'B', date: '2024-11-11', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-E06', orNumber: '5000368593', deadline: '24-Nov' },
    { zoneCode: 'MTR-04', week: 46, batch: 'B', date: '2024-11-11', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-SL06', orNumber: '5000368594', deadline: '24-Nov' },
    { zoneCode: 'MTR-04', week: 46, batch: 'B', date: '2024-11-12', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-E07', orNumber: '5000370417', deadline: '25-Nov' },
    { zoneCode: 'MTR-04', week: 46, batch: 'B', date: '2024-11-12', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-SL07', orNumber: '5000370418', deadline: '25-Nov' },
    { zoneCode: 'MTR-04', week: 46, batch: 'B', date: '2024-11-13', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-E08', orNumber: '5000371986', deadline: '26-Nov' },
    { zoneCode: 'MTR-04', week: 46, batch: 'B', date: '2024-11-13', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-SL08', orNumber: '5000371987', deadline: '26-Nov' },
    { zoneCode: 'MTR-04', week: 46, batch: 'B', date: '2024-11-14', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-E09', orNumber: '5000375325', deadline: '27-Nov' },
    { zoneCode: 'MTR-04', week: 46, batch: 'B', date: '2024-11-14', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-SL09', orNumber: '5000375327', deadline: '27-Nov' },
    
    // MTR-04 (Week 47, Batch A) - Complete from image (Nov 17 shows SPARE - skip those)
    { zoneCode: 'MTR-04', week: 47, batch: 'A', date: '2024-11-16', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-FL05', orNumber: '5000388220', deadline: '30-Nov' },
    { zoneCode: 'MTR-04', week: 47, batch: 'A', date: '2024-11-16', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-E02', orNumber: '5000388221', deadline: '30-Nov' },
    { zoneCode: 'MTR-04', week: 47, batch: 'A', date: '2024-11-16', timeSlot: 'SLOT_0330', equipmentNumber: 'TSY-SL13', orNumber: '5000388222', deadline: '30-Nov' },
    { zoneCode: 'MTR-04', week: 47, batch: 'A', date: '2024-11-18', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-E06', orNumber: '5000388232', deadline: '02-Dec' },
    { zoneCode: 'MTR-04', week: 47, batch: 'A', date: '2024-11-18', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-SL06', orNumber: '5000388233', deadline: '02-Dec' },
    { zoneCode: 'MTR-04', week: 47, batch: 'A', date: '2024-11-19', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-E07', orNumber: '5000389472', deadline: '03-Dec' },
    { zoneCode: 'MTR-04', week: 47, batch: 'A', date: '2024-11-19', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-SL07', orNumber: '5000389473', deadline: '03-Dec' },
    { zoneCode: 'MTR-04', week: 47, batch: 'A', date: '2024-11-20', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-E08', orNumber: '5000391027', deadline: '04-Dec' },
    { zoneCode: 'MTR-04', week: 47, batch: 'A', date: '2024-11-20', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-SL08', orNumber: '5000391028', deadline: '04-Dec' },
    { zoneCode: 'MTR-04', week: 47, batch: 'A', date: '2024-11-21', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-E09', orNumber: '5000392553', deadline: '05-Dec' },
    { zoneCode: 'MTR-04', week: 47, batch: 'A', date: '2024-11-21', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-SL09', orNumber: '5000392555', deadline: '05-Dec' },
    
    // MTR-04 (Week 48, Batch B) - Complete from image
    { zoneCode: 'MTR-04', week: 48, batch: 'B', date: '2024-11-23', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-SL04', orNumber: '5000392549', deadline: '05-Dec' },
    { zoneCode: 'MTR-04', week: 48, batch: 'B', date: '2024-11-23', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-E04', orNumber: '5000392550', deadline: '05-Dec' },
    { zoneCode: 'MTR-04', week: 48, batch: 'B', date: '2024-11-24', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-E05', orNumber: '5000396107', deadline: '08-Dec' },
    { zoneCode: 'MTR-04', week: 48, batch: 'B', date: '2024-11-24', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-SL05', orNumber: '5000396108', deadline: '08-Dec' },
    { zoneCode: 'MTR-04', week: 48, batch: 'B', date: '2024-11-25', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-E06', orNumber: '5000399075', deadline: '09-Dec' },
    { zoneCode: 'MTR-04', week: 48, batch: 'B', date: '2024-11-25', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-SL06', orNumber: '5000399076', deadline: '09-Dec' },
    { zoneCode: 'MTR-04', week: 48, batch: 'B', date: '2024-11-26', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-E07', orNumber: '5000400173', deadline: '10-Dec' },
    { zoneCode: 'MTR-04', week: 48, batch: 'B', date: '2024-11-26', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-SL07', orNumber: '5000400174', deadline: '10-Dec' },
    { zoneCode: 'MTR-04', week: 48, batch: 'B', date: '2024-11-27', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-SL04', orNumber: '5000405833', deadline: '11-Dec' },
    { zoneCode: 'MTR-04', week: 48, batch: 'B', date: '2024-11-27', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-E04', orNumber: '5000405834', deadline: '11-Dec' },
    
    // MTR-05 (Week 45, Batch A) - Complete from image
    { zoneCode: 'MTR-05', week: 45, batch: 'A', date: '2024-11-02', timeSlot: 'SLOT_0130', equipmentNumber: 'LHP-E03', orNumber: '5000507882', deadline: '16-Nov' },
    { zoneCode: 'MTR-05', week: 45, batch: 'A', date: '2024-11-02', timeSlot: 'SLOT_0330', equipmentNumber: 'LHP-E04', orNumber: '5000507887', deadline: '16-Nov' },
    { zoneCode: 'MTR-05', week: 45, batch: 'A', date: '2024-11-03', timeSlot: 'SLOT_0130', equipmentNumber: 'OLY-FL04', orNumber: '5000355443', deadline: '16-Nov' },
    { zoneCode: 'MTR-05', week: 45, batch: 'A', date: '2024-11-03', timeSlot: 'SLOT_0330', equipmentNumber: 'OLY-CE01', orNumber: '5000357828', deadline: '17-Nov' },
    { zoneCode: 'MTR-05', week: 45, batch: 'A', date: '2024-11-04', timeSlot: 'SLOT_0130', equipmentNumber: 'OLY-CE02', orNumber: '5000357826', deadline: '17-Nov' },
    { zoneCode: 'MTR-05', week: 45, batch: 'A', date: '2024-11-05', timeSlot: 'SLOT_0130', equipmentNumber: 'OLY-FL01', orNumber: '5000355444', deadline: '16-Nov' },
    { zoneCode: 'MTR-05', week: 45, batch: 'A', date: '2024-11-05', timeSlot: 'SLOT_0330', equipmentNumber: 'OLY-E03', orNumber: '5000355452', deadline: '16-Nov' },
    { zoneCode: 'MTR-05', week: 45, batch: 'A', date: '2024-11-06', timeSlot: 'SLOT_0130', equipmentNumber: 'OLY-E04', orNumber: '5000355442', deadline: '16-Nov' },
    { zoneCode: 'MTR-05', week: 45, batch: 'A', date: '2024-11-06', timeSlot: 'SLOT_0330', equipmentNumber: 'LAK-L04', orNumber: '5000507892', deadline: '17-Nov' },
    { zoneCode: 'MTR-05', week: 45, batch: 'A', date: '2024-11-07', timeSlot: 'SLOT_0130', equipmentNumber: 'LAK-L05', orNumber: '5000507898', deadline: '20-Nov' },
    { zoneCode: 'MTR-05', week: 45, batch: 'A', date: '2024-11-07', timeSlot: 'SLOT_0330', equipmentNumber: 'OLY-E01', orNumber: '5000366908', deadline: '23-Nov' },
    { zoneCode: 'MTR-05', week: 45, batch: 'A', date: '2024-11-08', timeSlot: 'SLOT_0130', equipmentNumber: 'OLY-E02', orNumber: '5000366912', deadline: '23-Nov' },
    
    // MTR-05 (Week 46, Batch B) - Complete from image
    { zoneCode: 'MTR-05', week: 46, batch: 'B', date: '2024-11-09', timeSlot: 'SLOT_0130', equipmentNumber: 'LHP-E01', orNumber: '5000507871', deadline: '23-Nov' },
    { zoneCode: 'MTR-05', week: 46, batch: 'B', date: '2024-11-09', timeSlot: 'SLOT_0330', equipmentNumber: 'LHP-E02', orNumber: '5000507877', deadline: '23-Nov' },
    { zoneCode: 'MTR-05', week: 46, batch: 'B', date: '2024-11-10', timeSlot: 'SLOT_0130', equipmentNumber: 'DIS-E01', orNumber: '5000371979', deadline: '26-Nov' },
    { zoneCode: 'MTR-05', week: 46, batch: 'B', date: '2024-11-10', timeSlot: 'SLOT_0330', equipmentNumber: 'DIS-E02', orNumber: '5000371976', deadline: '26-Nov' },
    { zoneCode: 'MTR-05', week: 46, batch: 'B', date: '2024-11-11', timeSlot: 'SLOT_0130', equipmentNumber: 'DIS-PL01', orNumber: '5000377001', deadline: '28-Nov' },
    { zoneCode: 'MTR-05', week: 46, batch: 'B', date: '2024-11-12', timeSlot: 'SLOT_0130', equipmentNumber: 'SUN-E05', orNumber: '5000375321', deadline: '27-Nov' },
    { zoneCode: 'MTR-05', week: 46, batch: 'B', date: '2024-11-12', timeSlot: 'SLOT_0330', equipmentNumber: 'SUN-E08', orNumber: '5000375322', deadline: '27-Nov' },
    { zoneCode: 'MTR-05', week: 46, batch: 'B', date: '2024-11-13', timeSlot: 'SLOT_0130', equipmentNumber: 'SUN-PL01', orNumber: '5000375328', deadline: '27-Nov' },
    { zoneCode: 'MTR-05', week: 46, batch: 'B', date: '2024-11-13', timeSlot: 'SLOT_0330', equipmentNumber: 'SUN-PL02', orNumber: '5000375332', deadline: '27-Nov' },
    { zoneCode: 'MTR-05', week: 46, batch: 'B', date: '2024-11-14', timeSlot: 'SLOT_0130', equipmentNumber: 'SUN-E01', orNumber: '5000377011', deadline: '28-Nov' },
    { zoneCode: 'MTR-05', week: 46, batch: 'B', date: '2024-11-14', timeSlot: 'SLOT_0330', equipmentNumber: 'SUN-E03', orNumber: '5000377015', deadline: '28-Nov' },
    
    // MTR-05 (Week 47, Batch A) - Complete from image
    { zoneCode: 'MTR-05', week: 47, batch: 'A', date: '2024-11-16', timeSlot: 'SLOT_0130', equipmentNumber: 'LHP-E03', orNumber: '5000532509', deadline: '30-Nov' },
    { zoneCode: 'MTR-05', week: 47, batch: 'A', date: '2024-11-16', timeSlot: 'SLOT_0330', equipmentNumber: 'LHP-E04', orNumber: '5000532630', deadline: '30-Nov' },
    { zoneCode: 'MTR-05', week: 47, batch: 'A', date: '2024-11-17', timeSlot: 'SLOT_0130', equipmentNumber: 'OLY-FL04', orNumber: '5000384109', deadline: '30-Nov' },
    { zoneCode: 'MTR-05', week: 47, batch: 'A', date: '2024-11-17', timeSlot: 'SLOT_0330', equipmentNumber: 'OLY-CE01', orNumber: '5000386797', deadline: '01-Dec' },
    { zoneCode: 'MTR-05', week: 47, batch: 'A', date: '2024-11-18', timeSlot: 'SLOT_0130', equipmentNumber: 'OLY-CE02', orNumber: '5000386804', deadline: '01-Dec' },
    { zoneCode: 'MTR-05', week: 47, batch: 'A', date: '2024-11-19', timeSlot: 'SLOT_0130', equipmentNumber: 'OLY-FL01', orNumber: '5000384111', deadline: '30-Nov' },
    { zoneCode: 'MTR-05', week: 47, batch: 'A', date: '2024-11-19', timeSlot: 'SLOT_0330', equipmentNumber: 'OLY-E03', orNumber: '5000377002', deadline: '28-Nov' },
    { zoneCode: 'MTR-05', week: 47, batch: 'A', date: '2024-11-20', timeSlot: 'SLOT_0130', equipmentNumber: 'OLY-E04', orNumber: '5000384104', deadline: '30-Nov' },
    { zoneCode: 'MTR-05', week: 47, batch: 'A', date: '2024-11-20', timeSlot: 'SLOT_0330', equipmentNumber: 'LAK-L04', orNumber: '5000537663', deadline: '01-Dec' },
    { zoneCode: 'MTR-05', week: 47, batch: 'A', date: '2024-11-21', timeSlot: 'SLOT_0130', equipmentNumber: 'LAK-L05', orNumber: '5000546234', deadline: '04-Dec' },
    { zoneCode: 'MTR-05', week: 47, batch: 'A', date: '2024-11-21', timeSlot: 'SLOT_0330', equipmentNumber: 'OLY-E01', orNumber: '5000394301', deadline: '07-Dec' },
    { zoneCode: 'MTR-05', week: 47, batch: 'A', date: '2024-11-22', timeSlot: 'SLOT_0130', equipmentNumber: 'OLY-E02', orNumber: '5000394319', deadline: '07-Dec' },
    
    // MTR-05 (Week 48, Batch B) - Complete from image
    { zoneCode: 'MTR-05', week: 48, batch: 'B', date: '2024-11-23', timeSlot: 'SLOT_0130', equipmentNumber: 'LHP-E01', orNumber: '5000561444', deadline: '07-Dec' },
    { zoneCode: 'MTR-05', week: 48, batch: 'B', date: '2024-11-23', timeSlot: 'SLOT_0330', equipmentNumber: 'LHP-E02', orNumber: '5000561436', deadline: '07-Dec' },
    { zoneCode: 'MTR-05', week: 48, batch: 'B', date: '2024-11-24', timeSlot: 'SLOT_0130', equipmentNumber: 'DIS-E01', orNumber: '5000400185', deadline: '10-Dec' },
    { zoneCode: 'MTR-05', week: 48, batch: 'B', date: '2024-11-24', timeSlot: 'SLOT_0330', equipmentNumber: 'DIS-E02', orNumber: '5000400179', deadline: '10-Dec' },
    { zoneCode: 'MTR-05', week: 48, batch: 'B', date: '2024-11-25', timeSlot: 'SLOT_0130', equipmentNumber: 'DIS-PL01', orNumber: '5000407686', deadline: '12-Dec' },
    { zoneCode: 'MTR-05', week: 48, batch: 'B', date: '2024-11-26', timeSlot: 'SLOT_0130', equipmentNumber: 'SUN-E05', orNumber: '5000405831', deadline: '11-Dec' },
    { zoneCode: 'MTR-05', week: 48, batch: 'B', date: '2024-11-26', timeSlot: 'SLOT_0330', equipmentNumber: 'SUN-E08', orNumber: '5000405836', deadline: '11-Dec' },
    { zoneCode: 'MTR-05', week: 48, batch: 'B', date: '2024-11-27', timeSlot: 'SLOT_0130', equipmentNumber: 'SUN-PL01', orNumber: '5000405840', deadline: '11-Dec' },
    { zoneCode: 'MTR-05', week: 48, batch: 'B', date: '2024-11-27', timeSlot: 'SLOT_0330', equipmentNumber: 'SUN-PL02', orNumber: '5000405835', deadline: '11-Dec' },
    { zoneCode: 'MTR-05', week: 48, batch: 'B', date: '2024-11-28', timeSlot: 'SLOT_0130', equipmentNumber: 'SUN-E01', orNumber: '5000407695', deadline: '12-Dec' },
    { zoneCode: 'MTR-05', week: 48, batch: 'B', date: '2024-11-28', timeSlot: 'SLOT_0330', equipmentNumber: 'SUN-E03', orNumber: '5000407693', deadline: '12-Dec' },
    
    // MTR-06 (Week 45, Batch A) - Complete from image
    { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2024-11-02', timeSlot: 'SLOT_0130', equipmentNumber: 'AWE-E03', orNumber: '5000357821', deadline: '17-Nov' },
    { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2024-11-03', timeSlot: 'SLOT_0130', equipmentNumber: 'TUC-FL01', orNumber: '5000357819', deadline: '17-Nov' },
    { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2024-11-03', timeSlot: 'SLOT_0330', equipmentNumber: 'TUC-E07', orNumber: '5000357827', deadline: '17-Nov' },
    { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2024-11-04', timeSlot: 'SLOT_0130', equipmentNumber: 'TUM-E13', orNumber: '5000449744', deadline: '17-Nov' },
    { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2024-11-04', timeSlot: 'SLOT_0330', equipmentNumber: 'TUM-E14', orNumber: '5000449773', deadline: '17-Nov' },
    { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2024-11-06', timeSlot: 'SLOT_0130', equipmentNumber: 'TUC-E05', orNumber: '5000363550', deadline: '20-Nov' },
    { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2024-11-06', timeSlot: 'SLOT_0330', equipmentNumber: 'TUC-E06', orNumber: '5000363562', deadline: '20-Nov' },
    { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2024-11-07', timeSlot: 'SLOT_0130', equipmentNumber: 'TUC-E03', orNumber: '5000365269', deadline: '21-Nov' },
    { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2024-11-07', timeSlot: 'SLOT_0330', equipmentNumber: 'TUC-E04', orNumber: '5000365279', deadline: '21-Nov' },
    
    // MTR-06 (Week 46, Batch B) - Complete from image
    { zoneCode: 'MTR-06', week: 46, batch: 'B', date: '2024-11-09', timeSlot: 'SLOT_0130', equipmentNumber: 'TUC-AE01', orNumber: '5000365277', deadline: '21-Nov' },
    { zoneCode: 'MTR-06', week: 46, batch: 'B', date: '2024-11-09', timeSlot: 'SLOT_0330', equipmentNumber: 'TUC-AE02', orNumber: '5000365273', deadline: '21-Nov' },
    { zoneCode: 'MTR-06', week: 46, batch: 'B', date: '2024-11-10', timeSlot: 'SLOT_0130', equipmentNumber: 'AWE-E01', orNumber: '5000368589', deadline: '24-Nov' },
    { zoneCode: 'MTR-06', week: 46, batch: 'B', date: '2024-11-10', timeSlot: 'SLOT_0330', equipmentNumber: 'AWE-E02', orNumber: '5000368596', deadline: '24-Nov' },
    { zoneCode: 'MTR-06', week: 46, batch: 'B', date: '2024-11-11', timeSlot: 'SLOT_0130', equipmentNumber: 'TUM-E12', orNumber: '5000462052', deadline: '24-Nov' },
    { zoneCode: 'MTR-06', week: 46, batch: 'B', date: '2024-11-14', timeSlot: 'SLOT_2300', equipmentNumber: 'AIR-FL01', orNumber: '5000377005', deadline: '28-Nov' },
    { zoneCode: 'MTR-06', week: 46, batch: 'B', date: '2024-11-14', timeSlot: 'SLOT_0130', equipmentNumber: 'AIR-FL02', orNumber: '5000377014', deadline: '28-Nov' },
    { zoneCode: 'MTR-06', week: 46, batch: 'B', date: '2024-11-14', timeSlot: 'SLOT_0330', equipmentNumber: 'AIR-SL03', orNumber: '5000377018', deadline: '28-Nov' },
    
    // MTR-06 (Week 47, Batch A) - Complete from image
    { zoneCode: 'MTR-06', week: 47, batch: 'A', date: '2024-11-16', timeSlot: 'SLOT_0130', equipmentNumber: 'AWE-E03', orNumber: '5000386801', deadline: '01-Dec' },
    { zoneCode: 'MTR-06', week: 47, batch: 'A', date: '2024-11-17', timeSlot: 'SLOT_0130', equipmentNumber: 'TUC-FL01', orNumber: '5000386795', deadline: '01-Dec' },
    { zoneCode: 'MTR-06', week: 47, batch: 'A', date: '2024-11-17', timeSlot: 'SLOT_0330', equipmentNumber: 'TUC-E07', orNumber: '5000386793', deadline: '01-Dec' },
    { zoneCode: 'MTR-06', week: 47, batch: 'A', date: '2024-11-18', timeSlot: 'SLOT_0130', equipmentNumber: 'TUM-E13', orNumber: '5000541356', deadline: '01-Dec' },
    { zoneCode: 'MTR-06', week: 47, batch: 'A', date: '2024-11-18', timeSlot: 'SLOT_0330', equipmentNumber: 'TUM-E14', orNumber: '5000541351', deadline: '01-Dec' },
    { zoneCode: 'MTR-06', week: 47, batch: 'A', date: '2024-11-20', timeSlot: 'SLOT_0130', equipmentNumber: 'TUC-E05', orNumber: '5000391033', deadline: '04-Dec' },
    { zoneCode: 'MTR-06', week: 47, batch: 'A', date: '2024-11-20', timeSlot: 'SLOT_0330', equipmentNumber: 'TUC-E06', orNumber: '5000391032', deadline: '04-Dec' },
    { zoneCode: 'MTR-06', week: 47, batch: 'A', date: '2024-11-21', timeSlot: 'SLOT_0130', equipmentNumber: 'TUC-E03', orNumber: '5000392551', deadline: '05-Dec' },
    { zoneCode: 'MTR-06', week: 47, batch: 'A', date: '2024-11-21', timeSlot: 'SLOT_0330', equipmentNumber: 'TUC-E04', orNumber: '5000392550', deadline: '05-Dec' },
    
    // MTR-06 (Week 48, Batch B) - Complete from image
    { zoneCode: 'MTR-06', week: 48, batch: 'B', date: '2024-11-23', timeSlot: 'SLOT_0130', equipmentNumber: 'TUC-AE01', orNumber: '5000392558', deadline: '05-Dec' },
    { zoneCode: 'MTR-06', week: 48, batch: 'B', date: '2024-11-23', timeSlot: 'SLOT_0330', equipmentNumber: 'TUC-AE02', orNumber: '5000392554', deadline: '05-Dec' },
    { zoneCode: 'MTR-06', week: 48, batch: 'B', date: '2024-11-24', timeSlot: 'SLOT_0130', equipmentNumber: 'AWE-E01', orNumber: '5000396109', deadline: '08-Dec' },
    { zoneCode: 'MTR-06', week: 48, batch: 'B', date: '2024-11-24', timeSlot: 'SLOT_0330', equipmentNumber: 'AWE-E02', orNumber: '5000396115', deadline: '08-Dec' },
    { zoneCode: 'MTR-06', week: 48, batch: 'B', date: '2024-11-25', timeSlot: 'SLOT_0130', equipmentNumber: 'TUM-E12', orNumber: '5000574488', deadline: '08-Dec' },
    { zoneCode: 'MTR-06', week: 48, batch: 'B', date: '2024-11-28', timeSlot: 'SLOT_2300', equipmentNumber: 'AIR-FL01', orNumber: '5000407688', deadline: '12-Dec' },
    { zoneCode: 'MTR-06', week: 48, batch: 'B', date: '2024-11-28', timeSlot: 'SLOT_0130', equipmentNumber: 'AIR-FL02', orNumber: '5000407691', deadline: '12-Dec' },
    { zoneCode: 'MTR-06', week: 48, batch: 'B', date: '2024-11-28', timeSlot: 'SLOT_0330', equipmentNumber: 'AIR-SL03', orNumber: '5000407697', deadline: '12-Dec' },
  ]

  // Create equipment map to avoid duplicates
  const equipmentMap = new Map<string, { id: string; zoneId: string }>()

  // First pass: Create all equipment
  console.log('\n📦 Creating equipment...')
  for (const schedule of scheduleData) {
    const equipmentKey = `${schedule.zoneCode}-${schedule.equipmentNumber}`
    if (!equipmentMap.has(equipmentKey)) {
      const zoneId = createdZones[schedule.zoneCode]
      if (!zoneId) {
        console.warn(`⚠️  Zone ${schedule.zoneCode} not found for equipment ${schedule.equipmentNumber}`)
        continue
      }

      // Determine equipment type from equipment number
      let type: 'ELEVATOR' | 'ESCALATOR' = 'ELEVATOR'
      if (schedule.equipmentNumber.includes('FL') || schedule.equipmentNumber.includes('SL') || schedule.equipmentNumber.includes('PL')) {
        type = 'ESCALATOR'
      }

      const equipment = await prisma.equipment.upsert({
        where: { equipmentNumber: schedule.equipmentNumber },
        update: {},
        create: {
          equipmentNumber: schedule.equipmentNumber,
          name: schedule.equipmentNumber,
          type,
          location: schedule.equipmentNumber,
          zoneId,
          active: true,
        },
      })
      equipmentMap.set(equipmentKey, { id: equipment.id, zoneId })
      console.log(`  ✅ Equipment: ${schedule.equipmentNumber}`)
    }
  }

  // Second pass: Create schedules
  console.log('\n📅 Creating schedules...')
  let scheduleCount = 0
  for (const schedule of scheduleData) {
    const equipmentKey = `${schedule.zoneCode}-${schedule.equipmentNumber}`
    const equipment = equipmentMap.get(equipmentKey)
    if (!equipment) {
      console.warn(`⚠️  Equipment ${schedule.equipmentNumber} not found`)
      continue
    }

    const zoneId = createdZones[schedule.zoneCode]
    if (!zoneId) {
      console.warn(`⚠️  Zone ${schedule.zoneCode} not found`)
      continue
    }

    // Parse date and map to 2025
    // Simple: same calendar date, different year
    // Nov 25, 2024 → Nov 25, 2025
    const [year, month, day] = schedule.date.split('-').map(Number)
    
    // Create adjusted date: same month/day, year 2025
    const adjustedDate = new Date(2025, month - 1, day)
    
    let hour = 0
    let minute = 0
    
    if (schedule.timeSlot === 'SLOT_2300') {
      hour = 23
      minute = 0
    } else if (schedule.timeSlot === 'SLOT_0130') {
      hour = 1
      minute = 30
    } else if (schedule.timeSlot === 'SLOT_0330') {
      hour = 3
      minute = 30
    }

    const r0PlannedDate = createHKTDate(
      adjustedDate.getFullYear(),
      adjustedDate.getMonth() + 1,
      adjustedDate.getDate(),
      hour,
      minute
    )
    const r1PlannedDate = createHKTDate(
      adjustedDate.getFullYear(),
      adjustedDate.getMonth() + 1,
      adjustedDate.getDate(),
      hour,
      minute
    )
    
    // Calculate due date (R0 + 14 days) instead of parsing deadline
    const dueDate = calculateDueDate(r0PlannedDate)

    try {
      await prisma.schedule.create({
        data: {
          equipmentId: equipment.id,
          zoneId,
          r0PlannedDate,
          r1PlannedDate,
          dueDate,
          batch: schedule.batch as ScheduleBatch,
          timeSlot: schedule.timeSlot as TimeSlot,
          workOrderNumber: schedule.orNumber,
          status: 'PLANNED',
        },
      })
      scheduleCount++
    } catch (error: any) {
      // Skip if duplicate OR number
      if (error.code === 'P2002') {
        console.warn(`  ⚠️  Duplicate OR number ${schedule.orNumber}, skipping`)
      } else {
        console.error(`  ❌ Error creating schedule for ${schedule.equipmentNumber}:`, error.message)
      }
    }
  }

  console.log(`\n✅ Created ${scheduleCount} schedules`)
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
