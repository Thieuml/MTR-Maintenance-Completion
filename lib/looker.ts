/**
 * Looker API integration utilities for MTR Maintenance Tracking
 * 
 * Integrations:
 * - Look ID 160: Engineers list (filtered on HK)
 * - Look ID 167: MTR devices list
 * - Look ID 168: Maintenance visits from last 3 months
 */

import { Looker40SDK } from '@looker/sdk'
import { LookerNodeSDK, NodeSession, NodeTransport } from '@looker/sdk-node'
import { ApiSettings, type IApiSection } from '@looker/sdk-rtl'

/**
 * Custom settings that implements IApiSettings interface
 */
class CustomNodeSettings extends ApiSettings {
  private readonly configValues: IApiSection
  
  constructor(baseUrl: string, clientId: string, clientSecret: string) {
    super({ base_url: baseUrl } as any)
    this.configValues = {
      base_url: baseUrl,
      client_id: clientId,
      client_secret: clientSecret,
    }
  }
  
  readConfig(_section?: string): IApiSection {
    return this.configValues
  }
}

/**
 * Initialize Looker SDK client
 */
export async function getLookerClient(): Promise<Looker40SDK> {
  if (process.env.LOOKER_API_BASE_URL && process.env.LOOKER_CLIENT_ID && process.env.LOOKER_CLIENT_SECRET) {
    let baseUrl = process.env.LOOKER_API_BASE_URL.trim()
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1)
    }
    
    const clientId = process.env.LOOKER_CLIENT_ID.trim()
    const clientSecret = process.env.LOOKER_CLIENT_SECRET.trim()
    
    const settings = new CustomNodeSettings(baseUrl, clientId, clientSecret)
    const transport = new NodeTransport(settings)
    const session = new NodeSession(settings, transport)
    return new Looker40SDK(session)
  } else {
    return LookerNodeSDK.init40()
  }
}

/**
 * Query Looker for data
 */
export async function fetchDataFromLooker(
  lookId?: string,
  queryId?: string,
  query?: any
): Promise<any[]> {
  const sdk = await getLookerClient()
  
  try {
    let result
    
    if (lookId) {
      console.log(`[Looker] Running Look ID: ${lookId}`)
      const response = await sdk.run_look({
        look_id: lookId,
        result_format: 'json',
      })
      result = response
    } else if (queryId) {
      console.log(`[Looker] Running Query ID: ${queryId}`)
      const response = await sdk.run_query({
        query_id: queryId,
        result_format: 'json',
      })
      result = response
    } else if (query) {
      console.log(`[Looker] Running raw query`)
      const response = await sdk.run_inline_query({
        result_format: 'json',
        body: query,
      })
      result = response
    } else {
      throw new Error('Either lookId, queryId, or query must be provided')
    }
    
    // Parse the result
    let parsedData: any[] = []
    
    if (typeof result === 'string') {
      parsedData = JSON.parse(result)
    } else if (Array.isArray(result)) {
      parsedData = result
    } else if (result && typeof result === 'object') {
      if ('data' in result) {
        parsedData = Array.isArray((result as any).data) ? (result as any).data : []
      } else if ('rows' in result) {
        parsedData = Array.isArray((result as any).rows) ? (result as any).rows : []
      } else if ('values' in result) {
        parsedData = Array.isArray((result as any).values) ? (result as any).values : []
      } else {
        const arrayKeys = Object.keys(result).filter(key => Array.isArray((result as any)[key]))
        if (arrayKeys.length > 0) {
          parsedData = (result as any)[arrayKeys[0]]
        } else {
          parsedData = [result]
        }
      }
    }
    
    console.log(`[Looker] Parsed ${parsedData.length} rows`)
    return parsedData
  } catch (error) {
    console.error('[Looker] Error fetching data:', error)
    throw error
  }
}

/**
 * Fetch engineers from Looker (Look ID 160)
 */
export async function fetchEngineersFromLooker(): Promise<any[]> {
  const lookId = process.env.LOOKER_ENGINEERS_LOOK_ID || '160'
  return fetchDataFromLooker(lookId)
}

/**
 * Fetch MTR devices from Looker (Look ID 167)
 */
export async function fetchMTRDevicesFromLooker(): Promise<any[]> {
  const lookId = process.env.LOOKER_DEVICES_LOOK_ID || '167'
  return fetchDataFromLooker(lookId)
}

/**
 * Fetch maintenance visits from Looker (Look ID 168)
 */
export async function fetchMaintenanceVisitsFromLooker(): Promise<any[]> {
  const lookId = process.env.LOOKER_VISITS_LOOK_ID || '168'
  return fetchDataFromLooker(lookId)
}

/**
 * Test Looker connection
 */
export async function testLookerConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const sdk = await getLookerClient()
    await sdk.ok(sdk.me())
    return { connected: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Looker] Connection test failed:', errorMessage)
    return { connected: false, error: errorMessage }
  }
}

