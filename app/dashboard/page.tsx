'use client'

import { useState, useEffect } from 'react'
import { Navigation } from '@/components/Navigation'
import { useZones } from '@/lib/hooks'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface AnalyticsSummary {
  total: number
  totalDue: number // Total work orders with due date in the past
  completed: number
  completedDue: number // Completed work orders with due date in the past
  missed: number
  onTime: number
  late: number
  completionRate: number
  onTimeRate: number
  avgPlanningDeviation: number | null
  avgExecutionDeviation: number | null
}

interface GroupedData {
  [key: string]: {
    key: string
    total: number
    completed: number
    missed: number
    onTime: number
    late: number
    completionRate: number
    onTimeRate: number
    avgPlanningDeviation: number | null
    avgExecutionDeviation: number | null
  }
}

interface WorkOrderDetail {
  scheduleId: string
  equipmentNumber: string
  zoneCode: string
  r1PlannedDate: string
  dueDate?: string | null
  completionDate?: string | null
  executionDeviation?: number | null
  planningDeviation?: number | null
  mtrPlannedStartDate?: string | null
  workOrderNumber?: string | null
}

interface AnalyticsDetails {
  missedWorkOrders: WorkOrderDetail[]
  lateWorkOrders: WorkOrderDetail[]
  planningDeviationWorkOrders?: WorkOrderDetail[]
  executionDeviationWorkOrders?: WorkOrderDetail[]
}

export default function DashboardPage() {
  const { zones } = useZones()
  const [selectedZone, setSelectedZone] = useState<string>('all')
  const [selectedBatch, setSelectedBatch] = useState<'A' | 'B' | 'all'>('all')
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'batch' | 'zone'>('month')
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days ago
    to: new Date().toISOString().split('T')[0], // today
  })

  // Build API URL
  const buildApiUrl = () => {
    const params = new URLSearchParams()
    if (dateRange.from) params.append('from', dateRange.from)
    if (dateRange.to) params.append('to', dateRange.to)
    if (selectedZone !== 'all') params.append('zoneId', selectedZone)
    if (selectedBatch !== 'all') params.append('batch', selectedBatch)
    if (selectedPeriod) params.append('period', selectedPeriod)
    return `/api/analytics/maintenance?${params.toString()}`
  }

  const { data, error, isLoading } = useSWR<{
    summary: AnalyticsSummary
    grouped: GroupedData | null
    details: AnalyticsDetails
  }>(buildApiUrl(), fetcher)

  // Always provide default values to ensure structure is shown
  const summary: AnalyticsSummary = data?.summary || {
    total: 0,
    totalDue: 0,
    completed: 0,
    completedDue: 0,
    missed: 0,
    onTime: 0,
    late: 0,
    completionRate: 0,
    onTimeRate: 0,
    avgPlanningDeviation: null,
    avgExecutionDeviation: null,
  }
  const grouped = data?.grouped
  const details: AnalyticsDetails = data?.details || {
    missedWorkOrders: [],
    lateWorkOrders: [],
    planningDeviationWorkOrders: [],
    executionDeviationWorkOrders: [],
  }

  // Expandable sections state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set())
  
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const toggleDetails = (indicator: string) => {
    const newExpanded = new Set(expandedDetails)
    if (newExpanded.has(indicator)) {
      newExpanded.delete(indicator)
    } else {
      newExpanded.add(indicator)
    }
    setExpandedDetails(newExpanded)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Navigation />
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Maintenance Analytics Dashboard</h1>
            <p className="text-gray-600">Track maintenance completion performance and key indicators</p>
          </div>

          {/* Filters */}
          <div className="mb-6 bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Zones</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch</label>
                <select
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value as 'A' | 'B' | 'all')}
                  className="w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Batches</option>
                  <option value="A">Batch A</option>
                  <option value="B">Batch B</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Group By</label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as 'month' | 'batch' | 'zone')}
                className="w-full md:w-auto px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="month">By Month</option>
                <option value="batch">By 2-Week Period (Batch)</option>
                <option value="zone">By Zone</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading analytics...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">Error loading analytics. Please try again.</div>
          ) : (
            <>
              {/* Key Indicators - 4 Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Indicator 1: Completion Rate */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                      1. Maintenance Completion
                    </h2>
                    <button
                      onClick={() => toggleDetails('completion')}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      {expandedDetails.has('completion') ? 'Hide info' : 'See info'}
                    </button>
                  </div>
                  {expandedDetails.has('completion') && (
                    <div className="text-xs text-gray-600 mb-4 pb-3 border-b border-gray-200">
                      <strong>Definition:</strong> Percentage of maintenance work orders that were completed before their due date.
                      <br /><br />
                      <strong>Calculation:</strong> (Number of completed work orders with due date in the past) ÷ (Total work orders with due date in the past) × 100
                      <br /><br />
                      <strong>For a specific period (month or bi-weekly):</strong> The calculation includes all work orders that were <strong>scheduled</strong> (WM Planned Start Date) within the selected period. Among those, only work orders with a due date that has already passed are counted in the numerator and denominator. Work orders scheduled in the period but not yet due are excluded.
                      <br /><br />
                      <strong>Note:</strong> Only counts work orders where the due date has already passed. Work orders not yet due are excluded from this calculation.
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-sm text-gray-600">Completion Rate</span>
                        <span className="text-2xl font-bold text-gray-900">
                          {summary.completionRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            summary.completionRate === 100 ? 'bg-green-600' : 'bg-blue-600'
                          }`}
                          style={{ width: `${summary.completionRate}%` }}
                        />
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Missed Maintenance</span>
                        <span className={`text-xl font-semibold ${summary.missed === 0 ? 'text-gray-700' : 'text-red-600'}`}>
                          {summary.missed}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {summary.completedDue} completed out of {summary.totalDue} due
                        {summary.totalDue < summary.total && (
                          <span className="ml-1">({summary.total - summary.totalDue} not yet due)</span>
                        )}
                      </div>
                      {summary.missed > 0 && (
                        <button
                          onClick={() => toggleSection('missed')}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          {expandedSections.has('missed') ? 'Hide' : 'Show'} details ({summary.missed} work orders)
                        </button>
                      )}
                      {expandedSections.has('missed') && details.missedWorkOrders && details.missedWorkOrders.length > 0 && (
                        <div className="mt-3 max-h-60 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">WO Number</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Equipment</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Zone</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Planned Date</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Due Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {details.missedWorkOrders.map((wo) => (
                                <tr key={wo.scheduleId}>
                                  <td className="px-2 py-1 text-gray-900">{wo.workOrderNumber || '-'}</td>
                                  <td className="px-2 py-1 text-gray-900">{wo.equipmentNumber}</td>
                                  <td className="px-2 py-1 text-gray-900">{wo.zoneCode}</td>
                                  <td className="px-2 py-1 text-gray-900">
                                    {new Date(wo.r1PlannedDate).toLocaleDateString()}
                                  </td>
                                  <td className="px-2 py-1 text-gray-900">
                                    {wo.dueDate ? new Date(wo.dueDate).toLocaleDateString() : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Indicator 2: On-Time Rate */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                      2. On-Time Completion
                    </h2>
                    <button
                      onClick={() => toggleDetails('onTime')}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      {expandedDetails.has('onTime') ? 'Hide info' : 'See info'}
                    </button>
                  </div>
                  {expandedDetails.has('onTime') && (
                    <div className="text-xs text-gray-600 mb-4 pb-3 border-b border-gray-200">
                      <strong>Definition:</strong> Percentage of completed maintenance work orders that were finished on time (within 6 days of the MTR planned start date).
                      <br /><br />
                      <strong>Calculation:</strong> (Number of on-time completed work orders) ÷ (Total completed work orders) × 100
                      <br /><br />
                      <strong>For a specific period (month or bi-weekly):</strong> The calculation includes all work orders that were <strong>executed</strong> (completed) within the selected period. Only work orders that have been completed are included in both the numerator and denominator. Work orders scheduled in the period but not yet completed are excluded.
                      <br /><br />
                      <strong>On-Time Criteria:</strong> Maintenance completed within 6 days (0-6 days) from the MTR planned start date. Late maintenance is completed 7+ days after the MTR planned start date.
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-sm text-gray-600">On-Time Rate</span>
                        <span className="text-2xl font-bold text-gray-900">
                          {summary.onTimeRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-green-600 h-3 rounded-full transition-all"
                          style={{ width: `${summary.onTimeRate}%` }}
                        />
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Late Maintenance</span>
                        <span className={`text-xl font-semibold ${summary.late === 0 ? 'text-gray-700' : 'text-orange-600'}`}>
                          {summary.late}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {summary.onTime} on-time out of {summary.completed} completed
                      </div>
                      {summary.late > 0 && (
                        <button
                          onClick={() => toggleSection('late')}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          {expandedSections.has('late') ? 'Hide' : 'Show'} details ({summary.late} work orders)
                        </button>
                      )}
                      {expandedSections.has('late') && details.lateWorkOrders && details.lateWorkOrders.length > 0 && (
                        <div className="mt-3 max-h-60 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">WO Number</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Equipment</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Zone</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Planned Date</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Completion Date</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Deviation</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {details.lateWorkOrders.map((wo) => (
                                <tr key={wo.scheduleId}>
                                  <td className="px-2 py-1 text-gray-900">{wo.workOrderNumber || '-'}</td>
                                  <td className="px-2 py-1 text-gray-900">{wo.equipmentNumber}</td>
                                  <td className="px-2 py-1 text-gray-900">{wo.zoneCode}</td>
                                  <td className="px-2 py-1 text-gray-900">
                                    {new Date(wo.r1PlannedDate).toLocaleDateString()}
                                  </td>
                                  <td className="px-2 py-1 text-gray-900">
                                    {wo.completionDate ? new Date(wo.completionDate).toLocaleDateString() : '-'}
                                  </td>
                                  <td className="px-2 py-1 text-gray-900">
                                    {wo.executionDeviation !== null && wo.executionDeviation !== undefined
                                      ? `${wo.executionDeviation.toFixed(1)} days`
                                      : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Indicator 3: Planning Deviation */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                      3. Planning Deviation
                    </h2>
                    <button
                      onClick={() => toggleDetails('planning')}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      {expandedDetails.has('planning') ? 'Hide info' : 'See info'}
                    </button>
                  </div>
                  {expandedDetails.has('planning') && (
                    <div className="text-xs text-gray-600 mb-4 pb-3 border-b border-gray-200">
                      <strong>Definition:</strong> Average number of days between when WM (WeMaintain) schedules maintenance and when MTR originally planned it to start.
                      <br /><br />
                      <strong>Calculation:</strong> Average of (WM Planned Start Date - MTR Planned Start Date) for all scheduled work orders.
                      <br /><br />
                      <strong>For a specific period (month or bi-weekly):</strong> The calculation includes all work orders that were <strong>scheduled</strong> (WM Planned Start Date) within the selected period. Only work orders that have both a WM Planned Start Date and an MTR Planned Start Date are included in the average.
                      <br /><br />
                      <strong>Interpretation:</strong> Positive values mean WM scheduled later than MTR's plan. Zero means perfect alignment. This measures WM's ability to schedule maintenance on the dates expected by MTR.
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-sm text-gray-600">Average Deviation</span>
                        <span
                          className={`text-2xl font-bold ${
                            summary.avgPlanningDeviation === null
                              ? 'text-gray-400'
                              : summary.avgPlanningDeviation > 5
                              ? 'text-orange-600'
                              : summary.avgPlanningDeviation < 0
                              ? 'text-blue-600'
                              : 'text-gray-700'
                          }`}
                        >
                          {summary.avgPlanningDeviation === null
                            ? 'N/A'
                            : `${summary.avgPlanningDeviation > 0 ? '+' : ''}${summary.avgPlanningDeviation.toFixed(1)} days`}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Days between WM Start Date and MTR Start Date
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        Shows how many days WM scheduled after MTR planned date
                      </div>
                      {summary.avgPlanningDeviation !== null && summary.avgPlanningDeviation > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          Average: {summary.avgPlanningDeviation.toFixed(1)} days later
                        </div>
                      )}
                      {details.planningDeviationWorkOrders && details.planningDeviationWorkOrders.length > 0 && (
                        <button
                          onClick={() => toggleSection('planningDeviation')}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          {expandedSections.has('planningDeviation') ? 'Hide' : 'Show'} details ({details.planningDeviationWorkOrders.length} work orders)
                        </button>
                      )}
                      {expandedSections.has('planningDeviation') && details.planningDeviationWorkOrders && details.planningDeviationWorkOrders.length > 0 && (
                        <div className="mt-3 max-h-60 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">WO Number</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Equipment</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Zone</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">WM Planned Date</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">MTR Planned Date</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Deviation</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {details.planningDeviationWorkOrders.map((wo) => (
                                <tr key={wo.scheduleId}>
                                  <td className="px-2 py-1 text-gray-900">{wo.workOrderNumber || '-'}</td>
                                  <td className="px-2 py-1 text-gray-900">{wo.equipmentNumber}</td>
                                  <td className="px-2 py-1 text-gray-900">{wo.zoneCode}</td>
                                  <td className="px-2 py-1 text-gray-900">
                                    {new Date(wo.r1PlannedDate).toLocaleDateString()}
                                  </td>
                                  <td className="px-2 py-1 text-gray-900">
                                    {wo.mtrPlannedStartDate ? new Date(wo.mtrPlannedStartDate).toLocaleDateString() : '-'}
                                  </td>
                                  <td className="px-2 py-1 text-gray-900">
                                    {wo.planningDeviation !== null && wo.planningDeviation !== undefined
                                      ? `${wo.planningDeviation.toFixed(1)} days`
                                      : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Indicator 4: Execution Deviation */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                      4. Execution Deviation
                    </h2>
                    <button
                      onClick={() => toggleDetails('execution')}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      {expandedDetails.has('execution') ? 'Hide info' : 'See info'}
                    </button>
                  </div>
                  {expandedDetails.has('execution') && (
                    <div className="text-xs text-gray-600 mb-4 pb-3 border-b border-gray-200">
                      <strong>Definition:</strong> Average number of days between when maintenance was actually completed and when WM originally planned it to start.
                      <br /><br />
                      <strong>Calculation:</strong> Average of (Completion Date - WM Planned Start Date) for all completed work orders.
                      <br /><br />
                      <strong>For a specific period (month or bi-weekly):</strong> The calculation includes all work orders that were <strong>executed</strong> (completed) within the selected period. Only work orders that have been completed are included in the average. Work orders scheduled in the period but not yet completed are excluded.
                      <br /><br />
                      <strong>Interpretation:</strong> Positive values mean maintenance was completed later than planned. Zero means completed exactly on the planned date. This measures WM's ability to execute maintenance on the scheduled day, regardless of whether it matched MTR's original plan.
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-sm text-gray-600">Average Deviation</span>
                        <span
                          className={`text-2xl font-bold ${
                            summary.avgExecutionDeviation === null
                              ? 'text-gray-400'
                              : summary.avgExecutionDeviation > 0
                              ? 'text-orange-600'
                              : summary.avgExecutionDeviation < 0
                              ? 'text-blue-600'
                              : 'text-gray-900'
                          }`}
                        >
                          {summary.avgExecutionDeviation === null
                            ? 'N/A'
                            : `${summary.avgExecutionDeviation > 0 ? '+' : ''}${summary.avgExecutionDeviation.toFixed(1)} days`}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        Days between completion date and WM Planned Start Date
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        Shows how many days after planned date maintenance was completed
                      </div>
                      {summary.avgExecutionDeviation !== null && summary.avgExecutionDeviation > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          Average: {summary.avgExecutionDeviation.toFixed(1)} days later
                        </div>
                      )}
                      {details.executionDeviationWorkOrders && details.executionDeviationWorkOrders.length > 0 && (
                        <button
                          onClick={() => toggleSection('executionDeviation')}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          {expandedSections.has('executionDeviation') ? 'Hide' : 'Show'} details ({details.executionDeviationWorkOrders.length} work orders)
                        </button>
                      )}
                      {expandedSections.has('executionDeviation') && details.executionDeviationWorkOrders && details.executionDeviationWorkOrders.length > 0 && (
                        <div className="mt-3 max-h-60 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">WO Number</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Equipment</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Zone</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Planned Date</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Completion Date</th>
                                <th className="px-2 py-1 text-left text-gray-900 font-semibold">Deviation</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {details.executionDeviationWorkOrders.map((wo) => (
                                <tr key={wo.scheduleId}>
                                  <td className="px-2 py-1 text-gray-900">{wo.workOrderNumber || '-'}</td>
                                  <td className="px-2 py-1 text-gray-900">{wo.equipmentNumber}</td>
                                  <td className="px-2 py-1 text-gray-900">{wo.zoneCode}</td>
                                  <td className="px-2 py-1 text-gray-900">
                                    {new Date(wo.r1PlannedDate).toLocaleDateString()}
                                  </td>
                                  <td className="px-2 py-1 text-gray-900">
                                    {wo.completionDate ? new Date(wo.completionDate).toLocaleDateString() : '-'}
                                  </td>
                                  <td className="px-2 py-1 text-gray-900">
                                    {wo.executionDeviation !== null && wo.executionDeviation !== undefined
                                      ? `${wo.executionDeviation.toFixed(1)} days`
                                      : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Grouped Data Table */}
              {grouped && Object.keys(grouped).length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                      Trends by {selectedPeriod === 'month' ? 'Month' : selectedPeriod === 'batch' ? '2-Week Period' : 'Zone'}
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                              {selectedPeriod === 'month' ? 'Month' : selectedPeriod === 'batch' ? 'Period' : 'Zone'}
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                              Total
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                              Completed
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                              Completion %
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                              Missed
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                              On-Time %
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                              Late
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                              Planning Dev.
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                              Execution Dev.
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {Object.values(grouped)
                            .sort((a, b) => a.key.localeCompare(b.key))
                            .map((group) => (
                              <tr key={group.key} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                  {group.key}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                  {group.total}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                  {group.completed}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                  {group.completionRate.toFixed(1)}%
                                </td>
                                <td className="px-4 py-3 text-sm text-red-600 text-right font-medium">
                                  {group.missed}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                  {group.onTimeRate.toFixed(1)}%
                                </td>
                                <td className="px-4 py-3 text-sm text-orange-600 text-right font-medium">
                                  {group.late}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                  {group.avgPlanningDeviation === null
                                    ? '-'
                                    : `${group.avgPlanningDeviation.toFixed(1)} days`}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                  {group.avgExecutionDeviation === null
                                    ? '-'
                                    : `${group.avgExecutionDeviation.toFixed(1)} days`}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

