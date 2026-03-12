import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Database, ChevronDown, TrendingUp, DollarSign, CreditCard,
  AlertCircle, Calendar, Settings, MousePointer2, ShoppingCart, Users,
  ArrowUpRight, ArrowDownRight, Video, Image, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react'
import { db } from '../lib/api'
import { getDashboardSettings, DEFAULT_SETTINGS } from '../lib/settings'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

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
  return (
    <th className={`px-4 py-3 text-xs font-medium text-gray-500 text-${align}`}>
      <button
        onClick={() => sort.toggle(field)}
        className={`flex items-center gap-1 text-xs font-medium uppercase hover:text-gray-800 ${align === 'right' ? 'ml-auto' : ''} ${active ? 'text-blue-600' : 'text-gray-500'}`}
      >
        {label}
        <Icon size={11} className={active ? 'text-blue-600' : 'text-gray-400'} />
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
}

const DATE_PRESETS = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 14 Days', days: 14 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'This Month', type: 'month' },
  { label: 'Last Month', type: 'last_month' },
  { label: 'This Year', type: 'this_year' },
  { label: 'Last Year', type: 'last_year' },
]

type MetricKey = 'spend' | 'ctr' | 'conversions' | 'costperconv' | 'roas'

// Aggregate rows by a key field (campaign, adset, ad), summing metrics across dates
function aggregateRows<T extends Record<string, any>>(
  rows: T[],
  keyField: string,
  nameField: string,
  extraFields: string[] = []
): any[] {
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
      map.set(key, entry)
    }
    const entry = map.get(key)!
    entry.spend += Number(row.spend) || 0
    entry.impressions += Number(row.impressions) || 0
    entry.clicks += Number(row.clicks) || 0
    entry.conversions += Number(row.conversions) || 0
    entry.revenue += Number(row.revenue) || 0
  }
  const result = Array.from(map.values())
  result.sort((a, b) => b.spend - a.spend)
  return result
}

// Aggregate creatives by ad_id, keeping latest creative fields
function aggregateCreatives(rows: any[]): any[] {
  const map = new Map<string, any>()
  for (const row of rows) {
    const key = row.ad_id || row.id
    if (!map.has(key)) {
      map.set(key, {
        _key: key,
        ad_id: row.ad_id,
        ad_name: row.ad_name,
        campaign_name: row.campaign_name,
        ad_set_name: row.ad_set_name,
        image_url: row.image_url,
        thumbnail_url: row.thumbnail_url,
        video_id: row.video_id,
        headline: row.headline,
        primary_copy: row.primary_copy,
        call_to_action_type: row.call_to_action_type,
        spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0,
      })
    }
    const entry = map.get(key)!
    entry.spend += Number(row.spend) || 0
    entry.impressions += Number(row.impressions) || 0
    entry.clicks += Number(row.clicks) || 0
    entry.conversions += Number(row.conversions) || 0
    entry.revenue += Number(row.revenue) || 0
    // Prefer row with image
    if (!entry.image_url && row.image_url) entry.image_url = row.image_url
    if (!entry.thumbnail_url && row.thumbnail_url) entry.thumbnail_url = row.thumbnail_url
    if (!entry.video_id && row.video_id) entry.video_id = row.video_id
  }
  return Array.from(map.values()).sort((a, b) => b.spend - a.spend)
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

export default function DataAnalytics() {
  const navigate = useNavigate()

  // Core states
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [showDatePresets, setShowDatePresets] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Table sort states
  const adsetSort = useTableSort('spend')
  const creativeSort = useTableSort('spend')
  const keywordSort = useTableSort('spend')
  const searchTermSort = useTableSort('spend')

  // Business Type and Selected Metric
  const [businessType, setBusinessType] = useState<'leadgen' | 'ecommerce'>('ecommerce')
  const [businessTypeManual, setBusinessTypeManual] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('roas')
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
    queryKey: ['clients_table'],
    queryFn: db.getClients,
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
    queryKey: ['ad_accounts', selectedClient, selectedPlatform],
    queryFn: () => db.getAdAccounts({ clientId: selectedClient, platform: selectedPlatform }),
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
  const { data: performance } = useQuery({
    queryKey: ['performance', selectedClient, selectedPlatform, selectedAdAccount, dateRange],
    queryFn: () => db.getDailyPerformance({
      clientId: selectedClient,
      platform: selectedPlatform,
      adAccountId: selectedAdAccount || undefined,
      startDate: dateRange.start,
      endDate: dateRange.end,
    }),
    staleTime: settings.cacheTimeout * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const performanceData: DailyPerformance[] = (performance as DailyPerformance[]) || []

  // Previous period range
  const previousPeriodRange = (() => {
    if (!dateRange.start || !dateRange.end) return { start: '', end: '' }
    const startDate = new Date(dateRange.start)
    const endDate = new Date(dateRange.end)
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const prevEnd = new Date(startDate)
    prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevStart.getDate() - daysDiff)
    return {
      start: prevStart.toISOString().split('T')[0],
      end: prevEnd.toISOString().split('T')[0]
    }
  })()

  const { data: previousPerformance } = useQuery({
    queryKey: ['previous_performance', selectedClient, selectedPlatform, selectedAdAccount, previousPeriodRange],
    queryFn: () => db.getDailyPerformance({
      clientId: selectedClient,
      platform: selectedPlatform,
      adAccountId: selectedAdAccount || undefined,
      startDate: previousPeriodRange.start,
      endDate: previousPeriodRange.end,
    }),
    enabled: !!previousPeriodRange.start && !!previousPeriodRange.end,
    staleTime: settings.cacheTimeout * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const previousPerformanceData: DailyPerformance[] = (previousPerformance as DailyPerformance[]) || []

  // Meta data
  const { data: metaAdsets } = useQuery({
    queryKey: ['meta_adsets', selectedClient, selectedAdAccount, dateRange],
    queryFn: () => db.getMetaAdsets({
      clientId: selectedClient,
      adAccountId: selectedAdAccount || undefined,
      startDate: dateRange.start,
      endDate: dateRange.end,
    }),
    enabled: selectedPlatform === 'all' || selectedPlatform === 'meta_ads',
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  // Previous period Meta adsets
  const { data: prevMetaAdsets } = useQuery({
    queryKey: ['meta_adsets_prev', selectedClient, selectedAdAccount, previousPeriodRange],
    queryFn: () => db.getMetaAdsets({
      clientId: selectedClient,
      adAccountId: selectedAdAccount || undefined,
      startDate: previousPeriodRange.start,
      endDate: previousPeriodRange.end,
    }),
    enabled: (selectedPlatform === 'all' || selectedPlatform === 'meta_ads') && !!previousPeriodRange.start,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const { data: metaCreatives } = useQuery({
    queryKey: ['meta_creatives', selectedClient, dateRange],
    queryFn: () => db.getMetaCreatives(selectedClient, dateRange.start, dateRange.end),
    enabled: selectedPlatform === 'all' || selectedPlatform === 'meta_ads',
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  // Previous period creatives
  const { data: prevMetaCreatives } = useQuery({
    queryKey: ['meta_creatives_prev', selectedClient, previousPeriodRange],
    queryFn: () => db.getMetaCreatives(selectedClient, previousPeriodRange.start, previousPeriodRange.end),
    enabled: (selectedPlatform === 'all' || selectedPlatform === 'meta_ads') && !!previousPeriodRange.start,
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

  // Aggregated data
  const aggAdsets = aggregateRows(metaAdsets || [], 'ad_set_id', 'ad_set_name', ['campaign_name'])
  const prevAggAdsets = aggregateRows(prevMetaAdsets || [], 'ad_set_id', 'ad_set_name', ['campaign_name'])
  const aggCreatives = aggregateCreatives(metaCreatives || [])
  const prevAggCreativesMap = new Map((aggregateCreatives(prevMetaCreatives || [])).map(r => [r.ad_id, r]))
  const aggKeywords = aggregateRows(googleKeywords || [], 'keyword_id', 'keyword', ['campaign_name', 'ad_group_name', 'match_type'])
  const prevAggKeywordsMap = new Map((aggregateRows(prevGoogleKeywords || [], 'keyword_id', 'keyword', ['campaign_name', 'ad_group_name', 'match_type'])).map(r => [r.keyword_id, r]))
  const aggSearchTerms = aggregateRows(googleSearchTerms || [], 'search_term', 'search_term', ['campaign_name', 'ad_group_name', 'match_type'])
  const prevAggSearchTermsMap = new Map((aggregateRows(prevGoogleSearchTerms || [], 'search_term', 'search_term', [])).map(r => [r.search_term, r]))

  // Apply date preset
  const applyDatePreset = (preset: any) => {
    const end = new Date()
    const start = new Date()
    if (preset.type === 'month') {
      start.setDate(1)
    } else if (preset.type === 'last_month') {
      start.setMonth(start.getMonth() - 1)
      start.setDate(1)
      end.setDate(0)
    } else if (preset.type === 'this_year') {
      start.setMonth(0)
      start.setDate(1)
    } else if (preset.type === 'last_year') {
      start.setFullYear(start.getFullYear() - 1)
      start.setMonth(0)
      start.setDate(1)
      end.setFullYear(end.getFullYear() - 1)
      end.setMonth(11)
      end.setDate(31)
    } else {
      start.setDate(end.getDate() - preset.days)
    }
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    })
    setShowDatePresets(false)
  }

  // Totals
  const totals = performanceData.reduce((acc, day) => ({
    cost: acc.cost + (day.cost || 0),
    impressions: acc.impressions + (day.impressions || 0),
    clicks: acc.clicks + (day.clicks || 0),
    conversions: acc.conversions + (day.conversions || 0),
    revenue: acc.revenue + (day.revenue || 0),
  }), { cost: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 })

  const previousTotals = previousPerformanceData.reduce((acc, day) => ({
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
  const dailyDataWithMetrics = performanceData.reduce((acc: any[], day) => {
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

  const getChartDomain = (metricKey: MetricKey): [number, number] => {
    const values = dailyDataWithMetrics.map(d => parseFloat(d[metricKey]) || 0)
    const maxValue = Math.max(...values, 1)
    return [0, Math.ceil(maxValue * 1.2)]
  }

  const metricConfig: Record<MetricKey, any> = {
    spend: { label: 'Spend', color: '#3b82f6', formatter: (v: number) => `$${v.toFixed(2)}` },
    ctr: { label: 'CTR', color: '#8b5cf6', formatter: (v: number) => `${v.toFixed(2)}%` },
    conversions: { label: businessType === 'leadgen' ? 'Leads' : 'Purchases', color: '#10b981', formatter: (v: number) => v.toString() },
    costperconv: { label: businessType === 'leadgen' ? 'Cost Per Lead' : 'Cost Per Purchase', color: '#f59e0b', formatter: (v: number) => `$${v.toFixed(2)}` },
    roas: { label: 'ROAS', color: '#ef4444', formatter: (v: number) => `${v.toFixed(2)}x` },
  }

  const currentMetricConfig = metricConfig[selectedMetric]

  const leadGenKPIs = [
    { title: 'Total Spend', value: `$${totals.cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, change: spendChange, icon: DollarSign, color: 'blue', key: 'spend' as MetricKey },
    { title: 'CTR', value: `${ctr.toFixed(2)}%`, change: ctrChange, icon: MousePointer2, color: 'violet', key: 'ctr' as MetricKey },
    { title: 'Leads', value: totals.conversions.toLocaleString(), change: conversionsChange, icon: Users, color: 'emerald', key: 'conversions' as MetricKey },
    { title: 'Cost Per Lead (CPL)', value: `$${costPerConv.toFixed(2)}`, change: costPerConvChange, icon: CreditCard, color: 'amber', key: 'costperconv' as MetricKey, invertTrend: true },
  ]

  const ecommerceKPIs = [
    { title: 'Total Spend', value: `$${totals.cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, change: spendChange, icon: DollarSign, color: 'blue', key: 'spend' as MetricKey },
    { title: 'CTR', value: `${ctr.toFixed(2)}%`, change: ctrChange, icon: MousePointer2, color: 'violet', key: 'ctr' as MetricKey },
    { title: 'Purchases', value: totals.conversions.toLocaleString(), change: conversionsChange, icon: ShoppingCart, color: 'emerald', key: 'conversions' as MetricKey },
    { title: 'ROAS', value: `${roas.toFixed(2)}x`, change: roasChange, icon: TrendingUp, color: 'amber', key: 'roas' as MetricKey },
  ]

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
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - settings.defaultDateRange)
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    })
  }, [settings.defaultDateRange])

  // Creative image component
  const CreativeThumb = ({ creative }: { creative: any }) => {
    const isVideo = !!creative.video_id
    const imgSrc = creative.image_url || creative.thumbnail_url
    const videoUrl = creative.video_id ? `https://www.facebook.com/videos/${creative.video_id}` : null

    const wrapLink = (content: React.ReactNode) =>
      videoUrl ? (
        <a href={videoUrl} target="_blank" rel="noopener noreferrer" title="View video" className="block">
          {content}
        </a>
      ) : <>{content}</>

    if (isVideo && !imgSrc) {
      return wrapLink(
        <div className="w-14 h-14 bg-gray-800 rounded-lg flex flex-col items-center justify-center gap-1 hover:opacity-80 transition-opacity cursor-pointer">
          <Video size={18} className="text-white" />
          <span className="text-white text-[9px]">VIDEO</span>
        </div>
      )
    }

    if (imgSrc) {
      return wrapLink(
        <div className="relative w-14 h-14">
          <img
            src={imgSrc}
            alt={creative.ad_name}
            className={`w-14 h-14 object-cover rounded-lg border border-gray-200 ${videoUrl ? 'hover:opacity-80 transition-opacity cursor-pointer' : ''}`}
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent) {
                parent.innerHTML = `<div class="w-14 h-14 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 text-[10px] text-center px-1">${isVideo ? '🎬' : '🖼️'}<br/>N/A</div>`
              }
            }}
          />
          {isVideo && (
            <div className="absolute bottom-0.5 right-0.5 bg-black/60 rounded px-1">
              <Video size={10} className="text-white" />
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="w-14 h-14 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
        <Image size={18} className="text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Database className="text-blue-600" />
            Account Performance
          </h1>
          <p className="text-gray-500 mt-1">Deep-dive performance metrics by account</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-600" size={20} />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">✕</button>
        </div>
      )}

      {/* ── STICKY FILTER BAR ── */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm shadow-md border-b border-gray-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Business Type Toggle */}
          <div className="flex rounded-lg border border-gray-200 p-0.5">
            <button
              onClick={() => { setBusinessType('leadgen'); setBusinessTypeManual(true); setSelectedMetric('costperconv') }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1 ${businessType === 'leadgen' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Users size={13} /> Lead Gen
            </button>
            <button
              onClick={() => { setBusinessType('ecommerce'); setBusinessTypeManual(true); setSelectedMetric('roas') }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1 ${businessType === 'ecommerce' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <ShoppingCart size={13} /> eCommerce
            </button>
          </div>
          {businessTypeManual && (
            <button onClick={() => setBusinessTypeManual(false)} className="text-xs text-blue-500 underline">Auto</button>
          )}

          <div className="w-px h-6 bg-gray-200" />

          {/* Client Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowClientDropdown(!showClientDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm min-w-[180px]"
            >
              <span className="flex-1 text-left truncate">{selectedClientName}</span>
              <ChevronDown size={14} />
            </button>
            {showClientDropdown && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-56 overflow-y-auto">
                <button onClick={() => { setSelectedClient('all'); setSelectedAdAccount(''); setBusinessTypeManual(false); setShowClientDropdown(false) }} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm">All Clients</button>
                {clients?.map(client => (
                  <button key={client.id} onClick={() => { setSelectedClient(client.id); setSelectedAdAccount(''); setBusinessTypeManual(false); setShowClientDropdown(false) }} className="w-full text-left px-4 py-2 hover:bg-gray-50">
                    <div className="text-sm font-medium">{client.name}</div>
                    {client.business_type && <div className="text-xs text-gray-500">{client.business_type === 'leadgen' ? 'Lead Gen' : 'eCommerce'}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Platform */}
          <select
            value={selectedPlatform}
            onChange={(e) => { setSelectedPlatform(e.target.value); setSelectedAdAccount('') }}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm min-w-[160px]"
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
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm min-w-[200px]"
            >
              <option value="">All Accounts</option>
              {adAccountsFromDB.map((account: any) => (
                <option key={account.id} value={account.id}>{account.label}</option>
              ))}
            </select>
          )}

          <div className="w-px h-6 bg-gray-200" />

          {/* Date Range */}
          <div className="relative flex items-center gap-1.5">
            <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
            <span className="text-gray-400 text-xs">to</span>
            <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
            <button
              onClick={() => setShowDatePresets(!showDatePresets)}
              className="px-2 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-xs font-medium flex items-center gap-1"
            >
              <Calendar size={13} /> Presets
            </button>
            {showDatePresets && (
              <div className="absolute top-full right-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                {DATE_PRESETS.map(preset => (
                  <button key={preset.label} onClick={() => applyDatePreset(preset)} className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm first:rounded-t-lg last:rounded-b-lg">
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Currency badge */}
          {selectedClient !== 'all' && (
            <span className="px-2 py-1 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg text-xs font-mono font-semibold">
              {selectedClientCurrency}
            </span>
          )}

          {/* Settings */}
          <button
            onClick={() => navigate('/dashboard/settings')}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm"
          >
            <Settings size={14} /> Settings
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {currentKPIs.map(kpi => {
          const isPositive = (kpi as any).invertTrend ? kpi.change <= 0 : kpi.change >= 0
          const changeColor = isPositive ? 'text-green-600' : 'text-red-600'
          const ArrowIcon = kpi.change >= 0 ? ArrowUpRight : ArrowDownRight

          return (
            <div
              key={kpi.key}
              onClick={() => setSelectedMetric(kpi.key)}
              className={`bg-white rounded-xl shadow-sm border-2 cursor-pointer transition-all ${selectedMetric === kpi.key ? 'border-blue-500 shadow-lg scale-105' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'} p-6`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm text-gray-500">{kpi.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                </div>
                <div className={`p-3 rounded-lg bg-${kpi.color}-50 text-${kpi.color}-600`}>
                  <kpi.icon size={24} />
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                {kpi.change !== undefined && (
                  <div className={`flex items-center gap-1 text-sm font-medium ${changeColor}`}>
                    <ArrowIcon size={14} />
                    <span>{Math.abs(kpi.change).toFixed(1)}% vs prev period</span>
                  </div>
                )}
                {selectedMetric === kpi.key && <div className="text-xs text-blue-600 font-medium">↓ Chart</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Dynamic Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{currentMetricConfig.label} Trend (Daily)</h3>
        {performanceData.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="mx-auto mb-2" size={32} />
            <p>No data available for selected filters</p>
            <p className="text-sm mt-2">{selectedClientName} | {selectedPlatform} | {dateRange.start} to {dateRange.end}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={settings.chartHeight}>
            <AreaChart data={dailyDataWithMetrics}>
              <defs>
                <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={currentMetricConfig.color} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={currentMetricConfig.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              {settings.showGridLines && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={getChartDomain(selectedMetric)} />
              <Tooltip formatter={(value: number) => [currentMetricConfig.formatter(value), currentMetricConfig.label]} />
              <Area type="monotone" dataKey={selectedMetric} stroke={currentMetricConfig.color} fillOpacity={1} fill="url(#colorMetric)" isAnimationActive={settings.animateChart} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── META AD SET PERFORMANCE (Aggregated) ── */}
      {(selectedPlatform === 'all' || selectedPlatform === 'meta_ads') && aggAdsets.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <details>
            <summary className="text-lg font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
              <span className="text-blue-600">📊</span>
              Meta Ad Set Performance ({aggAdsets.length} ad sets)
              <span className="ml-2 text-xs font-normal text-gray-400">vs previous period</span>
            </summary>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <SortTh label="Campaign" field="campaign_name" sort={adsetSort} align="left" />
                    <SortTh label="Ad Set" field="ad_set_name" sort={adsetSort} align="left" />
                    <SortTh label="Spend" field="spend" sort={adsetSort} />
                    <SortTh label="Impr." field="impressions" sort={adsetSort} />
                    <SortTh label="Clicks" field="clicks" sort={adsetSort} />
                    <SortTh label="CTR" field="_ctr" sort={adsetSort} />
                    <SortTh label="Conv." field="conversions" sort={adsetSort} />
                    <SortTh label={businessType === 'leadgen' ? 'CPA' : 'ROAS'} field={businessType === 'leadgen' ? '_cpa' : '_roas'} sort={adsetSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {adsetSort.sortRows(aggAdsets.map((a: any) => ({
                    ...a,
                    _ctr: a.impressions > 0 ? a.clicks / a.impressions * 100 : 0,
                    _roas: a.spend > 0 ? a.revenue / a.spend : 0,
                    _cpa: a.conversions > 0 ? a.spend / a.conversions : 0,
                  }))).map((adset: any) => {
                    const prev = prevAggAdsets.find((p: any) => p.ad_set_id === adset.ad_set_id)
                    const ctr = adset.impressions > 0 ? adset.clicks / adset.impressions * 100 : 0
                    const roas = adset.spend > 0 ? adset.revenue / adset.spend : 0
                    const cpa = adset.conversions > 0 ? adset.spend / adset.conversions : 0
                    return (
                      <tr key={adset._key} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{adset.campaign_name}</td>
                        <td className="px-4 py-3 font-medium max-w-[200px] truncate">{adset.ad_set_name}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {selectedClientCurrencySym}{adset.spend.toFixed(2)}
                          {prev && <PctBadge current={adset.spend} previous={prev.spend} />}
                        </td>
                        <td className="px-4 py-3 text-right">{adset.impressions.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{adset.clicks.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{ctr.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${adset.conversions > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {adset.conversions}
                          </span>
                          {prev && <PctBadge current={adset.conversions} previous={prev.conversions} />}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {businessType === 'leadgen'
                            ? (cpa > 0 ? `${selectedClientCurrencySym}${cpa.toFixed(2)}` : '-')
                            : (roas > 0 ? `${roas.toFixed(2)}x` : '-')}
                          {prev && businessType === 'leadgen' && cpa > 0 && (
                            <PctBadge current={cpa} previous={prev.conversions > 0 ? prev.spend / prev.conversions : 0} invertTrend />
                          )}
                          {prev && businessType === 'ecommerce' && roas > 0 && (
                            <PctBadge current={roas} previous={prev.spend > 0 ? prev.revenue / prev.spend : 0} />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      {/* ── META CREATIVE PERFORMANCE (Aggregated) ── */}
      {(selectedPlatform === 'all' || selectedPlatform === 'meta_ads') && aggCreatives.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <details open>
            <summary className="text-lg font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
              <span className="text-purple-600">🎨</span>
              Meta Creative Performance ({aggCreatives.length} ads)
              <span className="ml-2 text-xs font-normal text-gray-400">vs previous period</span>
            </summary>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-20">Creative</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ad / Copy</th>
                    <SortTh label="Campaign" field="campaign_name" sort={creativeSort} align="left" />
                    <SortTh label="Ad Set" field="ad_set_name" sort={creativeSort} align="left" />
                    <SortTh label="Spend" field="spend" sort={creativeSort} />
                    <SortTh label="Impr." field="impressions" sort={creativeSort} />
                    <SortTh label="CTR" field="_ctr" sort={creativeSort} />
                    <SortTh label="Conv." field="conversions" sort={creativeSort} />
                    <SortTh label={businessType === 'leadgen' ? 'CPA' : 'ROAS'} field={businessType === 'leadgen' ? '_cpa' : '_roas'} sort={creativeSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {creativeSort.sortRows(aggCreatives.map((c: any) => ({
                    ...c,
                    _ctr: c.impressions > 0 ? c.clicks / c.impressions * 100 : 0,
                    _roas: c.spend > 0 ? c.revenue / c.spend : 0,
                    _cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
                  }))).map((creative: any) => {
                    const prev = prevAggCreativesMap.get(creative.ad_id)
                    const ctr = creative.impressions > 0 ? creative.clicks / creative.impressions * 100 : 0
                    const roas = creative.spend > 0 ? creative.revenue / creative.spend : 0
                    const cpa = creative.conversions > 0 ? creative.spend / creative.conversions : 0
                    return (
                      <tr key={creative._key} className="hover:bg-purple-50 align-top">
                        <td className="px-4 py-3">
                          <CreativeThumb creative={creative} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 max-w-[200px] truncate">{creative.ad_name}</div>
                          {creative.headline && <div className="text-xs text-gray-500 mt-0.5 max-w-[200px] truncate">{creative.headline}</div>}
                          {creative.primary_copy && <div className="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate italic">"{creative.primary_copy}"</div>}
                          {creative.call_to_action_type && (
                            <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                              {creative.call_to_action_type.replace(/_/g, ' ')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{creative.campaign_name}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{creative.ad_set_name}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {selectedClientCurrencySym}{creative.spend.toFixed(2)}
                          {prev && <PctBadge current={creative.spend} previous={prev.spend} />}
                        </td>
                        <td className="px-4 py-3 text-right">{creative.impressions.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          {ctr.toFixed(2)}%
                          {prev && prev.impressions > 0 && <PctBadge current={ctr} previous={prev.clicks / prev.impressions * 100} />}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${creative.conversions > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {creative.conversions}
                          </span>
                          {prev && <PctBadge current={creative.conversions} previous={prev.conversions} />}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {businessType === 'leadgen'
                            ? (cpa > 0 ? `${selectedClientCurrencySym}${cpa.toFixed(2)}` : '-')
                            : (roas > 0 ? `${roas.toFixed(2)}x` : '-')}
                          {prev && businessType === 'leadgen' && cpa > 0 && (
                            <PctBadge current={cpa} previous={prev.conversions > 0 ? prev.spend / prev.conversions : 0} invertTrend />
                          )}
                          {prev && businessType === 'ecommerce' && roas > 0 && (
                            <PctBadge current={roas} previous={prev.spend > 0 ? prev.revenue / prev.spend : 0} />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      {/* ── GOOGLE KEYWORDS (Aggregated) ── */}
      {(selectedPlatform === 'all' || selectedPlatform === 'google_ads') && aggKeywords.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <details>
            <summary className="text-lg font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
              <span className="text-red-600">🔑</span>
              Google Keywords ({aggKeywords.length} keywords)
              <span className="ml-2 text-xs font-normal text-gray-400">vs previous period</span>
            </summary>
            <div className="overflow-x-auto mt-4">
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
          </details>
        </div>
      )}

      {/* ── GOOGLE SEARCH TERMS (Aggregated) ── */}
      {(selectedPlatform === 'all' || selectedPlatform === 'google_ads') && aggSearchTerms.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <details>
            <summary className="text-lg font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
              <span className="text-orange-600">🔍</span>
              Google Search Terms ({aggSearchTerms.length} terms)
              <span className="ml-2 text-xs font-normal text-gray-400">vs previous period</span>
            </summary>
            <div className="overflow-x-auto mt-4">
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
          </details>
        </div>
      )}
    </div>
  )
}
