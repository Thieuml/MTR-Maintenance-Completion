'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { WeMaintainLogo } from './WeMaintainLogo'
import useSWR from 'swr'
import { useMemo } from 'react'
import { useSession } from '@/lib/hooks/use-session'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function Navigation() {
  const pathname = usePathname()
  const { session, isLoading: sessionLoading } = useSession()

  // Fetch lightweight badge count (much faster than fetching all work orders)
  // Only fetch if user is authenticated
  const { data: countData } = useSWR<{ toValidate: number; toReschedule: number; total: number }>(
    session ? '/api/admin/work-orders/count' : null,
    fetcher,
    {
      refreshInterval: 120000, // Refresh every 2 minutes (reduced from 30 seconds)
      // revalidateOnFocus is disabled globally in SWRProvider
      revalidateOnReconnect: true,
    }
  )

  // Calculate badge count: sum of toValidate and toReschedule (only if authenticated)
  const badgeCount = countData ? countData.toValidate + countData.toReschedule : 0

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/signin' })
  }

  const navItems = [
    { href: '/schedule', label: 'Schedule', badge: null },
    { href: '/work-order-tracking', label: 'Work Order Tracking', badge: badgeCount },
    { href: '/dashboard', label: 'Dashboard', badge: null },
    { href: '/admin', label: 'Admin', badge: null },
  ]

  // Show navigation with loading state if session is loading
  // Only hide if we're sure there's no session (not just loading)
  if (!sessionLoading && !session) {
    return null
  }

  return (
    <aside className="fixed left-0 top-0 w-64 bg-slate-800 text-white flex flex-col h-screen z-50">
      <div className="p-6 border-b border-slate-700 flex-shrink-0">
        <WeMaintainLogo />
      </div>
      {/* Navigation items */}
      <nav className="flex-1 p-4 overflow-y-auto min-h-0">
        <div className="space-y-2">
          <div className="px-3 py-2 text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Navigation
          </div>
          {sessionLoading ? (
            <div className="px-3 py-2 text-sm text-slate-400">Loading...</div>
          ) : (
            navItems.map((item) => {
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
            })
          )}
        </div>
      </nav>
      
      {/* User section - fixed at bottom */}
      <div className="p-4 border-t border-slate-700 flex-shrink-0 bg-slate-800">
        {sessionLoading ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-600 animate-pulse"></div>
            <div className="flex-1 min-w-0">
              <div className="h-4 bg-slate-600 rounded animate-pulse mb-2"></div>
              <div className="h-3 bg-slate-600 rounded animate-pulse w-2/3"></div>
            </div>
          </div>
        ) : session ? (
          <>
            <div className="flex items-center gap-3 mb-3">
              {session.user?.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  className="w-8 h-8 rounded-full flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-sm font-medium flex-shrink-0">
                  {session.user?.name?.charAt(0).toUpperCase() || session.user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {session.user?.name || 'User'}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {session.user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
            >
              Sign Out
            </button>
          </>
        ) : null}
      </div>
    </aside>
  )
}

