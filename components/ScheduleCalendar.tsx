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
          const expectedDateKey = new Date(pendingMove.newDate).toISOString().split('T')[0]
          const actualDateKey = new Date(schedule.r1PlannedDate).toISOString().split('T')[0]
          
          // If the schedule is now in the expected position, clear the pending move
          if (actualDateKey === expectedDateKey && schedule.timeSlot === pendingMove.newTimeSlot) {
            newMap.delete(scheduleId)
            hasChanges = true
          }
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
        dateKey = new Date(pendingMove.newDate).toISOString().split('T')[0]
        timeSlot = pendingMove.newTimeSlot
      } else {
        // Use the original schedule date and time slot
        dateKey = new Date(schedule.r1PlannedDate).toISOString().split('T')[0]
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

    const scheduleId = active.id as string
    const schedule = schedules.find((s) => s.id === scheduleId)
    if (!schedule) return

    const dropData = over.data.current
    if (!dropData || !dropData.dateKey || !dropData.timeSlot) return

    const targetDateKey = dropData.dateKey
    const targetTimeSlot = dropData.timeSlot

    // Check if target slot already has a schedule (for swapping)
    const targetSchedules = schedulesByDateAndTime.get(targetDateKey)?.get(targetTimeSlot) || []
    const targetSchedule = targetSchedules.length > 0 ? targetSchedules[0] : null

    // Build new date with time from slot
    const targetDate = new Date(targetDateKey)
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
    targetDate.setHours(hour, minute, 0, 0)

    // Optimistically update the schedule position
    setPendingMoves((prev) => {
      const newMap = new Map(prev)
      newMap.set(scheduleId, {
        newDate: targetDate.toISOString(),
        newTimeSlot: targetTimeSlot,
      })
      return newMap
    })

    try {
      const response = await fetch(`/api/schedules/${scheduleId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newDate: targetDate.toISOString(),
          newTimeSlot: targetTimeSlot,
          swapWithScheduleId: targetSchedule?.id || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        // Revert optimistic update on error
        setPendingMoves((prev) => {
          const newMap = new Map(prev)
          newMap.delete(scheduleId)
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
                  const dateKey = date.toISOString().split('T')[0]
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
          <ScheduleCard schedule={activeSchedule} isDragging={true} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
