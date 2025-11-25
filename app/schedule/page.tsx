'use client'

import { useState, useMemo } from 'react'
import { useSchedule, useZones } from '@/lib/hooks'
import { ScheduleCalendar } from '@/components/ScheduleCalendar'
import { ZoneFilter } from '@/components/ZoneFilter'

type ViewMode = 'week' | 'month'

export default function SchedulePage() {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [dateOffset, setDateOffset] = useState(0) // Offset in weeks or months

  const { zones } = useZones()

  // Calculate date range based on view mode
  const { fromDate, toDate, displayRange } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get Sunday of current week
    const currentWeekStart = new Date(today)
    const dayOfWeek = today.getDay()
    currentWeekStart.setDate(today.getDate() - dayOfWeek)

    if (viewMode === 'week') {
      // Show one week starting from Sunday
      const weekStart = new Date(currentWeekStart)
      weekStart.setDate(weekStart.getDate() + dateOffset * 7)

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)

      return {
        fromDate: weekStart,
        toDate: weekEnd,
        displayRange: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      }
    } else {
      // Show one month
      const monthStart = new Date(today.getFullYear(), today.getMonth() + dateOffset, 1)
      // Get first Sunday of the month
      const firstSunday = new Date(monthStart)
      firstSunday.setDate(firstSunday.getDate() - firstSunday.getDay())

      // Get last day of month and find last Saturday
      const lastDay = new Date(today.getFullYear(), today.getMonth() + dateOffset + 1, 0)
      const lastSaturday = new Date(lastDay)
      lastSaturday.setDate(lastSaturday.getDate() + (6 - lastDay.getDay()))
      lastSaturday.setHours(23, 59, 59, 999)

      return {
        fromDate: firstSunday,
        toDate: lastSaturday,
        displayRange: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      }
    }
  }, [viewMode, dateOffset])

  const from = fromDate.toISOString().split('T')[0]
  const to = toDate.toISOString().split('T')[0]

  const { schedules, isLoading, isError } = useSchedule(
    undefined, // Always fetch all zones
    from,
    to
  )

  // Group schedules by zone
  const schedulesByZone = useMemo(() => {
    const grouped = new Map<string, any[]>()
    
    zones.forEach((zone: any) => {
      grouped.set(zone.id, [])
    })

    schedules.forEach((schedule: any) => {
      const zoneId = schedule.zone.id
      if (!grouped.has(zoneId)) {
        grouped.set(zoneId, [])
      }
      grouped.get(zoneId)!.push(schedule)
    })

    return grouped
  }, [schedules, zones])

  // Filter zones if selected
  const displayedZones = selectedZoneId
    ? zones.filter((z: any) => z.id === selectedZoneId)
    : zones

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            MTR Maintenance Schedule
          </h1>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-3 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <ZoneFilter
                selectedZoneId={selectedZoneId}
                onZoneChange={setSelectedZoneId}
              />
              
              {/* View Mode Toggle */}
              <div className="flex items-center gap-2 border border-gray-300 rounded-md">
                <button
                  onClick={() => {
                    setViewMode('week')
                    setDateOffset(0)
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-l-md ${
                    viewMode === 'week'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => {
                    setViewMode('month')
                    setDateOffset(0)
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-r-md ${
                    viewMode === 'month'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Month
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setDateOffset(dateOffset - 1)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                ← Previous
              </button>
              <button
                onClick={() => setDateOffset(0)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                  dateOffset === 0
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                disabled={dateOffset === 0}
              >
                Today
              </button>
              <button
                onClick={() => setDateOffset(dateOffset + 1)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Next →
              </button>
            </div>
          </div>

          {/* Date Range Display */}
          <div className="mt-3 text-sm text-gray-600 font-medium">
            {displayRange}
          </div>
        </div>

        {/* Calendar - Show all zones */}
        <div className="space-y-4">
          {displayedZones.map((zone: any) => (
            <div key={zone.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {zone.code} - {zone.name}
                </h2>
              </div>
              <ScheduleCalendar
                schedules={schedulesByZone.get(zone.id) || []}
                isLoading={false}
                isError={false}
                fromDate={fromDate}
                toDate={toDate}
                viewMode={viewMode}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
