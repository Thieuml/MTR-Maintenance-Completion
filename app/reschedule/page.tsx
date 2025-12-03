'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSchedule, useZones } from '@/lib/hooks'
import { Navigation } from '@/components/shared/Navigation'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  createHKTDate,
  getHKTDateKey,
  addDaysToHKTDateKey,
  formatHKTDateKey,
  compareHKTDateKeys,
} from '@/lib/utils/timezone'

function ReschedulePageContent() {
  const { zones } = useZones()
  const router = useRouter()
  const searchParams = useSearchParams()
  const scheduleIdFromUrl = searchParams.get('scheduleId')
  
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(scheduleIdFromUrl)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<'SLOT_2300' | 'SLOT_0130' | 'SLOT_0330' | ''>('')
  const [warning, setWarning] = useState<string>('')

  // Track today's date as an HKT date key (YYYY-MM-DD) to avoid timezone drift
  const todayKey = useMemo(() => getHKTDateKey(new Date()), [])

  // Future window for slot lookup (30 days ahead)
  const futureKey = useMemo(() => addDaysToHKTDateKey(todayKey, 30), [todayKey])

  // Get schedules that need rescheduling (MISSED or SKIPPED)
  const { schedules: missedSchedules, isLoading: isLoadingMissed, mutate: mutateMissed } = useSchedule(undefined, undefined, undefined, 'MISSED')
  const { schedules: skippedSchedules, isLoading: isLoadingSkipped, mutate: mutateSkipped } = useSchedule(undefined, undefined, undefined, 'SKIPPED')
  
  // Combine MISSED and SKIPPED schedules
  const schedules = useMemo(() => {
    const all = [...missedSchedules, ...skippedSchedules]
    return all
  }, [missedSchedules, skippedSchedules])
  
  const isLoading = isLoadingMissed || isLoadingSkipped
  const mutate = () => {
    mutateMissed()
    mutateSkipped()
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
 
  const selectedSchedule = selectedScheduleId
    ? schedules.find((s: any) => s.id === selectedScheduleId)
    : null

  // Get schedules for the selected zone only - fixes zone filtering issue
  // Only fetch schedules if we have a selected schedule (to get the zone)
  const selectedZoneId = selectedSchedule?.zone?.id || selectedSchedule?.zoneId
  const { schedules: allSchedules, isLoading: isLoadingAllSchedules } = useSchedule(
    selectedZoneId || undefined, // Filter by zone - CRITICAL FIX
    selectedSchedule ? todayKey : undefined,
    selectedSchedule ? futureKey : undefined
  )

  // Find free slots before deadline
  // Only calculate if schedules are loaded (prevents showing all slots as available during loading)
  const freeSlots = useMemo(() => {
    if (!selectedSchedule || isLoadingAllSchedules) return []

    const deadlineKey = getHKTDateKey(new Date(selectedSchedule.dueDate))
    const selectedZoneId = selectedSchedule.zone?.id || selectedSchedule.zoneId
    if (!selectedZoneId) return []

    const schedulesInSameZone = allSchedules.filter((s: any) => {
      const scheduleZoneId = s.zone?.id || s.zoneId
      return (
        scheduleZoneId === selectedZoneId &&
        s.r1PlannedDate &&
        s.id !== selectedSchedule.id
      )
    })

    const occupiedSlotMap = new Map<string, any>()
    schedulesInSameZone.forEach((s: any) => {
      if (!s.r1PlannedDate) return
      const scheduleKey = getHKTDateKey(new Date(s.r1PlannedDate))
      occupiedSlotMap.set(`${scheduleKey}-${s.timeSlot}`, s)
    })

    const slots: Array<{
      dateKey: string
      timeSlot: 'SLOT_2300' | 'SLOT_0130' | 'SLOT_0330'
      label: string
      isOccupied: boolean
      occupiedSchedule?: any
    }> = []

    const timeSlots: Array<'SLOT_2300' | 'SLOT_0130' | 'SLOT_0330'> = [
      'SLOT_2300',
      'SLOT_0130',
      'SLOT_0330',
    ]

    let currentKey = todayKey

    while (compareHKTDateKeys(currentKey, deadlineKey) <= 0) {
      timeSlots.forEach((slot) => {
        const slotKey = `${currentKey}-${slot}`
        const occupiedSchedule = occupiedSlotMap.get(slotKey)
        let label = ''
        if (slot === 'SLOT_2300') label = '23:00'
        else if (slot === 'SLOT_0130') label = '01:30'
        else if (slot === 'SLOT_0330') label = '03:30'

        slots.push({
          dateKey: currentKey,
          timeSlot: slot,
          label,
          isOccupied: Boolean(occupiedSchedule),
          occupiedSchedule,
        })
      })

      currentKey = addDaysToHKTDateKey(currentKey, 1)
    }

    return slots
  }, [selectedSchedule, allSchedules, todayKey, isLoadingAllSchedules])

  const handleReschedule = async () => {
    if (!selectedScheduleId || !selectedDate || !selectedTimeSlot) {
      alert('Please select a schedule, date, and time slot')
      return
    }

    // Check if slot is occupied
    const slot = freeSlots.find(
      (s) => s.dateKey === selectedDate && s.timeSlot === selectedTimeSlot
    )

    if (slot?.isOccupied && slot.occupiedSchedule) {
      const confirmPush = confirm(
        `This slot is already occupied by ${slot.occupiedSchedule.equipment.equipmentNumber}. They will be moved to the next available slot in this zone before their deadline. Do you want to continue?`
      )
      if (!confirmPush) return
    }

    // Check for 23:00 slot eligibility - show warning but allow proceed
    const selectedSchedule = schedules.find((s: any) => s.id === selectedScheduleId)
    const isInvalid2300Slot = selectedTimeSlot === 'SLOT_2300' && selectedSchedule?.equipment?.canUse2300Slot !== true
    let allowInvalid2300Slot = false

    if (isInvalid2300Slot) {
      const confirmed = confirm(
        'Warning: This equipment is not eligible for the 23:00 slot. Only equipment with the clock icon can be scheduled at 23:00.\n\nDo you want to proceed anyway?'
      )
      if (!confirmed) {
        return
      }
      allowInvalid2300Slot = true
    }

    try {
      // Parse selectedDate (format: YYYY-MM-DD) and create date in HKT
      const [year, month, day] = selectedDate.split('-').map(Number)
      
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
      
      // Create date in HKT timezone to ensure consistent comparison
      const targetDateHKT = createHKTDate(year, month, day, hour, minute)

      const response = await fetch(`/api/schedules/${selectedScheduleId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newDate: targetDateHKT.toISOString(),
          newTimeSlot: selectedTimeSlot,
          swapWithScheduleId: slot?.occupiedSchedule?.id || undefined,
          allowInvalid2300Slot, // Allow move despite 23:00 warning
          targetDateStr: selectedDate, // Send the date string directly for comparison
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
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="ml-64 overflow-auto p-4">
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
                    const scheduledDate = schedule.r1PlannedDate ? new Date(schedule.r1PlannedDate) : null
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
                              {scheduledDate 
                                ? `Scheduled: ${scheduledDate.toLocaleDateString('en-US')} ${timeLabel}`
                                : 'No scheduled date (needs rescheduling)'}
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
                  {isLoadingAllSchedules ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                      <p className="text-sm">Loading schedules...</p>
                      <p className="text-xs text-gray-400 mt-1">Please wait while we check slot availability</p>
                    </div>
                  ) : (
                    <>
                      {warning && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                          {warning}
                        </div>
                      )}
                      
                      {/* Improved compact slot picker */}
                      <div className="max-w-2xl">
                        <div className="text-sm font-semibold text-gray-900 mb-3">
                          Select date and time:
                        </div>
                        
                        {/* Table-style layout with dates as rows */}
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          {/* Header row with time slots */}
                          <div className="grid grid-cols-[140px_repeat(3,1fr)] bg-gray-50 border-b border-gray-200">
                            <div className="px-3 py-2 text-xs font-semibold text-gray-700 border-r border-gray-200">
                              Date
                            </div>
                            <div className="px-3 py-2 text-xs font-semibold text-gray-700 text-center border-r border-gray-200">
                              23:00
                            </div>
                            <div className="px-3 py-2 text-xs font-semibold text-gray-700 text-center border-r border-gray-200">
                              01:30
                            </div>
                            <div className="px-3 py-2 text-xs font-semibold text-gray-700 text-center">
                              03:30
                            </div>
                          </div>

                          {/* Date rows with slots */}
                          <div className="divide-y divide-gray-200">
                            {Array.from(new Set(freeSlots.map((s) => s.dateKey)))
                              .sort()
                              .map((dateKey) => {
                                const dateSlots = freeSlots.filter(
                                  (s) => s.dateKey === dateKey
                                )
                                const isToday = dateKey === todayKey
                                
                                // Get slots in order: 23:00, 01:30, 03:30
                                const slot2300 = dateSlots.find(s => s.timeSlot === 'SLOT_2300')
                                const slot0130 = dateSlots.find(s => s.timeSlot === 'SLOT_0130')
                                const slot0330 = dateSlots.find(s => s.timeSlot === 'SLOT_0330')

                                return (
                                  <div key={dateKey} className="grid grid-cols-[140px_repeat(3,1fr)] hover:bg-gray-50 transition-colors">
                                    {/* Date column */}
                                    <div className="px-3 py-1.5 border-r border-gray-200 flex items-center min-h-[56px]">
                                      <div className="flex flex-col">
                                        <span className={`text-sm font-semibold leading-tight ${
                                          isToday ? 'text-blue-600' : 'text-gray-900'
                                        }`}>
                                          {formatHKTDateKey(dateKey, {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                          })}
                                        </span>
                                        {isToday && (
                                          <span className="text-[10px] text-blue-600 font-medium mt-0.5 leading-tight">
                                            Today
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Time slot columns */}
                                    {[slot2300, slot0130, slot0330].map((slot, index) => {
                                      if (!slot) return null
                                      
                                      const isSelected =
                                        selectedDate === dateKey &&
                                        selectedTimeSlot === slot.timeSlot

                                      return (
                                        <div
                                          key={index}
                                          className="px-1.5 py-1.5 border-r border-gray-200 last:border-r-0 flex items-center justify-center"
                                        >
                                          <button
                                            onClick={() => {
                                              setSelectedDate(dateKey)
                                              setSelectedTimeSlot(slot.timeSlot)
                                              if (slot.isOccupied) {
                                                setWarning(
                                                  `This slot is occupied by ${slot.occupiedSchedule?.equipment.equipmentNumber}. Selecting it will push that work order to the next available slot.`
                                                )
                                              } else {
                                                setWarning('')
                                              }
                                            }}
                                            className={`w-full h-14 rounded-md text-xs font-medium transition-all flex flex-col items-center justify-center gap-0.5 ${
                                              slot.isOccupied
                                                ? 'bg-yellow-50 border-2 border-yellow-400 hover:bg-yellow-100 hover:border-yellow-500'
                                                : 'bg-green-50 border-2 border-green-400 hover:bg-green-100 hover:border-green-500'
                                            } ${
                                              isSelected
                                                ? 'ring-2 ring-blue-500 ring-offset-1 bg-blue-100 border-blue-600 shadow-sm'
                                                : ''
                                            }`}
                                          >
                                            {slot.isOccupied ? (
                                              <>
                                                <span className="text-yellow-800 font-semibold text-[10px] leading-tight">Occupied</span>
                                                <span className="text-yellow-700 font-bold text-[11px] leading-tight">
                                                  {slot.occupiedSchedule?.equipment.equipmentNumber || 'Unknown'}
                                                </span>
                                              </>
                                            ) : (
                                              <span className={`font-semibold text-xs ${
                                                isSelected ? 'text-blue-800' : 'text-green-800'
                                              }`}>
                                                {isSelected ? '✓ Selected' : 'Available'}
                                              </span>
                                            )}
                                          </button>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                
                {/* Fixed footer with rescheduling info and buttons */}
                <div className="px-4 py-4 border-t border-gray-200 bg-white flex-shrink-0">
                  <div className="mb-2 text-sm text-blue-700">
                    {selectedDate && selectedTimeSlot ? (
                      <>
                        Rescheduling to{' '}
                        <span className="font-semibold">
                          {formatHKTDateKey(selectedDate, {
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
                        </span>
                      </>
                    ) : (
                      'Please select a date and time slot above.'
                    )}
                  </div>
                  {warning && (
                    <div className="mb-3 text-xs text-blue-600">
                      {warning}
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

export default function ReschedulePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <ReschedulePageContent />
    </Suspense>
  )
}

