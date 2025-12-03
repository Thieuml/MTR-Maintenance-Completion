import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const prodUrl = process.env.PROD_DATABASE_URL
if (!prodUrl) {
  console.error('PROD_DATABASE_URL not found')
  process.exit(1)
}

const prodPrisma = new PrismaClient({
  datasources: { db: { url: prodUrl } }
})

async function check() {
  const statuses = await prodPrisma.schedule.groupBy({
    by: ['status'],
    where: { workOrderNumber: { not: null } },
    _count: true
  })
  
  console.log('Production status distribution:')
  statuses.forEach(s => console.log(`  ${s.status}: ${s._count}`))
  
  const today = new Date()
  today.setHours(0,0,0,0)
  
  const missed = await prodPrisma.schedule.count({
    where: { workOrderNumber: { not: null }, status: 'MISSED' }
  })
  
  const rescheduled = await prodPrisma.schedule.findMany({
    where: { 
      workOrderNumber: { not: null }, 
      status: 'RESCHEDULED' 
    },
    select: { r1PlannedDate: true }
  })
  
  const rescheduledPast = rescheduled.filter(s => {
    if (!s.r1PlannedDate) return false
    const d = new Date(s.r1PlannedDate)
    d.setHours(0,0,0,0)
    return d < today
  })
  
  console.log('\nTo reschedule calculation:')
  console.log(`  MISSED: ${missed}`)
  console.log(`  RESCHEDULED total: ${rescheduled.length}`)
  console.log(`  RESCHEDULED with past date: ${rescheduledPast.length}`)
  console.log(`  Total to reschedule: ${missed + rescheduledPast.length}`)
  
  await prodPrisma.$disconnect()
}

check()
