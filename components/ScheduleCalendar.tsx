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
import { useSchedule } from '@/lib/hooks'

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
  // Generate dates - always start from Sunday, show 7 days for week view
  // Use UTC dates consistently to avoid timezone issues
  const dates = useMemo(() => {
    const dateList: Date[] = []
    const currentDate = new Date(fromDate)
    
    if (viewMode === 'week') {
      // Always show exactly 7 days starting from Sunday
      for (let i = 0; i < 7; i++) {
        const date = new Date(currentDate)
        dateList.push(date)
        currentDate.setDate(currentDate.getDate() + 1)
      }
    } else {
      // Month view - show all days from first Sunday to last Saturday
      while (currentDate <= toDate) {
        const date = new Date(currentDate)
        dateList.push(date)
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }
    
    return dateList
  }, [fromDate, toDate, viewMode])

  // Helper function to get date key consistently (YYYY-MM-DD format)
  const getDateKey = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
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
          const expectedDateKey = getDateKey(new Date(pendingMove.newDate))
          const actualDateKey = getDateKey(new Date(schedule.r1PlannedDate))
          
          // If the schedule is now in the expected position, clear the pending move
          if (actualDateKey === expectedDateKey && schedule.timeSlot === pendingMove.newTimeSlot) {
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
      // Check if there's a pending move for this schedule
      const pendingMove = pendingMoves.get(schedule.id)
      
      let dateKey: string
      let timeSlot: string
      
      if (pendingMove) {
        // Use the pending move's date and time slot
        dateKey = getDateKey(new Date(pendingMove.newDate))
        timeSlot = pendingMove.newTimeSlot
      } else {
        // Use the original schedule date and time slot
        dateKey = getDateKey(new Date(schedule.r1PlannedDate))
        timeSlot = schedule.timeSlot
      }
      
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, new Map())
      }
      
      const timeMap = grouped.get(dateKey)!
      if (!timeMap.has(timeSlot)) {
        timeMap.set(timeSlot, [])
      }
      
      // Create a modified schedule object with the new date/time for display
      const displaySchedule = pendingMove
        ? {
            ...schedule,
            r1PlannedDate: pendingMove.newDate,
            timeSlot: pendingMove.newTimeSlot,
          }
        : schedule
      
      timeMap.get(timeSlot)!.push(displaySchedule)
    })
    
    return grouped
  }, [schedules, pendingMoves])

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
    const month = parseInt(targetDateParts[1], 10) - 1 // Month is 0-indexed
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

    // Create date with the intended local date/time
    // This ensures the date portion matches what the user sees, regardless of timezone
    const targetDate = new Date(year, month, day, hour, minute, 0, 0)

    // Prevent moving to past dates
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetDateOnly = new Date(targetDate)
    targetDateOnly.setHours(0, 0, 0, 0)
    
    if (targetDateOnly < today) {
      alert('Cannot move schedule to a past date.')
      return
    }

    // Check if target slot already has a schedule (for swapping)
    // Use schedulesByDateAndTime to check current display state (includes pending moves)
    const targetSchedules = schedulesByDateAndTime.get(targetDateKey)?.get(targetTimeSlot) || []
    // Find the target schedule from display, but get the actual schedule object from schedules array
    const targetDisplaySchedule = targetSchedules.find((s: any) => s.id !== scheduleId)
    const targetSchedule = targetDisplaySchedule 
      ? schedules.find((s) => s.id === targetDisplaySchedule.id)
      : null

    // Check if moving a pending card (past date, not completed)
    const scheduleDate = new Date(schedule.r1PlannedDate)
    scheduleDate.setHours(0, 0, 0, 0)
    const isPending = scheduleDate < today && 
      schedule.status !== 'COMPLETED' && 
      schedule.status !== 'COMPLETED_LATE' &&
      schedule.status !== 'MISSED' &&
      schedule.status !== 'RESCHEDULED'

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

    if (isPending) {
      const confirmed = window.confirm(
        'This work order is marked as Pending (past date, not yet validated).\n\nPlease confirm:\n- This work order was NOT executed\n- You want to reschedule it\n\nDo you want to proceed with rescheduling?'
      )
      if (!confirmed) {
        return
      }
    }

    // Get original position of the schedule being moved
    const originalDateKey = getDateKey(new Date(schedule.r1PlannedDate))
    const originalTimeSlot = schedule.timeSlot

    // Optimistically update BOTH schedules immediately (for swap)
    setPendingMoves((prev) => {
      const newMap = new Map(prev)
      
      // Move the dragged schedule to target position
      newMap.set(scheduleId, {
        newDate: targetDate.toISOString(),
        newTimeSlot: targetTimeSlot,
      })
      
      // If swapping, also move the target schedule to the original position
      if (targetSchedule) {
        // Use the original position from the schedule object (not affected by pending moves)
        newMap.set(targetSchedule.id, {
          newDate: schedule.r1PlannedDate, // Original position of dragged schedule
          newTimeSlot: originalTimeSlot,
        })
      }
      
      return newMap
    })

    // Format date for API - use ISO string but ensure date portion is correct
    // Create a date string that preserves the intended date regardless of timezone
    // Format: YYYY-MM-DDTHH:mm:ss (using local time, then convert to ISO)
    const dateForAPI = new Date(year, month, day, hour, minute, 0, 0)
    
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
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        // Revert optimistic update on error (both schedules if swapping)
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
      // Revert optimistic update on error (both schedules if swapping)
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
                  const dateKey = getDateKey(date)
                  const isToday = date.toDateString() === today.toDateString()
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
