import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createHKTDate } from '@/lib/utils/timezone'

/**
 * POST /api/cron/planned-to-pending
 * CRON job to automatically transition PLANNED → PENDING at 7am HK Time daily
 * 
 * This endpoint should be called by a scheduled job (Vercel Cron, GitHub Actions, etc.)
 * at 7am HKT daily.
 * 
 * Security: Should be protected with a secret token in production
 */
export async function POST(request: NextRequest) {
  try {
    // Verify request is from authorized source
    // Vercel Cron: Check for Vercel signature or allow if CRON_SECRET matches
    const authHeader = request.headers.get('authorization')
    const vercelSignature = request.headers.get('x-vercel-signature')
    const cronSecret = process.env.CRON_SECRET
    
    // Allow if:
    // 1. Vercel Cron signature is present (production)
    // 2. Authorization header matches CRON_SECRET (manual/external calls)
    // 3. CRON_SECRET is not set (development - less secure)
    const isVercelCron = vercelSignature !== null
    const isValidAuth = cronSecret && authHeader === `Bearer ${cronSecret}`
    const isDevMode = !cronSecret
    
    if (cronSecret && !isVercelCron && !isValidAuth && !isDevMode) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get current date in HKT
    // Convert server time (UTC on Vercel) to HKT to get the correct date components
    const now = new Date()
    const hktString = now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' })
    const hktDate = new Date(hktString)
    
    // Create midnight today in HKT
    const hktNow = createHKTDate(
      hktDate.getFullYear(),
      hktDate.getMonth() + 1,
      hktDate.getDate(),
      0,
      0
    )

    // Find all PLANNED schedules with r1PlannedDate < today (in HKT)
    const result = await prisma.schedule.updateMany({
      where: {
        status: 'PLANNED',
        r1PlannedDate: {
          lt: hktNow, // Past date in HKT
        },
      },
      data: {
        status: 'PENDING',
      },
    })

    return NextResponse.json({
      success: true,
      message: `Transitioned ${result.count} schedules from PLANNED to PENDING`,
      count: result.count,
      timestamp: new Date().toISOString(),
      hktDate: hktNow.toISOString(),
    })
  } catch (error) {
    console.error('[CRON Planned to Pending] Error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// Also support GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request)
}

