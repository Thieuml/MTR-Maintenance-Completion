/**
 * Script to delete duplicate devices created due to missing leading zeros
 * Deletes devices that match existing devices when normalized (e.g., HOK-E1 vs HOK-E01)
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const prisma = new PrismaClient()

/**
 * Normalize equipment number by removing leading zeros from numbers
 * E.g., HOK-E01 -> HOK-E1, TSY-E10 -> TSY-E10 (no change)
 */
function normalizeEquipmentNumber(num: string): string {
  // Match pattern like HOK-E01, KOW-SL05, etc.
  // Replace E01 -> E1, SL05 -> SL5, but keep E10 -> E10
  return num.replace(/([A-Z]+-)([A-Z]*)(0+)(\d+)/g, (match, prefix, middle, zeros, digits) => {
    // Only remove leading zeros if there are multiple zeros or if the number is single digit
    if (zeros.length > 1 || (zeros.length === 1 && digits.length === 1)) {
      return `${prefix}${middle}${digits}`
    }
    return match
  })
}

async function deleteDuplicateDevices() {
  try {
    console.log('🔍 Finding duplicate devices...')
    
    const allEquipment = await prisma.equipment.findMany({
      select: {
        id: true,
        equipmentNumber: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc', // Keep older devices
      },
    })

    // Group by normalized equipment number
    const normalizedMap = new Map<string, Array<{ id: string; equipmentNumber: string; createdAt: Date }>>()
    
    for (const eq of allEquipment) {
      const normalized = normalizeEquipmentNumber(eq.equipmentNumber)
      if (!normalizedMap.has(normalized)) {
        normalizedMap.set(normalized, [])
      }
      normalizedMap.get(normalized)!.push(eq)
    }

    // Find duplicates (normalized groups with more than one device)
    const duplicatesToDelete: string[] = []
    const duplicatesInfo: Array<{ keep: string; delete: string[] }> = []

    for (const [normalized, devices] of normalizedMap.entries()) {
      if (devices.length > 1) {
        // Keep the oldest device (first in sorted array), delete the rest
        const sorted = devices.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        const keep = sorted[0]
        const toDelete = sorted.slice(1)
        
        duplicatesInfo.push({
          keep: keep.equipmentNumber,
          delete: toDelete.map(d => d.equipmentNumber),
        })
        
        duplicatesToDelete.push(...toDelete.map(d => d.id))
      }
    }

    if (duplicatesToDelete.length === 0) {
      console.log('✅ No duplicates found')
      return
    }

    console.log(`\n📋 Found ${duplicatesInfo.length} duplicate groups:`)
    duplicatesInfo.forEach(({ keep, delete: deleteList }) => {
      console.log(`  Keep: ${keep}, Delete: ${deleteList.join(', ')}`)
    })

    console.log(`\n🗑️  Deleting ${duplicatesToDelete.length} duplicate devices...`)

    // Check for schedules or mappings that reference these devices
    const schedulesCount = await prisma.schedule.count({
      where: {
        equipmentId: { in: duplicatesToDelete },
      },
    })

    const mappingsCount = await prisma.equipmentZoneMapping.count({
      where: {
        equipmentId: { in: duplicatesToDelete },
      },
    })

    if (schedulesCount > 0 || mappingsCount > 0) {
      console.log(`\n⚠️  Warning: Found ${schedulesCount} schedules and ${mappingsCount} mappings referencing these devices`)
      console.log('   These will be deleted as well (cascade delete)')
    }

    // Delete duplicates
    const result = await prisma.equipment.deleteMany({
      where: {
        id: { in: duplicatesToDelete },
      },
    })

    console.log(`\n✅ Deleted ${result.count} duplicate devices`)
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

deleteDuplicateDevices()
  .then(() => {
    console.log('\n✨ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })



