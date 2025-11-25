'use client'

import { useState, useEffect } from 'react'

export function WorkOrderManagement() {
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [equipment, setEquipment] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    workOrderNumber: '',
    equipmentId: '',
    date: '',
  })

  // Fetch equipment with mappings
  useEffect(() => {
    async function loadEquipment() {
      try {
        const res = await fetch('/api/admin/equipment-mapping')
        const data = await res.json()
        setEquipment(
          data.mappings.map((m: any) => ({
            ...m.equipment,
            zone: m.zone,
            batch: m.batch,
          }))
        )
      } catch (error) {
        console.error('Failed to load equipment:', error)
      }
    }
    loadEquipment()
  }, [])

  // Fetch work orders
  useEffect(() => {
    async function loadWorkOrders() {
      try {
        const res = await fetch('/api/admin/work-orders')
        const data = await res.json()
        setWorkOrders(data.workOrders || [])
      } catch (error) {
        console.error('Failed to load work orders:', error)
      }
    }
    loadWorkOrders()
  }, [])

  const handleAssignWO = async () => {
    if (!formData.workOrderNumber || !formData.equipmentId || !formData.date) {
      alert('Please fill in all fields')
      return
    }

    setLoading(true)
    try {
      const date = new Date(formData.date)
      const res = await fetch('/api/admin/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workOrderNumber: formData.workOrderNumber,
          equipmentId: formData.equipmentId,
          date: date.toISOString(),
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to assign work order')
      }

      const data = await res.json()
      setWorkOrders([data.schedule, ...workOrders])
      setFormData({ workOrderNumber: '', equipmentId: '', date: '' })
      alert('Work order assigned successfully!')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to assign work order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-900">Work Order Management</h2>
      <p className="text-sm text-gray-700 mb-6">
        Map work orders (OR numbers) to equipment and dates.
      </p>

      {/* Assign Work Order Form */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-medium mb-4 text-gray-900">Assign Work Order</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Work Order Number
            </label>
            <input
              type="text"
              value={formData.workOrderNumber}
              onChange={(e) =>
                setFormData({ ...formData, workOrderNumber: e.target.value })
              }
              placeholder="e.g., 5000355448"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Equipment
            </label>
            <select
              value={formData.equipmentId}
              onChange={(e) =>
                setFormData({ ...formData, equipmentId: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
            >
              <option value="">Select equipment...</option>
              {equipment.map((eq: any) => (
                <option key={eq.id} value={eq.id}>
                  {eq.equipmentNumber} ({eq.zone.code} - {eq.batch})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAssignWO}
              disabled={loading || !formData.workOrderNumber || !formData.equipmentId || !formData.date}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Assigning...' : 'Assign WO'}
            </button>
          </div>
        </div>
      </div>

      {/* Existing Work Orders */}
      <div>
        <h3 className="font-medium mb-4 text-gray-900">Assigned Work Orders ({workOrders.length})</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Equipment
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  OR Number
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {workOrders.map((wo) => (
                <tr key={wo.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">{wo.equipment.equipmentNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {new Date(wo.r1PlannedDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">
                    {wo.workOrderNumber}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {workOrders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No work orders assigned yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
