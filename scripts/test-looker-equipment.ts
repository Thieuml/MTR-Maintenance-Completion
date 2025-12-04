/**
 * Test script to check Looker visits for specific equipment
 * Run with: npx tsx scripts/test-looker-equipment.ts
 */

import { fetchMaintenanceVisitsFromLooker } from '@/lib/looker'
import { getHKTDateKey } from '@/lib/utils/timezone'

async function main() {
  console.log('Fetching visits from Looker...')
  const visits = await fetchMaintenanceVisitsFromLooker()
  console.log(`Total visits fetched: ${visits.length}\n`)

  // Equipment to check
  const targetEquipment = ['TUC-FL01', 'TUM-E14']
  
  for (const equipment of targetEquipment) {
    console.log(`\n=== Checking ${equipment} ===`)
    
    // Find visits for this equipment
    const equipmentVisits = visits.filter((v: any) => {
      const eqNum = (v['device.location'] || 
                     v['device_location'] || 
                     v.device_location || 
                     v.equipment_number || 
                     v.equipmentNumber || 
                     '').toString().trim().toUpperCase()
      return eqNum === equipment.toUpperCase() || 
             eqNum === equipment.toUpperCase().replace('-', ' ') ||
             eqNum === equipment.toUpperCase().replace('-', '')
    })

    console.log(`Found ${equipmentVisits.length} visits for ${equipment}`)

    if (equipmentVisits.length > 0) {
      equipmentVisits.forEach((v: any, i: number) => {
        const date = v['task.completed_date'] || v.completed_date || v.completedDate
        const pdfReport = v['task.pdf_report'] || v.pdf_report || v.pdfReport
        const dateKey = date ? getHKTDateKey(new Date(date)) : 'N/A'
        console.log(`  ${i + 1}. Date: ${dateKey}, PDF: ${pdfReport ? 'YES' : 'NO'}`)
        if (pdfReport) {
          console.log(`      PDF Report ID: ${pdfReport}`)
        }
        console.log(`      Raw equipment: ${v['device.location'] || v.device_location || v.equipment_number || 'N/A'}`)
      })
    } else {
      // Check for variations
      console.log('Checking for equipment number variations...')
      const variations = [
        equipment.toUpperCase(),
        equipment.toUpperCase().replace('-', ' '),
        equipment.toUpperCase().replace('-', ''),
        equipment.toLowerCase(),
      ]
      
      variations.forEach(variant => {
        const matches = visits.filter((v: any) => {
          const eqNum = (v['device.location'] || 
                         v['device_location'] || 
                         v.device_location || 
                         v.equipment_number || 
                         v.equipmentNumber || 
                         '').toString().trim().toUpperCase()
          return eqNum === variant.toUpperCase()
        })
        if (matches.length > 0) {
          console.log(`  Found ${matches.length} visits for variant: ${variant}`)
        }
      })
    }
  }

  // Check for visits around Dec 3, 2025
  console.log('\n=== Checking for visits on Dec 3, 2025 ===')
  const targetDate = new Date('2025-12-03')
  const targetDateKey = getHKTDateKey(targetDate)
  const nextDateKey = getHKTDateKey(new Date(targetDate.getTime() + 24*60*60*1000))
  
  console.log(`Looking for visits on dates: ${targetDateKey} or ${nextDateKey}`)
  
  const dateMatches = visits.filter((v: any) => {
    const date = v['task.completed_date'] || v.completed_date || v.completedDate
    if (!date) return false
    const visitDateKey = getHKTDateKey(new Date(date))
    return visitDateKey === targetDateKey || visitDateKey === nextDateKey
  })
  
  console.log(`Found ${dateMatches.length} visits on those dates`)
  if (dateMatches.length > 0) {
    dateMatches.slice(0, 10).forEach((v: any, i: number) => {
      const eqNum = (v['device.location'] || 
                     v['device_location'] || 
                     v.device_location || 
                     v.equipment_number || 
                     v.equipmentNumber || 
                     'UNKNOWN')
      const date = v['task.completed_date'] || v.completed_date || v.completedDate
      const dateKey = date ? getHKTDateKey(new Date(date)) : 'N/A'
      const pdfReport = v['task.pdf_report'] || v.pdf_report || v.pdfReport
      console.log(`  ${i + 1}. Equipment: ${eqNum}, Date: ${dateKey}, PDF: ${pdfReport ? 'YES' : 'NO'}`)
    })
  }
}

main().catch(console.error)

