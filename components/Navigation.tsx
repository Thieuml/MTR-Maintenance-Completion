'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WeMaintainLogo } from './WeMaintainLogo'
import { useSchedule } from '@/lib/hooks'
import { useMemo } from 'react'

export function Navigation() {
  const pathname = usePathname()

  // Get counts for completion and reschedule badges
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const pastDate = new Date(today)
  pastDate.setDate(pastDate.getDate() - 30)
  
  // Fetch schedules for completion count (past dates with PLANNED/IN_PROGRESS/RESCHEDULED)
  const { schedules: completionSchedules } = useSchedule(
    undefined,
    pastDate.toISOString().split('T')[0],
    today.toISOString().split('T')[0]
  )
  
  // Fetch schedules for reschedule count (MISSED status)
  const { schedules: rescheduleSchedules } = useSchedule(undefined, undefined, undefined, 'MISSED')

  const completionCount = useMemo(() => {
    return completionSchedules.filter((schedule: any) => {
      const scheduleDate = new Date(schedule.r1PlannedDate)
      scheduleDate.setHours(0, 0, 0, 0)
      const isPastDate = scheduleDate < today
      const needsValidation = 
        schedule.status === 'PLANNED' ||
        schedule.status === 'IN_PROGRESS' ||
        schedule.status === 'RESCHEDULED'
      return isPastDate && needsValidation
    }).length
  }, [completionSchedules, today])

  const rescheduleCount = useMemo(() => {
    return rescheduleSchedules.length
  }, [rescheduleSchedules])

  const navItems = [
    { href: '/schedule', label: 'Schedule', badge: null },
    { href: '/work-order-tracking', label: 'Work Order Tracking', badge: completionCount + rescheduleCount },
    { href: '/dashboard', label: 'Dashboard', badge: null },
    { href: '/admin', label: 'Admin', badge: null },
  ]

  return (
    <aside className="w-64 bg-slate-800 text-white flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <WeMaintainLogo />
      </div>
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          <div className="px-3 py-2 text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Navigation
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-md ${
                  isActive
                    ? 'bg-slate-700 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {item.badge !== null && item.badge > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full min-w-[20px]">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}

