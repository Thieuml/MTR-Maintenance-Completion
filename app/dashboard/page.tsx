'use client'

import { useState, useMemo, useEffect } from 'react'
import { Navigation } from '@/components/shared/Navigation'
import { useZones } from '@/lib/hooks'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

type IndicatorId = '1' | '2' | '3' | '4'

export default function AnalyticsPage() {
  const { zones } = useZones()
  const [selectedZoneId, setSelectedZoneId] = useState<string>('')
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorId | null>(null)
  
  // Month selection - default logic: before 5th = last month, after 5th = current month
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date()
    const dayOfMonth = today.getDate()
    
    if (dayOfMonth < 5) {
      // Show last month
      const lastMonth = new Date(today)
      lastMonth.setMonth(today.getMonth() - 1)
      const year = lastMonth.getFullYear()
      const month = String(lastMonth.getMonth() + 1).padStart(2, '0')
      return `${year}-${month}`
    } else {
      // Show current month
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      return `${year}-${month}`
    }
  })

  // Reset selected indicator when month or zone changes
  useEffect(() => {
    setSelectedIndicator(null)
  }, [selectedMonth, selectedZoneId])

  // Calculate start and end dates from selected month
  const { startDate, endDate } = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number)
    
    // Create dates at midnight local time to avoid timezone issues
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0) // Last day of month
    
    // Format as YYYY-MM-DD in local timezone
    const formatLocalDate = (date: Date) => {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
    
    return {
      startDate: formatLocalDate(start),
      endDate: formatLocalDate(end),
    }
  }, [selectedMonth])

  // Build API URL - always fetch, optionally include details
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams({
      startDate,
      endDate,
    })
    if (selectedZoneId) {
      params.append('zoneId', selectedZoneId)
    }
    if (selectedIndicator) {
      params.append('includeDetails', selectedIndicator)
    }
    return `/api/analytics/kpi?${params.toString()}`
  }, [startDate, endDate, selectedZoneId, selectedIndicator])

  const { data, error, isLoading } = useSWR(apiUrl, fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    keepPreviousData: true, // Keep previous data visible while loading new data
    dedupingInterval: 0,
  })

  // Check if current data matches the selected filters (to handle stale data during month/zone changes)
  const isDataStale = data && data.period && (
    data.period.startDate !== startDate || 
    data.period.endDate !== endDate
  )
  
  // Show loading if data is stale or actually loading
  const effectivelyLoading = isLoading || isDataStale

  // Generate list of available months (up to current month)
  const availableMonths = useMemo(() => {
    const months: Array<{ value: string; label: string }> = []
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth()

    // Go back 12 months from current month
    for (let i = 0; i <= 12; i++) {
      const date = new Date(currentYear, currentMonth - i, 1)
      
      // Format value in local timezone (not UTC) to match our date calculations
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const value = `${year}-${month}`
      
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      months.push({ value, label })
    }

    return months
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="ml-64 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
            <p className="text-sm text-gray-600">
              Key Performance Indicators for preventive maintenance operations
            </p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-1">
                  Month
                </label>
                <select
                  id="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {availableMonths.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="zone" className="block text-sm font-medium text-gray-700 mb-1">
                  Zone
                </label>
                <select
                  id="zone"
                  value={selectedZoneId}
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                  className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">All Zones</option>
                  {zones.map((zone: any) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.code} - {zone.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => {
                    const today = new Date()
                    const dayOfMonth = today.getDate()
                    
                    if (dayOfMonth < 5) {
                      const lastMonth = new Date(today)
                      lastMonth.setMonth(today.getMonth() - 1)
                      const year = lastMonth.getFullYear()
                      const month = String(lastMonth.getMonth() + 1).padStart(2, '0')
                      setSelectedMonth(`${year}-${month}`)
                    } else {
                      const year = today.getFullYear()
                      const month = String(today.getMonth() + 1).padStart(2, '0')
                      setSelectedMonth(`${year}-${month}`)
                    }
                    setSelectedZoneId('')
                    setSelectedIndicator(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Loading/Error States */}
          {effectivelyLoading && (isDataStale || !data) && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading analytics...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">Error loading analytics</p>
              <p className="text-red-600 text-sm mt-1">{error.message}</p>
            </div>
          )}

          {/* KPI Summary Cards - Top Row */}
          {data && data.indicator1_asPlannedCompletion && !isDataStale && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {/* Indicator 1: As-Planned Completion Rate */}
                <button
                  onClick={() => setSelectedIndicator(selectedIndicator === '1' ? null : '1')}
                  className={`text-left rounded-lg shadow-sm p-4 border-l-4 transition-all ${
                    selectedIndicator === '1'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-600 bg-white hover:border-gray-800'
                  }`}
                >
                  <div className="text-xs font-medium text-gray-600 uppercase">Completion Rate</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {data.indicator1_asPlannedCompletion.overall.completionRate}%
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {data.indicator1_asPlannedCompletion.overall.completedAsPlanned} /{' '}
                    {data.indicator1_asPlannedCompletion.overall.total} items
                  </div>
                </button>

                {/* Indicator 2: Reschedule Rate */}
                <button
                  onClick={() => setSelectedIndicator(selectedIndicator === '2' ? null : '2')}
                  className={`text-left rounded-lg shadow-sm p-4 border-l-4 transition-all ${
                    selectedIndicator === '2'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-600 bg-white hover:border-gray-800'
                  }`}
                >
                  <div className="text-xs font-medium text-gray-600 uppercase">Reschedule Rate</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {data.indicator2_rescheduleRate.rescheduleRate}%
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {data.indicator2_rescheduleRate.anyReschedule} /{' '}
                    {data.indicator2_rescheduleRate.totalCompleted} completed
                  </div>
                </button>

                {/* Indicator 3: Late Completion Rate (swapped with 4) */}
                <button
                  onClick={() => setSelectedIndicator(selectedIndicator === '3' ? null : '3')}
                  className={`text-left rounded-lg shadow-sm p-4 border-l-4 transition-all ${
                    selectedIndicator === '3'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-600 bg-white hover:border-gray-800'
                  }`}
                >
                  <div className="text-xs font-medium text-gray-600 uppercase">Late Completion</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {data.indicator4_lateCompletionRate.lateCompletionRate}%
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {data.indicator4_lateCompletionRate.lateCompletions} /{' '}
                    {data.indicator4_lateCompletionRate.totalCompleted} completed
                  </div>
                </button>

                {/* Indicator 4: Deviation from MTR (swapped with 3) */}
                <button
                  onClick={() => setSelectedIndicator(selectedIndicator === '4' ? null : '4')}
                  className={`text-left rounded-lg shadow-sm p-4 border-l-4 transition-all ${
                    selectedIndicator === '4'
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-600 bg-white hover:border-gray-800'
                  }`}
                >
                  <div className="text-xs font-medium text-gray-600 uppercase">MTR Deviation</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {data.indicator3_deviationFromMTR.avgDeviationDays > 0 ? '+' : ''}
                    {data.indicator3_deviationFromMTR.avgDeviationDays} days
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {data.indicator3_deviationFromMTR.itemsIncluded} completed
                  </div>
                </button>
              </div>

              {/* Expanded Details Section */}
              {selectedIndicator && (
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  {/* Show loading state for details */}
                  {effectivelyLoading && (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="mt-2 text-gray-600">Loading details...</p>
                    </div>
                  )}

                  {/* Show details once loaded */}
                  {!effectivelyLoading && data && (
                    <>
                      {/* Indicator 1 Details */}
                      {selectedIndicator === '1' && (
                        <div>
                          <h2 className="text-xl font-semibold text-gray-900 mb-2">
                            As-Planned Completion Rate
                          </h2>
                          <p className="text-sm text-gray-600 mb-4">
                            Of all work orders scheduled for a specific date, what percentage were completed as
                            planned versus skipped/rescheduled. This measures execution reliability.
                          </p>

                          {/* Summary Cards */}
                          <div className="grid grid-cols-3 gap-4 mb-6 max-w-3xl">
                            <div className="bg-white rounded-lg p-4 border-l-4 border-green-600 shadow-sm">
                              <div className="text-xs font-medium text-green-700 uppercase">Completed as Planned</div>
                              <div className="mt-1 text-2xl font-bold text-green-900">
                                {data.indicator1_asPlannedCompletion.overall.completedAsPlanned}
                              </div>
                            </div>
                            <div className="bg-white rounded-lg p-4 border-l-4 border-orange-600 shadow-sm">
                              <div className="text-xs font-medium text-orange-700 uppercase">Skipped</div>
                              <div className="mt-1 text-2xl font-bold text-orange-900">
                                {data.indicator1_asPlannedCompletion.overall.skipped}
                              </div>
                            </div>
                            <div className="bg-white rounded-lg p-4 border-l-4 border-gray-600 shadow-sm">
                              <div className="text-xs font-medium text-gray-700 uppercase">Still Pending</div>
                              <div className="mt-1 text-2xl font-bold text-gray-900">
                                {data.indicator1_asPlannedCompletion.overall.pending}
                              </div>
                            </div>
                          </div>

                          {/* Daily Completion Rate - Stacked Bar + Line Chart */}
                          <div className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Daily Completion Rate</h3>
                            <div className="relative bg-white border border-gray-200 rounded-lg p-6">
                              {/* Chart container */}
                              <div className="relative" style={{ height: '300px' }}>
                                {/* Y-axis labels for count (left) */}
                                <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-600 pr-2">
                                  <span>
                                    {Math.max(
                                      ...data.indicator1_asPlannedCompletion.byDate.map((d: any) => d.total)
                                    )}
                                  </span>
                                  <span>
                                    {Math.round(
                                      Math.max(
                                        ...data.indicator1_asPlannedCompletion.byDate.map((d: any) => d.total)
                                      ) * 0.75
                                    )}
                                  </span>
                                  <span>
                                    {Math.round(
                                      Math.max(
                                        ...data.indicator1_asPlannedCompletion.byDate.map((d: any) => d.total)
                                      ) * 0.5
                                    )}
                                  </span>
                                  <span>
                                    {Math.round(
                                      Math.max(
                                        ...data.indicator1_asPlannedCompletion.byDate.map((d: any) => d.total)
                                      ) * 0.25
                                    )}
                                  </span>
                                  <span>0</span>
                                </div>

                                {/* Y-axis labels for percentage (right) */}
                                <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-600 pl-2">
                                  <span>100%</span>
                                  <span>75%</span>
                                  <span>50%</span>
                                  <span>25%</span>
                                  <span>0%</span>
                                </div>

                                {/* Chart area */}
                                <div className="absolute left-12 right-12 top-0 bottom-8 flex items-end justify-around gap-1">
                                  {data.indicator1_asPlannedCompletion.byDate.map((day: any, idx: number) => {
                                    const maxCount = Math.max(
                                      ...data.indicator1_asPlannedCompletion.byDate.map((d: any) => d.total)
                                    )
                                    const total = day.total
                                    
                                    // Calculate heights for stacked bars
                                    const completedHeight = maxCount > 0 ? (day.completedAsPlanned / maxCount) * 250 : 0
                                    const skippedHeight = maxCount > 0 ? (day.skipped / maxCount) * 250 : 0
                                    const pendingHeight = maxCount > 0 ? (day.pending / maxCount) * 250 : 0

                                    return (
                                      <div
                                        key={day.date}
                                        className="relative flex-1 flex flex-col items-center"
                                        style={{ height: '100%' }}
                                      >
                                        {/* Stacked bars */}
                                        <div className="absolute bottom-0 w-full flex flex-col items-center">
                                          {/* Total count on top */}
                                          <div className="text-xs font-semibold text-gray-900 mb-1">
                                            {total > 0 ? total : ''}
                                          </div>
                                          
                                          {/* Stacked bar segments */}
                                          <div className="w-full flex flex-col-reverse">
                                            {/* Pending (gray) - bottom */}
                                            {day.pending > 0 && (
                                              <div
                                                className="w-full bg-gray-400"
                                                style={{ height: `${pendingHeight}px` }}
                                                title={`Pending: ${day.pending}`}
                                              ></div>
                                            )}
                                            
                                            {/* Skipped (orange) - middle */}
                                            {day.skipped > 0 && (
                                              <div
                                                className="w-full bg-orange-500"
                                                style={{ height: `${skippedHeight}px` }}
                                                title={`Skipped: ${day.skipped}`}
                                              ></div>
                                            )}
                                            
                                            {/* Completed (green) - top */}
                                            {day.completedAsPlanned > 0 && (
                                              <div
                                                className="w-full bg-green-500 rounded-t"
                                                style={{ height: `${completedHeight}px` }}
                                                title={`Completed: ${day.completedAsPlanned}`}
                                              ></div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}

                                {/* Line chart overlay */}
                                  <svg
                                    className="absolute inset-0 pointer-events-none"
                                    viewBox="0 0 400 100"
                                    preserveAspectRatio="xMidYMid meet"
                                    style={{ width: '100%', height: '100%' }}
                                  >
                                  {(() => {
                                      const today = new Date()
                                      today.setHours(0, 0, 0, 0)
                                      
                                      const allDates = data.indicator1_asPlannedCompletion.byDate
                                      const totalDays = allDates.length
                                      
                                      // Build points only for dates up to today with data
                                      const points: Array<{ x: number; y: number; rate: number }> = []
                                      
                                      allDates.forEach((day: any, idx: number) => {
                                        const dayDate = new Date(day.date)
                                        dayDate.setHours(0, 0, 0, 0)
                                        
                                        // Only include past dates with data
                                        if (dayDate <= today && day.total > 0) {
                                          const x = ((idx + 0.5) / totalDays) * 400
                                          const y = 100 - day.completionRate
                                          points.push({ x, y, rate: day.completionRate })
                                        }
                                      })
                                      
                                      if (points.length === 0) return null
                                      
                                      return (
                                        <>
                                          <polyline
                                            points={points.map(p => `${p.x},${p.y}`).join(' ')}
                                            fill="none"
                                            stroke="#1e3a8a"
                                            strokeWidth="1.5"
                                            vectorEffect="non-scaling-stroke"
                                          />
                                          {/* Points with title for hover */}
                                          {points.map((point, idx) => (
                                            <circle
                                              key={idx}
                                              cx={point.x}
                                              cy={point.y}
                                              r="1.5"
                                              fill="#1e3a8a"
                                              className="pointer-events-auto cursor-pointer"
                                            >
                                              <title>{point.rate}%</title>
                                            </circle>
                                          ))}
                                        </>
                                      )
                                    })()}
                                  </svg>
                                </div>

                                {/* X-axis labels (dates) - show every 5 days */}
                                <div className="absolute left-12 right-12 bottom-0 flex justify-around text-xs text-gray-600">
                                  {data.indicator1_asPlannedCompletion.byDate.map((day: any, idx: number) => {
                                    // Get day of month
                                    const dayOfMonth = new Date(day.date).getDate()
                                    
                                    // Show label if it's day 1, 5, 10, 15, 20, 25, or last day of month
                                    const isLastDay = idx === data.indicator1_asPlannedCompletion.byDate.length - 1
                                    const shouldShow = dayOfMonth === 1 || dayOfMonth % 5 === 0 || isLastDay
                                    
                                    return (
                                      <div key={day.date} className="flex-1 text-center">
                                        {shouldShow ? (
                                          new Date(day.date).toLocaleDateString('en-US', {
                                            month: 'numeric',
                                            day: 'numeric',
                                          })
                                        ) : (
                                          ''
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* Legend */}
                              <div className="flex items-center justify-center gap-6 mt-4 text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                                  <span className="text-gray-700">Completed</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-4 h-4 bg-orange-500 rounded"></div>
                                  <span className="text-gray-700">Skipped</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-4 h-4 bg-gray-400 rounded"></div>
                                  <span className="text-gray-700">Pending</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-0.5 bg-blue-900"></div>
                                  <span className="text-gray-700">Completion Rate %</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Skipped Items Table */}
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">
                              Skipped Items (All Dates)
                            </h3>
                            {data.indicator1_asPlannedCompletion.skippedItems &&
                            data.indicator1_asPlannedCompletion.skippedItems.length > 0 ? (
                              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Equipment
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Work Order
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Zone
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Original Date
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Skipped On
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Rescheduled To
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {data.indicator1_asPlannedCompletion.skippedItems.map(
                                      (item: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                          <td className="px-4 py-2 text-sm text-gray-900">
                                            {item.equipmentNumber}
                                          </td>
                                          <td className="px-4 py-2 text-sm text-gray-900">
                                            {item.workOrderNumber}
                                          </td>
                                          <td className="px-4 py-2 text-sm text-gray-600">{item.zoneName}</td>
                                          <td className="px-4 py-2 text-sm text-gray-600">
                                            {new Date(item.originalDate).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric',
                                              year: 'numeric',
                                            })}
                                          </td>
                                          <td className="px-4 py-2 text-sm text-gray-600">
                                            {new Date(item.skippedDate).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric',
                                              year: 'numeric',
                                            })}
                                          </td>
                                          <td className="px-4 py-2 text-sm text-gray-600">
                                            {item.newDate
                                              ? new Date(item.newDate).toLocaleDateString('en-US', {
                                                  month: 'short',
                                                  day: 'numeric',
                                                  year: 'numeric',
                                                })
                                              : 'TBD'}
                                          </td>
                                        </tr>
                                      )
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-600">
                                No skipped items in this period
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Indicator 2 Details */}
                      {selectedIndicator === '2' && (
                        <div>
                          <h2 className="text-xl font-semibold text-gray-900 mb-2">
                            Work Order Reschedule Rate
                          </h2>
                          <p className="text-sm text-gray-600 mb-4">
                            Of all completed work orders, what percentage were rescheduled at least once before
                            completion. This measures schedule stability.
                          </p>

                          {/* Summary Cards */}
                          <div className="grid grid-cols-4 gap-4 mb-6 max-w-4xl">
                            <div className="bg-white rounded-lg p-4 border-l-4 border-green-600 shadow-sm">
                              <div className="text-xs font-medium text-green-700 uppercase">Never Rescheduled</div>
                              <div className="mt-1 text-2xl font-bold text-green-900">
                                {data.indicator2_rescheduleRate.neverRescheduled}
                              </div>
                            </div>
                            <div className="bg-white rounded-lg p-4 border-l-4 border-yellow-600 shadow-sm">
                              <div className="text-xs font-medium text-yellow-700 uppercase">Rescheduled Once</div>
                              <div className="mt-1 text-2xl font-bold text-yellow-900">
                                {data.indicator2_rescheduleRate.rescheduledOnce}
                              </div>
                            </div>
                            <div className="bg-white rounded-lg p-4 border-l-4 border-orange-600 shadow-sm">
                              <div className="text-xs font-medium text-orange-700 uppercase">Rescheduled Twice</div>
                              <div className="mt-1 text-2xl font-bold text-orange-900">
                                {data.indicator2_rescheduleRate.rescheduledTwice}
                              </div>
                            </div>
                            <div className="bg-white rounded-lg p-4 border-l-4 border-red-600 shadow-sm">
                              <div className="text-xs font-medium text-red-700 uppercase">Rescheduled 3+ Times</div>
                              <div className="mt-1 text-2xl font-bold text-red-900">
                                {data.indicator2_rescheduleRate.rescheduledThreePlus}
                              </div>
                            </div>
                          </div>

                          {/* Detailed Tables */}
                          <div className="space-y-6">
                            {/* Rescheduled Once */}
                            {data.indicator2_rescheduleRate.details?.rescheduledOnce &&
                              data.indicator2_rescheduleRate.details.rescheduledOnce.length > 0 && (
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                                    Rescheduled Once ({data.indicator2_rescheduleRate.rescheduledOnce} items)
                                  </h3>
                                  <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                            Equipment
                                          </th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                            Work Order
                                          </th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                            Zone
                                          </th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                            Completion Date
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {data.indicator2_rescheduleRate.details.rescheduledOnce.map(
                                          (item: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                              <td className="px-4 py-2 text-sm text-gray-900">
                                                {item.equipmentNumber}
                                              </td>
                                              <td className="px-4 py-2 text-sm text-gray-900">
                                                {item.workOrderNumber}
                                              </td>
                                              <td className="px-4 py-2 text-sm text-gray-600">{item.zoneName}</td>
                                              <td className="px-4 py-2 text-sm text-gray-600">
                                                {item.completionDate
                                                  ? new Date(item.completionDate).toLocaleDateString('en-US', {
                                                      month: 'short',
                                                      day: 'numeric',
                                                      year: 'numeric',
                                                    })
                                                  : 'N/A'}
                                              </td>
                                            </tr>
                                          )
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                            {/* Rescheduled Twice */}
                            {data.indicator2_rescheduleRate.details?.rescheduledTwice &&
                              data.indicator2_rescheduleRate.details.rescheduledTwice.length > 0 && (
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                                    Rescheduled Twice ({data.indicator2_rescheduleRate.rescheduledTwice} items)
                                  </h3>
                                  <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                            Equipment
                                          </th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                            Work Order
                                          </th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                            Zone
                                          </th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                            Completion Date
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {data.indicator2_rescheduleRate.details.rescheduledTwice.map(
                                          (item: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                              <td className="px-4 py-2 text-sm text-gray-900">
                                                {item.equipmentNumber}
                                              </td>
                                              <td className="px-4 py-2 text-sm text-gray-900">
                                                {item.workOrderNumber}
                                              </td>
                                              <td className="px-4 py-2 text-sm text-gray-600">{item.zoneName}</td>
                                              <td className="px-4 py-2 text-sm text-gray-600">
                                                {item.completionDate
                                                  ? new Date(item.completionDate).toLocaleDateString('en-US', {
                                                      month: 'short',
                                                      day: 'numeric',
                                                      year: 'numeric',
                                                    })
                                                  : 'N/A'}
                                              </td>
                                            </tr>
                                          )
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                            {/* Rescheduled 3+ Times */}
                            {data.indicator2_rescheduleRate.details?.rescheduledThreePlus &&
                              data.indicator2_rescheduleRate.details.rescheduledThreePlus.length > 0 && (
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                                    Rescheduled 3+ Times ({data.indicator2_rescheduleRate.rescheduledThreePlus}{' '}
                                    items)
                                  </h3>
                                  <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                      <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                            Equipment
                                          </th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                            Work Order
                                          </th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                            Zone
                                          </th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                            Times Rescheduled
                                          </th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                            Completion Date
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {data.indicator2_rescheduleRate.details.rescheduledThreePlus.map(
                                          (item: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                              <td className="px-4 py-2 text-sm text-gray-900">
                                                {item.equipmentNumber}
                                              </td>
                                              <td className="px-4 py-2 text-sm text-gray-900">
                                                {item.workOrderNumber}
                                              </td>
                                              <td className="px-4 py-2 text-sm text-gray-600">{item.zoneName}</td>
                                              <td className="px-4 py-2 text-sm font-semibold text-red-700">
                                                {item.skippedCount}x
                                              </td>
                                              <td className="px-4 py-2 text-sm text-gray-600">
                                                {item.completionDate
                                                  ? new Date(item.completionDate).toLocaleDateString('en-US', {
                                                      month: 'short',
                                                      day: 'numeric',
                                                      year: 'numeric',
                                                    })
                                                  : 'N/A'}
                                              </td>
                                            </tr>
                                          )
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                          </div>
                        </div>
                      )}

                      {/* Indicator 3 Details (Late Completion - swapped) */}
                      {selectedIndicator === '3' && (
                        <div>
                          <h2 className="text-xl font-semibold text-gray-900 mb-2">Late Completion Rate</h2>
                          <p className="text-sm text-gray-600 mb-4">
                            Of all completed work orders, what percentage were completed when scheduled close to
                            the deadline (within 6 days of due date). This measures execution urgency.
                          </p>

                          {/* Summary Cards */}
                          <div className="grid grid-cols-2 gap-4 mb-6 max-w-2xl">
                            <div className="bg-white rounded-lg p-4 border-l-4 border-red-600 shadow-sm">
                              <div className="text-xs font-medium text-red-700 uppercase">Late Completions</div>
                              <div className="mt-1 text-2xl font-bold text-red-900">
                                {data.indicator4_lateCompletionRate.lateCompletions}
                              </div>
                              <div className="mt-1 text-xs text-red-700">Within 6 days of deadline</div>
                            </div>
                            <div className="bg-white rounded-lg p-4 border-l-4 border-green-600 shadow-sm">
                              <div className="text-xs font-medium text-green-700 uppercase">On-Time Completions</div>
                              <div className="mt-1 text-2xl font-bold text-green-900">
                                {data.indicator4_lateCompletionRate.totalCompleted -
                                  data.indicator4_lateCompletionRate.lateCompletions}
                              </div>
                              <div className="mt-1 text-xs text-green-700">7+ days buffer</div>
                            </div>
                          </div>

                          {/* Late Completions List */}
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-2">
                              Late Completion Details
                            </h3>
                            {data.indicator4_lateCompletionRate.details?.lateCompletionItems &&
                            data.indicator4_lateCompletionRate.details.lateCompletionItems.length > 0 ? (
                              <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Equipment
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Work Order
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Zone
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Due Date
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Scheduled Date
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Completion Date
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Days Before Due
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {data.indicator4_lateCompletionRate.details.lateCompletionItems.map(
                                      (item: any, idx: number) => {
                                        // Calculate days before due date
                                        let daysBeforeDue = null
                                        if (item.r1PlannedDate && item.dueDate) {
                                          const plannedDate = new Date(item.r1PlannedDate)
                                          const dueDate = new Date(item.dueDate)
                                          plannedDate.setHours(0, 0, 0, 0)
                                          dueDate.setHours(0, 0, 0, 0)
                                          daysBeforeDue = Math.floor(
                                            (dueDate.getTime() - plannedDate.getTime()) /
                                              (1000 * 60 * 60 * 24)
                                          )
                                        }

                                        return (
                                          <tr key={idx} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 text-sm text-gray-900">
                                              {item.equipmentNumber}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-900">
                                              {item.workOrderNumber}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-600">{item.zoneName}</td>
                                            <td className="px-4 py-2 text-sm text-gray-600">
                                              {item.dueDate
                                                ? new Date(item.dueDate).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                  })
                                                : 'N/A'}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-600">
                                              {item.r1PlannedDate
                                                ? new Date(item.r1PlannedDate).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                  })
                                                : 'N/A'}
                                            </td>
                                            <td className="px-4 py-2 text-sm text-gray-600">
                                              {item.completionDate
                                                ? new Date(item.completionDate).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                  })
                                                : 'N/A'}
                                            </td>
                                            <td className="px-4 py-2 text-sm font-semibold text-red-700">
                                              {daysBeforeDue !== null ? `${daysBeforeDue} days` : 'N/A'}
                                            </td>
                                          </tr>
                                        )
                                      }
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-600">
                                No late completions in this period
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Indicator 4 Details (Deviation - swapped) */}
                      {selectedIndicator === '4' && (
                        <div>
                          <h2 className="text-xl font-semibold text-gray-900 mb-2">
                            Deviation from MTR Scheduled Date
                          </h2>
                          <p className="text-sm text-gray-600 mb-4">
                            Average number of days between when MTR originally scheduled work and when it was
                            actually completed. Negative = early, 0 = on-time, positive = later than planned.
                          </p>

                          {/* Summary Cards */}
                          <div className="grid grid-cols-3 gap-4 mb-6 max-w-3xl">
                            <div className="bg-white rounded-lg p-4 border-l-4 border-green-600 shadow-sm">
                              <div className="text-xs font-medium text-green-700 uppercase">Completed Early</div>
                              <div className="mt-1 text-2xl font-bold text-green-900">
                                {data.indicator3_deviationFromMTR.distribution.early}
                              </div>
                            </div>
                            <div className="bg-white rounded-lg p-4 border-l-4 border-blue-600 shadow-sm">
                              <div className="text-xs font-medium text-blue-700 uppercase">Same Day Completion</div>
                              <div className="mt-1 text-2xl font-bold text-blue-900">
                                {data.indicator3_deviationFromMTR.distribution.onTime}
                              </div>
                            </div>
                            <div className="bg-white rounded-lg p-4 border-l-4 border-orange-600 shadow-sm">
                              <div className="text-xs font-medium text-orange-700 uppercase">Completed Later</div>
                              <div className="mt-1 text-2xl font-bold text-orange-900">
                                {data.indicator3_deviationFromMTR.distribution.late}
                              </div>
                            </div>
                          </div>

                          {data.indicator3_deviationFromMTR.itemsExcluded > 0 && (
                            <div className="mb-4 text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-2">
                              ⚠️ {data.indicator3_deviationFromMTR.itemsExcluded} items excluded (missing
                              MTR reference date)
                            </div>
                          )}

                          {/* Non-Same Day Completions List */}
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-2">
                              Non-Same Day Completions
                            </h3>
                            {data.indicator3_deviationFromMTR.details?.nonSameDayCompletions &&
                            data.indicator3_deviationFromMTR.details.nonSameDayCompletions.length > 0 ? (
                              <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Equipment
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Work Order
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Zone
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        MTR Planned Date
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Completion Date
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                        Deviation (Days)
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {data.indicator3_deviationFromMTR.details.nonSameDayCompletions.map(
                                      (item: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                          <td className="px-4 py-2 text-sm text-gray-900">
                                            {item.equipmentNumber}
                                          </td>
                                          <td className="px-4 py-2 text-sm text-gray-900">
                                            {item.workOrderNumber}
                                          </td>
                                          <td className="px-4 py-2 text-sm text-gray-600">{item.zoneName}</td>
                                          <td className="px-4 py-2 text-sm text-gray-600">
                                            {item.mtrPlannedDate
                                              ? new Date(item.mtrPlannedDate).toLocaleDateString('en-US', {
                                                  month: 'short',
                                                  day: 'numeric',
                                                  year: 'numeric',
                                                })
                                              : 'N/A'}
                                          </td>
                                          <td className="px-4 py-2 text-sm text-gray-600">
                                            {item.completionDate
                                              ? new Date(item.completionDate).toLocaleDateString('en-US', {
                                                  month: 'short',
                                                  day: 'numeric',
                                                  year: 'numeric',
                                                })
                                              : 'N/A'}
                                          </td>
                                          <td
                                            className={`px-4 py-2 text-sm font-semibold ${
                                              item.deviationDays < 0
                                                ? 'text-green-700'
                                                : item.deviationDays > 0
                                                ? 'text-orange-700'
                                                : 'text-gray-900'
                                            }`}
                                          >
                                            {item.deviationDays > 0 ? '+' : ''}
                                            {item.deviationDays} days
                                            {item.deviationDays < 0 && ' (Early)'}
                                            {item.deviationDays > 0 && ' (Late)'}
                                          </td>
                                        </tr>
                                      )
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-600">
                                All items were completed on their MTR planned date
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
