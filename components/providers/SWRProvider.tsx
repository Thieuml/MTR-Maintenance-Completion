'use client'

import { SWRConfig } from 'swr'

/**
 * Global SWR configuration provider
 * Optimizes data fetching across the application:
 * - Disables aggressive revalidation on focus (prevents refetch on tab switch)
 * - Sets reasonable refresh intervals
 * - Enables request deduplication
 */
export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Disable aggressive revalidation globally
        revalidateOnFocus: false, // Don't refetch on tab switch (major performance improvement)
        revalidateOnReconnect: true, // Only refetch on network reconnect
        revalidateIfStale: true, // Refetch if data is stale
        // Dedupe requests within 2 seconds (same request won't fire twice)
        dedupingInterval: 2000,
        // Error retry configuration
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        // Focus throttle - prevent rapid refetches
        focusThrottleInterval: 5000,
        // Keep previous data while revalidating (prevents flash of loading state)
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  )
}

