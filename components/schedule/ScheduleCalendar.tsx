'use client'

import { ScheduleCard } from './ScheduleCard'
import { useMemo, useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  DragEndEvent,
  DragStartEvent,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core'
import {
  getHKTDateKey,
  getHKTTodayKey,
  formatHKTDateKey,
  compareHKTDateKeys,
  createHKTDate,
} from '@/lib/utils/timezone'

interface ScheduleCalendarProps {
  schedules: any[]
  isLoading: boolean
  isError: boolean
  fromDate: Date
  toDate: Date
  viewMode: 'week' | 'month'
  isEditMode?: boolean
  onScheduleMove?: () => void
}

function DroppableCell({
  dateKey,
  timeSlot,
  children,
  isEmpty,
}: {
  dateKey: string
  timeSlot: string
  children: React.ReactNode
  isEmpty: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${dateKey}-${timeSlot}`,
    data: {
      dateKey,
      timeSlot,
    },
  })

  return (
    <td
      ref={setNodeRef}
      className={`px-1 py-1 align-top min-h-[60px] ${
        isEmpty ? 'bg-green-50' : ''
      } ${isOver ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
    >
      {children}
    </td>
  )
}

export function ScheduleCalendar({
  schedules,
  isLoading,
  isError,
  fromDate,
  toDate,
  viewMode,
  isEditMode = false,
  onScheduleMove,
}: ScheduleCalendarProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pendingMoves, setPendingMoves] = useState<Map<string, { newDate: string; newTimeSlot: string }>>(new Map())
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )
  // Generate date keys (YYYY-MM-DD in HKT) for the visible range
  const dateKeys = useMemo(() => {
    const keys: string[] = []
    const currentDate = new Date(fromDate)
    currentDate.setHours(0, 0, 0, 0)

    if (viewMode === 'week') {
      for (let i = 0; i < 7; i++) {
        keys.push(getHKTDateKey(new Date(currentDate)))
        currentDate.setDate(currentDate.getDate() + 1)
      }
    } else {
      const endDate = new Date(toDate)
      endDate.setHours(0, 0, 0, 0)
      while (currentDate <= endDate) {
        keys.push(getHKTDateKey(new Date(currentDate)))
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }

    return Array.from(new Set(keys))
  }, [fromDate, toDate, viewMode])

  const getScheduleBaseDate = (schedule: any) => {
    // For completed items: use r1PlannedDate (the planned date that was kept when marked as completed)
    // Only fallback to updatedAt if r1PlannedDate is null (bad migration case)
    if (schedule?.status === 'COMPLETED') {
      return schedule?.r1PlannedDate ?? schedule?.updatedAt ?? null
    }
    return schedule?.r1PlannedDate ?? schedule?.lastSkippedDate ?? null
  }

  // Clear pending moves when schedules data confirms the move
  useEffect(() => {
    setPendingMoves((prev) => {
      if (prev.size === 0) return prev

      const newMap = new Map(prev)
      let hasChanges = false

      // Check each pending move
      prev.forEach((pendingMove, scheduleId) => {
        const schedule = schedules.find((s) => s.id === scheduleId)
        if (schedule) {
          const expectedDateKey = getHKTDateKey(new Date(pendingMove.newDate))
          const actualDateValue = getScheduleBaseDate(schedule)

          if (actualDateValue) {
            const actualDateKey = getHKTDateKey(new Date(actualDateValue))
            // If the schedule is now in the expected position, clear the pending move
            if (actualDateKey === expectedDateKey && schedule.timeSlot === pendingMove.newTimeSlot) {
              newMap.delete(scheduleId)
              hasChanges = true
            }
          } else {
            newMap.delete(scheduleId)
            hasChanges = true
          }
        } else {
          // Schedule not found - might have been deleted, clear the pending move
          newMap.delete(scheduleId)
          hasChanges = true
        }
      })

      return hasChanges ? newMap : prev
    })
  }, [schedules]) // Only depend on schedules, not pendingMoves to avoid loops

  // Group schedules by date and time slot (with optimistic updates)
  const schedulesByDateAndTime = useMemo(() => {
    const grouped = new Map<string, Map<string, any[]>>()
    
    schedules.forEach((schedule) => {
      const pendingMove = pendingMoves.get(schedule.id)

      let dateValue: Date | null = null
      let dateKey: string
      let timeSlot: string

      if (pendingMove) {
        dateValue = new Date(pendingMove.newDate)
        timeSlot = pendingMove.newTimeSlot
      } else {
        const baseDateValue = getScheduleBaseDate(schedule)
        if (!baseDateValue) {
          return
        }
        dateValue = new Date(baseDateValue)
        timeSlot = schedule.timeSlot
      }

      if (!dateValue || Number.isNaN(dateValue.getTime())) {
        return
      }

      dateKey = getHKTDateKey(dateValue)

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, new Map())
      }

      const timeMap = grouped.get(dateKey)!
      if (!timeMap.has(timeSlot)) {
        timeMap.set(timeSlot, [])
      }

      const displaySchedule = pendingMove
        ? {
            ...schedule,
            r1PlannedDate: pendingMove.newDate,
            timeSlot,
          }
        : schedule.r1PlannedDate
        ? schedule
        : schedule.lastSkippedDate
        ? {
            ...schedule,
            r1PlannedDate: schedule.lastSkippedDate,
          }
        : schedule

      timeMap.get(timeSlot)!.push(displaySchedule)
    })
    
    return grouped
  }, [schedules, pendingMoves])

  // Get today's date key (HKT) for highlighting/comparisons
  const todayKey = useMemo(() => getHKTTodayKey(), [])

  // Time slots in order
  const timeSlots: Array<{ slot: 'SLOT_2300' | 'SLOT_0130' | 'SLOT_0330'; label: string }> = [
    { slot: 'SLOT_2300', label: '23:00' },
    { slot: 'SLOT_0130', label: '01:30' },
    { slot: 'SLOT_0330', label: '03:30' },
  ]

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    // Don't allow dragging if not in edit mode
    if (!isEditMode) return

    const scheduleId = active.id as string
    const schedule = schedules.find((s) => s.id === scheduleId)
    if (!schedule) return

    // Prevent moving completed schedules
    if (schedule.status === 'COMPLETED' || schedule.status === 'COMPLETED_LATE') {
      return
    }

    const dropData = over.data.current
    if (!dropData || !dropData.dateKey || !dropData.timeSlot) return

    const targetDateKey = dropData.dateKey
    const targetTimeSlot = dropData.timeSlot

    // Parse target date consistently - dateKey is in format YYYY-MM-DD
    // Parse as local date to match how dates are displayed in the calendar
    const targetDateParts = targetDateKey.split('-')
    const year = parseInt(targetDateParts[0], 10)
    const monthNumber = parseInt(targetDateParts[1], 10)
    const day = parseInt(targetDateParts[2], 10)

    // Set time based on slot
    let hour = 0
    let minute = 0
    if (targetTimeSlot === 'SLOT_2300') {
      hour = 23
      minute = 0
    } else if (targetTimeSlot === 'SLOT_0130') {
      hour = 1
      minute = 30
    } else if (targetTimeSlot === 'SLOT_0330') {
      hour = 3
      minute = 30
    }

    // Compare date strings directly (allow today - target date must be >= today)
    const todayDateStr = getHKTTodayKey()
    if (compareHKTDateKeys(targetDateKey, todayDateStr) < 0) {
      alert('Cannot move schedule to a past date.')
      return
    }

    // Create date with the intended local date/time
    // This ensures the date portion matches what the user sees, regardless of timezone
    const targetDateHKT = createHKTDate(year, monthNumber, day, hour, minute)

    // Check if target slot already has a schedule (we'll push it forward)
    // Use schedulesByDateAndTime to check current display state (includes pending moves)
    const targetSchedules = schedulesByDateAndTime.get(targetDateKey)?.get(targetTimeSlot) || []
    // Find the target schedule from display, but get the actual schedule object from schedules array
    const targetDisplaySchedule = targetSchedules.find((s: any) => s.id !== scheduleId)
    const targetSchedule = targetDisplaySchedule 
      ? schedules.find((s) => s.id === targetDisplaySchedule.id)
      : null

    // Determine behavior: swap vs push-forward
    // - If moving schedule is PLANNED (has r1PlannedDate), swap positions (no warning)
    // - If moving schedule is PENDING/SKIPPED/MISSED (being rescheduled), push forward (show warning)
    // Note: Future slots can only be occupied by PLANNED items, so target will always be PLANNED
    const scheduleIsPlanned = schedule.status === 'PLANNED' && Boolean(schedule.r1PlannedDate)
    const willPushTarget = !!targetSchedule && !scheduleIsPlanned

    if (targetSchedule && willPushTarget) {
      const confirmed = window.confirm(
        `This slot is already occupied by ${targetSchedule.equipment.equipmentNumber}. The existing work order will be pushed to the next available slot after ${formatHKTDateKey(
          targetDateKey,
          { month: 'long', day: 'numeric' }
        )}. Do you want to continue?`
      )
      if (!confirmed) {
        return
      }
    }

    const scheduleBaseDate = getScheduleBaseDate(schedule)
    if (!scheduleBaseDate) {
      alert('This work order no longer has a scheduled date. Please use the Reschedule tab to plan it.')
      return
    }

    // Check if moving a pending card (past date, not completed) - use HKT for consistency
    const scheduleDateKey = getHKTDateKey(new Date(scheduleBaseDate))
    const isPending =
      compareHKTDateKeys(scheduleDateKey, todayKey) < 0 && schedule.status === 'PENDING'

    // Check for 23:00 slot eligibility warning
    const isInvalid2300Slot = targetTimeSlot === 'SLOT_2300' && schedule.equipment.canUse2300Slot !== true

    // Show confirmation dialogs
    if (isInvalid2300Slot) {
      const confirmed = window.confirm(
        'Warning: This equipment is not eligible for the 23:00 slot. Only equipment with the clock icon can be scheduled at 23:00.\n\nDo you want to proceed with this move?'
      )
      if (!confirmed) {
        return
      }
    }

    // If PENDING, auto-skip and reschedule in one operation
    // The move endpoint will handle the skip automatically
    // PLANNED (future) items can be moved without confirmation - just updating planned date
    if (isPending) {
      const confirmed = window.confirm(
        'This work order is marked as Pending (past date, not yet validated).\n\nPlease confirm:\n- This work order was NOT executed\n- You want to reschedule it\n\nIt will be automatically marked as skipped and rescheduled in one step.'
      )
      if (!confirmed) {
        return
      }
    }
    // No confirmation needed for PLANNED (future) items - just moving the planned date

    // Get original position of the schedule being moved
    const originalDateKey = getHKTDateKey(new Date(scheduleBaseDate))

    // Optimistically update the dragged schedule immediately
    setPendingMoves((prev) => {
      const newMap = new Map(prev)
      
      // Move the dragged schedule to target position
      newMap.set(scheduleId, {
        newDate: targetDateHKT.toISOString(),
        newTimeSlot: targetTimeSlot,
      })

      if (
        targetSchedule &&
        !willPushTarget &&
        schedule.r1PlannedDate &&
        targetSchedule.r1PlannedDate
      ) {
        newMap.set(targetSchedule.id, {
          newDate: schedule.r1PlannedDate,
          newTimeSlot: schedule.timeSlot,
        })
      }
      
      return newMap
    })

    // Format date for API - use ISO string but ensure date portion is correct
    // Create a date string that preserves the intended date regardless of timezone
    // Format: YYYY-MM-DDTHH:mm:ss (using local time, then convert to ISO)
    const dateForAPI = targetDateHKT
    
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newDate: dateForAPI.toISOString(),
          newTimeSlot: targetTimeSlot,
          swapWithScheduleId: targetSchedule?.id || undefined,
          allowInvalid2300Slot: isInvalid2300Slot, // Flag to allow move despite warning
          targetDateStr: targetDateKey, // Send the date string directly for comparison
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        // Revert optimistic update on error
        setPendingMoves((prev) => {
          const newMap = new Map(prev)
          newMap.delete(scheduleId)
          if (targetSchedule) {
            newMap.delete(targetSchedule.id)
          }
          return newMap
        })
        alert(`Error moving schedule: ${error.error}`)
        return
      }

      // Don't clear pending move yet - keep it until data refresh confirms the move
      // Refresh schedules - the pending move will be cleared when new data arrives
      if (onScheduleMove) {
        onScheduleMove()
      }
    } catch (error) {
      console.error('Error moving schedule:', error)
      // Revert optimistic update on error
      setPendingMoves((prev) => {
        const newMap = new Map(prev)
        newMap.delete(scheduleId)
        if (targetSchedule) {
          newMap.delete(targetSchedule.id)
        }
        return newMap
      })
      alert('Failed to move schedule. Please try again.')
    }
  }

  const activeSchedule = activeId ? schedules.find((s) => s.id === activeId) : null

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 z-20 px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase bg-gray-50 border-r border-gray-200 min-w-[60px]">
                Time
              </th>
              {dateKeys.map((dateKey) => {
                const isToday = dateKey === todayKey
                return (
                  <th
                    key={dateKey}
                    className={`px-2 py-2 text-center text-xs font-medium text-gray-700 uppercase min-w-[120px] ${
                      isToday ? 'bg-blue-100' : ''
                    }`}
                  >
                    <div className="font-semibold">
                      {formatHKTDateKey(dateKey, { weekday: 'short' })}
                    </div>
                    <div className={`text-xs ${isToday ? 'text-blue-700 font-bold' : 'text-gray-900'}`}>
                      {formatHKTDateKey(dateKey, { month: 'short', day: 'numeric' })}
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
                {dateKeys.map((dateKey) => {
                  const isToday = dateKey === todayKey
                  const daySchedules = schedulesByDateAndTime.get(dateKey)?.get(timeSlot.slot) || []
                  const isEmpty = daySchedules.length === 0

                  return (
                    <DroppableCell
                      key={`${dateKey}-${timeSlot.slot}`}
                      dateKey={dateKey}
                      timeSlot={timeSlot.slot}
                      isEmpty={isEmpty}
                    >
                      <div className="space-y-1">
                        {daySchedules.map((schedule) => (
                          <ScheduleCard
                            key={schedule.id}
                            schedule={schedule}
                            isDragging={activeId === schedule.id}
                            isEditMode={isEditMode}
                          />
                        ))}
                      </div>
                    </DroppableCell>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DragOverlay>
        {activeSchedule ? (
          <ScheduleCard schedule={activeSchedule} isDragging={true} isEditMode={isEditMode} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
