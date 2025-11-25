'use client'

import { ScheduleCard } from './ScheduleCard'
import { formatHKT } from '@/lib/utils/timezone'

interface ScheduleCalendarProps {
  schedules: any[]
  isLoading: boolean
  isError: boolean
  selectedZoneId: string | null
  fromDate: Date
  toDate: Date
}

export function ScheduleCalendar({
  schedules,
  isLoading,
  isError,
  selectedZoneId,
  fromDate,
  toDate,
}: ScheduleCalendarProps) {
  // Group schedules by date
  const schedulesByDate = new Map<string, any[]>()

  schedules.forEach((schedule) => {
    const dateKey = new Date(schedule.r1PlannedDate).toISOString().split('T')[0]
    if (!schedulesByDate.has(dateKey)) {
      schedulesByDate.set(dateKey, [])
    }
    schedulesByDate.get(dateKey)!.push(schedule)
  })

  // Generate date range
  const dates: Date[] = []
  const currentDate = new Date(fromDate)
  while (currentDate <= toDate) {
    dates.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 1)
  }

  // Get today's date for highlighting
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-700 bg-white rounded-lg shadow-sm">
        Loading schedule...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-red-700 bg-white rounded-lg shadow-sm">
        Error loading schedule. Please try again.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 z-10 px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider bg-gray-50 border-r border-gray-200">
                Date
              </th>
              {dates.map((date) => {
                const isToday =
                  date.toDateString() === today.toDateString()
                return (
                  <th
                    key={date.toISOString()}
                    className={`px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider min-w-[200px] ${
                      isToday ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="font-semibold">
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={`text-sm ${isToday ? 'text-blue-700 font-bold' : ''}`}>
                      {date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td className="sticky left-0 z-10 px-4 py-4 text-sm font-medium text-gray-900 bg-white border-r border-gray-200">
                Schedules
              </td>
              {dates.map((date) => {
                const dateKey = date.toISOString().split('T')[0]
                const daySchedules = schedulesByDate.get(dateKey) || []
                const isToday =
                  date.toDateString() === today.toDateString()

                return (
                  <td
                    key={date.toISOString()}
                    className={`px-3 py-4 align-top ${isToday ? 'bg-blue-50' : ''}`}
                  >
                    <div className="space-y-2">
                      {daySchedules.length === 0 ? (
                        <div className="text-xs text-gray-400 text-center py-2">
                          No schedules
                        </div>
                      ) : (
                        daySchedules.map((schedule) => (
                          <ScheduleCard
                            key={schedule.id}
                            schedule={schedule}
                          />
                        ))
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

