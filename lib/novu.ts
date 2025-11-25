/**
 * Novu integration for MTR Maintenance Tracking
 * 
 * Notifications in Chinese for engineers:
 * - Tonight's planned maintenance units
 * - Missed committed date alerts
 */

import { Novu } from '@novu/api'

/**
 * Novu client singleton
 */
let novuClient: Novu | null = null

export function getNovuClient(): Novu {
  if (!novuClient) {
    const apiKey = process.env.NOVU_API_KEY
    if (!apiKey) {
      throw new Error('NOVU_API_KEY environment variable is not set')
    }
    
    const apiHostname = process.env.NOVU_API_HOSTNAME
    
    const options: { secretKey: string; serverURL?: string } = {
      secretKey: apiKey,
    }
    
    if (apiHostname) {
      options.serverURL = apiHostname
    }
    
    novuClient = new Novu(options)
  }
  return novuClient
}

/**
 * Notify engineer of tonight's planned maintenance units
 */
export async function notifyTonightSchedule(params: {
  engineerId: string
  engineerEmail?: string | null
  engineerName: string
  units: Array<{
    equipmentNumber: string
    station: string
    timeSlot: string
    workOrderNumber?: string
  }>
  date: Date
}) {
  try {
    const novu = getNovuClient()
    const subscriberId = params.engineerId
    
    // Create or update subscriber
    if (params.engineerEmail) {
      try {
        const nameParts = params.engineerName.trim().split(/\s+/)
        const firstName = nameParts[0] || params.engineerName
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null
        
        await novu.subscribers.create({
          subscriberId,
          email: params.engineerEmail,
          firstName,
          lastName,
        })
      } catch (subscriberError: any) {
        console.log(`[Novu] Subscriber note: ${subscriberError.message || 'Subscriber may already exist'}`)
      }
    }
    
    // Format date in Chinese
    const dateStr = params.date.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    })
    
    // Format units list
    const unitsList = params.units.map(unit => 
      `- ${unit.equipmentNumber} (${unit.station}) - ${unit.timeSlot}${unit.workOrderNumber ? ` (OR: ${unit.workOrderNumber})` : ''}`
    ).join('\n')
    
    await novu.trigger({
      workflowId: 'tonight-schedule',
      to: {
        subscriberId,
        email: params.engineerEmail || undefined,
      },
      payload: {
        engineerName: params.engineerName,
        date: dateStr,
        dateISO: params.date.toISOString(),
        unitsCount: params.units.length,
        unitsList,
        units: params.units,
      },
    })
    
    console.log(`[Novu] Tonight's schedule notification sent to ${params.engineerName} (${subscriberId})`)
  } catch (error) {
    console.error('[Novu] Failed to send tonight schedule notification:', error)
  }
}

/**
 * Notify engineer of missed committed date
 */
export async function notifyMissedCommittedDate(params: {
  engineerId: string
  engineerEmail?: string | null
  engineerName: string
  equipmentNumber: string
  station: string
  committedDate: Date
  dueDate: Date
  workOrderNumber?: string
}) {
  try {
    const novu = getNovuClient()
    const subscriberId = params.engineerId
    
    // Create or update subscriber
    if (params.engineerEmail) {
      try {
        const nameParts = params.engineerName.trim().split(/\s+/)
        const firstName = nameParts[0] || params.engineerName
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null
        
        await novu.subscribers.create({
          subscriberId,
          email: params.engineerEmail,
          firstName,
          lastName,
        })
      } catch (subscriberError: any) {
        console.log(`[Novu] Subscriber note: ${subscriberError.message || 'Subscriber may already exist'}`)
      }
    }
    
    // Format dates in Chinese
    const committedDateStr = params.committedDate.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    })
    
    const dueDateStr = params.dueDate.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
    })
    
    await novu.trigger({
      workflowId: 'missed-committed-date',
      to: {
        subscriberId,
        email: params.engineerEmail || undefined,
      },
      payload: {
        engineerName: params.engineerName,
        equipmentNumber: params.equipmentNumber,
        station: params.station,
        committedDate: committedDateStr,
        committedDateISO: params.committedDate.toISOString(),
        dueDate: dueDateStr,
        dueDateISO: params.dueDate.toISOString(),
        workOrderNumber: params.workOrderNumber || '',
      },
    })
    
    console.log(`[Novu] Missed committed date notification sent to ${params.engineerName} (${subscriberId})`)
  } catch (error) {
    console.error('[Novu] Failed to send missed committed date notification:', error)
  }
}

/**
 * Create Novu workflows for MTR maintenance notifications
 */
export async function createMTRWorkflows() {
  try {
    const novu = getNovuClient()
    
    // Check existing workflows
    const workflowsResponse = await novu.workflows.list({ offset: 0, limit: 100 })
    const workflows = workflowsResponse.result?.workflows || []
    
    // Create "tonight-schedule" workflow
    const tonightScheduleExists = workflows.find((w: any) => 
      w.workflowId === 'tonight-schedule' || w.identifier === 'tonight-schedule'
    )
    
    if (!tonightScheduleExists) {
      await novu.workflows.create({
        name: 'Tonight Schedule Reminder',
        workflowId: 'tonight-schedule',
        description: 'Notifies engineers of their planned maintenance units for tonight',
        tags: ['mtr', 'schedule', 'reminder'],
        active: true,
        steps: [
          {
            type: 'in_app' as const,
            name: 'In-App Notification',
            stepId: 'in-app-notification',
            controlValues: {
              subject: '今晚維護計劃 - {{payload.date}}',
              body: '{{payload.engineerName}}，您今晚需要完成以下 {{payload.unitsCount}} 個單位的維護：\n\n{{payload.unitsList}}',
            },
          },
        ],
      })
      console.log('[Novu] ✅ Created tonight-schedule workflow')
    }
    
    // Create "missed-committed-date" workflow
    const missedDateExists = workflows.find((w: any) => 
      w.workflowId === 'missed-committed-date' || w.identifier === 'missed-committed-date'
    )
    
    if (!missedDateExists) {
      await novu.workflows.create({
        name: 'Missed Committed Date Alert',
        workflowId: 'missed-committed-date',
        description: 'Notifies engineers when they miss a committed maintenance date',
        tags: ['mtr', 'alert', 'compliance'],
        active: true,
        steps: [
          {
            type: 'in_app' as const,
            name: 'In-App Notification',
            stepId: 'in-app-notification',
            controlValues: {
              subject: '錯過承諾日期 - {{payload.equipmentNumber}}',
              body: '{{payload.engineerName}}，您錯過了 {{payload.equipmentNumber}} ({{payload.station}}) 的承諾維護日期 {{payload.committedDate}}。\n\n請立即與主管協調重新安排。最遲完成日期：{{payload.dueDate}}',
            },
          },
        ],
      })
      console.log('[Novu] ✅ Created missed-committed-date workflow')
    }
    
    return { success: true }
  } catch (error: any) {
    console.error('[Novu] Failed to create workflows:', error)
    throw new Error(`Failed to create workflows: ${error.message || JSON.stringify(error)}`)
  }
}

