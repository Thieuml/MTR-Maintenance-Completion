'use client'

import { useState } from 'react'
import { EquipmentMapping } from '@/components/admin/EquipmentMapping'
import { WorkOrderManagement } from '@/components/admin/WorkOrderManagement'
import { ZoneEngineerAssignment } from '@/components/admin/ZoneEngineerAssignment'
import { Equipment2300Settings } from '@/components/admin/Equipment2300Settings'
import { Navigation } from '@/components/Navigation'

type AdminTab = 'mapping' | 'workorders' | 'engineers' | '2300settings'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('mapping')

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Navigation />
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Admin Panel
          </h1>
          <p className="text-gray-700">
            Manage equipment mappings, work orders, and engineer assignments
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('mapping')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'mapping'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Unit Mapping
              </button>
              <button
                onClick={() => setActiveTab('workorders')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'workorders'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Work Orders
              </button>
              <button
                onClick={() => setActiveTab('engineers')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'engineers'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Engineer Assignments
              </button>
              <button
                onClick={() => setActiveTab('2300settings')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === '2300settings'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                23:00 Slot Settings
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'mapping' && <EquipmentMapping />}
            {activeTab === 'workorders' && <WorkOrderManagement />}
            {activeTab === 'engineers' && <ZoneEngineerAssignment />}
            {activeTab === '2300settings' && <Equipment2300Settings />}
          </div>
        </div>
        </div>
      </main>
    </div>
  )
}

