/**
 * Test script to check Looker visits for KOW-SL05
 * Run with: npx tsx scripts/test-looker-visits.ts
 */

import { fetchMaintenanceVisitsFromLooker } from '@/lib/looker'
import { getHKTDateKey } from '@/lib/utils/timezone'

async function main() {
  console.log('Fetching visits from Looker...')
  const visits = await fetchMaintenanceVisitsFromLooker()
  console.log(`Total visits fetched: ${visits.length}\n`)

  // Show sample visit structure
  if (visits.length > 0) {
    console.log('Sample visit fields:', Object.keys(visits[0]))
    console.log('Sample visit data:', JSON.stringify(visits[0], null, 2))
    console.log('')
  }

  // Find KOW-SL05 visits
  const kowSl05Visits = visits.filter((v: any) => {
    const eqNum = (v['device.location'] || 
                   v['device_location'] || 
                   v.device_location || 
                   v.equipment_number || 
                   v.equipmentNumber || 
                   '').toString().trim().toUpperCase()
    return eqNum === 'KOW-SL05'
  })

  console.log(`Found ${kowSl05Visits.length} visits for KOW-SL05\n`)

  if (kowSl05Visits.length > 0) {
    console.log('KOW-SL05 visits:')
    kowSl05Visits.forEach((v: any, i: number) => {
      const date = v.completed_date || v.completedDate
      const pdf = v.pdf_report || v.pdfReport || v.report
      const dateKey = date ? getHKTDateKey(new Date(date)) : 'N/A'
      console.log(`  ${i + 1}. Date: ${dateKey}, PDF: ${pdf ? 'YES' : 'NO'}`)
      if (pdf) {
        console.log(`      URL: ${pdf}`)
      }
    })
  } else {
    // Check for variations
    console.log('Checking for equipment number variations...')
    const variations = ['KOW-SL05', 'KOW SL05', 'KOWSL05', 'KOW-SL-05', 'kow-sl05']
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

  // Check for visits around 2025-12-02
  const targetDate = new Date('2025-12-02')
  const targetDateKey = getHKTDateKey(targetDate)
  const nextDateKey = getHKTDateKey(new Date(targetDate.getTime() + 24*60*60*1000))
  
  console.log(`\nLooking for visits on dates: ${targetDateKey} or ${nextDateKey}`)
  
  const dateMatches = visits.filter((v: any) => {
    const date = v.completed_date || v.completedDate
    if (!date) return false
    const visitDateKey = getHKTDateKey(new Date(date))
    return visitDateKey === targetDateKey || visitDateKey === nextDateKey
  })
  
  console.log(`Found ${dateMatches.length} visits on those dates`)
  if (dateMatches.length > 0) {
    dateMatches.forEach((v: any, i: number) => {
      const eqNum = (v['device.location'] || 
                     v['device_location'] || 
                     v.device_location || 
                     v.equipment_number || 
                     v.equipmentNumber || 
                     'UNKNOWN')
      const date = v.completed_date || v.completedDate
      const dateKey = date ? getHKTDateKey(new Date(date)) : 'N/A'
      console.log(`  ${i + 1}. Equipment: ${eqNum}, Date: ${dateKey}`)
    })
  }
}

main().catch(console.error)

