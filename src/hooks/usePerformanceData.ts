import { useQuery } from '@tanstack/react-query'
import { db, PerformanceFilters } from '../lib/api'

/**
 * Hook for fetching performance data with caching
 */
export function usePerformanceData(filters: PerformanceFilters) {
  return useQuery({
    queryKey: ['performance', filters],
    queryFn: () => db.getDailyPerformance(filters),
    staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  })
}

/**
 * Hook for fetching clients
 */
export function useClients() {
  return useQuery({
    queryKey: ['clients_table'],
    queryFn: db.getClients,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
}

/**
 * Hook for fetching available platforms
 */
export function useAvailablePlatforms() {
  return useQuery({
    queryKey: ['available_platforms'],
    queryFn: db.getAvailablePlatforms,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })
}

/**
 * Hook for fetching Meta creatives
 */
export function useMetaCreatives(clientId?: string, enabled = true) {
  return useQuery({
    queryKey: ['meta_creatives', clientId],
    queryFn: () => db.getMetaCreatives(clientId),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}

/**
 * Hook for fetching Google keywords
 */
export function useGoogleKeywords(clientId?: string, enabled = true) {
  return useQuery({
    queryKey: ['google_keywords', clientId],
    queryFn: () => db.getGoogleKeywords(clientId),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}
