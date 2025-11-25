import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchEngineersFromLooker } from '@/lib/looker'

/**
 * POST /api/sync/engineers
 * Sync engineers from Looker (Look ID 160)
 * 
 * Fetches engineers from Looker and creates/updates them in the database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const dryRun = body.dryRun === true
    const deactivateMissing = body.deactivateMissing === true

    console.log('[Sync Engineers] Starting sync...', { dryRun, deactivateMissing })

    // Fetch engineers from Looker
    const lookerEngineers = await fetchEngineersFromLooker()
    console.log(`[Sync Engineers] Fetched ${lookerEngineers.length} engineers from Looker`)

    if (lookerEngineers.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No engineers found in Looker',
      }, { status: 400 })
    }

    // Map Looker data to our schema
    // Expected fields: engineer_name or name, country_code or country, active, looker_id
    const engineersToSync = lookerEngineers.map((eng: any) => {
      const name = eng.engineer_name || eng.name || eng.full_name
      const countryCode = eng.country_code || eng.country || 'HK'
      const lookerId = eng.looker_id || eng.id || eng.engineer_id
      const active = eng.active !== undefined ? eng.active : true
      const email = eng.email || null
      const phone = eng.phone || null

      if (!name) {
        throw new Error(`Invalid engineer data: missing name. Data: ${JSON.stringify(eng)}`)
      }

      return {
        name: name.trim(),
        countryCode: countryCode.toUpperCase(),
        lookerId: lookerId ? String(lookerId) : null,
        active,
        email,
        phone,
        role: 'ENGINEER' as const,
      }
    })

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        engineersFound: engineersToSync.length,
        engineers: engineersToSync,
        message: 'Dry run - no changes made',
      })
    }

    // Sync engineers to database
    const results = {
      created: 0,
      updated: 0,
      deactivated: 0,
      errors: [] as string[],
    }

    // Get all existing engineers by lookerId or name
    const existingEngineers = await prisma.engineer.findMany({
      where: {
        OR: [
          { lookerId: { not: null } },
          { name: { in: engineersToSync.map(e => e.name) } },
        ],
      },
    })

    const existingByLookerId = new Map(
      existingEngineers.filter(e => e.lookerId).map(e => [e.lookerId!, e])
    )
    const existingByName = new Map(
      existingEngineers.map(e => [e.name.toLowerCase(), e])
    )

    // Process each engineer
    for (const engData of engineersToSync) {
      try {
        let existing = null

        // Try to find by lookerId first, then by name
        if (engData.lookerId) {
          existing = existingByLookerId.get(engData.lookerId)
        }
        if (!existing) {
          existing = existingByName.get(engData.name.toLowerCase())
        }

        if (existing) {
          // Update existing engineer
          await prisma.engineer.update({
            where: { id: existing.id },
            data: {
              name: engData.name,
              active: engData.active,
              email: engData.email || existing.email,
              phone: engData.phone || existing.phone,
              lookerId: engData.lookerId || existing.lookerId,
              updatedAt: new Date(),
            },
          })
          results.updated++
        } else {
          // Create new engineer
          await prisma.engineer.create({
            data: engData,
          })
          results.created++
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        results.errors.push(`Failed to sync ${engData.name}: ${errorMsg}`)
        console.error(`[Sync Engineers] Error syncing ${engData.name}:`, error)
      }
    }

    // Deactivate engineers not found in Looker (if requested)
    if (deactivateMissing) {
      const syncedLookerIds = new Set(
        engineersToSync.filter(e => e.lookerId).map(e => e.lookerId!)
      )
      const syncedNames = new Set(
        engineersToSync.map(e => e.name.toLowerCase())
      )

      const toDeactivate = existingEngineers.filter(
        (e) =>
          e.active &&
          !(e.lookerId && syncedLookerIds.has(e.lookerId)) &&
          !syncedNames.has(e.name.toLowerCase())
      )

      for (const eng of toDeactivate) {
        await prisma.engineer.update({
          where: { id: eng.id },
          data: { active: false },
        })
        results.deactivated++
      }
    }

    console.log('[Sync Engineers] Sync completed:', results)

    return NextResponse.json({
      success: true,
      results,
      engineersProcessed: engineersToSync.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Sync Engineers] Sync failed:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sync/engineers
 * Test Looker connection
 */
export async function GET() {
  try {
    const { fetchEngineersFromLooker } = await import('@/lib/looker')
    const engineers = await fetchEngineersFromLooker()
    return NextResponse.json({
      connected: true,
      engineersFound: engineers.length,
      message: 'Looker connection successful',
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        connected: false,
        error: errorMessage,
      },
      { status: 500 }
    )
  }
}

