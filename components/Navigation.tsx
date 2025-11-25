'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WeMaintainLogo } from './WeMaintainLogo'

export function Navigation() {
  const pathname = usePathname()

  const navItems = [
    { href: '/schedule', label: 'Schedule' },
    { href: '/admin', label: 'Admin' },
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
                className={`block px-3 py-2 rounded-md ${
                  isActive
                    ? 'bg-slate-700 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}

