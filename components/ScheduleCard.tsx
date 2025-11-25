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

  // Show batch as "A" or "B-Week"
  const batchDisplay = schedule.batch === 'B' ? 'B-Week' : schedule.batch

  return (
    <div
      onClick={onClick}
      className={`p-1.5 rounded border ${statusColor} cursor-pointer hover:shadow-sm transition-shadow text-xs ${
        !schedule.fixedEngineer && !schedule.rotatingEngineer
          ? 'border-dashed border-pink-400 bg-pink-50'
          : ''
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 truncate">
            {schedule.equipment.equipmentNumber}
          </div>
          {schedule.workOrderNumber && (
            <div className="text-[10px] text-gray-600 font-mono truncate">
              {schedule.workOrderNumber}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-700">
            {batchDisplay}
          </span>
        </div>
      </div>
    </div>
  )
}
