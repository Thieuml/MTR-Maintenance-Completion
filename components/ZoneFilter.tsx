'use client'

import { useZones } from '@/lib/hooks'

interface ZoneFilterProps {
  selectedZoneId: string | null
  onZoneChange: (zoneId: string | null) => void
}

export function ZoneFilter({ selectedZoneId, onZoneChange }: ZoneFilterProps) {
  const { zones, isLoading } = useZones()

  return (
    <div className="flex items-center gap-4">
      <label htmlFor="zone-filter" className="text-sm font-medium text-gray-700">
        Zone:
      </label>
      <select
        id="zone-filter"
        value={selectedZoneId || ''}
        onChange={(e) => onZoneChange(e.target.value || null)}
        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">All Zones</option>
        {isLoading ? (
          <option disabled>Loading zones...</option>
        ) : (
          zones.map((zone: any) => (
            <option key={zone.id} value={zone.id}>
              {zone.code} - {zone.name}
            </option>
          ))
        )}
      </select>
    </div>
  )
}

