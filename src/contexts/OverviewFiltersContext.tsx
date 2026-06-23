import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CalendarDateRange } from '../lib/dashboardDateRange'
import { defaultCalendarRangeLastNDays } from '../lib/dashboardDateRange'
import { getDashboardSettings } from '../lib/settings'
import {
  DEFAULT_OVERVIEW_FILTERS,
  DEFAULT_OVERVIEW_UI,
  filtersFromSearchParams,
  filtersToSearchParams,
  mergeOverviewFilters,
  mergeOverviewUi,
  readStoredOverviewState,
  writeStoredOverviewState,
  type OverviewFilters,
  type OverviewUiPrefs,
} from '../lib/overviewFilters'

type OverviewFiltersContextValue = {
  ready: boolean
  filters: OverviewFilters
  ui: OverviewUiPrefs
  setSelectedClient: (clientId: string) => void
  setSelectedPlatform: (platformId: string) => void
  setSelectedAdAccount: (accountId: string) => void
  setDateRange: (range: CalendarDateRange) => void
  patchUi: (patch: Partial<OverviewUiPrefs>) => void
}

const OverviewFiltersContext = createContext<OverviewFiltersContextValue | null>(null)

export function OverviewFiltersProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [ready, setReady] = useState(false)
  const [filters, setFilters] = useState<OverviewFilters>(DEFAULT_OVERVIEW_FILTERS)
  const [ui, setUi] = useState<OverviewUiPrefs>(DEFAULT_OVERVIEW_UI)
  const skipUrlSync = useRef(true)
  const skipStorageSync = useRef(true)

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      const urlPartial = filtersFromSearchParams(searchParams)
      const stored = readStoredOverviewState()

      let nextFilters = mergeOverviewFilters(DEFAULT_OVERVIEW_FILTERS, stored?.filters)
      nextFilters = mergeOverviewFilters(nextFilters, urlPartial)

      let nextUi = mergeOverviewUi(DEFAULT_OVERVIEW_UI, stored?.ui)

      if (!urlPartial?.dateRange?.start && !stored?.filters?.dateRange?.start) {
        try {
          const settings = await getDashboardSettings('default_user')
          if (cancelled) return
          nextFilters = {
            ...nextFilters,
            dateRange: defaultCalendarRangeLastNDays(settings.defaultDateRange),
          }
          nextUi = mergeOverviewUi(nextUi, {
            businessType: settings.defaultBusinessType,
            selectedMetric: settings.defaultMetric,
          })
        } catch {
          /* keep defaults */
        }
      }

      if (cancelled) return
      setFilters(nextFilters)
      setUi(nextUi)
      setReady(true)
      skipUrlSync.current = false
      skipStorageSync.current = false
    }

    hydrate()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount
  }, [])

  useEffect(() => {
    if (!ready || skipUrlSync.current) return
    setSearchParams(
      prev => {
        const next = filtersToSearchParams(filters, prev)
        if (next.toString() === prev.toString()) return prev
        return next
      },
      { replace: true },
    )
  }, [filters, ready, setSearchParams])

  useEffect(() => {
    if (!ready || skipStorageSync.current) return
    writeStoredOverviewState(filters, ui)
  }, [filters, ui, ready])

  const patchFilters = useCallback((patch: Partial<OverviewFilters>) => {
    setFilters(prev => ({ ...prev, ...patch }))
  }, [])

  const setSelectedClient = useCallback(
    (clientId: string) => patchFilters({ selectedClient: clientId, selectedAdAccount: '' }),
    [patchFilters],
  )

  const setSelectedPlatform = useCallback(
    (platformId: string) => patchFilters({ selectedPlatform: platformId, selectedAdAccount: '' }),
    [patchFilters],
  )

  const setSelectedAdAccount = useCallback(
    (accountId: string) => patchFilters({ selectedAdAccount: accountId }),
    [patchFilters],
  )

  const setDateRange = useCallback(
    (range: CalendarDateRange) => patchFilters({ dateRange: range }),
    [patchFilters],
  )

  const patchUi = useCallback((patch: Partial<OverviewUiPrefs>) => {
    setUi(prev => ({ ...prev, ...patch }))
  }, [])

  const value = useMemo(
    () => ({
      ready,
      filters,
      ui,
      setSelectedClient,
      setSelectedPlatform,
      setSelectedAdAccount,
      setDateRange,
      patchUi,
    }),
    [
      ready,
      filters,
      ui,
      setSelectedClient,
      setSelectedPlatform,
      setSelectedAdAccount,
      setDateRange,
      patchUi,
    ],
  )

  return <OverviewFiltersContext.Provider value={value}>{children}</OverviewFiltersContext.Provider>
}

export function useOverviewFilters() {
  const ctx = useContext(OverviewFiltersContext)
  if (!ctx) throw new Error('useOverviewFilters must be used within OverviewFiltersProvider')
  return ctx
}
