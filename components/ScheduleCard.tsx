'use client'

interface ScheduleCardProps {
  schedule: {
    id: string
    equipment: {
      equipmentNumber: string
      name: string | null
      type: string
    }
    zone: {
      code: string
      name: string
    }
    r1PlannedDate: string
    batch: 'A' | 'B'
    timeSlot: 'SLOT_2300' | 'SLOT_0130' | 'SLOT_0330'
    status: string
    fixedEngineer: { name: string } | null
    rotatingEngineer: { name: string } | null
    workOrderNumber: string | null
  }
  onClick?: () => void
}

export function ScheduleCard({ schedule, onClick }: ScheduleCardProps) {
  // Get time slot display
  const timeSlotDisplay = {
    SLOT_2300: '23:00',
    SLOT_0130: '01:30',
    SLOT_0330: '03:30',
  }[schedule.timeSlot]

  // Status color coding
  const statusColors: Record<string, string> = {
    PLANNED: 'bg-gray-100 border-gray-300',
    ASSIGNED: 'bg-yellow-50 border-yellow-300',
    IN_PROGRESS: 'bg-blue-50 border-blue-300',
    COMPLETED: 'bg-green-50 border-green-300',
    COMPLETED_LATE: 'bg-orange-50 border-orange-300',
    MISSED: 'bg-red-50 border-red-300',
    RESCHEDULED: 'bg-purple-50 border-purple-300',
    OVERDUE: 'bg-red-100 border-red-500',
    CANCELLED: 'bg-gray-200 border-gray-400',
  }

  const statusColor = statusColors[schedule.status] || 'bg-gray-100 border-gray-300'

  // Format date
  const date = new Date(schedule.r1PlannedDate)
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border-2 ${statusColor} cursor-pointer hover:shadow-md transition-shadow ${
        !schedule.fixedEngineer && !schedule.rotatingEngineer
          ? 'border-dashed border-pink-400 bg-pink-50'
          : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="font-semibold text-sm text-gray-900">
            {schedule.equipment.equipmentNumber}
          </div>
          <div className="text-xs text-gray-600">{schedule.zone.code}</div>
        </div>
        <div className="text-xs font-medium text-gray-700">
          {schedule.batch}
        </div>
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-1 text-gray-700">
          <span className="font-medium">Time:</span>
          <span>{timeSlotDisplay}</span>
        </div>
        {schedule.workOrderNumber && (
          <div className="flex items-center gap-1 text-gray-600">
            <span className="font-medium">OR:</span>
            <span className="font-mono">{schedule.workOrderNumber}</span>
          </div>
        )}
        {schedule.fixedEngineer && (
          <div className="flex items-center gap-1">
            <span className="text-gray-600">Fixed:</span>
            <span className="font-medium text-blue-700">
              {schedule.fixedEngineer.name}
            </span>
          </div>
        )}
        {schedule.rotatingEngineer && (
          <div className="flex items-center gap-1">
            <span className="text-gray-600">Rotating:</span>
            <span className="font-medium text-green-700">
              {schedule.rotatingEngineer.name}
            </span>
          </div>
        )}
        {!schedule.fixedEngineer && !schedule.rotatingEngineer && (
          <div className="text-pink-600 font-medium text-xs">
            Unassigned
          </div>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-gray-200">
        <span className="text-xs font-medium text-gray-600">
          {schedule.status.replace('_', ' ')}
        </span>
      </div>
    </div>
  )
}

