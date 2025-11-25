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
  status?: string
) {
  const params = new URLSearchParams()
  if (zoneId) params.append('zoneId', zoneId)
  if (from) params.append('from', from)
  if (to) params.append('to', to)
  if (status) params.append('status', status)

  const { data, error, isLoading, mutate } = useSWR(
    `/api/schedules?${params.toString()}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
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
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true,
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
      revalidateOnFocus: false, // Zones don't change often
    }
  )

  return {
    zones: data?.zones || [],
    isLoading,
    isError: error,
    mutate,
  }
}

