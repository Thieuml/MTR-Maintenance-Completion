'use client'

import { useState, useEffect } from 'react'
import { useZones } from '@/lib/hooks'

export function EquipmentMapping() {
  const { zones } = useZones()
  const [equipment, setEquipment] = useState<any[]>([])
  const [mappings, setMappings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<string>('')
  const [selectedZone, setSelectedZone] = useState<string>('')
  const [selectedBatch, setSelectedBatch] = useState<'A' | 'B'>('A')

  // Fetch equipment from API
  useEffect(() => {
    async function loadEquipment() {
      try {
        const res = await fetch('/api/admin/equipment')
        const data = await res.json()
        setEquipment(data.equipment || [])
      } catch (error) {
        console.error('Failed to load equipment:', error)
      }
    }
    loadEquipment()
  }, [])

  // Fetch existing mappings
  useEffect(() => {
    async function loadMappings() {
      try {
        const res = await fetch('/api/admin/equipment-mapping')
        const data = await res.json()
        setMappings(data.mappings || [])
      } catch (error) {
        console.error('Failed to load mappings:', error)
      }
    }
    loadMappings()
  }, [])

  const handleCreateMapping = async () => {
    if (!selectedEquipment || !selectedZone) {
      alert('Please select equipment and zone')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/equipment-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: selectedEquipment,
          zoneId: selectedZone,
          batch: selectedBatch,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create mapping')
      }

      const data = await res.json()
      setMappings([...mappings, data.mapping])
      setSelectedEquipment('')
      setSelectedZone('')
      alert('Mapping created successfully!')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create mapping')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteMapping = async (equipmentId: string) => {
    if (!confirm('Are you sure you want to delete this mapping?')) return

    try {
      const res = await fetch(`/api/admin/equipment-mapping?equipmentId=${equipmentId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete mapping')
      }

      setMappings(mappings.filter((m) => m.equipment.id !== equipmentId))
      alert('Mapping deleted successfully!')
    } catch (error) {
      alert('Failed to delete mapping')
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-900">Equipment-Zone-Week Mapping</h2>
      <p className="text-sm text-gray-700 mb-6">
        Map equipment from Looker to zones and week batches (A/B). Only mapped equipment will appear in schedules.
      </p>

      {/* Create Mapping Form */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-medium mb-4 text-gray-900">Create New Mapping</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Equipment
            </label>
            <select
              value={selectedEquipment}
              onChange={(e) => setSelectedEquipment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
            >
              <option value="">Select equipment...</option>
              {equipment.map((eq: any) => (
                <option key={eq.equipmentNumber} value={eq.id || eq.equipmentNumber}>
                  {eq.equipmentNumber} - {eq.name || eq.equipmentNumber}
                  {eq.inDatabase === false && ' (Not in DB)'}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
            >
              <option value="">Select zone...</option>
              {zones.map((zone: any) => (
                <option key={zone.id} value={zone.id}>
                  {zone.code} - {zone.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Week Batch
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value as 'A' | 'B')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
            >
              <option value="A">A</option>
              <option value="B">B</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleCreateMapping}
              disabled={loading || !selectedEquipment || !selectedZone}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Mapping'}
            </button>
          </div>
        </div>
      </div>

      {/* Existing Mappings */}
      <div>
        <h3 className="font-medium mb-4 text-gray-900">Existing Mappings ({mappings.length})</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Equipment
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Zone
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Week Batch
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mappings.map((mapping) => (
                <tr key={mapping.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {mapping.equipment.equipmentNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {mapping.zone.code} - {mapping.zone.name}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-900">
                      {mapping.batch}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => handleDeleteMapping(mapping.equipment.id)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {mappings.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No mappings yet. Create one above.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
