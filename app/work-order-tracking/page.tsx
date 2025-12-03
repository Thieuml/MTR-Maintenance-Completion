'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Navigation } from '@/components/shared/Navigation'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { calculatePlanningDeviation } from '@/lib/analytics/classification'
import { isAtRisk } from '@/lib/utils/schedule'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

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
  r0PlannedDate: string
  r1PlannedDate: string | null
  mtrPlannedStartDate: string | null
  dueDate: string | null
  status: string
  isLate: boolean
  skippedCount: number
  lastSkippedDate: string | null
  updatedAt: string
  createdAt: string
  // visits removed - not fetched for performance
}

export default function WorkOrderTrackingPage() {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as 'to_validate' | 'to_reschedule' | 'completed' | 'at_risk' | null
  
  const [activeTab, setActiveTab] = useState<'to_validate' | 'to_reschedule' | 'completed' | 'at_risk' | 'daily_report'>(
    tabFromUrl && ['to_validate', 'to_reschedule', 'completed', 'at_risk', 'daily_report'].includes(tabFromUrl) 
      ? tabFromUrl as 'to_validate' | 'to_reschedule' | 'completed' | 'at_risk' | 'daily_report'
      : 'to_validate'
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'completed' | 'to_reschedule' | null>(null)
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

  // Update tab if URL parameter changes
  useEffect(() => {
    if (tabFromUrl && ['to_validate', 'to_reschedule', 'completed', 'at_risk', 'daily_report'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl as 'to_validate' | 'to_reschedule' | 'completed' | 'at_risk' | 'daily_report')
    }
  }, [tabFromUrl])

  // State for completed items date range (default: 90 days)
  const [completedDays, setCompletedDays] = useState(90)
  const [includeOldCompleted, setIncludeOldCompleted] = useState(false)

  // Build API URL with optional parameters
  const workOrdersUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (completedDays !== 90) params.append('completedDays', completedDays.toString())
    if (includeOldCompleted) params.append('includeOldCompleted', 'true')
    const queryString = params.toString()
    return `/api/admin/work-orders${queryString ? `?${queryString}` : ''}`
  }, [completedDays, includeOldCompleted])

  // Fetch all work orders with automatic refresh to ensure all users see up-to-date data
  // Optimized: Only fetch completed items from last 90 days by default
  const { data, error, isLoading, mutate } = useSWR<{ workOrders: WorkOrder[]; meta?: { completedDaysFilter: number; includeOldCompleted: boolean; totalReturned: number } }>(
    workOrdersUrl,
    fetcher,
    {
      refreshInterval: 120000, // Refresh every 2 minutes (reduced from 30 seconds)
      // revalidateOnFocus is disabled globally in SWRProvider
      revalidateOnReconnect: true, // Revalidate when network reconnects
    }
  )

  const workOrders = data?.workOrders || []

  // Filter and categorize work orders
  const categorized = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const toValidate: WorkOrder[] = []
    const toReschedule: WorkOrder[] = []
    const completed: WorkOrder[] = []
    const atRisk: WorkOrder[] = []

    workOrders.forEach((wo) => {
      // Filter by search term first
      if (searchTerm.trim()) {
        const search = searchTerm.trim().toLowerCase()
        if (
          !wo.workOrderNumber?.toLowerCase().includes(search) &&
          !wo.equipment?.equipmentNumber?.toLowerCase().includes(search)
        ) {
          return
        }
      }

      // Categorize based on status and date (using new status flow)
      // Check COMPLETED first (before accessing r1PlannedDate which might be null)
      if (wo.status === 'COMPLETED') {
        completed.push(wo)
        return // Skip date checks for completed items
      }

      // For other statuses, check r1PlannedDate (might be null for SKIPPED/MISSED)
      if (!wo.r1PlannedDate) {
        // Items without scheduled date: SKIPPED or MISSED
        if (wo.status === 'MISSED' || wo.status === 'SKIPPED') {
          toReschedule.push(wo)
        } else if (wo.status === 'PENDING') {
          toValidate.push(wo)
        }
        return
      }

      // Items with scheduled date
      const scheduleDate = new Date(wo.r1PlannedDate)
      scheduleDate.setHours(0, 0, 0, 0)
      const dueDate = wo.dueDate ? new Date(wo.dueDate) : null
      if (dueDate) dueDate.setHours(0, 0, 0, 0)

      if (wo.status === 'MISSED' || wo.status === 'SKIPPED') {
        // MISSED or SKIPPED - needs rescheduling
        toReschedule.push(wo)
      } else if (wo.status === 'PENDING') {
        // PENDING: Past dates awaiting validation
        toValidate.push(wo)
      } else if (wo.status === 'PLANNED' && scheduleDate < today) {
        // PLANNED with past date (CRON hasn't run yet) - needs validation
        toValidate.push(wo)
      } else if (wo.status === 'PLANNED') {
        // Check if PLANNED item is at risk (r1PlannedDate >= dueDate - 5 days)
        if (isAtRisk(wo.r1PlannedDate, wo.dueDate, wo.status)) {
          atRisk.push(wo)
        }
      }
    })

    return {
      toValidate, // Remove the 50-item limit
      toReschedule,
      completed,
      atRisk,
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
      case 'at_risk':
        return categorized.atRisk
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
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="ml-64 overflow-auto p-4">
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
                    setActiveTab('at_risk')
                    setSelectedIds(new Set())
                    setBulkAction(null)
                  }}
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${
                    activeTab === 'at_risk'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  At Risk ({categorized.atRisk.length})
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
                  Completed
                </button>
                <button
                  onClick={() => {
                    setActiveTab('daily_report')
                    setSelectedIds(new Set())
                    setBulkAction(null)
                  }}
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${
                    activeTab === 'daily_report'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Daily Report
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'daily_report' ? (
                <DailyReport 
                  workOrders={workOrders} 
                  isLoading={isLoading} 
                  error={error} 
                  onRefresh={mutate}
                  itemsToValidateCount={categorized.toValidate.length}
                />
              ) : isLoading ? (
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
                    : `No work orders in "${activeTab === 'to_validate' ? 'To be validated' : activeTab === 'to_reschedule' ? 'To be rescheduled' : activeTab === 'at_risk' ? 'At Risk' : activeTab === 'completed' ? 'Completed' : 'Unknown'}" category.`}
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
                  {activeTab === 'completed' && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span>
                          Showing completed work orders from the last <strong>{data?.meta?.completedDaysFilter || completedDays} days</strong>.
                          {data?.meta?.totalReturned && (
                            <span className="ml-2">({data.meta.totalReturned} total items loaded)</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-blue-700">
                            Days to show:
                            <select
                              value={completedDays}
                              onChange={(e) => {
                                setCompletedDays(parseInt(e.target.value, 10))
                                setIncludeOldCompleted(false)
                              }}
                              className="ml-2 px-2 py-1 text-xs border border-blue-300 rounded bg-white text-gray-900"
                            >
                              <option value={30}>30 days</option>
                              <option value={60}>60 days</option>
                              <option value={90}>90 days</option>
                              <option value={180}>180 days</option>
                              <option value={365}>1 year</option>
                            </select>
                          </label>
                          <label className="flex items-center gap-1 text-xs text-blue-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={includeOldCompleted}
                              onChange={(e) => setIncludeOldCompleted(e.target.checked)}
                              className="w-3 h-3 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
                            />
                            <span>Show all completed</span>
                          </label>
                        </div>
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
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                            MTR Start Date
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                            {activeTab === 'to_reschedule' ? 'Last Missed Date' : 'Planned Date'}
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">
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
                            <td className="px-4 py-3 text-sm text-gray-900 text-center">
                              {wo.mtrPlannedStartDate
                                ? new Date(wo.mtrPlannedStartDate).toLocaleDateString()
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-center">
                              {activeTab === 'to_reschedule' 
                                ? (wo.lastSkippedDate ? new Date(wo.lastSkippedDate).toLocaleDateString() : '-')
                                : (wo.r1PlannedDate ? new Date(wo.r1PlannedDate).toLocaleDateString() : '-')}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-center">
                              {wo.dueDate ? new Date(wo.dueDate).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {(() => {
                                const scheduleDate = wo.r1PlannedDate ? new Date(wo.r1PlannedDate) : null
                                if (scheduleDate) scheduleDate.setHours(0, 0, 0, 0)
                                const today = new Date()
                                today.setHours(0, 0, 0, 0)

                                // Status display logic aligned with new status flow
                                let displayStatus = wo.status
                                let statusClass = 'bg-gray-100 text-gray-700'

                                if (wo.status === 'COMPLETED') {
                                  displayStatus = wo.isLate ? 'Completed (Late)' : 'Completed'
                                  statusClass = 'bg-green-100 text-green-800'
                                } else if (wo.status === 'MISSED') {
                                  displayStatus = 'Missed'
                                  statusClass = 'bg-red-100 text-red-800'
                                } else if (wo.status === 'SKIPPED') {
                                  displayStatus = 'Skipped'
                                  statusClass = 'bg-orange-100 text-orange-800'
                                } else if (wo.status === 'PENDING') {
                                  displayStatus = 'Pending'
                                  statusClass = 'bg-yellow-100 text-yellow-800'
                                } else if (wo.status === 'PLANNED') {
                                  // PLANNED status - check if date is in future or past
                                  if (scheduleDate && scheduleDate >= today) {
                                    displayStatus = wo.isLate ? 'Planned (Late)' : 'Planned'
                                    statusClass = 'bg-blue-100 text-blue-800'
                                  } else {
                                    // PLANNED with past date (CRON hasn't run yet) - show as Pending
                                    displayStatus = 'Pending'
                                    statusClass = 'bg-yellow-100 text-yellow-800'
                                  }
                                } else if (wo.status === 'CANCELLED') {
                                  displayStatus = 'Cancelled'
                                  statusClass = 'bg-gray-100 text-gray-600'
                                } else {
                                  // Unknown status - fallback
                                  displayStatus = wo.status
                                  statusClass = 'bg-gray-100 text-gray-700'
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
                                    <>
                                      {wo.status === 'SKIPPED' ? (
                                        <a
                                          href={`/reschedule?scheduleId=${wo.id}`}
                                          className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors relative group inline-block"
                                          title="Reschedule"
                                        >
                                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path fillRule="evenodd" clipRule="evenodd" d="M12.3096 18.8877C12.0558 19.1415 11.6442 19.1415 11.3904 18.8877C11.1365 18.6338 11.1365 18.2223 11.3904 17.9684L17.1536 12.2061L4.65001 12.2055C4.32366 12.2055 4.05348 11.9649 4.00706 11.6515L4.00001 11.5555C4.00001 11.1965 4.29102 10.9055 4.65001 10.9055L17.1536 10.9061L11.3575 5.1096C11.1291 4.88114 11.1062 4.52493 11.289 4.27092L11.3575 4.19036C11.6114 3.93652 12.0229 3.93652 12.2768 4.19036L19.1822 11.0958C19.4361 11.3497 19.4361 11.7612 19.1822 12.0151L12.3096 18.8877Z" fill="currentColor"/>
                                          </svg>
                                          <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                                            Reschedule
                                          </span>
                                        </a>
                                      ) : wo.status === 'MISSED' ? (
                                        <span className="p-1.5 text-gray-400 cursor-not-allowed" title="Cannot reschedule - deadline has passed">
                                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path fillRule="evenodd" clipRule="evenodd" d="M12.3096 18.8877C12.0558 19.1415 11.6442 19.1415 11.3904 18.8877C11.1365 18.6338 11.1365 18.2223 11.3904 17.9684L17.1536 12.2061L4.65001 12.2055C4.32366 12.2055 4.05348 11.9649 4.00706 11.6515L4.00001 11.5555C4.00001 11.1965 4.29102 10.9055 4.65001 10.9055L17.1536 10.9061L11.3575 5.1096C11.1291 4.88114 11.1062 4.52493 11.289 4.27092L11.3575 4.19036C11.6114 3.93652 12.0229 3.93652 12.2768 4.19036L19.1822 11.0958C19.4361 11.3497 19.4361 11.7612 19.1822 12.0151L12.3096 18.8877Z" fill="currentColor"/>
                                          </svg>
                                        </span>
                                      ) : null}
                                    </>
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

// Daily Report Component
function DailyReport({ 
  workOrders, 
  isLoading, 
  error, 
  onRefresh,
  itemsToValidateCount
}: { 
  workOrders: WorkOrder[]
  isLoading: boolean
  error: any
  onRefresh: () => void
  itemsToValidateCount: number
}) {
  const reportRef = useRef<HTMLDivElement>(null)
  const [showValidationWarning, setShowValidationWarning] = useState(false)
  
  // Show warning on initial load if there are items to validate
  useEffect(() => {
    if (itemsToValidateCount > 0 && !isLoading) {
      setShowValidationWarning(true)
    }
  }, [itemsToValidateCount, isLoading])
  
  const handleRefresh = () => {
    if (itemsToValidateCount > 0) {
      setShowValidationWarning(true)
    }
    onRefresh()
  }
  
  const exportToPDF = async () => {
    if (!reportRef.current) return
    
    try {
      // Hide the buttons and warning message before capturing
      const buttons = reportRef.current.querySelectorAll('button')
      buttons.forEach(btn => {
        btn.style.display = 'none'
      })
      
      // Hide warning message if present
      const warningElement = reportRef.current.querySelector('[data-pdf-exclude="true"]')
      if (warningElement) {
        ;(warningElement as HTMLElement).style.display = 'none'
      }
      
      // Capture the report as canvas
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      })
      
      // Show buttons and warning again
      buttons.forEach(btn => {
        btn.style.display = ''
      })
      if (warningElement && showValidationWarning) {
        ;(warningElement as HTMLElement).style.display = ''
      }
      
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      
      // Add lateral margins (10mm on each side)
      const marginLeft = 10
      const marginRight = 10
      const pageWidth = 210 // A4 width in mm
      const pageHeight = 297 // A4 height in mm
      const contentWidth = pageWidth - marginLeft - marginRight
      
      const imgWidth = contentWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      
      let position = 0
      
      // Add first page
      pdf.addImage(imgData, 'PNG', marginLeft, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      
      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', marginLeft, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      
      // Generate filename with date
      const today = new Date()
      const dateStr = today.toISOString().split('T')[0]
      pdf.save(`Daily-Backlog-Report-${dateStr}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }
  const reportData = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const notRescheduled: WorkOrder[] = []
    const newItems: WorkOrder[] = []
    const otherPendingItems: WorkOrder[] = []
    const completedYesterday: WorkOrder[] = []
    
    workOrders.forEach((wo) => {
      // Check original planned date (r0PlannedDate) for date comparisons
      const r0Date = wo.r0PlannedDate ? new Date(wo.r0PlannedDate) : null
      if (r0Date) r0Date.setHours(0, 0, 0, 0)
      
      const isMissed = wo.status === 'MISSED'
      const isSkipped = wo.status === 'SKIPPED'
      const isCompleted = wo.status === 'COMPLETED'
      const isPending = wo.status === 'PENDING'
      
      // Items pending rescheduling: SKIPPED or MISSED status (no scheduled date)
      // Per STATUS_FLOW.md: status = 'SKIPPED' OR 'MISSED', r1PlannedDate IS NULL
      if ((isSkipped || isMissed) && !wo.r1PlannedDate) {
        notRescheduled.push(wo)
        return // Skip further processing for these items
      }
      
      // Items with r1PlannedDate (scheduled items)
      if (!wo.r1PlannedDate) {
        // Skip items without r1PlannedDate that aren't SKIPPED/MISSED (shouldn't happen, but handle gracefully)
        return
      }
      
      const r1Date = new Date(wo.r1PlannedDate)
      r1Date.setHours(0, 0, 0, 0)
      
      // Note: completionDate not available (visits not fetched for performance)
      // For Daily Report, we use status and dates instead
      const completionDate = null
      
      // Completed yesterday: items that were in backlog but completed yesterday
      // These are items that were past their WM Planned Date or had been rescheduled
      if (completionDate && isCompleted) {
        const completionDateOnly = new Date(completionDate)
        completionDateOnly.setHours(0, 0, 0, 0)
        if (completionDateOnly.getTime() === yesterday.getTime()) {
          // Check if it was previously in backlog:
          // 1. Was past WM Planned Date (r0PlannedDate < yesterday)
          // 2. Had been rescheduled (r1PlannedDate !== r0PlannedDate)
          const r0DateStr = wo.r0PlannedDate ? new Date(wo.r0PlannedDate).toISOString().split('T')[0] : null
          const r1DateStr = wo.r1PlannedDate ? new Date(wo.r1PlannedDate).toISOString().split('T')[0] : null
          const wasRescheduled = r0DateStr && r1DateStr && r0DateStr !== r1DateStr
          const wasPastPlannedDate = r0Date && r0Date < yesterday
          
          if (wasRescheduled || wasPastPlannedDate) {
            completedYesterday.push(wo)
          }
        }
        return // Skip further processing for completed items
      }
      
      // Items rescheduled, pending completion: PLANNED with skippedCount > 0
      // Per STATUS_FLOW.md: status = 'PLANNED', skippedCount > 0, r1PlannedDate IS NOT NULL
      if (wo.status === 'PLANNED' && wo.skippedCount && wo.skippedCount > 0 && wo.r1PlannedDate) {
        // Check if newly rescheduled (lastSkippedDate = yesterday)
        const lastSkipped = wo.lastSkippedDate ? new Date(wo.lastSkippedDate) : null
        if (lastSkipped) {
          lastSkipped.setHours(0, 0, 0, 0)
          if (lastSkipped.getTime() === yesterday.getTime()) {
            // Newly rescheduled items
            newItems.push(wo)
          } else {
            // Other rescheduled items (not newly rescheduled)
            if (!notRescheduled.includes(wo) && !newItems.includes(wo)) {
              otherPendingItems.push(wo)
            }
          }
        } else {
          // Rescheduled but no lastSkippedDate (shouldn't happen, but handle gracefully)
          // Still include in otherPendingItems if it has skippedCount > 0
          if (!notRescheduled.includes(wo) && !newItems.includes(wo)) {
            otherPendingItems.push(wo)
          }
        }
      }
    })
    
    return { notRescheduled, newItems, otherPendingItems, completedYesterday }
  }, [workOrders])
  
  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  
  const getPlanningDeviation = (wo: WorkOrder) => {
    if (!wo.mtrPlannedStartDate || !wo.r1PlannedDate) return null
    return calculatePlanningDeviation(
      new Date(wo.r1PlannedDate),
      new Date(wo.mtrPlannedStartDate)
    )
  }
  
  const getActualCompletionDate = (wo: WorkOrder) => {
    // Visits not fetched for performance - return '-' for now
    // TODO: Add completionDate field to Schedule model if needed
    return '-'
  }
  
  const getRescheduledDate = (wo: WorkOrder) => {
    // If r1PlannedDate is different from r0PlannedDate, it's been rescheduled
    const r0Date = wo.r0PlannedDate ? new Date(wo.r0PlannedDate).toISOString().split('T')[0] : null
    const r1Date = wo.r1PlannedDate ? new Date(wo.r1PlannedDate).toISOString().split('T')[0] : null
    if (r0Date && r1Date && r0Date !== r1Date) {
      return formatDate(wo.r1PlannedDate)
    }
    return '-'
  }
  
  const renderTable = (items: WorkOrder[], title: string, icon?: React.ReactNode, showCompletionDate?: boolean, showLastMissedDate?: boolean, showRescheduledDate?: boolean) => {
    if (items.length === 0) return null
    
    return (
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center gap-2">
          {icon && <span className="inline-flex items-center">{icon}</span>}
          {title} ({items.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase border border-slate-700 text-white">Equipment No.</th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase border border-slate-700 text-white">WO Number</th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase border border-slate-700 text-white">MTR Planned Date</th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase border border-slate-700 text-white">Due Date</th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase border border-slate-700 text-white">Planning deviation</th>
                {showCompletionDate ? (
                  <th className="px-4 py-2 text-center text-xs font-semibold uppercase border border-slate-700 text-white">Completion Date</th>
                ) : showLastMissedDate ? (
                  <th className="px-4 py-2 text-center text-xs font-semibold uppercase border border-slate-700 text-white">Last Missed Date</th>
                ) : showRescheduledDate ? (
                  <>
                    <th className="px-4 py-2 text-center text-xs font-semibold uppercase border border-slate-700 text-white">Last Missed Date</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold uppercase border border-slate-700 text-white">Rescheduled Date</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {items.map((wo) => {
                const deviation = getPlanningDeviation(wo)
                return (
                  <tr key={wo.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm border border-gray-200 text-gray-900 text-left">{wo.equipment.equipmentNumber}</td>
                    <td className="px-4 py-2 text-sm border border-gray-200 text-gray-900 text-center">{wo.workOrderNumber}</td>
                    <td className="px-4 py-2 text-sm border border-gray-200 text-gray-900 text-center">{formatDate(wo.mtrPlannedStartDate)}</td>
                    <td className="px-4 py-2 text-sm border border-gray-200 text-gray-900 text-center">{formatDate(wo.dueDate)}</td>
                    <td className={`px-4 py-2 text-sm border border-gray-200 text-center text-gray-900 ${deviation && deviation > 0 ? 'bg-yellow-100 font-semibold' : ''}`}>
                      {deviation !== null ? `${deviation} days` : '-'}
                    </td>
                    {showCompletionDate ? (
                      <td className="px-4 py-2 text-sm border border-gray-200 text-gray-900 text-center">{getActualCompletionDate(wo)}</td>
                    ) : showLastMissedDate ? (
                      <td className="px-4 py-2 text-sm border border-gray-200 text-gray-900 text-center">
                        {wo.lastSkippedDate ? formatDate(wo.lastSkippedDate) : (wo.r1PlannedDate ? formatDate(wo.r1PlannedDate) : formatDate(wo.r0PlannedDate))}
                      </td>
                    ) : showRescheduledDate ? (
                      <>
                        <td className="px-4 py-2 text-sm border border-gray-200 text-gray-900 text-center">
                          {wo.lastSkippedDate ? formatDate(wo.lastSkippedDate) : '-'}
                        </td>
                        <td className="px-4 py-2 text-sm border border-gray-200 text-gray-900 text-center">{getRescheduledDate(wo)}</td>
                      </>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
  
  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading daily report...
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        Error loading report. Please try again.
      </div>
    )
  }
  
  const today = new Date()
  const reportDate = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  
  return (
    <div ref={reportRef} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Daily Backlog Report</h2>
          <p className="text-sm text-gray-600 mt-1">Report Date: {reportDate}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
            title="Refresh Report"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-slate-800 text-white rounded hover:bg-slate-700 transition-colors"
            title="Export PDF"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>
      
      {/* Validation Warning */}
      {showValidationWarning && itemsToValidateCount > 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg" data-pdf-exclude="true">
          <div className="flex items-start gap-3">
            <svg 
              className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
                clipRule="evenodd" 
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                Warning: {itemsToValidateCount} item{itemsToValidateCount !== 1 ? 's' : ''} pending validation
              </h3>
              <p className="text-sm text-yellow-700">
                Some items may not appear in this report because their status is unknown and needs to be reviewed. 
                Please check the &quot;To be validated&quot; tab to review these items.
              </p>
            </div>
            <button
              onClick={() => setShowValidationWarning(false)}
              className="text-yellow-600 hover:text-yellow-800 flex-shrink-0"
              aria-label="Dismiss warning"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Not Rescheduled Section (Flagged at top) */}
      {renderTable(
        reportData.notRescheduled,
        reportData.notRescheduled.length > 0 ? 'Items Pending Rescheduling' : 'Items Requiring Immediate Attention',
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-700">
          <path fillRule="evenodd" clipRule="evenodd" d="M13.0361 2.22869C13.3934 2.42518 13.6874 2.71919 13.8839 3.07643L22.347 18.4639C22.9192 19.5043 22.5396 20.8116 21.4992 21.3839C21.1818 21.5585 20.8254 21.65 20.4631 21.65H3.5369C2.34949 21.65 1.3869 20.6874 1.3869 19.5C1.3869 19.1377 1.47845 18.7813 1.65304 18.4639L10.1161 3.07643C10.6884 2.036 11.9957 1.65646 13.0361 2.22869ZM11.2552 3.70293L2.79212 19.0904C2.72309 19.2159 2.6869 19.3568 2.6869 19.5C2.6869 19.9694 3.06746 20.35 3.5369 20.35H20.4631C20.6063 20.35 20.7472 20.3138 20.8727 20.2448C21.2841 20.0186 21.4341 19.5017 21.2079 19.0904L12.7448 3.70293C12.6671 3.56169 12.5509 3.44545 12.4096 3.36777C11.9983 3.14154 11.4814 3.29159 11.2552 3.70293ZM12 16C12.5523 16 13 16.4477 13 17C13 17.5523 12.5523 18 12 18C11.4477 18 11 17.5523 11 17C11 16.4477 11.4477 16 12 16ZM12 8C12.359 8 12.65 8.29101 12.65 8.65V14.027C12.65 14.386 12.359 14.677 12 14.677C11.641 14.677 11.35 14.386 11.35 14.027V8.65C11.35 8.29101 11.641 8 12 8Z" fill="currentColor"/>
        </svg>,
        false,
        true // Show Last Missed Date for items pending rescheduling
      )}
      
      {/* New Items Section */}
      {renderTable(
        reportData.newItems,
        'Newly Rescheduled Items (originally scheduled yesterday)',
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-700">
          <path fillRule="evenodd" clipRule="evenodd" d="M14.485 3.27554L20.163 3.98438C21.2591 4.12122 22.0367 5.12067 21.8998 6.21674C21.8973 6.23715 21.8944 6.25752 21.8912 6.27785L21.0076 11.9313C20.9273 12.4448 20.6503 12.9069 20.2352 13.2197L9.80322 21.0807C8.92107 21.7455 7.66707 21.5692 7.00232 20.6871L2.20802 14.3248C1.54327 13.4427 1.71951 12.1887 2.60166 11.5239L13.0336 3.66287C13.4487 3.35008 13.9693 3.21116 14.485 3.27554ZM4.88518 11.4301L3.38402 12.5621C3.07527 12.7948 3.01358 13.2337 3.24625 13.5425L8.04055 19.9047C8.27321 20.2135 8.71211 20.2751 9.02086 20.0425L10.5222 18.9101L4.88518 11.4301ZM13.816 4.70109L5.92418 10.6471L11.5612 18.1271L19.4528 12.1814C19.5981 12.072 19.6951 11.9102 19.7232 11.7305L20.6068 6.07708L20.6098 6.05569C20.6577 5.67207 20.3856 5.32226 20.002 5.27437L14.324 4.56553C14.1435 4.543 13.9613 4.59162 13.816 4.70109ZM15.75 6.35C17.075 6.35 18.15 7.42502 18.15 8.75C18.15 10.075 17.075 11.15 15.75 11.15C14.425 11.15 13.35 10.075 13.35 8.75C13.35 7.42502 14.425 6.35 15.75 6.35ZM15.75 7.65C15.143 7.65 14.65 8.14299 14.65 8.75C14.65 9.35702 15.143 9.85 15.75 9.85C16.357 9.85 16.85 9.35702 16.85 8.75C16.85 8.14299 16.357 7.65 15.75 7.65Z" fill="currentColor"/>
        </svg>,
        false,
        false,
        true // Show rescheduled date with last missed date
      )}
      
      {/* Other Pending Items Section */}
      {renderTable(
        reportData.otherPendingItems,
        'Other Rescheduled Items',
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-700">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 2.75C17.1086 2.75 21.25 6.89137 21.25 12C21.25 17.1086 17.1086 21.25 12 21.25C6.89137 21.25 2.75 17.1086 2.75 12C2.75 6.89137 6.89137 2.75 12 2.75ZM12 4.25C7.71979 4.25 4.25 7.71979 4.25 12C4.25 16.2802 7.71979 19.75 12 19.75C16.2802 19.75 19.75 16.2802 19.75 12C19.75 7.71979 16.2802 4.25 12 4.25ZM12 6.15773C12.4142 6.15773 12.75 6.49352 12.75 6.90773V11.7138L14.9458 14.1716C15.2218 14.4805 15.1951 14.9546 14.8862 15.2306C14.5773 15.5065 14.1031 15.4798 13.8272 15.1709L11.4407 12.4997C11.3179 12.3622 11.25 12.1843 11.25 12V6.90773C11.25 6.49352 11.5858 6.15773 12 6.15773Z" fill="currentColor"/>
        </svg>,
        false,
        false,
        true // Show rescheduled date with last missed date
      )}
      
      {/* Completed Yesterday Section */}
      {renderTable(
        reportData.completedYesterday,
        'Completed Yesterday (previously in backlog)',
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-700">
          <path fillRule="evenodd" clipRule="evenodd" d="M19.65 5.73077L15.7692 1.85001H6.49998L6.34643 1.8554C5.23068 1.93413 4.34998 2.86422 4.34998 4.00001V20L4.35537 20.1535C4.4341 21.2693 5.36419 22.15 6.49998 22.15H17.5L17.6535 22.1446C18.7693 22.0659 19.65 21.1358 19.65 20V5.73077ZM6.49998 3.15001H14.549L14.55 5.50001L14.556 5.64237C14.6282 6.48699 15.3367 7.15001 16.2 7.15001H18.349L18.35 20L18.3434 20.1066C18.2909 20.5257 17.9333 20.85 17.5 20.85H6.49998L6.39335 20.8434C5.97424 20.7909 5.64998 20.4333 5.64998 20V4.00001L5.6566 3.89338C5.70905 3.47427 6.06664 3.15001 6.49998 3.15001ZM15.85 5.50001L15.849 3.76901L17.93 5.85001H16.2L16.1294 5.8429C15.9699 5.81026 15.85 5.66914 15.85 5.50001ZM9.41865 12.533L11.2851 13.96L14.5995 9.68466C14.7972 9.385 15.2004 9.30234 15.5 9.50002C15.7997 9.6977 15.8823 10.1009 15.6847 10.4005L11.915 15.3659C11.6832 15.7174 11.1835 15.759 10.8966 15.4508L8.46698 13.4186C8.22242 13.1559 8.23721 12.7446 8.5 12.5C8.76279 12.2554 9.17409 12.2702 9.41865 12.533Z" fill="currentColor"/>
        </svg>,
        true
      )}
      
      {/* Empty State */}
      {reportData.notRescheduled.length === 0 && 
       reportData.newItems.length === 0 && 
       reportData.otherPendingItems.length === 0 &&
       reportData.completedYesterday.length === 0 && (
        <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
          <p className="text-lg font-medium mb-2">No items in backlog</p>
          <p className="text-sm">All work orders are on track.</p>
        </div>
      )}
    </div>
  )
}

