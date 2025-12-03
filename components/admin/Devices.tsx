'use client'

import { useState, useEffect, useMemo } from 'react'
import { useZones } from '@/lib/hooks'

interface Device {
  id: string | null
  equipmentNumber: string
  name: string
  type: 'ELEVATOR' | 'ESCALATOR'
  deviceId: string | null
  canUse2300Slot: boolean
  inDatabase: boolean
  mapping?: {
    id: string
    zoneId: string
    batch: 'A' | 'B'
    zone: {
      code: string
      name: string
    }
  }
}

export function Devices() {
  const { zones } = useZones()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [showUnmapped, setShowUnmapped] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'zone' | 'batch' | '2300' | null>(null)
  const [editValues, setEditValues] = useState<{
    zoneId?: string
    batch?: 'A' | 'B'
    canUse2300Slot?: boolean
  }>({})

  const [error, setError] = useState<string | null>(null)

  // Load all devices from Looker
  useEffect(() => {
    async function loadDevices() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/admin/equipment')
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to fetch equipment: ${res.statusText}`)
        }
        const data = await res.json()
        
        // Also fetch mappings
        const mappingRes = await fetch('/api/admin/equipment-mapping')
        if (!mappingRes.ok) {
          const errorData = await mappingRes.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to fetch mappings: ${mappingRes.statusText}`)
        }
        const mappingData = await mappingRes.json()
        
        // Create a map of equipment ID to mapping
        const mappingMap = new Map<string, any>()
        if (mappingData.mappings) {
          mappingData.mappings.forEach((m: any) => {
            mappingMap.set(m.equipment.id, m)
          })
        }
        
        // Merge devices with their mappings
        const devicesWithMappings = (data.equipment || []).map((device: any) => ({
          ...device,
          mapping: mappingMap.get(device.id),
        }))
        
        setDevices(devicesWithMappings)
      } catch (error) {
        console.error('Failed to load devices:', error)
        setError(error instanceof Error ? error.message : 'Failed to load devices')
      } finally {
        setLoading(false)
      }
    }
    loadDevices()
  }, [])

  const handleEdit = (deviceKey: string | null, field: 'zone' | 'batch' | '2300', currentValue?: any) => {
    if (!deviceKey) return
    setEditingId(deviceKey)
    setEditingField(field)
    
    const device = devices.find(d => (d.id || d.equipmentNumber) === deviceKey)
    if (device) {
      setEditValues({
        zoneId: device.mapping?.zoneId || '',
        batch: device.mapping?.batch || 'A',
        canUse2300Slot: device.canUse2300Slot || false,
      })
    }
  }

  const handleSave = async (deviceKey: string | null) => {
    if (!deviceKey) return
    const device = devices.find(d => (d.id || d.equipmentNumber) === deviceKey)
    if (!device) return
    
    let currentDeviceId: string | null = device.id

    try {
      // If device doesn't exist in DB, create it first
      if (!device.inDatabase || !device.id) {
        if (!editValues.zoneId) {
          alert('Please select a zone first')
          return
        }
        
        const createRes = await fetch('/api/admin/equipment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            equipmentNumber: device.equipmentNumber,
            zoneId: editValues.zoneId,
            type: device.type,
            canUse2300Slot: editValues.canUse2300Slot || false,
          }),
        })
        
        if (!createRes.ok) {
          throw new Error('Failed to create device')
        }
        
        const createData = await createRes.json()
        currentDeviceId = createData.equipment.id
      }

      // Update 23:00 flag if changed
      if (editingField === '2300' && editValues.canUse2300Slot !== undefined) {
        const updateRes = await fetch(`/api/admin/equipment/${currentDeviceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            canUse2300Slot: editValues.canUse2300Slot,
          }),
        })
        
        if (!updateRes.ok) {
          throw new Error('Failed to update 23:00 flag')
        }
      }

      // Update or create mapping if zone/batch changed
      if ((editingField === 'zone' || editingField === 'batch') && editValues.zoneId && editValues.batch) {
        const mappingRes = await fetch('/api/admin/equipment-mapping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            equipmentId: currentDeviceId,
            zoneId: editValues.zoneId,
            batch: editValues.batch,
          }),
        })
        
        if (!mappingRes.ok) {
          throw new Error('Failed to update mapping')
        }
      }

      // Refresh devices
      const res = await fetch('/api/admin/equipment')
      const data = await res.json()
      
      const mappingRes = await fetch('/api/admin/equipment-mapping')
      const mappingData = await mappingRes.json()
      
      const mappingMap = new Map<string, any>()
      mappingData.mappings.forEach((m: any) => {
        mappingMap.set(m.equipment.id, m)
      })
      
      const devicesWithMappings = (data.equipment || []).map((device: any) => ({
        ...device,
        mapping: mappingMap.get(device.id),
      }))
      
      setDevices(devicesWithMappings)
      setEditingId(null)
      setEditingField(null)
      setEditValues({})
    } catch (error) {
      console.error('Error saving:', error)
      alert(error instanceof Error ? error.message : 'Failed to save changes')
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditingField(null)
    setEditValues({})
  }

  // Filter devices based on toggle
  const filteredDevices = useMemo(() => {
    let filtered = devices
    
    // Filter out unmapped devices if toggle is off
    if (!showUnmapped) {
      filtered = devices.filter(device => device.mapping && device.mapping.zoneId && device.mapping.batch)
    }
    
    return filtered.sort((a, b) => a.equipmentNumber.localeCompare(b.equipmentNumber))
  }, [devices, showUnmapped])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Devices</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showUnmapped}
            onChange={(e) => setShowUnmapped(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show unmapped devices</span>
        </label>
      </div>
      <p className="text-sm text-gray-700 mb-6">
        Configure Zone, Week Batch, and 23:00 slot eligibility. 
        Only devices with both Zone and Week Batch can be linked to Work Orders.
      </p>

      {loading ? (
        <div className="text-center py-8 text-gray-500">
          Loading devices...
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-red-800">Error loading devices</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Device
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Zone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Week Batch
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    23:00 Slot
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      {showUnmapped 
                        ? 'No devices found. This could mean: (1) Looker connection issue, (2) No devices in Looker, or (3) Database sync needed.'
                        : 'No mapped devices found. Enable "Show unmapped devices" to see all devices.'}
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((device) => {
                  const deviceKey = device.id || device.equipmentNumber
                  const isEditing = editingId === deviceKey
                  const hasMapping = !!device.mapping
                  const canLinkWorkOrder = hasMapping && device.mapping?.zoneId && device.mapping?.batch

                  return (
                    <tr key={deviceKey} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {device.equipmentNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {device.type}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {isEditing && editingField === 'zone' ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={editValues.zoneId || ''}
                              onChange={(e) => setEditValues({ ...editValues, zoneId: e.target.value })}
                              className="px-2 py-1 text-sm text-gray-900 bg-white border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                            >
                              <option value="">No zone</option>
                              {zones.map((zone: any) => (
                                <option key={zone.id} value={zone.id}>
                                  {zone.code} - {zone.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleSave(deviceKey)}
                              className="px-2 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700"
                            >
                              ✓
                            </button>
                            <button
                              onClick={handleCancel}
                              className="px-2 py-1 text-xs text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(deviceKey, 'zone')}
                            className="text-sm text-gray-900 hover:text-blue-600 hover:underline"
                          >
                            {device.mapping?.zone ? `${device.mapping.zone.code} - ${device.mapping.zone.name}` : 'Not set'}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {isEditing && editingField === 'batch' ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={editValues.batch || 'A'}
                              onChange={(e) => setEditValues({ ...editValues, batch: e.target.value as 'A' | 'B' })}
                              className="px-2 py-1 text-sm text-gray-900 bg-white border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                            >
                              <option value="A">A</option>
                              <option value="B">B</option>
                            </select>
                            <button
                              onClick={() => handleSave(deviceKey)}
                              className="px-2 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700"
                            >
                              ✓
                            </button>
                            <button
                              onClick={handleCancel}
                              className="px-2 py-1 text-xs text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(deviceKey, 'batch')}
                            className="text-sm text-gray-900 hover:text-blue-600 hover:underline"
                          >
                            {device.mapping?.batch ? (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-900">
                                {device.mapping.batch}
                              </span>
                            ) : (
                              'Not set'
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {isEditing && editingField === '2300' ? (
                          <div className="flex items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editValues.canUse2300Slot || false}
                                onChange={(e) => setEditValues({ ...editValues, canUse2300Slot: e.target.checked })}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                            <button
                              onClick={() => handleSave(deviceKey)}
                              className="px-2 py-1 text-xs text-white bg-green-600 rounded hover:bg-green-700"
                            >
                              ✓
                            </button>
                            <button
                              onClick={handleCancel}
                              className="px-2 py-1 text-xs text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(deviceKey, '2300')}
                            className="flex items-center gap-2"
                          >
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={device.canUse2300Slot || false}
                                readOnly
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                            <span className="text-xs text-gray-600">
                              {device.canUse2300Slot ? 'Enabled' : 'Disabled'}
                            </span>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {canLinkWorkOrder ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                            Ready for Work Orders
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            Missing Mapping
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                }))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

