import { useState, useEffect, useCallback, useMemo, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  Database, ChevronDown, TrendingUp, DollarSign, CreditCard,
  AlertCircle, Calendar, Settings, MousePointer2, ShoppingCart, Users,
  ArrowUpRight, ArrowDownRight, ArrowUpDown, ArrowUp, ArrowDown, BookOpen,
} from 'lucide-react'
import MetaAdSetPerformanceTable from '../components/MetaAdSetPerformanceTable'
import AgencyInsightPies from '../components/AgencyInsightPies'
import OverviewAiNotesRail from '../components/OverviewAiNotesRail'
import PlatformBadge from '../components/PlatformBadge'
import { db } from '../lib/api'
import PerformanceRhythmSection from '../components/PerformanceRhythmSection'
import ReportSectionHeader from '../components/ReportSectionHeader'
import ResizableColgroup from '../components/ResizableColgroup'
import { useResizableColumns } from '../hooks/useResizableColumns'
import { getDashboardSettings, DEFAULT_SETTINGS } from '../lib/settings'
import { useAuth } from '../contexts/AuthContext'
import { useUiDensity } from '../contexts/UiDensityContext'
import { canAccessAlerts, scopedClientIdFromUser } from '../lib/rbac'
import AccountDateRangePicker from '../components/AccountDateRangePicker'
import FilterShell from '../components/FilterShell'
import { defaultCalendarRangeLastNDays, previousComparableCalendarRange } from '../lib/dashboardDateRange'
import { AGENCY_REPORTING_TZ } from '../lib/hourlyBuckets'
import { filterAdsDailyRows, sumAdsMetrics } from '../lib/adsRows'
import { rollupShopifyDaily } from '../lib/shopifyMetrics'
import { shouldShowHeatedMer, shopifyAfterReturnForShapedRow } from '../lib/heatedMerEligibility'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Area, Line, LineChart, ReferenceLine
} from 'recharts'
import {
  dailySpendPace,
  parseAdSpendTargets,
  resolveActiveSpendTarget,
} from '../lib/adSpendTarget'

// ── Sort helpers ──────────────────────────────────────────────────────────────
function useTableSort(defaultField: string, defaultDir: 'asc' | 'desc' = 'desc') {
  const [sortField, setSortField] = useState(defaultField)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultDir)
  const toggle = useCallback((field: string) => {
    setSortField(prev => {
      if (prev === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
      else { setSortDir('desc') }
      return field
    })
  }, [])
  const sortRows = (rows: any[], numericFields: string[] = []) =>
    [...rows].sort((a, b) => {
      const av = a[sortField] ?? 0, bv = b[sortField] ?? 0
      if (typeof av === 'string' && !numericFields.includes(sortField))
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av)
    })
  return { sortField, sortDir, toggle, sortRows }
}

function SortTh({ label, field, sort, align = 'right' }: { label: string; field: string; sort: ReturnType<typeof useTableSort>; align?: 'left' | 'right' }) {
  const active = sort.sortField === field
  const Icon = !active ? ArrowUpDown : sort.sortDir === 'asc' ? ArrowUp : ArrowDown
  const alignClass = align === 'left' ? 'text-left' : 'text-right'
  return (
    <th className={`px-4 py-3 text-xs font-medium text-gray-500 ${alignClass}`}>
      <button
        onClick={() => sort.toggle(field)}
        className={`flex items-center gap-1 text-xs font-medium uppercase hover:text-gray-800 ${align === 'right' ? 'ml-auto' : ''} ${active ? 'text-[var(--brand-600)]' : 'text-gray-500'}`}
      >
        {label}
        <Icon size={11} className={active ? 'text-[var(--brand-600)]' : 'text-gray-400'} />
      </button>
    </th>
  )
}
// ──────────────────────────────────────────────────────────────────────────────

interface DailyPerformance {
  id: string
  client_id: string
  client_name?: string
  date: string
  platform: string
  ad_account_id?: string
  data_timezone?: string | null
  impressions: number
  clicks: number
  conversions: number
  cost: number
  revenue: number
}

interface Client {
  id: string
  name: string
  industry?: string
  business_type?: 'leadgen' | 'ecommerce'
  currency?: string
  currency_symbol?: string
  meta_ad_account_id?: string | null
  google_ads_customer_id?: string | null
  target_ad_spend_30d_by_platform?: unknown
}

type MetricKey = 'spend' | 'ctr' | 'conversions' | 'costperconv' | 'roas' | 'mer'

type AggregateRowsOptions = {
  sumFields?: string[]
  weightedAvg?: { outKey: string; valueKey: string; weightKey: string }[]
}

// Aggregate rows by a key field (campaign, adset, ad), summing metrics across dates
function aggregateRows<T extends Record<string, any>>(
  rows: T[],
  keyField: string,
  nameField: string,
  extraFields: string[] = [],
  options?: AggregateRowsOptions
): any[] {
  const sumFields = options?.sumFields ?? []
  const weightedAvg = options?.weightedAvg ?? []
  const map = new Map<string, any>()
  for (const row of rows) {
    const key = row[keyField] || 'unknown'
    if (!map.has(key)) {
      const entry: any = {
        _key: key,
        [keyField]: key,
        [nameField]: row[nameField] || key,
        spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0,
      }
      for (const f of extraFields) entry[f] = row[f] ?? null
      for (const f of sumFields) entry[f] = 0
      for (const w of weightedAvg) {
        entry[`__wavg_${w.outKey}_n`] = 0
        entry[`__wavg_${w.outKey}_d`] = 0
      }
      map.set(key, entry)
    }
    const entry = map.get(key)!
    entry.spend += Number(row.spend) || 0
    entry.impressions += Number(row.impressions) || 0
    entry.clicks += Number(row.clicks) || 0
    entry.conversions += Number(row.conversions) || 0
    entry.revenue += Number(row.revenue) || 0
    for (const f of sumFields) entry[f] += Number(row[f]) || 0
    for (const w of weightedAvg) {
      const weight = Number(row[w.weightKey]) || 0
      const val = Number(row[w.valueKey]) || 0
      entry[`__wavg_${w.outKey}_n`] += val * weight
      entry[`__wavg_${w.outKey}_d`] += weight
    }
  }
  const result = Array.from(map.values())
  for (const e of result) {
    for (const w of weightedAvg) {
      const n = e[`__wavg_${w.outKey}_n`]
      const d = e[`__wavg_${w.outKey}_d`]
      e[w.outKey] = d > 0 ? n / d : null
      delete e[`__wavg_${w.outKey}_n`]
      delete e[`__wavg_${w.outKey}_d`]
    }
  }
  result.sort((a, b) => b.spend - a.spend)
  return result
}


// Pct change badge
function PctBadge({ current, previous, invertTrend = false }: { current: number; previous: number; invertTrend?: boolean }) {
  if (!previous || previous === 0) return null
  const pct = ((current - previous) / previous) * 100
  const isGood = invertTrend ? pct <= 0 : pct >= 0
  const ArrowIcon = pct >= 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ml-1 ${isGood ? 'text-green-600' : 'text-red-600'}`}>
      <ArrowIcon size={10} />
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function DailyDrillTh({
  id,
  children,
  align = 'left',
  widths,
  startResize,
}: {
  id: string
  children: ReactNode
  align?: 'left' | 'right'
  widths: Record<string, number>
  startResize: (colId: string, e: ReactMouseEvent) => void
}) {
  return (
    <th
      style={{ width: widths[id], minWidth: widths[id], maxWidth: widths[id] }}
      className={`relative px-2 py-1.5 ${align === 'right' ? 'text-right' : 'text-left'} font-medium text-slate-500`}
    >
      <span className={align === 'right' ? 'pr-2' : 'pl-0'}>{children}</span>
      <div
        aria-hidden
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-[var(--brand-600)]/30"
        onMouseDown={e => startResize(id, e)}
      />
    </th>
  )
}

export default function DataAnalytics({
  embedded = false,
  showHeatedRail = false,
}: {
  embedded?: boolean
  showHeatedRail?: boolean
}) {
  const navigate = useNavigate()
  const { appUser } = useAuth()
  const uiDensity = useUiDensity()
  const scopedClientId = useMemo(() => scopedClientIdFromUser(appUser), [appUser])

  // Core states
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Table sort states
  const metaCampaignSort = useTableSort('spend')
  const googleCampaignSort = useTableSort('spend')
  const keywordSort = useTableSort('spend')
  const searchTermSort = useTableSort('spend')

  // Business Type and Selected Metric
  const [businessType, setBusinessType] = useState<'leadgen' | 'ecommerce'>('ecommerce')
  const [businessTypeManual, setBusinessTypeManual] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('roas')
  const [secondaryMetric, setSecondaryMetric] = useState<MetricKey | 'none'>('none')
  const [showRolling7, setShowRolling7] = useState(false)
  type HeatedDrillTab = 'daily' | 'meta' | 'google' | 'keywords' | 'search' | 'adsets'
  const [heatedDrillTab, setHeatedDrillTab] = useState<HeatedDrillTab>('daily')
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      const userId = 'default_user'
      const loaded = await getDashboardSettings(userId)
      setSettings(loaded)
      setBusinessType(loaded.defaultBusinessType)
      setSelectedMetric(loaded.defaultMetric)
    }
    loadSettings()
  }, [])

  // Fetch clients
  const { data: clientsFromTable } = useQuery({
    queryKey: ['clients_table', scopedClientId ?? 'all'],
    queryFn: () => db.getClients(scopedClientId ? { scopedClientId } : undefined),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })

  // Fetch platforms
  const { data: platformsFromDB } = useQuery({
    queryKey: ['available_platforms'],
    queryFn: db.getAvailablePlatforms,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })

  // Fetch ad accounts
  const { data: adAccountsFromDB } = useQuery({
    queryKey: ['ad_accounts', selectedClient, selectedPlatform, scopedClientId ?? ''],
    queryFn: () => db.getAdAccounts({
      clientId: selectedClient,
      platform: selectedPlatform,
      scopedClientId: scopedClientId || undefined,
    }),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })

  // Auto-detect business type
  useEffect(() => {
    if (businessTypeManual) return
    const clients_data: Client[] = clientsFromTable || []
    let clientId = selectedClient
    if (clientId === 'all' && selectedAdAccount && adAccountsFromDB) {
      const match = adAccountsFromDB.find((a: any) => a.id === selectedAdAccount)
      if (match?.client_id) clientId = match.client_id
    }
    if (clientId && clientId !== 'all') {
      const client = clients_data.find(c => c.id === clientId)
      if (client?.business_type) {
        setBusinessType(client.business_type)
        setSelectedMetric(client.business_type === 'leadgen' ? 'costperconv' : 'roas')
      }
    }
  }, [selectedClient, selectedAdAccount, clientsFromTable, adAccountsFromDB, businessTypeManual])

  // Current period performance
  const { data: performance, isFetching: perfFetching } = useQuery({
    queryKey: ['performance', selectedClient, selectedPlatform, selectedAdAccount, dateRange, scopedClientId ?? ''],
    queryFn: () => db.getDailyPerformance({
      clientId: selectedClient,
      platform: selectedPlatform,
      adAccountId: selectedAdAccount || undefined,
      startDate: dateRange.start,
      endDate: dateRange.end,
      scopedClientId: scopedClientId || undefined,
      adsOnly: embedded,
    }),
    staleTime: settings.cacheTimeout * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })

  const performanceData: DailyPerformance[] = (performance as DailyPerformance[]) || []

  /** Heated View: KPIs + daily trend = paid ads only; Shopify stays on Agency overview cards. */
  const kpiRows = useMemo(
    () => (embedded ? filterAdsDailyRows(performanceData) : performanceData),
    [embedded, performanceData],
  )

  const paidAdsPeriodRoas = useMemo(() => {
    const t = sumAdsMetrics(kpiRows)
    return t.cost > 0 ? t.revenue / t.cost : 0
  }, [kpiRows])

  const previousPeriodRange = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return { start: '', end: '' }
    return previousComparableCalendarRange(dateRange)
  }, [dateRange.start, dateRange.end])

  const { data: previousPerformance } = useQuery({
    queryKey: ['previous_performance', selectedClient, selectedPlatform, selectedAdAccount, previousPeriodRange, scopedClientId ?? ''],
    queryFn: () => db.getDailyPerformance({
      clientId: selectedClient,
      platform: selectedPlatform,
      adAccountId: selectedAdAccount || undefined,
      startDate: previousPeriodRange.start,
      endDate: previousPeriodRange.end,
      scopedClientId: scopedClientId || undefined,
      adsOnly: embedded,
    }),
    enabled: !!previousPeriodRange.start && !!previousPeriodRange.end,
    staleTime: settings.cacheTimeout * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const previousPerformanceData: DailyPerformance[] = (previousPerformance as DailyPerformance[]) || []
  const prevKpiRows = useMemo(
    () => (embedded ? filterAdsDailyRows(previousPerformanceData) : previousPerformanceData),
    [embedded, previousPerformanceData],
  )

  const selectedClientRecord = useMemo(
    () => (selectedClient !== 'all' ? clientsFromTable?.find(c => c.id === selectedClient) : undefined),
    [selectedClient, clientsFromTable],
  )

  const showMerKpi = useMemo(
    () =>
      shouldShowHeatedMer({
        embedded,
        businessType,
        selectedPlatform,
        selectedClient,
        client: selectedClientRecord,
      }),
    [embedded, businessType, selectedPlatform, selectedClient, selectedClientRecord],
  )

  const { data: shopifyDailyRows = [] } = useQuery({
    queryKey: ['heated-shopify', dateRange.start, dateRange.end, selectedClient, scopedClientId ?? ''],
    queryFn: () =>
      db.getShopifyDailyPerformance({
        clientId: selectedClient,
        startDate: dateRange.start,
        endDate: dateRange.end,
        scopedClientId: scopedClientId || undefined,
      }),
    enabled: showMerKpi && !!dateRange.start && !!dateRange.end,
    staleTime: 5 * 60_000,
  })

  const { data: prevShopifyDailyRows = [] } = useQuery({
    queryKey: [
      'heated-shopify-prev',
      previousPeriodRange.start,
      previousPeriodRange.end,
      selectedClient,
      scopedClientId ?? '',
    ],
    queryFn: () =>
      db.getShopifyDailyPerformance({
        clientId: selectedClient,
        startDate: previousPeriodRange.start,
        endDate: previousPeriodRange.end,
        scopedClientId: scopedClientId || undefined,
      }),
    enabled: showMerKpi && !!previousPeriodRange.start && !!previousPeriodRange.end,
    staleTime: 5 * 60_000,
  })

  const rhythmAccountTzHint = useMemo(() => {
    const tzs = [...new Set(performanceData.map(r => r.data_timezone).filter(Boolean) as string[])]
    return tzs.length === 1 ? tzs[0]! : null
  }, [performanceData])

  const dailyDataTimezoneFootnote = useMemo(() => {
    const tzs = [...new Set(performanceData.map(r => r.data_timezone).filter(Boolean) as string[])]
    if (tzs.length === 0) {
      return 'Daily chart: dates follow synced daily rows when present. Gap-filled days are summed from hourly slices (UTC hour buckets) and may lack an advertiser reporting timezone until daily sync completes.'
    }
    if (tzs.length === 1) {
      return `Daily chart dates use reporting timezone ${tzs[0]} on synced rows. Gap-filled days use hourly UTC rollup.`
    }
    return `Daily chart mixes reporting timezones (${tzs.slice(0, 4).join(', ')}${tzs.length > 4 ? ', …' : ''}). Gap-filled days use hourly UTC rollup.`
  }, [performanceData])

  // Meta campaigns
  const { data: metaCampaigns } = useQuery({
    queryKey: ['meta_campaigns', selectedClient, selectedAdAccount, dateRange, scopedClientId ?? ''],
    queryFn: () => db.getMetaCampaigns({
      clientId: selectedClient,
      adAccountId: selectedAdAccount || undefined,
      startDate: dateRange.start,
      endDate: dateRange.end,
      scopedClientId: scopedClientId || undefined,
    }),
    enabled: selectedPlatform === 'all' || selectedPlatform === 'meta_ads',
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const { data: prevMetaCampaigns } = useQuery({
    queryKey: ['meta_campaigns_prev', selectedClient, selectedAdAccount, previousPeriodRange, scopedClientId ?? ''],
    queryFn: () => db.getMetaCampaigns({
      clientId: selectedClient,
      adAccountId: selectedAdAccount || undefined,
      startDate: previousPeriodRange.start,
      endDate: previousPeriodRange.end,
      scopedClientId: scopedClientId || undefined,
    }),
    enabled: (selectedPlatform === 'all' || selectedPlatform === 'meta_ads') && !!previousPeriodRange.start,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const { data: metaAdsetsForCount = [] } = useQuery({
    queryKey: ['meta_adsets_count', selectedClient, selectedAdAccount, dateRange, scopedClientId ?? ''],
    queryFn: () => db.getMetaAdsets({
      clientId: selectedClient,
      adAccountId: selectedAdAccount || undefined,
      startDate: dateRange.start,
      endDate: dateRange.end,
      scopedClientId: scopedClientId || undefined,
    }),
    enabled:
      (selectedPlatform === 'all' || selectedPlatform === 'meta_ads') &&
      !!dateRange.start &&
      !!dateRange.end,
    staleTime: 5 * 60 * 1000,
  })

  const { data: alertsRaw } = useQuery({
    queryKey: ['uni_alerts_heated'],
    queryFn: db.getAlertSummary,
    enabled: showHeatedRail,
    staleTime: 2 * 60 * 1000,
  })

  // Google campaigns
  const { data: googleCampaigns } = useQuery({
    queryKey: ['google_campaigns', selectedClient, selectedAdAccount, dateRange, scopedClientId ?? ''],
    queryFn: () => db.getGoogleCampaigns({
      clientId: selectedClient,
      adAccountId: selectedAdAccount || undefined,
      startDate: dateRange.start,
      endDate: dateRange.end,
      scopedClientId: scopedClientId || undefined,
    }),
    enabled: selectedPlatform === 'all' || selectedPlatform === 'google_ads',
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const { data: prevGoogleCampaigns } = useQuery({
    queryKey: ['google_campaigns_prev', selectedClient, selectedAdAccount, previousPeriodRange, scopedClientId ?? ''],
    queryFn: () => db.getGoogleCampaigns({
      clientId: selectedClient,
      adAccountId: selectedAdAccount || undefined,
      startDate: previousPeriodRange.start,
      endDate: previousPeriodRange.end,
      scopedClientId: scopedClientId || undefined,
    }),
    enabled: (selectedPlatform === 'all' || selectedPlatform === 'google_ads') && !!previousPeriodRange.start,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const { data: googleKeywords } = useQuery({
    queryKey: ['google_keywords', selectedClient, dateRange],
    queryFn: () => db.getGoogleKeywords(selectedClient, dateRange.start, dateRange.end),
    enabled: selectedPlatform === 'all' || selectedPlatform === 'google_ads',
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  // Previous period keywords
  const { data: prevGoogleKeywords } = useQuery({
    queryKey: ['google_keywords_prev', selectedClient, previousPeriodRange],
    queryFn: () => db.getGoogleKeywords(selectedClient, previousPeriodRange.start, previousPeriodRange.end),
    enabled: (selectedPlatform === 'all' || selectedPlatform === 'google_ads') && !!previousPeriodRange.start,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const { data: googleSearchTerms } = useQuery({
    queryKey: ['google_search_terms', selectedClient, dateRange],
    queryFn: () => db.getGoogleSearchTerms(selectedClient, dateRange.start, dateRange.end),
    enabled: selectedPlatform === 'all' || selectedPlatform === 'google_ads',
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const { data: prevGoogleSearchTerms } = useQuery({
    queryKey: ['google_search_terms_prev', selectedClient, previousPeriodRange],
    queryFn: () => db.getGoogleSearchTerms(selectedClient, previousPeriodRange.start, previousPeriodRange.end),
    enabled: (selectedPlatform === 'all' || selectedPlatform === 'google_ads') && !!previousPeriodRange.start,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const availablePlatforms = platformsFromDB || []
  const clients: Client[] = clientsFromTable || []

  const spendTargetClient = useMemo(
    () => (selectedClient !== 'all' ? clients.find(c => c.id === selectedClient) : undefined),
    [clients, selectedClient],
  )
  const spendTargets = useMemo(
    () => parseAdSpendTargets(spendTargetClient?.target_ad_spend_30d_by_platform),
    [spendTargetClient],
  )
  const activeSpendTarget = useMemo(
    () => resolveActiveSpendTarget(spendTargets, selectedPlatform),
    [spendTargets, selectedPlatform],
  )
  const spendPacePerDay = useMemo(
    () => dailySpendPace(activeSpendTarget),
    [activeSpendTarget],
  )

  // Aggregated data
  const metaCampaignAggOpts: AggregateRowsOptions = {
    sumFields: [
      'reach',
      'outbound_clicks',
      'video_p25_watched',
      'video_p50_watched',
      'video_p75_watched',
      'video_p100_watched',
      'video_avg_watch_time',
    ],
    weightedAvg: [{ outKey: 'frequency', valueKey: 'frequency', weightKey: 'impressions' }],
  }
  const aggMetaCampaigns = aggregateRows(metaCampaigns || [], 'campaign_id', 'campaign_name', [], metaCampaignAggOpts)
  const prevAggMetaCampaignsMap = new Map(
    aggregateRows(prevMetaCampaigns || [], 'campaign_id', 'campaign_name', [], metaCampaignAggOpts).map(r => [r.campaign_id, r])
  )
  const aggGoogleCampaigns = aggregateRows(googleCampaigns || [], 'campaign_id', 'campaign_name', [])
  const prevAggGoogleCampaignsMap = new Map((aggregateRows(prevGoogleCampaigns || [], 'campaign_id', 'campaign_name', [])).map(r => [r.campaign_id, r]))
  const aggKeywords = aggregateRows(googleKeywords || [], 'keyword_id', 'keyword', ['campaign_name', 'ad_group_name', 'match_type'])
  const prevAggKeywordsMap = new Map((aggregateRows(prevGoogleKeywords || [], 'keyword_id', 'keyword', ['campaign_name', 'ad_group_name', 'match_type'])).map(r => [r.keyword_id, r]))
  const aggSearchTerms = aggregateRows(googleSearchTerms || [], 'search_term', 'search_term', ['campaign_name', 'ad_group_name', 'match_type'])
  const prevAggSearchTermsMap = new Map((aggregateRows(prevGoogleSearchTerms || [], 'search_term', 'search_term', ['campaign_name', 'ad_group_name', 'match_type'])).map(r => [r.search_term, r]))

  // Totals
  const totals = kpiRows.reduce((acc, day) => ({
    cost: acc.cost + (day.cost || 0),
    impressions: acc.impressions + (day.impressions || 0),
    clicks: acc.clicks + (day.clicks || 0),
    conversions: acc.conversions + (day.conversions || 0),
    revenue: acc.revenue + (day.revenue || 0),
  }), { cost: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 })

  const previousTotals = prevKpiRows.reduce((acc, day) => ({
    cost: acc.cost + (day.cost || 0),
    impressions: acc.impressions + (day.impressions || 0),
    clicks: acc.clicks + (day.clicks || 0),
    conversions: acc.conversions + (day.conversions || 0),
    revenue: acc.revenue + (day.revenue || 0),
  }), { cost: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 })

  const roas = totals.cost > 0 ? totals.revenue / totals.cost : 0
  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions * 100 : 0
  const costPerConv = totals.conversions > 0 ? totals.cost / totals.conversions : 0
  const prevRoas = previousTotals.cost > 0 ? previousTotals.revenue / previousTotals.cost : 0
  const prevCtr = previousTotals.impressions > 0 ? previousTotals.clicks / previousTotals.impressions * 100 : 0
  const prevCostPerConv = previousTotals.conversions > 0 ? previousTotals.cost / previousTotals.conversions : 0

  const calculateChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const spendChange = calculateChange(totals.cost, previousTotals.cost)
  const ctrChange = calculateChange(ctr, prevCtr)
  const conversionsChange = calculateChange(totals.conversions, previousTotals.conversions)
  const costPerConvChange = calculateChange(costPerConv, prevCostPerConv)
  const roasChange = calculateChange(roas, prevRoas)

  // Daily chart data
  const dailyDataWithMetrics = kpiRows.reduce((acc: any[], day) => {
    const existing = acc.find(d => d.date === day.date)
    const cost = day.cost || 0
    const revenue = day.revenue || 0
    const impressions = day.impressions || 0
    const clicks = day.clicks || 0
    const conversions = day.conversions || 0
    const dataPoint = {
      date: day.date,
      spend: cost,
      impressions, clicks, conversions, revenue,
      ctr: impressions > 0 ? clicks / impressions * 100 : 0,
      costperconv: conversions > 0 ? cost / conversions : 0,
      roas: cost > 0 ? revenue / cost : 0,
    }
    if (existing) {
      existing.spend += dataPoint.spend
      existing.impressions += dataPoint.impressions
      existing.clicks += dataPoint.clicks
      existing.conversions += dataPoint.conversions
      existing.revenue += dataPoint.revenue
      existing.ctr = existing.impressions > 0 ? existing.clicks / existing.impressions * 100 : 0
      existing.costperconv = existing.conversions > 0 ? existing.spend / existing.conversions : 0
      existing.roas = existing.spend > 0 ? existing.revenue / existing.spend : 0
    } else {
      acc.push(dataPoint)
    }
    return acc
  }, []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const shopifyAfterReturnTotal = useMemo(
    () => rollupShopifyDaily(shopifyDailyRows).shopifyAfterReturn,
    [shopifyDailyRows],
  )
  const prevShopifyAfterReturnTotal = useMemo(
    () => rollupShopifyDaily(prevShopifyDailyRows).shopifyAfterReturn,
    [prevShopifyDailyRows],
  )
  const mer = totals.cost > 0 ? shopifyAfterReturnTotal / totals.cost : 0
  const prevMer = previousTotals.cost > 0 ? prevShopifyAfterReturnTotal / previousTotals.cost : 0
  const merChange = calculateChange(mer, prevMer)

  const chartDailyData = useMemo(() => {
    const shopByDate = new Map<string, number>()
    for (const row of shopifyDailyRows) {
      const d = String(row.date || '')
      if (!d) continue
      shopByDate.set(d, (shopByDate.get(d) || 0) + shopifyAfterReturnForShapedRow(row))
    }
    return dailyDataWithMetrics.map(d => ({
      ...d,
      mer: d.spend > 0 ? (shopByDate.get(d.date) || 0) / d.spend : 0,
    }))
  }, [dailyDataWithMetrics, shopifyDailyRows])

  useEffect(() => {
    if (!showMerKpi && selectedMetric === 'mer') setSelectedMetric('roas')
  }, [showMerKpi, selectedMetric])

  const showPlatformInDailyDrill = selectedPlatform === 'all'
  const dailyDrillTableRows = useMemo(() => {
    if (!showPlatformInDailyDrill) {
      return dailyDataWithMetrics.map(d => ({
        ...d,
        platform: selectedPlatform.replace(/_/g, ' '),
      }))
    }
    const map = new Map<string, any>()
    for (const day of kpiRows) {
      const platKey = day.platform || 'unknown'
      const platLabel = platKey.replace(/_/g, ' ')
      const key = `${day.date}|${platKey}`
      const cost = Number(day.cost) || 0
      const revenue = Number(day.revenue) || 0
      const conversions = Number(day.conversions) || 0
      if (!map.has(key)) {
        map.set(key, { date: day.date, platform: platLabel, platformId: platKey, spend: 0, revenue: 0, conversions: 0 })
      }
      const e = map.get(key)!
      e.spend += cost
      e.revenue += revenue
      e.conversions += conversions
    }
    return Array.from(map.values()).sort((a, b) => {
      const byDate = b.date.localeCompare(a.date)
      if (byDate !== 0) return byDate
      return String(a.platform).localeCompare(String(b.platform))
    })
  }, [kpiRows, dailyDataWithMetrics, selectedPlatform, showPlatformInDailyDrill])

  const { widths: ddColW, startResize: ddColResize } = useResizableColumns('heated-daily-drill-v1', {
    date: 112,
    platform: 94,
    spend: 78,
    revenue: 84,
    conv: 64,
  })

  // 7-day rolling avg
  const chartData = chartDailyData.map((d, i) => {
    const window = chartDailyData.slice(Math.max(0, i - 6), i + 1)
    const rolling7 = window.reduce((s: number, r: any) => s + (r[selectedMetric] || 0), 0) / window.length
    return { ...d, rolling7 }
  })

  // Sparkline data (last 7 days per metric)
  const last7 = chartDailyData.slice(-7)

  const getChartDomain = (metricKey: MetricKey): [number, number] => {
    const values = chartDailyData.map(d => parseFloat(d[metricKey]) || 0)
    if (metricKey === 'spend' && spendPacePerDay > 0) {
      values.push(spendPacePerDay)
    }
    const maxValue = Math.max(...values, 1)
    return [0, Math.ceil(maxValue * 1.2)]
  }

  const KPI_ICON_SHELL: Record<string, string> = {
    blue: 'p-3 rounded-lg bg-[var(--brand-50)] text-[var(--brand-600)]',
    violet: 'p-3 rounded-lg bg-violet-50 text-violet-600',
    emerald: 'p-3 rounded-lg bg-emerald-50 text-emerald-600',
    amber: 'p-3 rounded-lg bg-amber-50 text-amber-600',
    teal: 'p-3 rounded-lg bg-teal-50 text-teal-600',
  }

  const metricConfig: Record<MetricKey, any> = {
    spend: { label: 'Spend', color: '#ea580c', formatter: (v: number) => `$${v.toFixed(2)}` },
    ctr: { label: 'CTR', color: '#8b5cf6', formatter: (v: number) => `${v.toFixed(2)}%` },
    conversions: { label: businessType === 'leadgen' ? 'Leads' : 'Purchases', color: '#10b981', formatter: (v: number) => v.toString() },
    costperconv: { label: businessType === 'leadgen' ? 'Cost Per Lead' : 'Cost Per Purchase', color: '#f59e0b', formatter: (v: number) => `$${v.toFixed(2)}` },
    roas: { label: 'ROAS', color: '#ef4444', formatter: (v: number) => `${v.toFixed(2)}x` },
    mer: {
      label: 'MER (after-return Shopify ÷ spend)',
      color: '#0d9488',
      formatter: (v: number) => `${v.toFixed(2)}x`,
    },
  }

  const currentMetricConfig = metricConfig[selectedMetric]

  const leadGenKPIs = [
    { title: 'Total Spend', value: `$${totals.cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, change: spendChange, icon: DollarSign, color: 'blue', key: 'spend' as MetricKey },
    { title: 'CTR', value: `${ctr.toFixed(2)}%`, change: ctrChange, icon: MousePointer2, color: 'violet', key: 'ctr' as MetricKey },
    { title: 'Leads', value: totals.conversions.toLocaleString(), change: conversionsChange, icon: Users, color: 'emerald', key: 'conversions' as MetricKey },
    { title: 'Cost Per Lead (CPL)', value: `$${costPerConv.toFixed(2)}`, change: costPerConvChange, icon: CreditCard, color: 'amber', key: 'costperconv' as MetricKey, invertTrend: true },
  ]

  const ecommerceKPIs = useMemo(() => {
    const cards = [
      { title: 'Total Spend', value: `$${totals.cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, change: spendChange, icon: DollarSign, color: 'blue', key: 'spend' as MetricKey },
      { title: 'CTR', value: `${ctr.toFixed(2)}%`, change: ctrChange, icon: MousePointer2, color: 'violet', key: 'ctr' as MetricKey },
      { title: 'Purchases', value: totals.conversions.toLocaleString(), change: conversionsChange, icon: ShoppingCart, color: 'emerald', key: 'conversions' as MetricKey },
      { title: 'ROAS', value: `${roas.toFixed(2)}x`, change: roasChange, icon: TrendingUp, color: 'amber', key: 'roas' as MetricKey },
    ]
    if (showMerKpi) {
      cards.push({
        title: 'MER',
        value: `${mer.toFixed(2)}x`,
        change: merChange,
        icon: ShoppingCart,
        color: 'teal',
        key: 'mer' as MetricKey,
      })
    }
    return cards
  }, [totals.cost, ctr, totals.conversions, roas, spendChange, ctrChange, conversionsChange, roasChange, showMerKpi, mer, merChange])

  const currentKPIs = businessType === 'leadgen' ? leadGenKPIs : ecommerceKPIs

  const selectedClientName = selectedClient === 'all'
    ? 'All Clients'
    : clients?.find(c => c.id === selectedClient)?.name || 'Unknown'

  // Currency symbol helper — per-client in tables; KPI cards always show USD (mixed currencies)
  const selectedClientCurrencySym = selectedClient !== 'all'
    ? (clients?.find(c => c.id === selectedClient)?.currency_symbol || '$')
    : '$'
  const selectedClientCurrency = selectedClient !== 'all'
    ? (clients?.find(c => c.id === selectedClient)?.currency || 'USD')
    : 'USD (mixed)'

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  // Default date range
  useEffect(() => {
    setDateRange(defaultCalendarRangeLastNDays(settings.defaultDateRange))
  }, [settings.defaultDateRange])

  useEffect(() => {
    if (scopedClientId) {
      setSelectedClient(scopedClientId)
      setSelectedAdAccount('')
    }
  }, [scopedClientId])

  const fmtDailyMoney = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: selectedClient === 'all' ? 'USD' : (clients?.find(c => c.id === selectedClient)?.currency || 'USD'),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n)

  const shellCard =
    embedded && uiDensity === 'compact'
      ? 'bg-white rounded-lg shadow-sm border border-gray-200 p-3'
      : embedded && uiDensity === 'comfort'
        ? 'bg-white rounded-xl shadow-sm border border-gray-200 p-5'
        : 'bg-white rounded-xl shadow-sm border border-gray-200 p-6'
  const tableWrapMt = embedded ? 'overflow-x-auto mt-2' : 'overflow-x-auto mt-4'
  const rootStack =
    embedded && uiDensity === 'compact' ? 'space-y-3' : embedded && uiDensity === 'comfort' ? 'space-y-5' : 'space-y-6'

  const canDailyTab = dailyDataWithMetrics.length > 0
  const canMetaTab = (selectedPlatform === 'all' || selectedPlatform === 'meta_ads') && aggMetaCampaigns.length > 0
  const canGoogleTab = (selectedPlatform === 'all' || selectedPlatform === 'google_ads') && aggGoogleCampaigns.length > 0
  const canKwTab = (selectedPlatform === 'all' || selectedPlatform === 'google_ads') && aggKeywords.length > 0
  const canSearchTab = (selectedPlatform === 'all' || selectedPlatform === 'google_ads') && aggSearchTerms.length > 0
  const metaAdsetCount = Array.isArray(metaAdsetsForCount) ? metaAdsetsForCount.length : 0
  const canAdsetsTab =
    (selectedPlatform === 'all' || selectedPlatform === 'meta_ads') &&
    !!dateRange.start &&
    !!dateRange.end

  const heatedAlerts = useMemo(() => {
    if (!showHeatedRail || !alertsRaw) return []
    return alertsRaw.filter((a: { client_id?: string }) => {
      if (selectedClient === 'all') return true
      return a.client_id === selectedClient
    })
  }, [alertsRaw, selectedClient, showHeatedRail])

  const heatedAlertSummary = useMemo(() => {
    return heatedAlerts.reduce(
      (acc, a: { status?: string; severity?: string }) => {
        acc.total++
        if (a.status === 'new') acc.new++
        if (a.severity === 'critical') acc.critical++
        if (a.severity === 'high') acc.high++
        return acc
      },
      { total: 0, new: 0, critical: 0, high: 0 },
    )
  }, [heatedAlerts])

  useEffect(() => {
    const ok =
      (heatedDrillTab === 'daily' && canDailyTab) ||
      (heatedDrillTab === 'meta' && canMetaTab) ||
      (heatedDrillTab === 'google' && canGoogleTab) ||
      (heatedDrillTab === 'keywords' && canKwTab) ||
      (heatedDrillTab === 'search' && canSearchTab) ||
      (heatedDrillTab === 'adsets' && canAdsetsTab)
    if (ok) return
    if (canDailyTab) setHeatedDrillTab('daily')
    else if (canMetaTab) setHeatedDrillTab('meta')
    else if (canGoogleTab) setHeatedDrillTab('google')
    else if (canKwTab) setHeatedDrillTab('keywords')
    else if (canSearchTab) setHeatedDrillTab('search')
    else if (canAdsetsTab) setHeatedDrillTab('adsets')
  }, [heatedDrillTab, canDailyTab, canMetaTab, canGoogleTab, canKwTab, canSearchTab, canAdsetsTab])

  const mainContent = (
    <div className={`${rootStack}${perfFetching ? ' opacity-95 transition-opacity duration-200' : ''}`} aria-busy={perfFetching || undefined}>
      {/* Top Header */}
      <div className="flex items-center justify-between">
        {!embedded && (
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Database className="text-[var(--brand-600)]" />
              Account Performance
            </h1>
            <p className="text-gray-500 mt-1">Deep-dive performance metrics by account</p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-600" size={20} />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">✕</button>
        </div>
      )}

      {/* ── STICKY FILTER BAR ── */}
      <FilterShell className="z-40" stickyBelowHeader>
        <div className="flex items-center gap-2 flex-wrap w-full">
          {/* Business Type Toggle */}
          <div className="flex rounded-md border border-gray-200 p-0.5 shrink-0">
            <button
              onClick={() => { setBusinessType('leadgen'); setBusinessTypeManual(true); setSelectedMetric('costperconv') }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1 ${businessType === 'leadgen' ? 'bg-[var(--brand-600)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Users size={13} /> Lead Gen
            </button>
            <button
              onClick={() => { setBusinessType('ecommerce'); setBusinessTypeManual(true); setSelectedMetric('roas') }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1 ${businessType === 'ecommerce' ? 'bg-[var(--brand-600)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <ShoppingCart size={13} /> eCommerce
            </button>
          </div>
          {businessTypeManual && (
            <button onClick={() => setBusinessTypeManual(false)} className="text-xs text-[var(--brand-600)] underline shrink-0">Auto</button>
          )}

          <div className="w-px h-6 bg-gray-200 hidden sm:block" />

          {/* Client Dropdown */}
          {scopedClientId ? (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-700 min-w-[160px]">
              <span className="flex-1 text-left truncate">{selectedClientName}</span>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowClientDropdown(!showClientDropdown)}
                className="flex items-center gap-2 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-900 min-w-[160px]"
              >
                <span className="flex-1 text-left truncate">{selectedClientName}</span>
                <ChevronDown size={14} />
              </button>
              {showClientDropdown && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-56 overflow-y-auto">
                  <button onClick={() => { setSelectedClient('all'); setSelectedAdAccount(''); setBusinessTypeManual(false); setShowClientDropdown(false) }} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-900">All Clients</button>
                  {clients?.map(client => (
                    <button key={client.id} onClick={() => { setSelectedClient(client.id); setSelectedAdAccount(''); setBusinessTypeManual(false); setShowClientDropdown(false) }} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-900">
                      <div className="text-sm font-medium">{client.name}</div>
                      {client.business_type && <div className="text-xs text-gray-500">{client.business_type === 'leadgen' ? 'Lead Gen' : 'eCommerce'}</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Platform */}
          <select
            value={selectedPlatform}
            onChange={(e) => { setSelectedPlatform(e.target.value); setSelectedAdAccount('') }}
            className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md text-xs min-w-[140px]"
          >
            <option value="all">All Platforms</option>
            {availablePlatforms.map((platform: any) => (
              <option key={platform.id} value={platform.id}>{platform.label}</option>
            ))}
          </select>

          {/* Ad Account */}
          {adAccountsFromDB && adAccountsFromDB.length > 0 && (
            <select
              value={selectedAdAccount}
              onChange={(e) => setSelectedAdAccount(e.target.value)}
              className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md text-xs min-w-[180px]"
            >
              <option value="">All Accounts</option>
              {adAccountsFromDB.map((account: any) => (
                <option key={account.id} value={account.id}>{account.label}</option>
              ))}
            </select>
          )}

          <div className="w-px h-6 bg-gray-200 hidden sm:block" />

          <AccountDateRangePicker dateRange={dateRange} onChange={setDateRange} />

          {/* Currency badge */}
          {selectedClient !== 'all' && (
            <span className="px-2 py-0.5 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md text-[11px] font-mono font-semibold">
              {selectedClientCurrency}
            </span>
          )}

          {/* Settings */}
          {!embedded && (
            <button
              onClick={() => navigate('/dashboard/settings')}
              className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 text-xs"
            >
              <Settings size={14} /> Settings
            </button>
          )}
        </div>
      </FilterShell>

      {/* KPI Cards */}
      <div
        className={
          embedded
            ? `grid grid-cols-2 gap-2 sm:gap-3 ${showMerKpi ? 'md:grid-cols-5' : 'md:grid-cols-4'}`
            : `grid grid-cols-1 gap-4 ${showMerKpi ? 'md:grid-cols-5' : 'md:grid-cols-4'}`
        }
      >
        {currentKPIs.map(kpi => {
          const isPositive = (kpi as any).invertTrend ? kpi.change <= 0 : kpi.change >= 0
          const changeColor = isPositive ? 'text-green-600' : 'text-red-600'
          const ArrowIcon = kpi.change >= 0 ? ArrowUpRight : ArrowDownRight
          const sparkColor = isPositive ? '#16a34a' : '#dc2626'
          const sparkData = last7.map((d: any) => ({ v: d[kpi.key] || 0 }))

          return (
            <div
              key={kpi.key}
              onClick={() => setSelectedMetric(kpi.key)}
              className={
                embedded
                  ? `bg-white rounded-lg shadow-sm border cursor-pointer transition p-3 ${
                      selectedMetric === kpi.key
                        ? 'border-[var(--brand-600)] ring-1 ring-[var(--brand-600)]/25'
                        : 'border-gray-200 hover:border-gray-300'
                    }`
                  : `bg-white rounded-xl shadow-sm border-2 cursor-pointer transition-all p-4 ${
                      selectedMetric === kpi.key
                        ? 'border-[var(--brand-500)] shadow-lg scale-[1.02]'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`
              }
            >
              <div className={`flex items-start justify-between ${embedded ? 'mb-1' : 'mb-2'}`}>
                <div>
                  <p className={embedded ? 'text-xs text-gray-500' : 'text-sm text-gray-500'}>{kpi.title}</p>
                  <p className={embedded ? 'text-lg font-bold text-gray-900 mt-0.5 leading-tight' : 'text-2xl font-bold text-gray-900 mt-1'}>{kpi.value}</p>
                </div>
                <div
                  className={
                    embedded
                      ? `${(KPI_ICON_SHELL[kpi.color] ?? 'p-1.5 rounded-md bg-slate-50 text-slate-600').replace('p-3', 'p-1.5')} [&_svg]:w-4 [&_svg]:h-4`
                      : (KPI_ICON_SHELL[kpi.color] ?? 'p-3 rounded-lg bg-slate-50 text-slate-600')
                  }
                >
                  <kpi.icon size={embedded ? 18 : 24} />
                </div>
              </div>
              <div className={`flex items-center justify-between ${embedded ? 'mt-1' : 'mt-2'}`}>
                {kpi.change !== undefined && (
                  <div className={`flex items-center gap-0.5 ${embedded ? 'text-xs' : 'text-sm'} font-medium ${changeColor}`}>
                    <ArrowIcon size={embedded ? 12 : 14} />
                    <span>{Math.abs(kpi.change).toFixed(1)}%{embedded ? '' : ' vs prev period'}</span>
                  </div>
                )}
                {selectedMetric === kpi.key && (
                  <div className={`${embedded ? 'text-[10px]' : 'text-xs'} text-[var(--brand-600)] font-medium`}>{embedded ? 'Chart' : '↓ Chart'}</div>
                )}
              </div>
              {!embedded && sparkData.length > 1 && (
                <div className="mt-2 -mx-1">
                  <LineChart width={140} height={36} data={sparkData}>
                    <Line type="monotone" dataKey="v" stroke={sparkColor} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                  </LineChart>
                </div>
              )}
            </div>
          )
        })}
      </div>


      {/* Dynamic Chart */}
      <div className={`bg-white shadow-sm border border-gray-200 ${embedded ? 'rounded-lg p-3' : 'rounded-xl p-6'}`}>
        <div className={`flex items-center justify-between flex-wrap gap-3 ${embedded ? 'mb-2' : 'mb-4'}`}>
          <h3 className={embedded ? 'text-sm font-semibold text-gray-900' : 'text-lg font-semibold text-gray-900'}>
            {currentMetricConfig.label} Trend (Daily)
            {embedded && selectedMetric === 'mer' ? ' — Shopify after-return ÷ paid spend' : embedded ? ' — paid ads' : ''}
          </h3>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Secondary metric */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Overlay:</label>
              <select
                value={secondaryMetric}
                onChange={e => setSecondaryMetric(e.target.value as MetricKey | 'none')}
                className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-gray-50"
              >
                <option value="none">None</option>
                {(Object.keys(metricConfig) as MetricKey[]).filter(k => k !== selectedMetric).map(k => (
                  <option key={k} value={k}>{metricConfig[k].label}</option>
                ))}
              </select>
            </div>
            {/* 7-day rolling avg toggle */}
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showRolling7}
                onChange={e => setShowRolling7(e.target.checked)}
                className="rounded"
              />
              7-day avg
            </label>
          </div>
        </div>
        {performanceData.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="mx-auto mb-2" size={32} />
            <p>No data available for selected filters</p>
            <p className="text-sm mt-2">{selectedClientName} | {selectedPlatform} | {dateRange.start} to {dateRange.end}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={embedded ? 260 : settings.chartHeight}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={currentMetricConfig.color} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={currentMetricConfig.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              {settings.showGridLines && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} domain={getChartDomain(selectedMetric)} />
              {secondaryMetric !== 'none' && (
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              )}
              <Tooltip
                formatter={(value: any, name: string) => {
                  if (name === 'rolling7') return [currentMetricConfig.formatter(value), '7-day avg']
                  if (secondaryMetric !== 'none' && name === secondaryMetric) return [metricConfig[secondaryMetric as MetricKey].formatter(value), metricConfig[secondaryMetric as MetricKey].label]
                  return [currentMetricConfig.formatter(value), currentMetricConfig.label]
                }}
              />
              <Area yAxisId="left" type="monotone" dataKey={selectedMetric} stroke={currentMetricConfig.color} fillOpacity={1} fill="url(#colorMetric)" isAnimationActive={settings.animateChart} />
              {selectedMetric === 'spend' && spendPacePerDay > 0 && (
                <ReferenceLine
                  yAxisId="left"
                  y={spendPacePerDay}
                  stroke="#64748b"
                  strokeDasharray="6 4"
                  label={{
                    value: `30d pace $${spendPacePerDay.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day`,
                    position: 'insideTopRight',
                    fontSize: 11,
                    fill: '#64748b',
                  }}
                />
              )}
              {showRolling7 && (
                <Line yAxisId="left" type="monotone" dataKey="rolling7" stroke="#a855f7" strokeDasharray="4 4" dot={false} strokeWidth={2} name="rolling7" isAnimationActive={false} />
              )}
              {secondaryMetric !== 'none' && (
                <Line yAxisId="right" type="monotone" dataKey={secondaryMetric} stroke={metricConfig[secondaryMetric as MetricKey].color} dot={false} strokeWidth={2} isAnimationActive={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
        {performanceData.length > 0 && selectedMetric === 'spend' && spendPacePerDay > 0 && (
          <p className="text-xs text-slate-500 mt-2">
            Dashed line: daily spend pace to hit 30d target (${spendPacePerDay.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day).
          </p>
        )}
        {performanceData.length > 0 && (
          <p className="text-xs text-gray-500 mt-3 leading-relaxed">{dailyDataTimezoneFootnote}</p>
        )}
      </div>

      {performanceData.length > 0 && dateRange.start && dateRange.end && (
        <PerformanceRhythmSection
          dateRange={dateRange}
          selectedClient={selectedClient}
          selectedPlatform={selectedPlatform}
          scopedClientId={scopedClientId || undefined}
          displayZone={AGENCY_REPORTING_TZ}
          accountTzHint={rhythmAccountTzHint}
          adsOnly={embedded}
          periodRoasKpi={embedded && paidAdsPeriodRoas > 0 ? paidAdsPeriodRoas : undefined}
        />
      )}

      {performanceData.length > 0 && dateRange.start && dateRange.end && (
        <AgencyInsightPies
          dailyRows={embedded ? kpiRows : performanceData}
          dateRange={dateRange}
          selectedClient={selectedClient}
          selectedPlatform={selectedPlatform}
        />
      )}

      {performanceData.length > 0 && (
        <div className={shellCard}>
          <ReportSectionHeader sectionLabel="Heated drill" title="Campaign & keyword breakdowns" />
          <p className="text-xs text-stone-500 mb-2 mt-1">Tabs with no rows for the current filters are disabled.</p>
          <div className="flex flex-wrap gap-1.5 mb-3 items-center">
            {([
              { id: 'daily' as const, label: 'Daily breakdown', disabled: !canDailyTab },
              { id: 'meta' as const, label: 'Meta campaigns' + (aggMetaCampaigns.length ? ` (${aggMetaCampaigns.length})` : ''), disabled: !canMetaTab },
              { id: 'adsets' as const, label: 'Meta ad sets' + (metaAdsetCount ? ` (${metaAdsetCount})` : ''), disabled: !canAdsetsTab },
              { id: 'google' as const, label: 'Google campaigns' + (aggGoogleCampaigns.length ? ` (${aggGoogleCampaigns.length})` : ''), disabled: !canGoogleTab },
              { id: 'keywords' as const, label: 'Google keywords' + (aggKeywords.length ? ` (${aggKeywords.length})` : ''), disabled: !canKwTab },
              { id: 'search' as const, label: 'Search terms' + (aggSearchTerms.length ? ` (${aggSearchTerms.length})` : ''), disabled: !canSearchTab },
            ] as const).map(tab => (
              <button
                key={tab.id}
                type="button"
                disabled={tab.disabled}
                onClick={() => !tab.disabled && setHeatedDrillTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  tab.disabled
                    ? 'opacity-40 cursor-not-allowed border-gray-100 text-gray-400'
                    : heatedDrillTab === tab.id
                      ? 'bg-[var(--brand-600)] text-white border-transparent shadow-sm'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {heatedDrillTab === 'daily' && canDailyTab && (
            <div>
              <div className="mb-3">
                <ReportSectionHeader sectionLabel="Tables" title={`Daily breakdown — ${dateRange.start} → ${dateRange.end}`} />
              </div>
              <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded-md border border-slate-100">
                <table className="w-full table-fixed text-xs tabular-nums">
                  <ResizableColgroup
                    cols={
                      showPlatformInDailyDrill
                        ? ['date', 'platform', 'spend', 'revenue', 'conv']
                        : ['date', 'spend', 'revenue', 'conv']
                    }
                    widths={ddColW}
                  />
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <DailyDrillTh id="date" widths={ddColW} startResize={ddColResize}>Date</DailyDrillTh>
                      {showPlatformInDailyDrill && (
                        <DailyDrillTh id="platform" widths={ddColW} startResize={ddColResize}>Platform</DailyDrillTh>
                      )}
                      <DailyDrillTh id="spend" align="right" widths={ddColW} startResize={ddColResize}>Spend</DailyDrillTh>
                      <DailyDrillTh id="revenue" align="right" widths={ddColW} startResize={ddColResize}>Revenue</DailyDrillTh>
                      <DailyDrillTh id="conv" align="right" widths={ddColW} startResize={ddColResize}>Conv.</DailyDrillTh>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyDrillTableRows.map(d => (
                      <tr key={`${d.date}-${d.platform ?? ''}`} className="text-slate-800 hover:bg-slate-50/80">
                        <td style={{ width: ddColW.date }} className="px-2 py-1 truncate whitespace-nowrap font-medium">{d.date}</td>
                        {showPlatformInDailyDrill && (
                          <td style={{ width: ddColW.platform }} className="px-2 py-1 truncate">
                            <PlatformBadge platform={d.platformId || d.platform} />
                          </td>
                        )}
                        <td style={{ width: ddColW.spend }} className="px-2 py-1 text-right">{fmtDailyMoney(d.spend)}</td>
                        <td style={{ width: ddColW.revenue }} className="px-2 py-1 text-right text-green-700">{fmtDailyMoney(d.revenue)}</td>
                        <td style={{ width: ddColW.conv }} className="px-2 py-1 text-right">{d.conversions.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {heatedDrillTab === 'meta' && canMetaTab && (
            <div>
              <ReportSectionHeader
                sectionLabel="Meta"
                title="Campaign performance vs previous period"
                badge={<BookOpen className="text-[var(--brand-600)]" size={18} aria-hidden />}
              />
              <div className={tableWrapMt}>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <SortTh label="Campaign" field="campaign_name" sort={metaCampaignSort} align="left" />
                      <SortTh label="Spend" field="spend" sort={metaCampaignSort} />
                      <SortTh label="Clicks" field="clicks" sort={metaCampaignSort} />
                      <SortTh label="CTR" field="_ctr" sort={metaCampaignSort} />
                      <SortTh label="Reach" field="reach" sort={metaCampaignSort} />
                      <SortTh label="Freq" field="frequency" sort={metaCampaignSort} />
                      <SortTh label="Outbound" field="outbound_clicks" sort={metaCampaignSort} />
                      <SortTh label="Video 25%" field="video_p25_watched" sort={metaCampaignSort} />
                      <SortTh label="Conv." field="conversions" sort={metaCampaignSort} />
                      <SortTh label="CPA" field="_cpa" sort={metaCampaignSort} />
                      <SortTh label="ROAS" field="_roas" sort={metaCampaignSort} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                  {metaCampaignSort.sortRows(aggMetaCampaigns.map((c: any) => ({
                    ...c,
                    _ctr: c.impressions > 0 ? c.clicks / c.impressions * 100 : 0,
                    _roas: c.spend > 0 ? c.revenue / c.spend : 0,
                    _cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
                    frequency: c.frequency ?? 0,
                    reach: Number(c.reach) || 0,
                    outbound_clicks: Number(c.outbound_clicks) || 0,
                    video_p25_watched: Number(c.video_p25_watched) || 0,
                  }))).map((camp: any) => {
                    const prev = prevAggMetaCampaignsMap.get(camp.campaign_id)
                    const ctr = camp.impressions > 0 ? camp.clicks / camp.impressions * 100 : 0
                    const roas = camp.spend > 0 ? camp.revenue / camp.spend : 0
                    const cpa = camp.conversions > 0 ? camp.spend / camp.conversions : 0
                    const freqDisplay = camp.frequency != null && camp.frequency > 0 ? camp.frequency.toFixed(2) : '—'
                    return (
                      <tr key={camp._key} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium max-w-[280px] truncate">{camp.campaign_name}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {selectedClientCurrencySym}{camp.spend.toFixed(2)}
                          {prev && <PctBadge current={camp.spend} previous={prev.spend} />}
                        </td>
                        <td className="px-4 py-3 text-right">{camp.clicks.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          {ctr.toFixed(2)}%
                          {prev && prev.impressions > 0 && <PctBadge current={ctr} previous={prev.clicks / prev.impressions * 100} />}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {camp.reach > 0 ? camp.reach.toLocaleString() : '—'}
                          {prev && prev.reach > 0 && camp.reach > 0 && <PctBadge current={camp.reach} previous={prev.reach} />}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{freqDisplay}</td>
                        <td className="px-4 py-3 text-right">
                          {camp.outbound_clicks > 0 ? camp.outbound_clicks.toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {camp.video_p25_watched > 0 ? camp.video_p25_watched.toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${camp.conversions > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {camp.conversions}
                          </span>
                          {prev && <PctBadge current={camp.conversions} previous={prev.conversions} />}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {cpa > 0 ? `${selectedClientCurrencySym}${cpa.toFixed(2)}` : '-'}
                          {prev && cpa > 0 && (
                            <PctBadge current={cpa} previous={prev.conversions > 0 ? prev.spend / prev.conversions : 0} invertTrend />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {roas > 0 ? `${roas.toFixed(2)}x` : '-'}
                          {prev && roas > 0 && (
                            <PctBadge current={roas} previous={prev.spend > 0 ? prev.revenue / prev.spend : 0} />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                </table>
              </div>
            </div>
          )}

          {heatedDrillTab === 'google' && canGoogleTab && (
            <div>
              <ReportSectionHeader sectionLabel="Google Ads" title="Campaign performance vs previous period" />
              <div className={tableWrapMt}>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <SortTh label="Campaign" field="campaign_name" sort={googleCampaignSort} align="left" />
                      <SortTh label="Spend" field="spend" sort={googleCampaignSort} />
                      <SortTh label="Clicks" field="clicks" sort={googleCampaignSort} />
                      <SortTh label="CTR" field="_ctr" sort={googleCampaignSort} />
                      <SortTh label="Conv." field="conversions" sort={googleCampaignSort} />
                      <SortTh label="CPA" field="_cpa" sort={googleCampaignSort} />
                      <SortTh label="ROAS" field="_roas" sort={googleCampaignSort} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                  {googleCampaignSort.sortRows(aggGoogleCampaigns.map((c: any) => ({
                    ...c,
                    _ctr: c.impressions > 0 ? c.clicks / c.impressions * 100 : 0,
                    _roas: c.spend > 0 ? c.revenue / c.spend : 0,
                    _cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
                  }))).map((camp: any) => {
                    const prev = prevAggGoogleCampaignsMap.get(camp.campaign_id)
                    const ctr = camp.impressions > 0 ? camp.clicks / camp.impressions * 100 : 0
                    const roas = camp.spend > 0 ? camp.revenue / camp.spend : 0
                    const cpa = camp.conversions > 0 ? camp.spend / camp.conversions : 0
                    return (
                      <tr key={camp._key} className="hover:bg-red-50">
                        <td className="px-4 py-3 font-medium max-w-[280px] truncate">{camp.campaign_name}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {selectedClientCurrencySym}{camp.spend.toFixed(2)}
                          {prev && <PctBadge current={camp.spend} previous={prev.spend} />}
                        </td>
                        <td className="px-4 py-3 text-right">{camp.clicks.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          {ctr.toFixed(2)}%
                          {prev && prev.impressions > 0 && <PctBadge current={ctr} previous={prev.clicks / prev.impressions * 100} />}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${camp.conversions > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {camp.conversions}
                          </span>
                          {prev && <PctBadge current={camp.conversions} previous={prev.conversions} />}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {cpa > 0 ? `${selectedClientCurrencySym}${cpa.toFixed(2)}` : '-'}
                          {prev && cpa > 0 && (
                            <PctBadge current={cpa} previous={prev.conversions > 0 ? prev.spend / prev.conversions : 0} invertTrend />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {roas > 0 ? `${roas.toFixed(2)}x` : '-'}
                          {prev && roas > 0 && (
                            <PctBadge current={roas} previous={prev.spend > 0 ? prev.revenue / prev.spend : 0} />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                </table>
              </div>
            </div>
          )}

          {heatedDrillTab === 'keywords' && canKwTab && (
            <div>
              <ReportSectionHeader sectionLabel="Google Ads" title="Keywords vs previous period" />
              <div className={tableWrapMt}>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <SortTh label="Keyword" field="keyword" sort={keywordSort} align="left" />
                      <SortTh label="Campaign" field="campaign_name" sort={keywordSort} align="left" />
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ad Group</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Match</th>
                      <SortTh label="Spend" field="spend" sort={keywordSort} />
                      <SortTh label="Clicks" field="clicks" sort={keywordSort} />
                      <SortTh label="CTR" field="_ctr" sort={keywordSort} />
                      <SortTh label="Conv." field="conversions" sort={keywordSort} />
                      <SortTh label="CPC" field="_cpc" sort={keywordSort} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                  {keywordSort.sortRows(aggKeywords.map((k: any) => ({
                    ...k,
                    _ctr: k.impressions > 0 ? k.clicks / k.impressions * 100 : 0,
                    _cpc: k.clicks > 0 ? k.spend / k.clicks : 0,
                  }))).map((kw: any) => {
                    const prev = prevAggKeywordsMap.get(kw.keyword_id)
                    const ctr = kw.impressions > 0 ? kw.clicks / kw.impressions * 100 : 0
                    const cpc = kw.clicks > 0 ? kw.spend / kw.clicks : 0
                    return (
                      <tr key={kw._key} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{kw.keyword}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">{kw.campaign_name}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate">{kw.ad_group_name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">{kw.match_type}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {selectedClientCurrencySym}{kw.spend.toFixed(2)}
                          {prev && <PctBadge current={kw.spend} previous={prev.spend} />}
                        </td>
                        <td className="px-4 py-3 text-right">{kw.clicks}</td>
                        <td className="px-4 py-3 text-right">{ctr.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right">
                          {kw.conversions}
                          {prev && <PctBadge current={kw.conversions} previous={prev.conversions} />}
                        </td>
                        <td className="px-4 py-3 text-right">{cpc > 0 ? `$${cpc.toFixed(2)}` : '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                </table>
              </div>
            </div>
          )}

          {heatedDrillTab === 'search' && canSearchTab && (
            <div>
              <ReportSectionHeader sectionLabel="Google Ads" title="Search terms vs previous period" />
              <div className={tableWrapMt}>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <SortTh label="Search Term" field="search_term" sort={searchTermSort} align="left" />
                      <SortTh label="Campaign" field="campaign_name" sort={searchTermSort} align="left" />
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Match</th>
                      <SortTh label="Spend" field="spend" sort={searchTermSort} />
                      <SortTh label="Impr." field="impressions" sort={searchTermSort} />
                      <SortTh label="Clicks" field="clicks" sort={searchTermSort} />
                      <SortTh label="CTR" field="_ctr" sort={searchTermSort} />
                      <SortTh label="CPC" field="_cpc" sort={searchTermSort} />
                      <SortTh label="Conv." field="conversions" sort={searchTermSort} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                  {searchTermSort.sortRows(aggSearchTerms.map((t: any) => ({
                    ...t,
                    _ctr: t.impressions > 0 ? t.clicks / t.impressions * 100 : 0,
                    _cpc: t.clicks > 0 ? t.spend / t.clicks : 0,
                  }))).map((term: any) => {
                    const prev = prevAggSearchTermsMap.get(term.search_term)
                    const ctr = term.impressions > 0 ? term.clicks / term.impressions * 100 : 0
                    const cpc = term.clicks > 0 ? term.spend / term.clicks : 0
                    return (
                      <tr key={term._key} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium max-w-[220px] truncate">{term.search_term}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{term.campaign_name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{term.match_type}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {selectedClientCurrencySym}{term.spend.toFixed(2)}
                          {prev && <PctBadge current={term.spend} previous={prev.spend} />}
                        </td>
                        <td className="px-4 py-3 text-right">{term.impressions.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{term.clicks}</td>
                        <td className="px-4 py-3 text-right">{ctr.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right">{cpc > 0 ? `$${cpc.toFixed(2)}` : '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${term.conversions > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {term.conversions}
                          </span>
                          {prev && <PctBadge current={term.conversions} previous={prev.conversions} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                </table>
              </div>
            </div>
          )}

          {heatedDrillTab === 'adsets' && canAdsetsTab && (
            <div>
              <ReportSectionHeader sectionLabel="Meta" title="Ad set performance" />
              <MetaAdSetPerformanceTable
                compact
                clientId={selectedClient}
                startDate={dateRange.start}
                endDate={dateRange.end}
                scopedClientId={scopedClientId || undefined}
              />
            </div>
          )}
        </div>
      )}


    </div>
  )

  if (!showHeatedRail || !canAccessAlerts(appUser?.role)) return mainContent

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_15rem] xl:gap-3 xl:items-start">
      {mainContent}
      <OverviewAiNotesRail
        alerts={heatedAlerts.slice(0, 5)}
        alertSummary={heatedAlertSummary}
      />
    </div>
  )
}


