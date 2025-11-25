'use client'

import { useState, useEffect } from 'react'

export function Equipment2300Settings() {
  const [equipment, setEquipment] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  // Fetch equipment with mappings
  useEffect(() => {
    async function loadEquipment() {
      try {
        const res = await fetch('/api/admin/equipment-mapping')
        const data = await res.json()
        // Get equipment details for each mapping
        const equipmentPromises = data.mappings.map(async (m: any) => {
          try {
            const eqRes = await fetch(`/api/admin/equipment/${m.equipment.id}`)
            if (!eqRes.ok) {
              // If equipment not found, use mapping data
              return {
                ...m.equipment,
                zone: m.zone,
                batch: m.batch,
                canUse2300Slot: m.equipment.canUse2300Slot || false,
              }
            }
            const eqData = await eqRes.json()
            return {
              ...m.equipment,
              ...eqData.equipment,
              zone: m.zone,
              batch: m.batch,
            }
          } catch (err) {
            // Fallback to mapping data if fetch fails
            return {
              ...m.equipment,
              zone: m.zone,
              batch: m.batch,
              canUse2300Slot: m.equipment.canUse2300Slot || false,
            }
          }
        })
        const equipmentData = await Promise.all(equipmentPromises)
        setEquipment(equipmentData)
      } catch (error) {
        console.error('Failed to load equipment:', error)
      }
    }
    loadEquipment()
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
    } catch (error) {
      alert('Failed to update equipment')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-900">
        23:00 Slot Settings
      </h2>
      <p className="text-sm text-gray-700 mb-6">
        Mark units that are allowed to start servicing at 23:00 (earlier slot). These units are marked in green in the schedule.
      </p>

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
                Can Use 23:00 Slot
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {equipment.map((eq) => (
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
                  {eq.zone.code} - {eq.zone.name}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-900">
                    {eq.batch}
                  </span>
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
            ))}
          </tbody>
        </table>
        {equipment.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No mapped equipment found. Create mappings first.
          </div>
        )}
      </div>
    </div>
  )
}

