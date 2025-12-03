import useSWR, { SWRConfiguration } from 'swr'

/**
 * Fetcher function for SWR
 */
async function fetcher(url: string) {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    // @ts-ignore
    error.info = await res.json()
    // @ts-ignore
    error.status = res.status
    throw error
  }
  return res.json()
}

/**
 * Hook for fetching schedules
 */
export function useSchedule(
  zoneId?: string,
  from?: string,
  to?: string,
  status?: string,
  includeVisits: boolean = false // Default to false for performance
) {
  const params = new URLSearchParams()
  if (zoneId) params.append('zoneId', zoneId)
  if (from) params.append('from', from)
  if (to) params.append('to', to)
  if (status) params.append('status', status)
  if (!includeVisits) params.append('includeVisits', 'false')

  const { data, error, isLoading, mutate } = useSWR(
    `/api/schedules?${params.toString()}`,
    fetcher,
    {
      refreshInterval: 120000, // Refresh every 2 minutes (reduced from 30 seconds)
      // revalidateOnFocus is disabled globally in SWRProvider
    }
  )

  return {
    schedules: data?.schedules || [],
    isLoading,
    isError: error,
    mutate,
  }
}

/**
 * Hook for fetching engineers
 */
export function useEngineers(
  zoneId?: string,
  hasCertificates?: boolean,
  search?: string
) {
  const params = new URLSearchParams()
  if (zoneId) params.append('zoneId', zoneId)
  if (hasCertificates) params.append('hasCertificates', 'true')
  if (search) params.append('search', search)

  const { data, error, isLoading, mutate } = useSWR(
    `/api/engineers?${params.toString()}`,
    fetcher,
    {
      refreshInterval: 120000, // Refresh every 2 minutes (reduced from 60 seconds)
      // revalidateOnFocus is disabled globally in SWRProvider
    }
  )

  return {
    engineers: data?.engineers || [],
    isLoading,
    isError: error,
    mutate,
  }
}

/**
 * Hook for fetching zones
 */
export function useZones() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/zones',
    fetcher,
    {
      // Zones don't change often, no refresh interval needed
      // revalidateOnFocus is disabled globally in SWRProvider
    }
  )

  return {
    zones: data?.zones || [],
    isLoading,
    isError: error,
    mutate,
  }
}

