import React from 'react'

interface DatePickerModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (date: string) => void
  scheduleName?: string
}

export function DatePickerModal({ isOpen, onClose, onConfirm, scheduleName }: DatePickerModalProps) {
  const [selectedDate, setSelectedDate] = React.useState('')

  React.useEffect(() => {
    if (isOpen) {
      // Reset selected date when modal opens
      setSelectedDate('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (selectedDate) {
      onConfirm(selectedDate)
      onClose()
    }
  }

  // Calculate max date (yesterday)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const maxDate = yesterday.toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Mark as Completed on Different Date
        </h3>
        
        {scheduleName && (
          <p className="text-sm text-gray-600 mb-4">
            {scheduleName}
          </p>
        )}

        <div className="mb-6">
          <label htmlFor="completion-date" className="block text-sm font-medium text-gray-700 mb-2">
            Completion Date
          </label>
          <input
            id="completion-date"
            type="date"
            max={maxDate}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 text-base text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={{
              colorScheme: 'light',
            }}
          />
          <p className="mt-1 text-xs text-gray-500">
            Select the date when maintenance was actually completed. Only past dates are allowed.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedDate}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

