'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSchedule, useZones } from '@/lib/hooks'
import { Navigation } from '@/components/Navigation'
import { useSearchParams, useRouter } from 'next/navigation'

export default function ReschedulePage() {
  const { zones } = useZones()
  const router = useRouter()
  const searchParams = useSearchParams()
  const scheduleIdFromUrl = searchParams.get('scheduleId')
  
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(scheduleIdFromUrl)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<'SLOT_2300' | 'SLOT_0130' | 'SLOT_0330' | ''>('')
  const [warning, setWarning] = useState<string>('')

  // Get schedules that need rescheduling (MISSED or RESCHEDULED with past dates)
  const { schedules: missedSchedules, mutate: mutateMissed } = useSchedule(undefined, undefined, undefined, 'MISSED')
  
  // Also get RESCHEDULED schedules with past dates
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const pastDate = new Date(today)
  pastDate.setDate(pastDate.getDate() - 30)
  const { schedules: rescheduledSchedules, mutate: mutateRescheduled } = useSchedule(
    undefined,
    pastDate.toISOString().split('T')[0],
    today.toISOString().split('T')[0]
  )
  
  // Combine and filter: MISSED + RESCHEDULED with past dates
  const schedules = useMemo(() => {
    const all = [...missedSchedules]
    rescheduledSchedules.forEach((s: any) => {
      if (s.status === 'RESCHEDULED') {
        const scheduleDate = new Date(s.r1PlannedDate)
        scheduleDate.setHours(0, 0, 0, 0)
        if (scheduleDate < today && !all.find((a: any) => a.id === s.id)) {
          all.push(s)
        }
      }
    })
    return all
  }, [missedSchedules, rescheduledSchedules, today])
  
  const isLoading = false // We'll handle loading separately if needed
  const mutate = () => {
    mutateMissed()
    mutateRescheduled()
  }
  
  // Auto-select schedule if scheduleId is in URL
  useEffect(() => {
    if (scheduleIdFromUrl && schedules.length > 0) {
      const schedule = schedules.find((s: any) => s.id === scheduleIdFromUrl)
      if (schedule) {
        setSelectedScheduleId(scheduleIdFromUrl)
      }
    }
  }, [scheduleIdFromUrl, schedules])
 
  // Get all schedules for finding free slots (reuse today variable)
  const futureDate = new Date(today)
  futureDate.setDate(futureDate.getDate() + 30)
  const { schedules: allSchedules } = useSchedule(
    undefined,
    today.toISOString().split('T')[0],
    futureDate.toISOString().split('T')[0]
  )

  const selectedSchedule = selectedScheduleId
    ? schedules.find((s: any) => s.id === selectedScheduleId)
    : null

  // Find free slots before deadline
  const freeSlots = useMemo(() => {
    if (!selectedSchedule) return []

    const deadline = new Date(selectedSchedule.dueDate)
    const slots: Array<{
      date: Date
      timeSlot: 'SLOT_2300' | 'SLOT_0130' | 'SLOT_0330'
      label: string
      isOccupied: boolean
      occupiedSchedule?: any
    }> = []

    const currentDate = new Date(today)
    while (currentDate <= deadline) {
      const dateKey = currentDate.toISOString().split('T')[0]
      const timeSlots: Array<'SLOT_2300' | 'SLOT_0130' | 'SLOT_0330'> = [
        'SLOT_2300',
        'SLOT_0130',
        'SLOT_0330',
      ]

      timeSlots.forEach((slot) => {
        const occupied = allSchedules.some(
          (s: any) =>
            new Date(s.r1PlannedDate).toISOString().split('T')[0] === dateKey &&
            s.timeSlot === slot &&
            s.zoneId === selectedSchedule.zoneId
        )

        const occupiedSchedule = allSchedules.find(
          (s: any) =>
            new Date(s.r1PlannedDate).toISOString().split('T')[0] === dateKey &&
            s.timeSlot === slot &&
            s.zoneId === selectedSchedule.zoneId
        )

        let label = ''
        if (slot === 'SLOT_2300') label = '23:00'
        else if (slot === 'SLOT_0130') label = '01:30'
        else if (slot === 'SLOT_0330') label = '03:30'

        slots.push({
          date: new Date(currentDate),
          timeSlot: slot,
          label,
          isOccupied: !!occupied,
          occupiedSchedule,
        })
      })

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return slots
  }, [selectedSchedule, allSchedules, today])

  const handleReschedule = async () => {
    if (!selectedScheduleId || !selectedDate || !selectedTimeSlot) {
      alert('Please select a schedule, date, and time slot')
      return
    }

    // Check if slot is occupied
    const slot = freeSlots.find(
      (s) =>
        s.date.toISOString().split('T')[0] === selectedDate &&
        s.timeSlot === selectedTimeSlot
    )

    if (slot?.isOccupied && slot.occupiedSchedule) {
      const confirmSwap = confirm(
        `This slot is already occupied by ${slot.occupiedSchedule.equipment.equipmentNumber}. Do you want to swap schedules?`
      )
      if (!confirmSwap) return
    }

    try {
      const targetDate = new Date(selectedDate)
      let hour = 0
      let minute = 0
      if (selectedTimeSlot === 'SLOT_2300') {
        hour = 23
        minute = 0
      } else if (selectedTimeSlot === 'SLOT_0130') {
        hour = 1
        minute = 30
      } else if (selectedTimeSlot === 'SLOT_0330') {
        hour = 3
        minute = 30
      }
      targetDate.setHours(hour, minute, 0, 0)

      const response = await fetch(`/api/schedules/${selectedScheduleId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newDate: targetDate.toISOString(),
          newTimeSlot: selectedTimeSlot,
          swapWithScheduleId: slot?.occupiedSchedule?.id || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(`Error rescheduling: ${error.error}`)
        return
      }

      // Redirect back to Work Order Tracking page
      router.push('/work-order-tracking?tab=to_reschedule')
    } catch (error) {
      console.error('Error rescheduling:', error)
      alert('Failed to reschedule. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Navigation />
      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-full mx-auto">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Reschedule Maintenance Services
            </h1>
            <p className="text-sm text-gray-600">
              Select a service to reschedule and choose a new date/time slot
            </p>
          </div>

          <div className={`grid gap-4 ${scheduleIdFromUrl ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
            {/* Left: List of services to reschedule (hidden if scheduleId in URL) */}
            {!scheduleIdFromUrl && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Services to Reschedule
                </h2>
              </div>
              {isLoading ? (
                <div className="p-8 text-center text-gray-700">
                  Loading...
                </div>
              ) : schedules.length === 0 ? (
                <div className="p-8 text-center text-gray-700">
                  No services need rescheduling.
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {schedules.map((schedule: any) => {
                    const scheduledDate = new Date(schedule.r1PlannedDate)
                    const deadline = new Date(schedule.dueDate)
                    const timeSlot = schedule.timeSlot
                    let timeLabel = ''
                    if (timeSlot === 'SLOT_2300') timeLabel = '23:00'
                    else if (timeSlot === 'SLOT_0130') timeLabel = '01:30'
                    else if (timeSlot === 'SLOT_0330') timeLabel = '03:30'

                    return (
                      <div
                        key={schedule.id}
                        onClick={() => {
                          setSelectedScheduleId(schedule.id)
                          setSelectedDate('')
                          setSelectedTimeSlot('')
                          setWarning('')
                        }}
                        className={`p-4 cursor-pointer hover:bg-gray-50 ${
                          selectedScheduleId === schedule.id
                            ? 'bg-blue-50 border-l-4 border-blue-600'
                            : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-semibold text-gray-900">
                              {schedule.equipment.equipmentNumber}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              OR: {schedule.workOrderNumber || '-'}
                            </div>
                            <div className="text-sm text-gray-600">
                              Zone: {schedule.zone.code}
                            </div>
                            <div className="text-sm text-gray-600">
                              Scheduled: {scheduledDate.toLocaleDateString('en-US')} {timeLabel}
                            </div>
                            <div className="text-sm text-orange-600 font-medium mt-1">
                              Deadline: {deadline.toLocaleDateString('en-US')}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            )}

            {/* Right: Available slots */}
            {selectedSchedule ? (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Available Slots (Before Deadline)
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Deadline: {new Date(selectedSchedule.dueDate).toLocaleDateString('en-US')}
                  </p>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                  {/* Selected slot indicator */}
                  {selectedDate && selectedTimeSlot && (
                    <div className="mb-4 p-3 bg-blue-100 border-2 border-blue-500 rounded-lg">
                      <div className="text-sm font-semibold text-blue-900 mb-1">
                        Selected Slot:
                      </div>
                      <div className="text-base font-bold text-blue-900">
                        {new Date(selectedDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}{' '}
                        at{' '}
                        {selectedTimeSlot === 'SLOT_2300'
                          ? '23:00'
                          : selectedTimeSlot === 'SLOT_0130'
                          ? '01:30'
                          : '03:30'}
                      </div>
                    </div>
                  )}

                  {warning && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                      {warning}
                    </div>
                  )}
                  
                  {/* Compact slot picker */}
                  <div className="mb-2">
                    <div className="text-xs font-semibold text-gray-700 mb-1.5">
                      Select date and time:
                    </div>
                    {/* Column headers */}
                    <div className="grid grid-cols-3 gap-1.5 mb-1">
                      <div className="text-xs font-bold text-gray-900 text-center py-0.5">23:00</div>
                      <div className="text-xs font-bold text-gray-900 text-center py-0.5">01:30</div>
                      <div className="text-xs font-bold text-gray-900 text-center py-0.5">03:30</div>
                    </div>
                  </div>

                  {/* Group slots by date - compact */}
                  <div className="space-y-1.5">
                    {Array.from(new Set(freeSlots.map(s => s.date.toISOString().split('T')[0])))
                      .sort()
                      .map((dateKey) => {
                        const dateSlots = freeSlots.filter(
                          (s) => s.date.toISOString().split('T')[0] === dateKey
                        )
                        const date = new Date(dateKey)
                        const isToday = date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
                        
                        return (
                          <div key={dateKey} className="mb-1.5">
                            <div className="text-xs font-semibold text-gray-900 mb-0.5 flex items-center gap-1.5">
                              <span>
                                {date.toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              {isToday && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                                  Today
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              {dateSlots.map((slot, slotIndex) => {
                                const isSelected =
                                  selectedDate === dateKey && selectedTimeSlot === slot.timeSlot

                                return (
                                  <button
                                    key={slotIndex}
                                    onClick={() => {
                                      setSelectedDate(dateKey)
                                      setSelectedTimeSlot(slot.timeSlot)
                                      if (slot.isOccupied) {
                                        setWarning(
                                          `Warning: This slot is occupied by ${slot.occupiedSchedule?.equipment.equipmentNumber}. Selecting it will swap schedules.`
                                        )
                                      } else {
                                        setWarning('')
                                      }
                                    }}
                                    className={`p-1.5 rounded text-xs text-center transition-all ${
                                      slot.isOccupied
                                        ? 'bg-yellow-50 border border-yellow-400 hover:bg-yellow-100'
                                        : 'bg-green-50 border border-green-400 hover:bg-green-100'
                                    } ${
                                      isSelected
                                        ? 'ring-2 ring-blue-500 bg-blue-100 border-blue-600 shadow-md'
                                        : ''
                                    }`}
                                  >
                                    <div className="font-bold text-sm text-gray-900">
                                      {slot.label}
                                    </div>
                                    {slot.isOccupied && (
                                      <div className="text-[10px] text-yellow-800 mt-0.5 font-medium">
                                        Occupied
                                      </div>
                                    )}
                                    {isSelected && (
                                      <div className="text-[10px] text-blue-800 mt-0.5 font-bold">
                                        ✓
                                      </div>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
                
                {/* Fixed footer with rescheduling info and buttons */}
                <div className="px-4 py-4 border-t border-gray-200 bg-white flex-shrink-0">
                  {selectedDate && selectedTimeSlot ? (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-300">
                      <div className="text-sm text-gray-600 mb-2">Rescheduling to:</div>
                      <div className="text-lg font-bold text-gray-900">
                        {new Date(selectedDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}{' '}
                        at{' '}
                        {selectedTimeSlot === 'SLOT_2300'
                          ? '23:00'
                          : selectedTimeSlot === 'SLOT_0130'
                          ? '01:30'
                          : '03:30'}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="text-sm text-gray-500 italic">
                        Please select a date and time slot above
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleReschedule}
                      disabled={!selectedDate || !selectedTimeSlot}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                    >
                      Confirm Reschedule
                    </button>
                    <button
                      onClick={() => {
                        setSelectedScheduleId(null)
                        setSelectedDate('')
                        setSelectedTimeSlot('')
                        setWarning('')
                      }}
                      className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : scheduleIdFromUrl ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
                Loading schedule...
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
                Please select a service to reschedule
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

