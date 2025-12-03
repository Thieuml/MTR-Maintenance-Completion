'use client'

import { useMemo, useState } from 'react'
import { useSchedule } from '@/lib/hooks'
import { Navigation } from '@/components/shared/Navigation'

export default function ValidationPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'completed' | 'to_reschedule' | null>(null)
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  // Show all past services that haven't been actioned
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Get all schedules from the past (up to 30 days ago)
  const pastDate = new Date(today)
  pastDate.setDate(pastDate.getDate() - 30)
  
  const from = pastDate.toISOString().split('T')[0]
  const to = today.toISOString().split('T')[0]

  const { schedules, isLoading, mutate } = useSchedule(undefined, from, to)

  // Filter schedules that need validation:
  // - Status is PENDING (past dates awaiting validation)
  // - OR status is PLANNED with past r1PlannedDate (not yet transitioned by CRON)
  const pendingSchedules = useMemo(() => {
    return schedules.filter((schedule: any) => {
      if (schedule.status === 'PENDING') {
        return true
      }
      // Also show PLANNED items with past dates (CRON hasn't run yet)
      if (schedule.status === 'PLANNED' && schedule.r1PlannedDate) {
        const scheduleDate = new Date(schedule.r1PlannedDate)
        scheduleDate.setHours(0, 0, 0, 0)
        return scheduleDate < today
      }
      return false
    })
  }, [schedules, today])

  const handleValidate = async (scheduleId: string, action: 'completed' | 'to_reschedule') => {
    setProcessingIds(prev => new Set(prev).add(scheduleId))
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(`Error: ${error.error || 'Failed to validate schedule'}`)
        return
      }

      const result = await response.json()
      
      // Show success feedback before refresh
      if (action === 'to_reschedule') {
        const status = result.schedule?.status
        if (status === 'SKIPPED') {
          alert('Item marked as SKIPPED. You can find it in the "To be rescheduled" tab on the Work Order Tracking page.')
        } else if (status === 'MISSED') {
          alert('Item marked as MISSED. The deadline has passed. You can find it in the "To be rescheduled" tab on the Work Order Tracking page.')
        }
      } else if (action === 'completed') {
        alert('Item marked as COMPLETED.')
      }
      
      // Refresh schedules
      await mutate()
    } catch (error) {
      console.error('Error validating schedule:', error)
      alert(`Failed to validate schedule: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(scheduleId)
        return next
      })
    }
  }

  const handleBulkValidate = async () => {
    if (selectedIds.size === 0 || !bulkAction) {
      alert('Please select items and choose an action')
      return
    }

    setIsBulkProcessing(true)
    try {
      const promises = Array.from(selectedIds).map((id) =>
        fetch(`/api/schedules/${id}/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: bulkAction }),
        })
      )

      const results = await Promise.allSettled(promises)
      const failed = results.filter((r) => r.status === 'rejected').length

      if (failed > 0) {
        alert(`Completed ${selectedIds.size - failed} items. ${failed} failed.`)
      } else {
        alert(`Successfully validated ${selectedIds.size} items.`)
      }

      // Clear selection and refresh
      setSelectedIds(new Set())
      setBulkAction(null)
      mutate()
    } catch (error) {
      console.error('Error bulk validating:', error)
      alert('Failed to validate items. Please try again.')
    } finally {
      setIsBulkProcessing(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedIds.size === pendingSchedules.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingSchedules.map((s: any) => s.id)))
    }
  }

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="ml-64 overflow-auto p-4">
        <div className="max-w-full mx-auto">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Maintenance Completion
            </h1>
            <p className="text-sm text-gray-600">
              Validate all past maintenance services that haven&apos;t been actioned
            </p>
          </div>

          {/* Bulk actions */}
          {pendingSchedules.length > 0 && (
            <div className="mb-4 bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === pendingSchedules.length && pendingSchedules.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Select All ({selectedIds.size}/{pendingSchedules.length})
                    </span>
                  </label>
                </div>
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">
                      {selectedIds.size} selected
                    </span>
                    <select
                      value={bulkAction || ''}
                      onChange={(e) => setBulkAction(e.target.value as 'completed' | 'to_reschedule' | null)}
                      className="px-3 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="" className="text-gray-500">Choose action...</option>
                      <option value="completed" className="text-gray-900">Mark as Completed</option>
                      <option value="to_reschedule" className="text-gray-900">Mark as To Reschedule</option>
                    </select>
                    <button
                      onClick={handleBulkValidate}
                      disabled={!bulkAction || isBulkProcessing}
                      className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {isBulkProcessing ? 'Processing...' : 'Apply'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedIds(new Set())
                        setBulkAction(null)
                      }}
                      className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-gray-700 bg-white rounded-lg shadow-sm">
              Loading pending validations...
            </div>
          ) : pendingSchedules.length === 0 ? (
            <div className="p-8 text-center text-gray-700 bg-white rounded-lg shadow-sm">
              No pending validations for this date.
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase w-12">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === pendingSchedules.length && pendingSchedules.length > 0}
                          onChange={handleSelectAll}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Equipment
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        OR Number
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Zone
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Scheduled Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Engineers
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingSchedules.map((schedule: any) => {
                      const scheduledDate = new Date(schedule.r1PlannedDate)
                      const timeSlot = schedule.timeSlot
                      let timeLabel = ''
                      if (timeSlot === 'SLOT_2300') timeLabel = '23:00'
                      else if (timeSlot === 'SLOT_0130') timeLabel = '01:30'
                      else if (timeSlot === 'SLOT_0330') timeLabel = '03:30'

                      return (
                        <tr key={schedule.id} className={`hover:bg-gray-50 ${selectedIds.has(schedule.id) ? 'bg-blue-50' : ''}`}>
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(schedule.id)}
                              onChange={() => handleSelectOne(schedule.id)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {schedule.equipment.equipmentNumber}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {schedule.workOrderNumber || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {schedule.zone.code}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {scheduledDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            {timeLabel}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {schedule.fixedEngineer?.name || '-'}
                            {schedule.rotatingEngineer && (
                              <span className="text-gray-400">
                                {' '}
                                / {schedule.rotatingEngineer.name}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              Pending
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleValidate(schedule.id, 'completed')}
                                disabled={processingIds.has(schedule.id)}
                                className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                              >
                                {processingIds.has(schedule.id) ? 'Processing...' : 'Completed'}
                              </button>
                              <button
                                onClick={() => handleValidate(schedule.id, 'to_reschedule')}
                                disabled={processingIds.has(schedule.id)}
                                className="px-3 py-1 text-xs font-medium text-white bg-orange-600 rounded hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                              >
                                {processingIds.has(schedule.id) ? 'Processing...' : 'To Reschedule'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

