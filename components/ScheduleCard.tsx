'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

interface ScheduleCardProps {
  schedule: {
    id: string
    equipment: {
      equipmentNumber: string
      name: string | null
      type: string
      canUse2300Slot?: boolean
    }
    zone: {
      code: string
      name: string
    }
    r1PlannedDate: string
    dueDate: string
    batch: 'A' | 'B'
    timeSlot: 'SLOT_2300' | 'SLOT_0130' | 'SLOT_0330'
    status: string
    fixedEngineer: { name: string } | null
    rotatingEngineer: { name: string } | null
    workOrderNumber: string | null
  }
  onClick?: () => void
  isDragging?: boolean
}

export function ScheduleCard({ schedule, onClick, isDragging }: ScheduleCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useDraggable({
    id: schedule.id,
    data: {
      schedule,
    },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  // Get validation status
  const getValidationStatus = () => {
    if (schedule.status === 'COMPLETED' || schedule.status === 'COMPLETED_LATE') return 'completed'
    if (schedule.status === 'MISSED') return 'to_reschedule'
    
    // Don't show pending for future schedules
    const scheduleDate = new Date(schedule.r1PlannedDate)
    scheduleDate.setHours(0, 0, 0, 0)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Only show pending if the schedule date is in the past (not today, not future)
    if (scheduleDate >= today) {
      return null // Don't show status for today or future schedules
    }
    
    // Past date that hasn't been validated yet
    return 'pending'
  }

  const validationStatus = getValidationStatus()

  // Format deadline date
  const deadlineDate = schedule.dueDate
    ? new Date(schedule.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  // Check if unit is in 11pm slot but not eligible
  const isInvalid2300Slot = schedule.timeSlot === 'SLOT_2300' && schedule.equipment.canUse2300Slot !== true

  // Card background colors
  let cardBgColor = 'bg-white'
  if (validationStatus === 'to_reschedule') {
    cardBgColor = 'bg-red-50'
  } else if (isInvalid2300Slot) {
    cardBgColor = 'bg-yellow-50'
  }
  const cardBorderColor = 'border-blue-200'
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`p-1.5 rounded border ${cardBgColor} ${cardBorderColor} cursor-move hover:shadow-md transition-all text-xs ${
        !schedule.fixedEngineer && !schedule.rotatingEngineer
          ? 'border-dashed border-blue-400'
          : ''
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0 leading-tight">
          <div className="flex items-center gap-1.5 leading-none">
            <div className="font-semibold text-gray-900 leading-tight truncate">
              {schedule.equipment.equipmentNumber}
            </div>
            {schedule.equipment.canUse2300Slot === true && (
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 16 16" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg" 
                className="flex-shrink-0"
                style={{ width: '16px', height: '16px', minWidth: '16px' }}
                aria-label="Can use 23:00 slot"
              >
                <path 
                  d="M7.99998 1.84998C11.3965 1.84998 14.15 4.60342 14.15 7.99998C14.15 11.3965 11.3965 14.15 7.99998 14.15C4.60342 14.15 1.84998 11.3965 1.84998 7.99998C1.84998 4.60342 4.60342 1.84998 7.99998 1.84998ZM7.99998 3.14998C5.32139 3.14998 3.14998 5.32139 3.14998 7.99998C3.14998 10.6786 5.32139 12.85 7.99998 12.85C10.6786 12.85 12.85 10.6786 12.85 7.99998C12.85 5.32139 10.6786 3.14998 7.99998 3.14998ZM7.99998 4.13527C8.32633 4.13527 8.5965 4.37578 8.64293 4.68922L8.64998 4.78527V7.74698L10.1917 9.42881C10.4343 9.69342 10.4164 10.1046 10.1518 10.3472C9.91366 10.5655 9.5568 10.5729 9.31096 10.3793L9.23344 10.3073L7.52085 8.43922C7.43293 8.34332 7.37632 8.22383 7.3572 8.0966L7.34998 7.99998V4.78527C7.34998 4.42629 7.64099 4.13527 7.99998 4.13527Z" 
                  fill="#000000"
                />
              </svg>
            )}
          </div>
          {schedule.workOrderNumber && (
            <div className="text-[10px] text-gray-600 truncate leading-tight">
              {schedule.workOrderNumber}
            </div>
          )}
          {deadlineDate && (
            <div className="text-[10px] text-gray-500 leading-tight">
              Due: {deadlineDate}
            </div>
          )}
          {/* Validation status line */}
          {validationStatus && (
            <div className="text-[10px] leading-tight whitespace-nowrap">
              {validationStatus === 'completed' && (
                <span className="text-green-600 font-medium">✓ Completed</span>
              )}
              {validationStatus === 'to_reschedule' && (
                <span className="text-red-600 font-medium">⚠ To Reschedule</span>
              )}
              {validationStatus === 'pending' && (
                <span className="text-gray-500">Pending</span>
              )}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-blue-800 text-white">
            {schedule.batch}
          </span>
        </div>
      </div>
    </div>
  )
}
