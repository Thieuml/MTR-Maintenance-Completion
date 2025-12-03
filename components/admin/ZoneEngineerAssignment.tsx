'use client'

import { useState, useEffect } from 'react'
import { useZones, useEngineers } from '@/lib/hooks'

export function ZoneEngineerAssignment() {
  const { zones } = useZones()
  // Fetch all engineers (all should be HK engineers in this system)
  const { engineers } = useEngineers()
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    engineerId: '',
    zoneId: '',
    isQualified: false, // Whether engineer is qualified (has CP & RW certs)
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
    if (!formData.engineerId || !formData.zoneId) {
      alert('Please select engineer and zone')
      return
    }

    // Get selected engineer to check if they actually have the certificates
    const selectedEngineer = engineers.find((eng: any) => eng.id === formData.engineerId)
    if (!selectedEngineer) {
      alert('Engineer not found')
      return
    }

    // If user marked as qualified but engineer doesn't have certs, show warning
    if (formData.isQualified && (!selectedEngineer.hasCPCert || !selectedEngineer.hasRWCert)) {
      const confirmed = confirm(
        `Warning: This engineer does not have CP and RW certificates. They cannot be assigned as qualified. Continue as non-qualified?`
      )
      if (!confirmed) return
      setFormData({ ...formData, isQualified: false })
    }

    setLoading(true)
    try {
      const role = formData.isQualified ? 'FIXED_QUALIFIED' : 'FIXED'
      
      const res = await fetch('/api/admin/zone-engineers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneId: formData.zoneId,
          engineerId: formData.engineerId,
          role,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to assign engineer')
      }

      // Refresh assignments list
      const refreshRes = await fetch('/api/admin/zone-engineers')
      const refreshData = await refreshRes.json()
      setAssignments(refreshData.assignments || [])
      setFormData({ engineerId: '', zoneId: '', isQualified: false })
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
      <h2 className="text-xl font-semibold mb-4 text-gray-900">Zone Engineer Assignments</h2>
      <p className="text-sm text-gray-700 mb-6">
        Assign engineers to zones. Qualified engineers have both CP & RW certificates.
      </p>

      {/* Assign Form */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h3 className="font-medium mb-4 text-gray-900">Assign Engineer to Zone</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Step 1: Select Engineer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Engineer <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.engineerId}
              onChange={(e) => {
                const selectedEng = engineers.find((eng: any) => eng.id === e.target.value)
                setFormData({ 
                  ...formData, 
                  engineerId: e.target.value,
                  // Auto-set qualified based on engineer's certificates
                  isQualified: selectedEng ? (selectedEng.hasCPCert && selectedEng.hasRWCert) : false
                })
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white"
            >
              <option value="">Select engineer...</option>
              {engineers
                .filter((eng: any) => eng.active) // Only show active engineers
                .map((eng: any) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.name}
                  </option>
                ))}
            </select>
            {formData.engineerId && (() => {
              const selectedEng = engineers.find((eng: any) => eng.id === formData.engineerId)
              if (!selectedEng) return null
              const hasCerts = selectedEng.hasCPCert && selectedEng.hasRWCert
              return (
                <div className="mt-1 text-xs text-gray-600">
                  {hasCerts ? (
                    <span className="text-green-600">✓ Has CP & RW certificates</span>
                  ) : (
                    <span className="text-orange-600">⚠ Missing CP or RW certificate</span>
                  )}
                </div>
              )
            })()}
          </div>
          
          {/* Step 2: Select Zone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Zone <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.zoneId}
              onChange={(e) => setFormData({ ...formData, zoneId: e.target.value })}
              disabled={!formData.engineerId}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">Select zone...</option>
              {zones.map((zone: any) => (
                <option key={zone.id} value={zone.id}>
                  {zone.code} - {zone.name}
                </option>
              ))}
            </select>
          </div>

          {/* Step 3: Qualified Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Qualified Status
            </label>
            <div className="flex items-center h-10">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isQualified}
                  onChange={(e) => {
                    const selectedEng = engineers.find((eng: any) => eng.id === formData.engineerId)
                    if (e.target.checked && selectedEng && (!selectedEng.hasCPCert || !selectedEng.hasRWCert)) {
                      alert('This engineer does not have CP and RW certificates. They cannot be marked as qualified.')
                      return
                    }
                    setFormData({ ...formData, isQualified: e.target.checked })
                  }}
                  disabled={!formData.engineerId}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-gray-700">
                  Qualified (CP & RW certificates)
                </span>
              </label>
            </div>
          </div>

          {/* Assign Button */}
          <div className="flex items-end">
            <button
              onClick={handleAssign}
              disabled={loading || !formData.engineerId || !formData.zoneId}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </div>
      </div>

      {/* Existing Assignments */}
      <div>
        <h3 className="font-medium mb-4 text-gray-900">Existing Assignments ({assignments.length})</h3>
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
                  Qualified
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {assignment.zone.code} - {assignment.zone.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{assignment.engineer.name}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      assignment.engineer.hasCPCert && assignment.engineer.hasRWCert
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-200 text-gray-800'
                    }`}>
                      {assignment.engineer.hasCPCert && assignment.engineer.hasRWCert ? 'Qualified' : 'Not Qualified'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => handleDelete(assignment.zoneId, assignment.engineerId)}
                      className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors relative group"
                      title="Remove assignment"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M18.8286 5.04036C19.0824 5.2942 19.0824 5.70575 18.8286 5.9596L12.9231 11.865L18.8286 17.7702C19.057 17.9987 19.0799 18.3549 18.8971 18.6089L18.8286 18.6895C18.5748 18.9433 18.1632 18.9433 17.9094 18.6895L12.0041 12.784L6.09872 18.6895C5.84488 18.9433 5.43333 18.9433 5.17949 18.6895C4.92565 18.4356 4.92565 18.0241 5.17949 17.7702L11.0851 11.865L5.17949 5.9596C4.95103 5.73114 4.92818 5.37493 5.11095 5.12092L5.17949 5.04036C5.43333 4.78652 5.84488 4.78652 6.09872 5.04036L12.0041 10.946L17.9094 5.04036C18.1632 4.78652 18.5748 4.78652 18.8286 5.04036Z" fill="currentColor"/>
                      </svg>
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity">
                        Remove assignment
                      </span>
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
