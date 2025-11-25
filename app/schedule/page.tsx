'use client'

import { useState, useEffect } from 'react'
import { useSchedule } from '@/lib/hooks'
import { ScheduleCalendar } from '@/components/ScheduleCalendar'
import { ZoneFilter } from '@/components/ZoneFilter'
import { createHKTDate } from '@/lib/utils/timezone'

export default function SchedulePage() {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [dateOffset, setDateOffset] = useState(0) // Offset in days for navigation

  // Calculate date range: 14 days before and after (28 days total, showing 14-day cycles)
  const baseToday = new Date()
  baseToday.setHours(0, 0, 0, 0)
  const today = new Date(baseToday)
  today.setDate(today.getDate() + dateOffset)

  const fromDate = new Date(today)
  fromDate.setDate(fromDate.getDate() - 14)

  const toDate = new Date(today)
  toDate.setDate(toDate.getDate() + 14)

  const from = fromDate.toISOString().split('T')[0]
  const to = toDate.toISOString().split('T')[0]

  const { schedules, isLoading, isError } = useSchedule(
    selectedZoneId || undefined,
    from,
    to
  )

  // Filter schedules by selected zone if zone is selected
  const filteredSchedules = selectedZoneId
    ? schedules.filter((s: any) => s.zone.id === selectedZoneId)
    : schedules

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            MTR Maintenance Schedule
          </h1>
          <p className="text-gray-600">
            Visual 14-day calendar for all MTR units
          </p>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <ZoneFilter
                selectedZoneId={selectedZoneId}
                onZoneChange={setSelectedZoneId}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setDateOffset(dateOffset - 14)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                ← Previous 14 Days
              </button>
              <button
                onClick={() => setDateOffset(0)}
                className={`px-4 py-2 text-sm font-medium rounded-md ${
                  dateOffset === 0
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                disabled={dateOffset === 0}
              >
                Today
              </button>
              <button
                onClick={() => setDateOffset(dateOffset + 14)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Next 14 Days →
              </button>
            </div>
          </div>

          {/* Date Range Display */}
          <div className="mt-4 text-sm text-gray-600">
            Showing schedules from{' '}
            <span className="font-medium">
              {fromDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>{' '}
            to{' '}
            <span className="font-medium">
              {toDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* Status Legend */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div>
              <span className="text-sm text-gray-700">Planned</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-50 border-2 border-yellow-300 rounded"></div>
              <span className="text-sm text-gray-700">Assigned</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-50 border-2 border-green-300 rounded"></div>
              <span className="text-sm text-gray-700">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-50 border-2 border-red-300 rounded"></div>
              <span className="text-sm text-gray-700">Missed/Overdue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-pink-50 border-2 border-pink-400 border-dashed rounded"></div>
              <span className="text-sm font-semibold text-gray-700">Unassigned</span>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <ScheduleCalendar
          schedules={filteredSchedules}
          isLoading={isLoading}
          isError={isError}
          selectedZoneId={selectedZoneId}
          fromDate={fromDate}
          toDate={toDate}
        />

        {/* Summary Stats */}
        {filteredSchedules.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">Total Schedules</div>
                <div className="text-2xl font-bold text-gray-900">
                  {filteredSchedules.length}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Unassigned</div>
                <div className="text-2xl font-bold text-pink-600">
                  {
                    filteredSchedules.filter(
                      (s: any) => !s.fixedEngineer && !s.rotatingEngineer
                    ).length
                  }
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Overdue</div>
                <div className="text-2xl font-bold text-red-600">
                  {
                    filteredSchedules.filter(
                      (s: any) => s.status === 'OVERDUE'
                    ).length
                  }
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Completed</div>
                <div className="text-2xl font-bold text-green-600">
                  {
                    filteredSchedules.filter(
                      (s: any) => s.status === 'COMPLETED'
                    ).length
                  }
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

