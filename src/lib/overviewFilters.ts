import type { CalendarDateRange } from './dashboardDateRange'
import { defaultCalendarRangeLastNDays } from './dashboardDateRange'

export type OverviewFilters = {
  selectedClient: string
  selectedPlatform: string
  selectedAdAccount: string
  dateRange: CalendarDateRange
}

export type OverviewUiPrefs = {
  businessType: 'leadgen' | 'ecommerce'
  businessTypeManual: boolean
  selectedMetric: 'spend' | 'ctr' | 'conversions' | 'costperconv' | 'roas' | 'mer'
  secondaryMetric: 'spend' | 'ctr' | 'conversions' | 'costperconv' | 'roas' | 'mer' | 'none'
  showRolling7: boolean
  heatedDrillTab: 'daily' | 'meta' | 'google' | 'keywords' | 'search' | 'adsets'
}

const STORAGE_KEY = 'uni_overview_filters_v1'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const DEFAULT_OVERVIEW_FILTERS: OverviewFilters = {
  selectedClient: 'all',
  selectedPlatform: 'all',
  selectedAdAccount: '',
  dateRange: defaultCalendarRangeLastNDays(30),
}

export const DEFAULT_OVERVIEW_UI: OverviewUiPrefs = {
  businessType: 'ecommerce',
  businessTypeManual: false,
  selectedMetric: 'roas',
  secondaryMetric: 'none',
  showRolling7: false,
  heatedDrillTab: 'daily',
}

function isValidDate(s: string | null): s is string {
  return !!s && DATE_RE.test(s)
}

function sanitizeClient(v: string | null): string {
  if (!v || v === 'all') return 'all'
  return UUID_RE.test(v) ? v : 'all'
}

function sanitizePlatform(v: string | null): string {
  if (!v || v === 'all') return 'all'
  if (/^[a-z0-9_]+$/i.test(v)) return v
  return 'all'
}

function sanitizeAccount(v: string | null): string {
  if (!v) return ''
  return v.length <= 128 ? v : ''
}

export function filtersFromSearchParams(params: URLSearchParams): Partial<OverviewFilters> | null {
  const from = params.get('from')
  const to = params.get('to')
  const hasUrlFilters =
    params.has('client') ||
    params.has('platform') ||
    params.has('account') ||
    params.has('from') ||
    params.has('to')

  if (!hasUrlFilters) return null

  const partial: Partial<OverviewFilters> = {}
  if (params.has('client')) partial.selectedClient = sanitizeClient(params.get('client'))
  if (params.has('platform')) partial.selectedPlatform = sanitizePlatform(params.get('platform'))
  if (params.has('account')) partial.selectedAdAccount = sanitizeAccount(params.get('account'))
  if (isValidDate(from) && isValidDate(to)) {
    partial.dateRange = { start: from, end: to }
  }
  return partial
}

export function filtersToSearchParams(
  filters: OverviewFilters,
  existing?: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(existing ?? undefined)

  if (filters.selectedClient === 'all') next.delete('client')
  else next.set('client', filters.selectedClient)

  if (filters.selectedPlatform === 'all') next.delete('platform')
  else next.set('platform', filters.selectedPlatform)

  if (!filters.selectedAdAccount) next.delete('account')
  else next.set('account', filters.selectedAdAccount)

  if (filters.dateRange.start && filters.dateRange.end) {
    next.set('from', filters.dateRange.start)
    next.set('to', filters.dateRange.end)
  } else {
    next.delete('from')
    next.delete('to')
  }

  return next
}

type StoredPayload = {
  filters?: Partial<OverviewFilters>
  ui?: Partial<OverviewUiPrefs>
}

export function readStoredOverviewState(): StoredPayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredPayload
  } catch {
    return null
  }
}

export function writeStoredOverviewState(filters: OverviewFilters, ui: OverviewUiPrefs) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ filters, ui }))
  } catch {
    /* ignore quota */
  }
}

export function mergeOverviewFilters(
  base: OverviewFilters,
  partial?: Partial<OverviewFilters> | null,
): OverviewFilters {
  if (!partial) return base
  return {
    selectedClient: partial.selectedClient ?? base.selectedClient,
    selectedPlatform: partial.selectedPlatform ?? base.selectedPlatform,
    selectedAdAccount: partial.selectedAdAccount ?? base.selectedAdAccount,
    dateRange: partial.dateRange?.start && partial.dateRange?.end ? partial.dateRange : base.dateRange,
  }
}

export function mergeOverviewUi(base: OverviewUiPrefs, partial?: Partial<OverviewUiPrefs> | null): OverviewUiPrefs {
  if (!partial) return base
  return { ...base, ...partial }
}
