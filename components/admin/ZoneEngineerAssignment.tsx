'use client'

import { useState, useEffect } from 'react'
import { useZones, useEngineers } from '@/lib/hooks'

export function ZoneEngineerAssignment() {
  const { zones } = useZones()
  const { engineers } = useEngineers()
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    zoneId: '',
    engineerId: '',
    role: 'FIXED_QUALIFIED' as 'FIXED_QUALIFIED' | 'FIXED',
  })

  // Fetch existing assignments
  useEffect(() => {
    async function loadAssignments() {
      try {
        const res = await fetch('/api/admin/zone-engineers')
        const data = await res.json()
        setAssignments(data.assignments || [])
      } catch (error) {
        console.error('Failed to load assignments:', error)
      }
    }
    loadAssignments()
  }, [])

  const handleAssign = async () => {
    if (!formData.zoneId || !formData.engineerId) {
      alert('Please select zone and engineer')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/zone-engineers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneId: formData.zoneId,
          engineerId: formData.engineerId,
          role: formData.role,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to assign engineer')
      }

      const data = await res.json()
      setAssignments([...assignments, data.assignment])
      setFormData({ zoneId: '', engineerId: '', role: 'FIXED_QUALIFIED' })
      alert('Engineer assigned successfully!')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to assign engineer')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (zoneId: string, engineerId: string) => {
    if (!confirm('Are you sure you want to remove this assignment?')) return

    try {
      const res = await fetch(
        `/api/admin/zone-engineers?zoneId=${zoneId}&engineerId=${engineerId}`,
        { method: 'DELETE' }
      )

      if (!res.ok) {
        throw new Error('Failed to delete assignment')
      }

      setAssignments(
        assignments.filter(
          (a) => !(a.zoneId === zoneId && a.engineerId === engineerId)
        )
      )
      alert('Assignment removed successfully!')
    } catch (error) {
      alert('Failed to remove assignment')
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Zone Engineer Assignments</h2>
      <p className="text-sm text-gray-600 mb-6">
        Assign engineers to zones. FIXED_QUALIFIED requires CP & RW certificates.
      </p>

      {/* Assign Form */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h3 className="font-medium mb-4">Assign Engineer to Zone</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Zone
            </label>
            <select
              value={formData.zoneId}
              onChange={(e) => setFormData({ ...formData, zoneId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
              Engineer
            </label>
            <select
              value={formData.engineerId}
              onChange={(e) =>
                setFormData({ ...formData, engineerId: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Select engineer...</option>
              {engineers.map((eng: any) => (
                <option key={eng.id} value={eng.id}>
                  {eng.name}
                  {eng.hasCPCert && eng.hasRWCert && ' (CP+RW)'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as 'FIXED_QUALIFIED' | 'FIXED' })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="FIXED_QUALIFIED">Fixed Qualified (CP+RW)</option>
              <option value="FIXED">Fixed</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAssign}
              disabled={loading || !formData.zoneId || !formData.engineerId}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </div>
      </div>

      {/* Existing Assignments */}
      <div>
        <h3 className="font-medium mb-4">Existing Assignments ({assignments.length})</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Zone
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Engineer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Role
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td className="px-4 py-3 text-sm">
                    {assignment.zone.code} - {assignment.zone.name}
                  </td>
                  <td className="px-4 py-3 text-sm">{assignment.engineer.name}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100">
                      {assignment.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => handleDelete(assignment.zoneId, assignment.engineerId)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {assignments.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No assignments yet. Create one above.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
