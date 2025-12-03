'use client'

import { useState } from 'react'
import { Devices } from '@/components/admin/Devices'
import { WorkOrderManagement } from '@/components/admin/WorkOrderManagement'
import { ZoneEngineerAssignment } from '@/components/admin/ZoneEngineerAssignment'
import { Navigation } from '@/components/shared/Navigation'

type AdminTab = 'devices' | 'workorders' | 'engineers'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('devices')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="ml-64 overflow-auto p-6">
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
                onClick={() => setActiveTab('devices')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'devices'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Devices
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
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'devices' && <Devices />}
            {activeTab === 'workorders' && <WorkOrderManagement />}
            {activeTab === 'engineers' && <ZoneEngineerAssignment />}
          </div>
        </div>
        </div>
      </main>
    </div>
  )
}

