/**
 * Script to normalize equipment numbers to consistent format
 * Single digit numbers should be zero-padded: TSY-PL2 -> TSY-PL02
 * But double digit numbers stay as-is: TSY-PL12 -> TSY-PL12
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

/**
 * Normalize equipment number to standard format
 * Adds zero-padding to single digit numbers: TSY-PL2 -> TSY-PL02
 * Leaves double digit numbers unchanged: TSY-PL12 -> TSY-PL12
 */
function normalizeToStandardFormat(num: string): string {
  // Match pattern like TSY-PL2, HOK-E1, KOW-SL5, etc.
  // Format: [PREFIX]-[TYPE][SINGLE_DIGIT] -> [PREFIX]-[TYPE]0[SINGLE_DIGIT]
  return num.replace(/([A-Z]+-)([A-Z]+)(\d)(?!\d)/g, (match, prefix, type, digit) => {
    // Only pad if it's a single digit (not followed by another digit)
    return `${prefix}${type}0${digit}`
  })
}

async function normalizeEquipmentNumbers() {
  try {
    console.log('🔍 Finding equipment numbers that need normalization...')
    
    const allEquipment = await prisma.equipment.findMany({
      select: {
        id: true,
        equipmentNumber: true,
      },
    })

    const devicesToUpdate: Array<{ id: string; oldNumber: string; newNumber: string }> = []

    for (const eq of allEquipment) {
      const normalized = normalizeToStandardFormat(eq.equipmentNumber)
      if (normalized !== eq.equipmentNumber) {
        devicesToUpdate.push({
          id: eq.id,
          oldNumber: eq.equipmentNumber,
          newNumber: normalized,
        })
      }
    }

    if (devicesToUpdate.length === 0) {
      console.log('✅ All equipment numbers are already in the correct format')
      return
    }

    console.log(`\n📋 Found ${devicesToUpdate.length} devices to normalize:`)
    devicesToUpdate.forEach(({ oldNumber, newNumber }) => {
      console.log(`  ${oldNumber} -> ${newNumber}`)
    })

    // Check for conflicts (new number already exists)
    const newNumbers = devicesToUpdate.map(d => d.newNumber)
    const existingWithNewNumbers = await prisma.equipment.findMany({
      where: {
        equipmentNumber: { in: newNumbers },
      },
      select: {
        equipmentNumber: true,
      },
    })

    const existingSet = new Set(existingWithNewNumbers.map(eq => eq.equipmentNumber))
    const conflicts = devicesToUpdate.filter(d => existingSet.has(d.newNumber))

    if (conflicts.length > 0) {
      console.log(`\n⚠️  Warning: Found ${conflicts.length} conflicts (target name already exists):`)
      conflicts.forEach(({ oldNumber, newNumber }) => {
        console.log(`  ${oldNumber} -> ${newNumber} (CONFLICT: ${newNumber} already exists)`)
      })
      console.log('\nThese will be skipped. Please resolve conflicts manually.')
    }

    // Filter out conflicts
    const toUpdate = devicesToUpdate.filter(d => !existingSet.has(d.newNumber))

    if (toUpdate.length === 0) {
      console.log('\n❌ No devices can be updated due to conflicts')
      return
    }

    console.log(`\n📦 Updating ${toUpdate.length} devices...`)

    // Update devices one by one to handle foreign key constraints
    let updated = 0
    let errors = 0

    for (const { id, oldNumber, newNumber } of toUpdate) {
      try {
        // Check for schedules or mappings that might reference this equipment
        const schedulesCount = await prisma.schedule.count({
          where: { equipmentId: id },
        })

        const mappingsCount = await prisma.equipmentZoneMapping.count({
          where: { equipmentId: id },
        })

        if (schedulesCount > 0 || mappingsCount > 0) {
          console.log(`  ⚠️  ${oldNumber} has ${schedulesCount} schedules and ${mappingsCount} mappings - updating...`)
        }

        // Update equipment number
        await prisma.equipment.update({
          where: { id },
          data: {
            equipmentNumber: newNumber,
            name: newNumber, // Also update name to match
          },
        })

        updated++
        console.log(`  ✅ ${oldNumber} -> ${newNumber}`)
      } catch (error: any) {
        console.error(`  ❌ Error updating ${oldNumber}:`, error.message)
        errors++
      }
    }

    console.log(`\n✅ Updated ${updated} devices`)
    if (errors > 0) {
      console.log(`⚠️  ${errors} errors occurred`)
    }
    if (conflicts.length > 0) {
      console.log(`⚠️  ${conflicts.length} devices skipped due to conflicts`)
    }
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

normalizeEquipmentNumbers()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })


