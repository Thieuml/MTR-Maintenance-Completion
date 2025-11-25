/**
 * Import November 2025 schedules from Excel/PDF data
 * Based on the provided schedule images for MTR-01 through MTR-06
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') })

const prisma = new PrismaClient()

interface ScheduleEntry {
  zoneCode: string
  week: number
  batch: 'A' | 'B'
  date: string // Format: "YYYY-MM-DD"
  timeSlot: 'SLOT_2300' | 'SLOT_0130' | 'SLOT_0330'
  equipmentNumber: string
  orNumber: string | null
  deadline: string | null // Format: "YYYY-MM-DD"
}

// November 2025 schedule data extracted from images
const novemberSchedules: ScheduleEntry[] = [
  // MTR-01 (HOK equipment)
  { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2025-11-02', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E25', orNumber: '5000355448', deadline: '2025-11-16' },
  { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2025-11-02', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E26', orNumber: '5000355445', deadline: '2025-11-16' },
  { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2025-11-03', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E43', orNumber: '5000357829', deadline: '2025-11-17' },
  { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2025-11-03', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E44', orNumber: '5000357823', deadline: '2025-11-17' },
  { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2025-11-04', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E14', orNumber: '5000359340', deadline: '2025-11-18' },
  { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2025-11-05', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E37', orNumber: '5000360930', deadline: '2025-11-19' },
  { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2025-11-05', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E38', orNumber: '5000360928', deadline: '2025-11-19' },
  { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2025-11-06', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E28', orNumber: '5000363551', deadline: '2025-11-20' },
  { zoneCode: 'MTR-01', week: 45, batch: 'A', date: '2025-11-06', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E30', orNumber: '5000363560', deadline: '2025-11-20' },
  
  { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2025-11-09', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E01', orNumber: '5000366909', deadline: '2025-11-23' },
  { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2025-11-09', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E02', orNumber: '5000366917', deadline: '2025-11-23' },
  { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2025-11-09', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E05', orNumber: '5000366916', deadline: '2025-11-23' },
  { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2025-11-10', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E03', orNumber: '5000368588', deadline: '2025-11-24' },
  { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2025-11-10', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E07', orNumber: '5000368590', deadline: '2025-11-24' },
  { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2025-11-11', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E15', orNumber: '5000370414', deadline: '2025-11-25' },
  { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2025-11-11', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E33', orNumber: '5000370420', deadline: '2025-11-25' },
  { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2025-11-12', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E09', orNumber: '5000371981', deadline: '2025-11-26' },
  { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2025-11-12', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E10', orNumber: '5000371968', deadline: '2025-11-26' },
  { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2025-11-12', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E04', orNumber: '5000371980', deadline: '2025-11-26' },
  { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2025-11-13', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E19', orNumber: '5000375318', deadline: '2025-11-27' },
  { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2025-11-13', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E21', orNumber: '5000375331', deadline: '2025-11-27' },
  { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2025-11-14', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E13', orNumber: '5000377007', deadline: '2025-11-28' },
  { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2025-11-14', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E17', orNumber: '5000377003', deadline: '2025-11-28' },
  { zoneCode: 'MTR-01', week: 46, batch: 'B', date: '2025-11-14', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E18', orNumber: '5000377017', deadline: '2025-11-28' },
  
  // MTR-02 (HOK equipment - secondary)
  { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2025-11-02', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E27', orNumber: '5000357831', deadline: '2025-11-17' },
  { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2025-11-02', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E34', orNumber: '5000357830', deadline: '2025-11-17' },
  { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2025-11-03', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-SL11', orNumber: '5000355449', deadline: '2025-11-16' },
  { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2025-11-03', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-PL12', orNumber: '5000355450', deadline: '2025-11-16' },
  { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2025-11-03', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-PL13', orNumber: '5000355446', deadline: '2025-11-16' },
  { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2025-11-04', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E31', orNumber: '5000359343', deadline: '2025-11-18' },
  { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2025-11-04', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E32', orNumber: '5000359338', deadline: '2025-11-18' },
  { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2025-11-04', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E36', orNumber: '5000359342', deadline: '2025-11-18' },
  { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2025-11-05', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-PL14', orNumber: '5000360936', deadline: '2025-11-19' },
  { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2025-11-05', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-PL15', orNumber: '5000360924', deadline: '2025-11-19' },
  { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2025-11-05', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-PL05', orNumber: '5000360929', deadline: '2025-11-19' },
  { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2025-11-07', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E11', orNumber: '5000365282', deadline: '2025-11-21' },
  { zoneCode: 'MTR-02', week: 45, batch: 'A', date: '2025-11-07', timeSlot: 'SLOT_0330', equipmentNumber: 'HOK-E16', orNumber: '5000365281', deadline: '2025-11-21' },
  
  { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2025-11-09', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-FL04', orNumber: '5000366919', deadline: '2025-11-23' },
  { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2025-11-09', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E23', orNumber: '5000366910', deadline: '2025-11-23' },
  { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2025-11-10', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E12', orNumber: '5000368595', deadline: '2025-11-24' },
  { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2025-11-10', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-FL06', orNumber: '5000368586', deadline: '2025-11-24' },
  { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2025-11-11', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-SL01', orNumber: '5000370415', deadline: '2025-11-25' },
  { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2025-11-11', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E35', orNumber: '5000370421', deadline: '2025-11-25' },
  { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2025-11-12', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-SL03', orNumber: '5000371971', deadline: '2025-11-26' },
  { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2025-11-12', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E29', orNumber: '5000371974', deadline: '2025-11-26' },
  { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2025-11-13', timeSlot: 'SLOT_2300', equipmentNumber: 'HOK-E06', orNumber: '5000375324', deadline: '2025-11-27' },
  { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2025-11-13', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-E22', orNumber: '5000375323', deadline: '2025-11-27' },
  { zoneCode: 'MTR-02', week: 46, batch: 'B', date: '2025-11-14', timeSlot: 'SLOT_0130', equipmentNumber: 'HOK-SL16', orNumber: '5000377012', deadline: '2025-11-28' },
  
  // MTR-03 (KOW equipment)
  { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2025-11-02', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E01', orNumber: '5000366911', deadline: '2025-11-23' },
  { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2025-11-02', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-E02', orNumber: '5000366913', deadline: '2025-11-23' },
  { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2025-11-03', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E03', orNumber: '5000366907', deadline: '2025-11-23' },
  { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2025-11-03', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-E04', orNumber: '5000366906', deadline: '2025-11-23' },
  { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2025-11-04', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-SL05', orNumber: '5000366914', deadline: '2025-11-23' },
  { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2025-11-04', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-SL04', orNumber: '5000366915', deadline: '2025-11-23' },
  { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2025-11-05', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E07', orNumber: '5000368598', deadline: '2025-11-24' },
  { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2025-11-06', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E09', orNumber: '5000368599', deadline: '2025-11-24' },
  { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2025-11-06', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-E10', orNumber: '5000368591', deadline: '2025-11-24' },
  { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2025-11-07', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-FL17', orNumber: '5000370411', deadline: '2025-11-25' },
  { zoneCode: 'MTR-03', week: 45, batch: 'A', date: '2025-11-07', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-FL16', orNumber: '5000370413', deadline: '2025-11-25' },
  
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-09', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E16', orNumber: '5000371985', deadline: '2025-11-26' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-09', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E17', orNumber: '5000371970', deadline: '2025-11-26' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-09', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-SL03', orNumber: '5000371973', deadline: '2025-11-26' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-10', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E14', orNumber: '5000370422', deadline: '2025-11-25' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-10', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E15', orNumber: '5000370409', deadline: '2025-11-25' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-10', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-SL07', orNumber: '5000377006', deadline: '2025-11-28' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-11', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E08', orNumber: '5000370412', deadline: '2025-11-25' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-11', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E11', orNumber: '5000371972', deadline: '2025-11-26' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-11', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-SL06', orNumber: '5000368587', deadline: '2025-11-24' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-12', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-PL01', orNumber: '5000377013', deadline: '2025-11-28' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-12', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-FL02', orNumber: '5000368592', deadline: '2025-11-24' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-12', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-E12', orNumber: '5000370410', deadline: '2025-11-25' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-13', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E18', orNumber: '5000371984', deadline: '2025-11-26' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-13', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E19', orNumber: '5000375326', deadline: '2025-11-27' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-13', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-SL14', orNumber: '5000371982', deadline: '2025-11-26' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-14', timeSlot: 'SLOT_2300', equipmentNumber: 'KOW-E20', orNumber: '5000375320', deadline: '2025-11-27' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-14', timeSlot: 'SLOT_0130', equipmentNumber: 'KOW-E21', orNumber: '5000377010', deadline: '2025-11-28' },
  { zoneCode: 'MTR-03', week: 46, batch: 'B', date: '2025-11-14', timeSlot: 'SLOT_0330', equipmentNumber: 'KOW-SL15', orNumber: '5000375333', deadline: '2025-11-27' },
  
  // MTR-04 (TSY equipment) - Sample entries
  { zoneCode: 'MTR-04', week: 45, batch: 'A', date: '2025-11-04', timeSlot: 'SLOT_2300', equipmentNumber: 'TSY-FL05', orNumber: '5000359346', deadline: '2025-11-18' },
  { zoneCode: 'MTR-04', week: 46, batch: 'B', date: '2025-11-09', timeSlot: 'SLOT_0130', equipmentNumber: 'TSY-E04', orNumber: '5000363553', deadline: '2025-11-20' },
  
  // MTR-05 (OLY/DIS/SUN/LHP/LAK equipment) - Sample entries
  { zoneCode: 'MTR-05', week: 45, batch: 'A', date: '2025-11-02', timeSlot: 'SLOT_0130', equipmentNumber: 'LHP-E03', orNumber: '5000507882', deadline: '2025-11-16' },
  { zoneCode: 'MTR-05', week: 45, batch: 'A', date: '2025-11-02', timeSlot: 'SLOT_0330', equipmentNumber: 'LHP-E04', orNumber: '5000507887', deadline: '2025-11-16' },
  { zoneCode: 'MTR-05', week: 45, batch: 'A', date: '2025-11-03', timeSlot: 'SLOT_0130', equipmentNumber: 'OLY-FL04', orNumber: '5000355443', deadline: '2025-11-16' },
  { zoneCode: 'MTR-05', week: 45, batch: 'A', date: '2025-11-03', timeSlot: 'SLOT_0330', equipmentNumber: 'OLY-CE01', orNumber: '5000357828', deadline: '2025-11-17' },
  
  // MTR-06 (TUC/AIR/TUM/AWE equipment) - Sample entries
  { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2025-11-02', timeSlot: 'SLOT_0130', equipmentNumber: 'AWE-E03', orNumber: '5000357821', deadline: '2025-11-17' },
  { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2025-11-03', timeSlot: 'SLOT_2300', equipmentNumber: 'TUC-FL01', orNumber: '5000357819', deadline: '2025-11-17' },
  { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2025-11-03', timeSlot: 'SLOT_0130', equipmentNumber: 'TUC-E07', orNumber: '5000357827', deadline: '2025-11-17' },
  { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2025-11-04', timeSlot: 'SLOT_2300', equipmentNumber: 'TUM-E13', orNumber: '5000449744', deadline: '2025-11-17' },
  { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2025-11-04', timeSlot: 'SLOT_0130', equipmentNumber: 'TUM-E14', orNumber: '5000449773', deadline: '2025-11-17' },
  { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2025-11-06', timeSlot: 'SLOT_2300', equipmentNumber: 'TUC-E05', orNumber: '5000363550', deadline: '2025-11-20' },
  { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2025-11-06', timeSlot: 'SLOT_0130', equipmentNumber: 'TUC-E06', orNumber: '5000363562', deadline: '2025-11-20' },
  { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2025-11-07', timeSlot: 'SLOT_2300', equipmentNumber: 'TUC-E03', orNumber: '5000365269', deadline: '2025-11-21' },
  { zoneCode: 'MTR-06', week: 45, batch: 'A', date: '2025-11-07', timeSlot: 'SLOT_0130', equipmentNumber: 'TUC-E04', orNumber: '5000365279', deadline: '2025-11-21' },
  
  { zoneCode: 'MTR-06', week: 46, batch: 'B', date: '2025-11-09', timeSlot: 'SLOT_0130', equipmentNumber: 'TUC-AE01', orNumber: '5000365277', deadline: '2025-11-21' },
  { zoneCode: 'MTR-06', week: 46, batch: 'B', date: '2025-11-09', timeSlot: 'SLOT_0330', equipmentNumber: 'TUC-AE02', orNumber: '5000365273', deadline: '2025-11-21' },
  { zoneCode: 'MTR-06', week: 46, batch: 'B', date: '2025-11-10', timeSlot: 'SLOT_2300', equipmentNumber: 'AWE-E01', orNumber: '5000368589', deadline: '2025-11-24' },
  { zoneCode: 'MTR-06', week: 46, batch: 'B', date: '2025-11-10', timeSlot: 'SLOT_0130', equipmentNumber: 'AWE-E02', orNumber: '5000368596', deadline: '2025-11-24' },
  { zoneCode: 'MTR-06', week: 46, batch: 'B', date: '2025-11-11', timeSlot: 'SLOT_2300', equipmentNumber: 'TUM-E12', orNumber: '5000462052', deadline: '2025-11-24' },
  { zoneCode: 'MTR-06', week: 46, batch: 'B', date: '2025-11-14', timeSlot: 'SLOT_2300', equipmentNumber: 'AIR-FL01', orNumber: '5000377005', deadline: '2025-11-28' },
  { zoneCode: 'MTR-06', week: 46, batch: 'B', date: '2025-11-14', timeSlot: 'SLOT_0130', equipmentNumber: 'AIR-FL02', orNumber: '5000377014', deadline: '2025-11-28' },
  { zoneCode: 'MTR-06', week: 46, batch: 'B', date: '2025-11-14', timeSlot: 'SLOT_0330', equipmentNumber: 'AIR-SL03', orNumber: '5000377018', deadline: '2025-11-28' },
]

async function main() {
  console.log('🌱 Importing November 2025 schedules...')

  // Get all zones
  const zones = await prisma.zone.findMany()
  const zoneMap = new Map(zones.map(z => [z.code, z]))

  // Get unique equipment numbers
  const uniqueEquipmentNumbers = [...new Set(novemberSchedules.map(s => s.equipmentNumber))]
  console.log(`Found ${uniqueEquipmentNumbers.length} unique equipment numbers`)

  // Create or update equipment
  const equipmentMap = new Map<string, string>()
  for (const eqNumber of uniqueEquipmentNumbers) {
    // Determine zone from equipment prefix
    let zoneCode = 'MTR-01'
    if (eqNumber.startsWith('HOK-')) {
      zoneCode = 'MTR-01' // Could be MTR-01 or MTR-02, defaulting to MTR-01
    } else if (eqNumber.startsWith('KOW-')) {
      zoneCode = 'MTR-03'
    } else if (eqNumber.startsWith('TSY-') || eqNumber.startsWith('TY-')) {
      zoneCode = 'MTR-04'
    } else if (eqNumber.startsWith('OLY-') || eqNumber.startsWith('SBY-') || eqNumber.startsWith('DIS-') || eqNumber.startsWith('LKP-') || eqNumber.startsWith('LHP-') || eqNumber.startsWith('LAK-') || eqNumber.startsWith('SUN-')) {
      zoneCode = 'MTR-05'
    } else if (eqNumber.startsWith('TUC-') || eqNumber.startsWith('AIR-') || eqNumber.startsWith('TUM-') || eqNumber.startsWith('AWE-')) {
      zoneCode = 'MTR-06'
    }

    // Find zone for this equipment
    const zone = zoneMap.get(zoneCode)
    if (!zone) {
      console.warn(`Zone ${zoneCode} not found for equipment ${eqNumber}`)
      continue
    }

    // Determine equipment type
    const type = eqNumber.includes('E') || eqNumber.includes('FL') ? 'ELEVATOR' : 'ESCALATOR'

    // Create or update equipment
    const equipment = await prisma.equipment.upsert({
      where: { equipmentNumber: eqNumber },
      update: {
        zoneId: zone.id,
        type,
        active: true,
      },
      create: {
        equipmentNumber: eqNumber,
        name: eqNumber,
        type,
        location: eqNumber,
        zoneId: zone.id,
        active: true,
      },
    })

    equipmentMap.set(eqNumber, equipment.id)
    console.log(`✅ Created/updated equipment: ${eqNumber} (${zoneCode})`)
  }

  // Create schedules
  let created = 0
  let updated = 0

  for (const scheduleData of novemberSchedules) {
    const zone = zoneMap.get(scheduleData.zoneCode)
    if (!zone) {
      console.warn(`Zone ${scheduleData.zoneCode} not found`)
      continue
    }

    const equipmentId = equipmentMap.get(scheduleData.equipmentNumber)
    if (!equipmentId) {
      console.warn(`Equipment ${scheduleData.equipmentNumber} not found`)
      continue
    }

    // Parse dates
    const r0PlannedDate = new Date(scheduleData.date + 'T00:00:00Z')
    const r1PlannedDate = new Date(scheduleData.date + 'T00:00:00Z')
    
    // Set time based on time slot
    if (scheduleData.timeSlot === 'SLOT_2300') {
      r1PlannedDate.setHours(23, 0, 0, 0)
    } else if (scheduleData.timeSlot === 'SLOT_0130') {
      r1PlannedDate.setHours(1, 30, 0, 0)
      r1PlannedDate.setDate(r1PlannedDate.getDate() + 1) // Next day for 1:30
    } else if (scheduleData.timeSlot === 'SLOT_0330') {
      r1PlannedDate.setHours(3, 30, 0, 0)
      r1PlannedDate.setDate(r1PlannedDate.getDate() + 1) // Next day for 3:30
    }

    // Calculate due date (R0 + 14 days)
    const dueDate = new Date(r0PlannedDate)
    dueDate.setDate(dueDate.getDate() + 14)

    // Create or update schedule
    const existing = await prisma.schedule.findFirst({
      where: {
        equipmentId,
        r1PlannedDate: {
          gte: new Date(scheduleData.date + 'T00:00:00Z'),
          lt: new Date(scheduleData.date + 'T23:59:59Z'),
        },
        timeSlot: scheduleData.timeSlot,
      },
    })

    if (existing) {
      await prisma.schedule.update({
        where: { id: existing.id },
        data: {
          r0PlannedDate,
          r1PlannedDate,
          dueDate,
          batch: scheduleData.batch,
          workOrderNumber: scheduleData.orNumber,
          status: 'PLANNED',
        },
      })
      updated++
    } else {
      await prisma.schedule.create({
        data: {
          equipmentId,
          zoneId: zone.id,
          r0PlannedDate,
          r1PlannedDate,
          dueDate,
          batch: scheduleData.batch,
          timeSlot: scheduleData.timeSlot,
          workOrderNumber: scheduleData.orNumber,
          status: 'PLANNED',
        },
      })
      created++
    }
  }

  console.log(`\n✅ Import completed!`)
  console.log(`   Created: ${created} schedules`)
  console.log(`   Updated: ${updated} schedules`)
  console.log(`   Total equipment: ${equipmentMap.size}`)
}

main()
  .catch((e) => {
    console.error('❌ Import failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

