'use client'

import { ScheduleCard } from './ScheduleCard'
import { useMemo } from 'react'

interface ScheduleCalendarProps {
  schedules: any[]
  isLoading: boolean
  isError: boolean
  fromDate: Date
  toDate: Date
  viewMode: 'week' | 'month'
}

export function ScheduleCalendar({
  schedules,
  isLoading,
  isError,
  fromDate,
  toDate,
  viewMode,
}: ScheduleCalendarProps) {
  // Generate dates - always start from Sunday, show 7 days for week view
  const dates = useMemo(() => {
    const dateList: Date[] = []
    const currentDate = new Date(fromDate)
    
    if (viewMode === 'week') {
      // Always show exactly 7 days starting from Sunday
      for (let i = 0; i < 7; i++) {
        dateList.push(new Date(currentDate))
        currentDate.setDate(currentDate.getDate() + 1)
      }
    } else {
      // Month view - show all days from first Sunday to last Saturday
      while (currentDate <= toDate) {
        dateList.push(new Date(currentDate))
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }
    
    return dateList
  }, [fromDate, toDate, viewMode])

  // Group schedules by date and time slot
  const schedulesByDateAndTime = useMemo(() => {
    const grouped = new Map<string, Map<string, any[]>>()
    
    schedules.forEach((schedule) => {
      const dateKey = new Date(schedule.r1PlannedDate).toISOString().split('T')[0]
      const timeSlot = schedule.timeSlot
      
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, new Map())
      }
      
      const timeMap = grouped.get(dateKey)!
      if (!timeMap.has(timeSlot)) {
        timeMap.set(timeSlot, [])
      }
      
      timeMap.get(timeSlot)!.push(schedule)
    })
    
    return grouped
  }, [schedules])

  // Get today's date for highlighting
  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  // Time slots in order
  const timeSlots: Array<{ slot: 'SLOT_2300' | 'SLOT_0130' | 'SLOT_0330'; label: string }> = [
    { slot: 'SLOT_2300', label: '23:00' },
    { slot: 'SLOT_0130', label: '01:30' },
    { slot: 'SLOT_0330', label: '03:30' },
  ]

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-700">
        Loading schedule...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-6 text-center text-red-700">
        Error loading schedule. Please try again.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="sticky left-0 z-20 px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase bg-gray-50 border-r border-gray-200 min-w-[60px]">
              Time
            </th>
            {dates.map((date) => {
              const isToday = date.toDateString() === today.toDateString()
              return (
                <th
                  key={date.toISOString()}
                  className={`px-2 py-2 text-center text-xs font-medium text-gray-700 uppercase min-w-[120px] ${
                    isToday ? 'bg-blue-100' : ''
                  }`}
                >
                  <div className="font-semibold">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className={`text-xs ${isToday ? 'text-blue-700 font-bold' : 'text-gray-900'}`}>
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
          {timeSlots.map((timeSlot) => (
            <tr key={timeSlot.slot}>
              <td className="sticky left-0 z-10 px-2 py-2 text-xs font-medium text-gray-900 bg-white border-r border-gray-200">
                {timeSlot.label}
              </td>
              {dates.map((date) => {
                const dateKey = date.toISOString().split('T')[0]
                const isToday = date.toDateString() === today.toDateString()
                const daySchedules = schedulesByDateAndTime.get(dateKey)?.get(timeSlot.slot) || []

                return (
                  <td
                    key={`${dateKey}-${timeSlot.slot}`}
                    className={`px-1 py-1 align-top ${isToday ? 'bg-blue-50' : ''}`}
                  >
                    <div className="space-y-1">
                      {daySchedules.map((schedule) => (
                        <ScheduleCard
                          key={schedule.id}
                          schedule={schedule}
                        />
                      ))}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
