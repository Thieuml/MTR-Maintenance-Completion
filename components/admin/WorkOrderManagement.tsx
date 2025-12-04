'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

interface UploadResult {
  success: boolean
  totalLines: number
  validLines: number
  errors: Array<{
    line: number
    equipmentNumber: string
    woNumber: string
    error: string
  }>
  uploaded: Array<{
    equipmentNumber: string
    woNumber: string
    uploadTimestamp: string
  }>
  message: string
}

interface LastUpload {
  timestamp: string
  workOrderCount: number
  fileName?: string
}

export function WorkOrderManagement() {
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [allWorkOrders, setAllWorkOrders] = useState<any[]>([])
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [lastUpload, setLastUpload] = useState<LastUpload | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateRange, setDateRange] = useState<'7days' | '30days' | 'all'>('7days')
  const [showManualForm, setShowManualForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [manualFormData, setManualFormData] = useState({
    equipmentNumber: '',
    workOrderNumber: '',
    wmPlannedDate: '',
    mtrPlannedStartDate: '',
    mtrPlannedCompletionDate: '',
  })

  // Fetch all work orders
  useEffect(() => {
    async function loadWorkOrders() {
      try {
        const res = await fetch('/api/admin/work-orders')
        const data = await res.json()
        setAllWorkOrders(data.workOrders || [])
      } catch (error) {
        console.error('Failed to load work orders:', error)
      }
    }
    loadWorkOrders()
  }, [])

  // Filter work orders based on date range and search
  const filteredWorkOrders = useMemo(() => {
    let filtered = [...allWorkOrders]

    // Filter by date range (based on createdAt/upload timestamp)
    if (dateRange === '7days') {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      filtered = filtered.filter((wo) => {
        const uploadDate = new Date(wo.createdAt)
        return uploadDate >= sevenDaysAgo
      })
    } else if (dateRange === '30days') {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      filtered = filtered.filter((wo) => {
        const uploadDate = new Date(wo.createdAt)
        return uploadDate >= thirtyDaysAgo
      })
    }
    // 'all' shows everything

    // Filter by search term (WO number)
    if (searchTerm.trim()) {
      const search = searchTerm.trim().toLowerCase()
      filtered = filtered.filter((wo) =>
        wo.workOrderNumber?.toLowerCase().includes(search) ||
        wo.equipment?.equipmentNumber?.toLowerCase().includes(search)
      )
    }

    return filtered
  }, [allWorkOrders, dateRange, searchTerm])

  // Update displayed work orders
  useEffect(() => {
    setWorkOrders(filteredWorkOrders)
  }, [filteredWorkOrders])

  // Load last upload info from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('lastWorkOrderUpload')
    if (stored) {
      try {
        setLastUpload(JSON.parse(stored))
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [])

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file')
      return
    }

    setIsUploading(true)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/admin/work-orders/upload', {
        method: 'POST',
        body: formData,
      })

      const result: UploadResult = await res.json()

      if (!res.ok) {
        throw new Error(result.message || 'Upload failed')
      }

      setUploadResult(result)

      // Store last upload info
      if (result.success && result.validLines > 0) {
        const uploadInfo: LastUpload = {
          timestamp: new Date().toISOString(),
          workOrderCount: result.validLines,
          fileName: file.name,
        }
        setLastUpload(uploadInfo)
        localStorage.setItem('lastWorkOrderUpload', JSON.stringify(uploadInfo))

        // Refresh work orders
        const refreshRes = await fetch('/api/admin/work-orders')
        const refreshData = await refreshRes.json()
        setAllWorkOrders(refreshData.workOrders || [])
      }
    } catch (error) {
      setUploadResult({
        success: false,
        totalLines: 0,
        validLines: 0,
        errors: [],
        uploaded: [],
        message: error instanceof Error ? error.message : 'Upload failed',
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleDelete = async (workOrderId: string) => {
    if (!confirm('Are you sure you want to delete this work order? This action cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/admin/work-orders/${workOrderId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete work order')
      }

      // Refresh work orders
      const refreshRes = await fetch('/api/admin/work-orders')
      const refreshData = await refreshRes.json()
      setAllWorkOrders(refreshData.workOrders || [])
      alert('Work order deleted successfully!')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete work order')
    }
  }

  const handleManualCreate = async () => {
    if (!manualFormData.equipmentNumber || !manualFormData.workOrderNumber || !manualFormData.wmPlannedDate || !manualFormData.mtrPlannedCompletionDate) {
      alert('Please fill in all required fields')
      return
    }

    setIsCreating(true)
    try {
      const res = await fetch('/api/admin/work-orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentNumber: manualFormData.equipmentNumber,
          workOrderNumber: manualFormData.workOrderNumber,
          wmPlannedDate: new Date(manualFormData.wmPlannedDate).toISOString(),
          mtrPlannedStartDate: manualFormData.mtrPlannedStartDate ? new Date(manualFormData.mtrPlannedStartDate).toISOString() : null,
          mtrPlannedCompletionDate: new Date(manualFormData.mtrPlannedCompletionDate).toISOString(),
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to create work order')
      }

      // Reset form
      setManualFormData({
        equipmentNumber: '',
        workOrderNumber: '',
        wmPlannedDate: '',
        mtrPlannedStartDate: '',
        mtrPlannedCompletionDate: '',
      })
      setShowManualForm(false)

      // Refresh work orders
      const refreshRes = await fetch('/api/admin/work-orders')
      const refreshData = await refreshRes.json()
      setAllWorkOrders(refreshData.workOrders || [])
      alert('Work order created successfully!')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create work order')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-900">Work Order Management</h2>
      <p className="text-sm text-gray-700 mb-6">
        Upload work orders from CSV file.
      </p>

      {/* Manual Creation Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Create Work Order Manually</h3>
          <button
            onClick={() => setShowManualForm(!showManualForm)}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {showManualForm ? 'Cancel' : 'Add Work Order'}
          </button>
        </div>

        {showManualForm && (
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Equipment Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={manualFormData.equipmentNumber}
                  onChange={(e) => setManualFormData({ ...manualFormData, equipmentNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                  placeholder="e.g., HOK-E25"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Work Order Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={manualFormData.workOrderNumber}
                  onChange={(e) => setManualFormData({ ...manualFormData, workOrderNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                  placeholder="e.g., 5000355448"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  WM Planned Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={manualFormData.wmPlannedDate}
                  onChange={(e) => setManualFormData({ ...manualFormData, wmPlannedDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  MTR Planned Start Date
                </label>
                <input
                  type="date"
                  value={manualFormData.mtrPlannedStartDate}
                  onChange={(e) => setManualFormData({ ...manualFormData, mtrPlannedStartDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date (MTR Planned Completion) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={manualFormData.mtrPlannedCompletionDate}
                  onChange={(e) => setManualFormData({ ...manualFormData, mtrPlannedCompletionDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleManualCreate}
                  disabled={isCreating}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Creating...' : 'Create Work Order'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CSV Upload Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
        <h3 className="text-lg font-medium mb-4 text-gray-900">Upload Work Orders (CSV)</h3>
        
        {/* Drag and Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            id="csv-upload"
            disabled={isUploading}
          />
          <label
            htmlFor="csv-upload"
            className={`cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="space-y-2">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-4h-12m-4-4h12.172M16 20l.172-.172a4 4 0 015.656 0L28 28"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-sm text-gray-600">
                {isUploading ? (
                  <span>Uploading...</span>
                ) : (
                  <>
                    <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                  </>
                )}
              </div>
              <div className="text-xs text-gray-500">CSV file only</div>
            </div>
          </label>
        </div>

        {/* Upload Result */}
        {uploadResult && (
          <div className={`mt-4 p-4 rounded-lg ${
            uploadResult.success && uploadResult.errors.length === 0
              ? 'bg-green-50 border border-green-200'
              : uploadResult.success && uploadResult.errors.length > 0
              ? 'bg-yellow-50 border border-yellow-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="font-medium mb-2">
              {uploadResult.success && uploadResult.errors.length === 0 ? (
                <span className="text-green-800">✓ Upload Successful</span>
              ) : uploadResult.success && uploadResult.errors.length > 0 ? (
                <span className="text-yellow-800">⚠ Upload Completed with Errors</span>
              ) : (
                <span className="text-red-800">✗ Upload Failed</span>
              )}
            </div>
            <div className="text-sm text-gray-700 mb-4">
              {uploadResult.message}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-white rounded-md p-3 border border-gray-200">
                <div className="text-xs text-gray-500 mb-1">Total Lines Processed</div>
                <div className="text-lg font-semibold text-gray-900">{uploadResult.totalLines}</div>
              </div>
              <div className="bg-white rounded-md p-3 border border-gray-200">
                <div className="text-xs text-gray-500 mb-1">Successfully Uploaded</div>
                <div className="text-lg font-semibold text-green-600">{uploadResult.validLines}</div>
              </div>
              {uploadResult.errors.length > 0 && (
                <div className="bg-white rounded-md p-3 border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">Errors</div>
                  <div className="text-lg font-semibold text-red-600">{uploadResult.errors.length}</div>
                </div>
              )}
            </div>

            {/* Error Details */}
            {uploadResult.errors.length > 0 && (
              <div className="mt-4">
                <div className="font-medium text-sm text-gray-900 mb-2">Error Details:</div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-2 py-1 text-left">Line</th>
                        <th className="px-2 py-1 text-left">Equipment</th>
                        <th className="px-2 py-1 text-left">WO Number</th>
                        <th className="px-2 py-1 text-left">Error</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {uploadResult.errors.map((error, idx) => (
                        <tr key={idx}>
                          <td className="px-2 py-1">{error.line}</td>
                          <td className="px-2 py-1">{error.equipmentNumber}</td>
                          <td className="px-2 py-1">{error.woNumber}</td>
                          <td className="px-2 py-1 text-red-600">{error.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Uploaded Work Orders */}
            {uploadResult.uploaded.length > 0 && (
              <div className="mt-4">
                <div className="font-medium text-sm text-gray-900 mb-2">Uploaded Work Orders:</div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-2 py-1 text-left">Equipment</th>
                        <th className="px-2 py-1 text-left">WO Number</th>
                        <th className="px-2 py-1 text-left">Upload Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {uploadResult.uploaded.map((wo, idx) => (
                        <tr key={idx}>
                          <td className="px-2 py-1">{wo.equipmentNumber}</td>
                          <td className="px-2 py-1">{wo.woNumber}</td>
                          <td className="px-2 py-1">
                            {new Date(wo.uploadTimestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Last Upload Details Box */}
      {lastUpload && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Last Upload</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <div>
              <span className="font-medium">Date & Time:</span>{' '}
              {new Date(lastUpload.timestamp).toLocaleString()}
            </div>
            <div>
              <span className="font-medium">Work Orders Uploaded:</span> {lastUpload.workOrderCount}
            </div>
            {lastUpload.fileName && (
              <div>
                <span className="font-medium">File:</span> {lastUpload.fileName}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Uploaded Work Orders Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h3 className="font-medium text-gray-900">
              Uploaded Work Orders ({workOrders.length})
            </h3>
            <div className="flex items-center gap-3">
              {/* Search by WO Number */}
              <input
                type="text"
                placeholder="Search by WO # or Equipment..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              />
              {/* Date Range Filter */}
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as '7days' | '30days' | 'all')}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              >
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="all">All time</option>
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Equipment
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  WM Planned Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  MTR Planned Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Due Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  WO Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Upload Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {workOrders.map((wo) => (
                <tr key={wo.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {wo.equipment.equipmentNumber}
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
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {wo.workOrderNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(wo.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => handleDelete(wo.id)}
                      className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors relative group"
                      title="Delete work order"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M18.8286 5.04036C19.0824 5.2942 19.0824 5.70575 18.8286 5.9596L12.9231 11.865L18.8286 17.7702C19.057 17.9987 19.0799 18.3549 18.8971 18.6089L18.8286 18.6895C18.5748 18.9433 18.1632 18.9433 17.9094 18.6895L12.0041 12.784L6.09872 18.6895C5.84488 18.9433 5.43333 18.9433 5.17949 18.6895C4.92565 18.4356 4.92565 18.0241 5.17949 17.7702L11.0851 11.865L5.17949 5.9596C4.95103 5.73114 4.92818 5.37493 5.11095 5.12092L5.17949 5.04036C5.43333 4.78652 5.84488 4.78652 6.09872 5.04036L12.0041 10.946L17.9094 5.04036C18.1632 4.78652 18.5748 4.78652 18.8286 5.04036Z" fill="currentColor"/>
                      </svg>
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                        Delete work order
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {workOrders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {searchTerm || dateRange !== 'all'
                ? 'No work orders found matching your criteria.'
                : 'No work orders uploaded yet.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
