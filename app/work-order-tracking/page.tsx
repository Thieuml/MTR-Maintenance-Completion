'use client'

import { useState, useMemo, useEffect } from 'react'
import { Navigation } from '@/components/Navigation'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface WorkOrder {
  id: string
  workOrderNumber: string
  equipment: {
    equipmentNumber: string
  }
  zone: {
    code: string
  }
  r1PlannedDate: string
  mtrPlannedStartDate: string | null
  dueDate: string | null
  status: string
  createdAt: string
}

export default function WorkOrderTrackingPage() {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as 'to_validate' | 'to_reschedule' | 'completed' | null
  
  const [activeTab, setActiveTab] = useState<'to_validate' | 'to_reschedule' | 'completed'>(
    tabFromUrl && ['to_validate', 'to_reschedule', 'completed'].includes(tabFromUrl) 
      ? tabFromUrl 
      : 'to_validate'
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'completed' | 'to_reschedule' | null>(null)
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

  // Update tab if URL parameter changes
  useEffect(() => {
    if (tabFromUrl && ['to_validate', 'to_reschedule', 'completed'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl])

  // Fetch all work orders
  const { data, error, isLoading, mutate } = useSWR<{ workOrders: WorkOrder[] }>(
    '/api/admin/work-orders',
    fetcher
  )

  const workOrders = data?.workOrders || []

  // Filter and categorize work orders
  const categorized = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const toValidate: WorkOrder[] = []
    const toReschedule: WorkOrder[] = []
    const completed: WorkOrder[] = []

    workOrders.forEach((wo) => {
      const scheduleDate = new Date(wo.r1PlannedDate)
      scheduleDate.setHours(0, 0, 0, 0)
      const dueDate = wo.dueDate ? new Date(wo.dueDate) : null
      if (dueDate) dueDate.setHours(0, 0, 0, 0)

      // Filter by search term
      if (searchTerm.trim()) {
        const search = searchTerm.trim().toLowerCase()
        if (
          !wo.workOrderNumber?.toLowerCase().includes(search) &&
          !wo.equipment?.equipmentNumber?.toLowerCase().includes(search)
        ) {
          return
        }
      }

      // Categorize based on status and date
      if (wo.status === 'COMPLETED' || wo.status === 'COMPLETED_LATE') {
        completed.push(wo)
      } else if (wo.status === 'MISSED') {
        // Status is MISSED - needs rescheduling
        toReschedule.push(wo)
      } else if (wo.status === 'RESCHEDULED') {
        // RESCHEDULED: Only show in reschedule tab if the new date has passed and not completed
        // (meaning it needs to be rescheduled again)
        if (scheduleDate < today) {
          toReschedule.push(wo)
        }
        // If RESCHEDULED with future date, don't show in any tab (it's planned for future)
      } else if (scheduleDate < today) {
        // WM Planned date in the past - needs validation (Pending status)
        // Goes to "To Be Validated" tab regardless of due date
        toValidate.push(wo)
      }
      // Future dates are not shown in any tab (they're still PLANNED)
    })

    return {
      toValidate: toValidate.slice(0, 50), // Limit to 50
      toReschedule: toReschedule.slice(0, 50),
      completed: completed.slice(0, 50),
    }
  }, [workOrders, searchTerm])

  const currentTabData = useMemo(() => {
    switch (activeTab) {
      case 'to_validate':
        return categorized.toValidate
      case 'to_reschedule':
        return categorized.toReschedule
      case 'completed':
        return categorized.completed
      default:
        return []
    }
  }, [activeTab, categorized])

  const handleValidate = async (scheduleId: string, action: 'completed' | 'to_reschedule') => {
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
        alert(`Error: ${error.error}`)
        return
      }

      mutate()
    } catch (error) {
      console.error('Error validating schedule:', error)
      alert('Failed to validate schedule. Please try again.')
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
    if (activeTab === 'to_validate') {
      if (selectedIds.size === categorized.toValidate.length) {
        setSelectedIds(new Set())
      } else {
        setSelectedIds(new Set(categorized.toValidate.map((wo) => wo.id)))
      }
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
    <div className="min-h-screen bg-gray-50 flex">
      <Navigation />
      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-full mx-auto">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Work Order Tracking
            </h1>
            <p className="text-sm text-gray-600">
              Track and manage all work orders
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-4 bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Search by WO #:</label>
              <input
                type="text"
                placeholder="Enter work order number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  onClick={() => {
                    setActiveTab('to_validate')
                    setSelectedIds(new Set())
                    setBulkAction(null)
                  }}
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${
                    activeTab === 'to_validate'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  To be validated ({categorized.toValidate.length})
                </button>
                <button
                  onClick={() => {
                    setActiveTab('to_reschedule')
                    setSelectedIds(new Set())
                    setBulkAction(null)
                  }}
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${
                    activeTab === 'to_reschedule'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  To be rescheduled ({categorized.toReschedule.length})
                </button>
                <button
                  onClick={() => {
                    setActiveTab('completed')
                    setSelectedIds(new Set())
                    setBulkAction(null)
                  }}
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${
                    activeTab === 'completed'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Completed ({categorized.completed.length})
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {isLoading ? (
                <div className="p-8 text-center text-gray-500">
                  Loading work orders...
                </div>
              ) : error ? (
                <div className="p-8 text-center text-red-500">
                  Error loading work orders. Please try again.
                </div>
              ) : currentTabData.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {searchTerm
                    ? 'No work orders found matching your search.'
                    : `No work orders in "${activeTab === 'to_validate' ? 'To be validated' : activeTab === 'to_reschedule' ? 'To be rescheduled' : 'Completed'}" category.`}
                </div>
              ) : (
                <>
                  {/* Bulk actions for "To be validated" tab */}
                  {activeTab === 'to_validate' && categorized.toValidate.length > 0 && (
                    <div className="mb-4 bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedIds.size === categorized.toValidate.length && categorized.toValidate.length > 0}
                              onChange={handleSelectAll}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">
                              Select All ({selectedIds.size}/{categorized.toValidate.length})
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
                  {currentTabData.length >= 50 && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                      Showing first 50 work orders. Use search to find specific work orders.
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {activeTab === 'to_validate' && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase w-12">
                              <input
                                type="checkbox"
                                checked={selectedIds.size === categorized.toValidate.length && categorized.toValidate.length > 0}
                                onChange={handleSelectAll}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                            </th>
                          )}
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                            WO Number
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                            Equipment
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                            Zone
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                            Planned Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                            MTR Start Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                            Due Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                            Status
                          </th>
                          {activeTab !== 'completed' && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {currentTabData.map((wo) => (
                          <tr key={wo.id} className={`hover:bg-gray-50 ${selectedIds.has(wo.id) ? 'bg-blue-50' : ''}`}>
                            {activeTab === 'to_validate' && (
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(wo.id)}
                                  onChange={() => handleSelectOne(wo.id)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                              </td>
                            )}
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {wo.workOrderNumber}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {wo.equipment.equipmentNumber}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {wo.zone.code}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(wo.r1PlannedDate).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {wo.mtrPlannedStartDate
                                ? new Date(wo.mtrPlannedStartDate).toLocaleDateString()
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {wo.dueDate ? new Date(wo.dueDate).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {(() => {
                                const scheduleDate = new Date(wo.r1PlannedDate)
                                scheduleDate.setHours(0, 0, 0, 0)
                                const today = new Date()
                                today.setHours(0, 0, 0, 0)

                                let displayStatus = wo.status
                                let statusClass = 'bg-gray-100 text-gray-700'

                                if (wo.status === 'COMPLETED' || wo.status === 'COMPLETED_LATE') {
                                  displayStatus = wo.status === 'COMPLETED_LATE' ? 'Completed (Late)' : 'Completed'
                                  statusClass = 'bg-green-100 text-green-800'
                                } else if (wo.status === 'MISSED' || wo.status === 'RESCHEDULED') {
                                  displayStatus = 'Rescheduling'
                                  statusClass = 'bg-orange-100 text-orange-800'
                                } else if (scheduleDate >= today) {
                                  // WM Planned date in future or same day
                                  displayStatus = 'Planned'
                                  statusClass = 'bg-blue-100 text-blue-800'
                                } else {
                                  // WM Planned date in past - Pending validation
                                  displayStatus = 'Pending'
                                  statusClass = 'bg-yellow-100 text-yellow-800'
                                }

                                return (
                                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusClass}`}>
                                    {displayStatus}
                                  </span>
                                )
                              })()}
                            </td>
                            {activeTab !== 'completed' && (
                              <td className="px-4 py-3 text-sm">
                                <div className="flex items-center gap-2">
                                  {activeTab === 'to_validate' && (
                                    <>
                                      <button
                                        onClick={() => handleValidate(wo.id, 'completed')}
                                        className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors relative group"
                                        title="Mark as Completed"
                                      >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          <path fillRule="evenodd" clipRule="evenodd" d="M5.4596 11.5404C5.20575 11.2865 4.7942 11.2865 4.54036 11.5404C4.28652 11.7942 4.28652 12.2058 4.54036 12.4596L10.5404 18.4596C10.8304 18.7496 11.3133 18.7018 11.5408 18.3605L19.5408 6.36054C19.7399 6.06185 19.6592 5.65828 19.3605 5.45915C19.0618 5.26002 18.6583 5.34073 18.4591 5.63943L10.8989 16.9797L5.4596 11.5404Z" fill="currentColor"/>
                                        </svg>
                                        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                                          Mark as Completed
                                        </span>
                                      </button>
                                      <button
                                        onClick={() => handleValidate(wo.id, 'to_reschedule')}
                                        className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors relative group"
                                        title="Mark as To Reschedule"
                                      >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                          <path fillRule="evenodd" clipRule="evenodd" d="M19.7 12C19.7 16.2526 16.2526 19.7 12 19.7C10.1283 19.7 8.41262 19.0322 7.07815 17.9219L17.9219 7.07815C19.0322 8.41261 19.7 10.1283 19.7 12ZM6.15211 17.0094L17.0094 6.15211C15.6628 4.99753 13.9129 4.3 12 4.3C7.74741 4.3 4.3 7.74741 4.3 12C4.3 13.9129 4.99753 15.6629 6.15211 17.0094ZM21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" fill="currentColor"/>
                                        </svg>
                                        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                                          Mark as To Reschedule
                                        </span>
                                      </button>
                                    </>
                                  )}
                                  {activeTab === 'to_reschedule' && (
                                    <a
                                      href={`/reschedule?scheduleId=${wo.id}`}
                                      className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors relative group inline-block"
                                      title="Reschedule"
                                    >
                                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path fillRule="evenodd" clipRule="evenodd" d="M19.7 12C19.7 16.2526 16.2526 19.7 12 19.7C10.1283 19.7 8.41262 19.0322 7.07815 17.9219L17.9219 7.07815C19.0322 8.41261 19.7 10.1283 19.7 12ZM6.15211 17.0094L17.0094 6.15211C15.6628 4.99753 13.9129 4.3 12 4.3C7.74741 4.3 4.3 7.74741 4.3 12C4.3 13.9129 4.99753 15.6629 6.15211 17.0094ZM21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" fill="currentColor"/>
                                      </svg>
                                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                                        Reschedule
                                      </span>
                                    </a>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

