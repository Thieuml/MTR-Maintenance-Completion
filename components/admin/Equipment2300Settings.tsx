'use client'

import { useState, useEffect } from 'react'
import { useZones } from '@/lib/hooks'
import { useSWRConfig } from 'swr'

export function Equipment2300Settings() {
  const { zones } = useZones()
  const { mutate: globalMutate } = useSWRConfig()
  const [equipment, setEquipment] = useState<any[]>([])
  const [allEquipment, setAllEquipment] = useState<any[]>([])
  const [loading, setLoading] = useState(true) // Start with true to show loading immediately
  const [updating, setUpdating] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedEquipmentNumber, setSelectedEquipmentNumber] = useState('')
  const [selectedZone, setSelectedZone] = useState('')
  const [selectedType, setSelectedType] = useState<'ELEVATOR' | 'ESCALATOR'>('ELEVATOR')
  const [adding, setAdding] = useState(false)

  // Fetch all available equipment
  useEffect(() => {
    async function loadAllEquipment() {
      try {
        const res = await fetch('/api/admin/equipment')
        const data = await res.json()
        setAllEquipment(data.equipment || [])
      } catch (error) {
        console.error('Failed to load equipment:', error)
      }
    }
    loadAllEquipment()
  }, [])

  // Function to load equipment (optimized - single API call)
  const loadEquipment = async () => {
    setLoading(true)
    try {
      // Fetch all equipment that can use 23:00 slot in one optimized query
      const res = await fetch('/api/admin/equipment-2300')
      if (!res.ok) {
        const errorData = await res.json()
        console.error('[Equipment2300Settings] API error:', errorData)
        throw new Error('Failed to fetch equipment')
      }
      const data = await res.json()
      console.log('[Equipment2300Settings] Received equipment:', data.equipment?.length || 0, 'items')
      console.log('[Equipment2300Settings] Equipment numbers:', data.equipment?.map((eq: any) => eq.equipmentNumber).join(', ') || 'none')
      setEquipment(data.equipment || [])
      
      // Also fetch all equipment for the dropdown
      const allEqRes = await fetch('/api/admin/equipment')
      const allEqData = await allEqRes.json()
      setAllEquipment(allEqData.equipment || [])
    } catch (error) {
      console.error('Failed to load equipment:', error)
      setEquipment([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch equipment on mount
  useEffect(() => {
    // Load both datasets on mount
    async function initialize() {
      // Load all equipment for dropdown (can be done in parallel)
      try {
        const res = await fetch('/api/admin/equipment')
        const data = await res.json()
        setAllEquipment(data.equipment || [])
      } catch (error) {
        console.error('Failed to load all equipment:', error)
      }
      // Load 23:00 equipment for main table
      await loadEquipment()
    }
    initialize()
  }, [])

  const handleToggle2300Slot = async (equipmentId: string, currentValue: boolean) => {
    setUpdating(equipmentId)
    try {
      const res = await fetch(`/api/admin/equipment/${equipmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canUse2300Slot: !currentValue,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to update equipment')
      }

      const data = await res.json()
      setEquipment(
        equipment.map((eq) =>
          eq.id === equipmentId ? { ...eq, canUse2300Slot: data.equipment.canUse2300Slot } : eq
        )
      )
      
      // Refresh equipment list
      await loadEquipment()
      
      // Invalidate schedule cache so schedule cards show updated icon
      globalMutate((key) => typeof key === 'string' && key.startsWith('/api/schedules'))
    } catch (error) {
      alert('Failed to update equipment')
    } finally {
      setUpdating(null)
    }
  }

  const handleAddEquipment = async () => {
    if (!selectedEquipmentNumber || !selectedZone) {
      alert('Please select device and zone')
      return
    }

    setAdding(true)
    try {
      // First check if equipment exists
      let equipmentId = allEquipment.find((eq) => eq.equipmentNumber === selectedEquipmentNumber)?.id

      if (!equipmentId) {
        // Create equipment if it doesn't exist
        const createRes = await fetch('/api/admin/equipment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            equipmentNumber: selectedEquipmentNumber,
            zoneId: selectedZone,
            type: selectedType,
            canUse2300Slot: true,
          }),
        })

        if (!createRes.ok) {
          const error = await createRes.json()
          throw new Error(error.error || 'Failed to create equipment')
        }

        const createData = await createRes.json()
        equipmentId = createData.equipment.id
      } else {
        // Update existing equipment to enable 23:00 slot
        const updateRes = await fetch(`/api/admin/equipment/${equipmentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            canUse2300Slot: true,
          }),
        })

        if (!updateRes.ok) {
          throw new Error('Failed to update equipment')
        }
      }

      // Refresh equipment list to show the newly added device
      await loadEquipment()
      
      // Also refresh allEquipment for dropdown
      const allEqRes = await fetch('/api/admin/equipment')
      const allEqData = await allEqRes.json()
      setAllEquipment(allEqData.equipment || [])

      // Invalidate schedule cache so schedule cards show updated icon
      globalMutate((key) => typeof key === 'string' && key.startsWith('/api/schedules'))

      // Reset form
      setSelectedEquipmentNumber('')
      setSelectedZone('')
      setShowAddForm(false)
      alert('Device added successfully!')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to add device')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-900">
        23:00 Slot Settings
      </h2>
      <p className="text-sm text-gray-700 mb-6">
        Mark devices that are allowed to start servicing at 23:00 (earlier slot). These devices are marked with a clock icon in the schedule.
      </p>

      {/* Add Device Form */}
      <div className="mb-6">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          {showAddForm ? 'Cancel' : '+ Add Device'}
        </button>

        {showAddForm && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Add Device to 23:00 Slot List</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device
                </label>
                <select
                  value={selectedEquipmentNumber}
                  onChange={(e) => {
                    const deviceNumber = e.target.value
                    setSelectedEquipmentNumber(deviceNumber)
                    
                    if (!deviceNumber) {
                      setSelectedZone('')
                      setSelectedType('ELEVATOR')
                      return
                    }

                    // Auto-populate zone and type from mapped equipment or allEquipment
                    const mappedDevice = equipment.find((eq: any) => eq.equipmentNumber === deviceNumber)
                    const selectedDevice = allEquipment.find((eq) => eq.equipmentNumber === deviceNumber)
                    
                    // Set zone from mapped device if available
                    if (mappedDevice?.zone?.id) {
                      setSelectedZone(mappedDevice.zone.id)
                    }
                    
                    // Set type from device data
                    if (selectedDevice?.type) {
                      setSelectedType(selectedDevice.type as 'ELEVATOR' | 'ESCALATOR')
                    } else if (mappedDevice?.type) {
                      setSelectedType(mappedDevice.type as 'ELEVATOR' | 'ESCALATOR')
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white font-medium"
                >
                  <option value="" className="text-gray-500">Select device</option>
                  {allEquipment
                    .filter((eq) => {
                      // Show devices that aren't already enabled for 23:00
                      const mappedDevice = equipment.find((mappedEq: any) => mappedEq.equipmentNumber === eq.equipmentNumber)
                      return !mappedDevice || !mappedDevice.canUse2300Slot
                    })
                    .sort((a, b) => a.equipmentNumber.localeCompare(b.equipmentNumber))
                    .map((eq) => (
                      <option key={eq.equipmentNumber} value={eq.equipmentNumber} className="text-gray-900 font-medium">
                        {eq.equipmentNumber} {eq.inDatabase === false ? '(New)' : ''}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zone
                </label>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  disabled={!selectedEquipmentNumber}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white font-medium disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="" className="text-gray-500">Select zone</option>
                  {zones.map((zone: any) => (
                    <option key={zone.id} value={zone.id} className="text-gray-900 font-medium">
                      {zone.code} - {zone.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as 'ELEVATOR' | 'ESCALATOR')}
                  disabled={!selectedEquipmentNumber}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white font-medium disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="ELEVATOR" className="text-gray-900 font-medium">Elevator</option>
                  <option value="ESCALATOR" className="text-gray-900 font-medium">Escalator</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAddEquipment}
                  disabled={adding || !selectedEquipmentNumber || !selectedZone}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {adding ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">
          Loading equipment...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Device
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Zone
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Week Batch
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Can Use 23:00 Slot
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {equipment.length === 0 && !loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No devices found that can use the 23:00 slot. Add devices using the form above.
                  </td>
                </tr>
              ) : (
                equipment.map((eq) => (
                  <tr key={eq.id} className={eq.canUse2300Slot ? 'bg-green-50' : ''}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {eq.equipmentNumber}
                      {eq.canUse2300Slot && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                          23:00
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {eq.zone ? `${eq.zone.code} - ${eq.zone.name}` : 'No mapping'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {eq.batch ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-900">
                          {eq.batch}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={eq.canUse2300Slot || false}
                          onChange={() => handleToggle2300Slot(eq.id, eq.canUse2300Slot || false)}
                          disabled={updating === eq.id}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        <span className="ml-3 text-sm text-gray-900">
                          {eq.canUse2300Slot ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

