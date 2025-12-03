import { useMemo } from 'react'

export interface WorkOrder {
  id: string
  workOrderNumber: string
  r1PlannedDate: string
  status: string
}

export function useWorkOrderCategorization(workOrders: WorkOrder[], searchTerm: string) {
  return useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const toValidate: WorkOrder[] = []
    const toReschedule: WorkOrder[] = []
    const completed: WorkOrder[] = []

    workOrders.forEach((wo) => {
      const scheduleDate = new Date(wo.r1PlannedDate)
      scheduleDate.setHours(0, 0, 0, 0)

      // Filter by search term if provided
      if (searchTerm.trim()) {
        const search = searchTerm.trim().toLowerCase()
        if (
          !wo.workOrderNumber?.toLowerCase().includes(search)
        ) {
          return
        }
      }

      // Categorize based on status and date
      if (wo.status === 'COMPLETED' || wo.status === 'COMPLETED_LATE') {
        completed.push(wo)
      } else if (wo.status === 'MISSED') {
        toReschedule.push(wo)
      } else if (wo.status === 'RESCHEDULED') {
        // RESCHEDULED: Only show in reschedule tab if the new date has passed
        if (scheduleDate < today) {
          toReschedule.push(wo)
        }
      } else if (scheduleDate < today) {
        // Past date - needs validation
        toValidate.push(wo)
      }
    })

    return {
      toValidate,
      toReschedule,
      completed,
    }
  }, [workOrders, searchTerm])
}



