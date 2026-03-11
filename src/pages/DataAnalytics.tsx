import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Database, ChevronDown, TrendingUp, DollarSign, CreditCard,
  AlertCircle, Calendar, Settings, MousePointer2, ShoppingCart, Users,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { db } from '../lib/api'
import { getDashboardSettings, DEFAULT_SETTINGS } from '../lib/settings'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

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

  // NEW: Business Type and Selected Metric
  const [businessType, setBusinessType] = useState<'leadgen' | 'ecommerce'>('ecommerce')
  const [businessTypeManual, setBusinessTypeManual] = useState(false) // true when user manually overrides
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('roas')
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      const userId = 'default_user' // TODO: Get from auth
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

  // Fetch ad accounts filtered by selected client and platform
  const { data: adAccountsFromDB } = useQuery({
    queryKey: ['ad_accounts', selectedClient, selectedPlatform],
    queryFn: () => db.getAdAccounts({ clientId: selectedClient, platform: selectedPlatform }),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  })

  // Auto-detect business type from selected client or ad account's client
  useEffect(() => {
    if (businessTypeManual) return // user override takes precedence
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

  // Fetch performance data
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

  // Fetch previous period data for comparison
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

  // Fetch Meta data conditionally
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

  const { data: metaAds } = useQuery({
    queryKey: ['meta_ads', selectedClient, selectedAdAccount, dateRange],
    queryFn: () => db.getMetaAds({
      clientId: selectedClient,
      adAccountId: selectedAdAccount || undefined,
      startDate: dateRange.start,
      endDate: dateRange.end,
    }),
    enabled: selectedPlatform === 'all' || selectedPlatform === 'meta_ads',
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

  const { data: googleKeywords } = useQuery({
    queryKey: ['google_keywords', selectedClient, dateRange],
    queryFn: () => db.getGoogleKeywords(selectedClient, dateRange.start, dateRange.end),
    enabled: selectedPlatform === 'all' || selectedPlatform === 'google_ads',
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

  const availablePlatforms = platformsFromDB || []
  const clients: Client[] = clientsFromTable || []

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
      start.setMonth(0)  // January
      start.setDate(1)
    } else if (preset.type === 'last_year') {
      start.setFullYear(start.getFullYear() - 1)
      start.setMonth(0)  // January
      start.setDate(1)
      end.setFullYear(end.getFullYear() - 1)
      end.setMonth(11)  // December
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

  // Calculate totals for current period
  const totals = performanceData.reduce((acc, day) => {
    const cost = day.cost || 0
    const revenue = day.revenue || 0
    return {
      cost: acc.cost + cost,
      impressions: acc.impressions + (day.impressions || 0),
      clicks: acc.clicks + (day.clicks || 0),
      conversions: acc.conversions + (day.conversions || 0),
      revenue: acc.revenue + revenue,
    }
  }, { cost: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 })

  // Calculate totals for previous period
  const previousTotals = previousPerformanceData.reduce((acc, day) => {
    const cost = day.cost || 0
    const revenue = day.revenue || 0
    return {
      cost: acc.cost + cost,
      impressions: acc.impressions + (day.impressions || 0),
      clicks: acc.clicks + (day.clicks || 0),
      conversions: acc.conversions + (day.conversions || 0),
      revenue: acc.revenue + revenue,
    }
  }, { cost: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 })

  // Calculate metrics
  const roas = totals.cost > 0 ? (totals.revenue / totals.cost) : 0
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0
  const costPerConv = totals.conversions > 0 ? (totals.cost / totals.conversions) : 0

  const prevRoas = previousTotals.cost > 0 ? (previousTotals.revenue / previousTotals.cost) : 0
  const prevCtr = previousTotals.impressions > 0 ? (previousTotals.clicks / previousTotals.impressions * 100) : 0
  const prevCostPerConv = previousTotals.conversions > 0 ? (previousTotals.cost / previousTotals.conversions) : 0

  // Calculate percentage changes
  const calculateChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const spendChange = calculateChange(totals.cost, previousTotals.cost)
  const ctrChange = calculateChange(ctr, prevCtr)
  const conversionsChange = calculateChange(totals.conversions, previousTotals.conversions)
  const costPerConvChange = calculateChange(costPerConv, prevCostPerConv)
  const roasChange = calculateChange(roas, prevRoas)

  // Daily data with all metrics
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
      impressions,
      clicks,
      conversions,
      revenue,
      ctr: impressions > 0 ? (clicks / impressions * 100) : 0,
      costperconv: conversions > 0 ? (cost / conversions) : 0,
      roas: cost > 0 ? (revenue / cost) : 0,
    }

    if (existing) {
      existing.spend += dataPoint.spend
      existing.impressions += dataPoint.impressions
      existing.clicks += dataPoint.clicks
      existing.conversions += dataPoint.conversions
      existing.revenue += dataPoint.revenue
      existing.ctr = existing.impressions > 0 ? (existing.clicks / existing.impressions * 100) : 0
      existing.costperconv = existing.conversions > 0 ? (existing.spend / existing.conversions) : 0
      existing.roas = existing.spend > 0 ? (existing.revenue / existing.spend) : 0
    } else {
      acc.push(dataPoint)
    }
    return acc
  }, []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Chart domain calculator
  const getChartDomain = (metricKey: MetricKey): [number, number] => {
    const values = dailyDataWithMetrics.map(d => parseFloat(d[metricKey]) || 0)
    const maxValue = Math.max(...values, 1) // At least 1
    const ceiling = Math.ceil(maxValue * 1.2) // 20% margin

    return [0, Math.max(ceiling, 1)]
  }

  // Metric configurations
  const metricConfig: Record<MetricKey, any> = {
    spend: {
      label: 'Spend',
      color: '#3b82f6',
      gradient: 'blue',
      formatter: (value: number) => `$${value.toFixed(2)}`,
    },
    ctr: {
      label: 'CTR',
      color: '#8b5cf6',
      gradient: 'violet',
      formatter: (value: number) => `${value.toFixed(2)}%`,
    },
    conversions: {
      label: businessType === 'leadgen' ? 'Leads' : 'Purchases',
      color: '#10b981',
      gradient: 'emerald',
      formatter: (value: number) => value.toString(),
    },
    costperconv: {
      label: businessType === 'leadgen' ? 'Cost Per Lead (CPL)' : 'Cost Per Purchase',
      color: '#f59e0b',
      gradient: 'amber',
      formatter: (value: number) => `$${value.toFixed(2)}`,
    },
    roas: {
      label: 'ROAS',
      color: '#ef4444',
      gradient: 'red',
      formatter: (value: number) => `${value.toFixed(2)}x`,
    },
  }

  const currentMetricConfig = metricConfig[selectedMetric]

  // KPI definitions with period comparison
  const leadGenKPIs = [
    {
      title: "Total Spend",
      value: `$${totals.cost.toLocaleString(undefined, {maximumFractionDigits: 2})}`,
      change: spendChange,
      icon: DollarSign,
      color: "blue",
      key: "spend" as MetricKey
    },
    {
      title: "CTR",
      value: `${ctr.toFixed(2)}%`,
      change: ctrChange,
      icon: MousePointer2,
      color: "violet",
      key: "ctr" as MetricKey
    },
    {
      title: "Leads",
      value: totals.conversions.toLocaleString(),
      change: conversionsChange,
      icon: Users,
      color: "emerald",
      key: "conversions" as MetricKey
    },
    {
      title: "Cost Per Lead (CPL)",
      value: `$${costPerConv.toFixed(2)}`,
      change: costPerConvChange,
      icon: CreditCard,
      color: "amber",
      key: "costperconv" as MetricKey
    },
  ]

  const ecommerceKPIs = [
    {
      title: "Total Spend",
      value: `$${totals.cost.toLocaleString(undefined, {maximumFractionDigits: 2})}`,
      change: spendChange,
      icon: DollarSign,
      color: "blue",
      key: "spend" as MetricKey
    },
    {
      title: "CTR",
      value: `${ctr.toFixed(2)}%`,
      change: ctrChange,
      icon: MousePointer2,
      color: "violet",
      key: "ctr" as MetricKey
    },
    {
      title: "Purchases",
      value: totals.conversions.toLocaleString(),
      change: conversionsChange,
      icon: ShoppingCart,
      color: "emerald",
      key: "conversions" as MetricKey
    },
    {
      title: "ROAS",
      value: `${roas.toFixed(2)}x`,
      change: roasChange,
      icon: TrendingUp,
      color: "amber",
      key: "roas" as MetricKey
    },
  ]

  const currentKPIs = businessType === 'leadgen' ? leadGenKPIs : ecommerceKPIs

  const selectedClientName = selectedClient === 'all'
    ? 'All Clients'
    : clients?.find(c => c.id === selectedClient)?.name || 'Unknown'

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  // Set default date range
  useEffect(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - settings.defaultDateRange)
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    })
  }, [settings.defaultDateRange])

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

      {/* Business Type Toggle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">Business Type:</span>
            {!businessTypeManual && selectedClient !== 'all' && (
              <span className="text-xs text-gray-400 italic">Auto-detected</span>
            )}
            <div className="flex rounded-lg border border-gray-200 p-1">
              <button
                onClick={() => { setBusinessType('leadgen'); setBusinessTypeManual(true); setSelectedMetric('costperconv') }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${businessType === 'leadgen'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <Users size={16} />
                Lead Gen
              </button>
              <button
                onClick={() => { setBusinessType('ecommerce'); setBusinessTypeManual(true); setSelectedMetric('roas') }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${businessType === 'ecommerce'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <ShoppingCart size={16} />
                eCommerce
              </button>
            </div>
            {businessTypeManual && (
              <button
                onClick={() => setBusinessTypeManual(false)}
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                Auto-detect
              </button>
            )}
          </div>

          <button
            onClick={() => navigate('/dashboard/settings')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            <Settings size={18} />
            Settings
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Client Dropdown */}
          <div className="relative">
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">
              Client ({clients.length})
            </label>
            <button
              onClick={() => setShowClientDropdown(!showClientDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg min-w-[250px]"
            >
              <span className="flex-1 text-left truncate">{selectedClientName}</span>
              <ChevronDown size={16} />
            </button>
            {showClientDropdown && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-60 overflow-y-auto">
                <button onClick={() => { setSelectedClient('all'); setSelectedAdAccount(''); setBusinessTypeManual(false); setShowClientDropdown(false) }} className="w-full text-left px-4 py-2 hover:bg-gray-50">All Clients</button>
                {clients?.map(client => (
                  <button key={client.id} onClick={() => { setSelectedClient(client.id); setSelectedAdAccount(''); setBusinessTypeManual(false); setShowClientDropdown(false) }} className="w-full text-left px-4 py-2 hover:bg-gray-50">
                    <div className="font-medium">{client.name}</div>
                    {client.business_type && (
                      <div className="text-xs text-gray-500">{client.business_type === 'leadgen' ? 'Lead Gen' : 'eCommerce'}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Platform Dropdown */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">
              Platform ({availablePlatforms.length} found)
            </label>
            <select
              value={selectedPlatform}
              onChange={(e) => {
                setSelectedPlatform(e.target.value)
                setSelectedAdAccount('') // Reset ad account when platform changes
              }}
              className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg min-w-[200px]"
            >
              <option value="all">All Platforms</option>
              {availablePlatforms.map((platform: any) => (
                <option key={platform.id} value={platform.id}>{platform.label}</option>
              ))}
            </select>
          </div>

          {/* Ad Account Dropdown - Always visible, filtered by client and platform */}
          {adAccountsFromDB && adAccountsFromDB.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">
                Ad Account ({adAccountsFromDB.length} found)
              </label>
              <select
                value={selectedAdAccount}
                onChange={(e) => setSelectedAdAccount(e.target.value)}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg min-w-[250px]"
              >
                <option value="">All Accounts</option>
                {adAccountsFromDB.map((account: any) => (
                  <option key={account.id} value={account.id}>{account.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range with Presets */}
          <div className="relative">
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Date Range</label>
            <div className="flex items-center gap-2">
              <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg" />
              <span className="text-gray-400">to</span>
              <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg" />
              <button
                onClick={() => setShowDatePresets(!showDatePresets)}
                className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
              >
                Presets
              </button>
            </div>

            {showDatePresets && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                {DATE_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => applyDatePreset(preset)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards - Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {currentKPIs.map(kpi => {
          const isPositive = kpi.change >= 0
          const changeColor = isPositive ? 'text-green-600' : 'text-red-600'
          const ArrowIcon = isPositive ? ArrowUpRight : ArrowDownRight

          return (
            <div
              key={kpi.key}
              onClick={() => setSelectedMetric(kpi.key)}
              className={`bg-white rounded-xl shadow-sm border-2 cursor-pointer transition-all ${selectedMetric === kpi.key
                  ? 'border-blue-500 shadow-lg scale-105'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                } p-6`}
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
                    <span>{Math.abs(kpi.change).toFixed(1)}%</span>
                  </div>
                )}
                {selectedMetric === kpi.key && (
                  <div className="text-xs text-blue-600 font-medium">
                    ↓ Chart below
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Dynamic Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {currentMetricConfig.label} Trend (Daily)
        </h3>
        {performanceData.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="mx-auto mb-2" size={32} />
            <p>No data available for selected filters</p>
            <p className="text-sm mt-2">Selected: {selectedClientName} | {selectedPlatform} | {dateRange.start} to {dateRange.end}</p>
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
              <YAxis
                tick={{ fontSize: 12 }}
                domain={getChartDomain(selectedMetric)}
              />
              <Tooltip formatter={(value: number) => [currentMetricConfig.formatter(value), currentMetricConfig.label]} />
              <Area
                type="monotone"
                dataKey={selectedMetric}
                stroke={currentMetricConfig.color}
                fillOpacity={1}
                fill="url(#colorMetric)"
                isAnimationActive={settings.animateChart}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Daily Performance Data Table - Collapsible */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <details open>
          <summary className="text-lg font-semibold text-gray-900 mb-4 cursor-pointer">
            Daily Performance Data ({performanceData.length} records)
          </summary>
          {performanceData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Database className="mx-auto mb-2" size={32} />
              <p>No data available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Client</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ad Account</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Spend</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Conv.</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">
                      {businessType === 'leadgen' ? 'CPA' : 'ROAS'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {performanceData.slice(0, settings.rowsPerPage).map((day: any) => {
                    const cost = day.cost || 0
                    const revenue = day.revenue || 0
                    const conversions = day.conversions || 0
                    const roas = cost > 0 ? (revenue / cost) : 0
                    const cpa = conversions > 0 ? (cost / conversions) : 0
                    const clientName = clients.find(c => c.id === day.client_id)?.name || day.client_name
                    const hasConversions = conversions > 0
                    const rowClass = hasConversions ? 'hover:bg-green-50' : 'bg-gray-50 text-gray-500'

                    return (
                      <tr key={day.id} className={rowClass}>
                        <td className="px-4 py-3">{day.date}</td>
                        <td className="px-4 py-3 font-medium">{clientName}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-mono text-xs">{day.ad_account_id || 'N/A'}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 w-fit mt-1">
                              {day.platform}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">${cost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-1 rounded-full text-sm ${
                            hasConversions ? 'bg-green-100 text-green-700 font-semibold' : 'bg-gray-200 text-gray-500'
                          }`}>
                            {conversions}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {businessType === 'leadgen' ? `$${cpa.toFixed(2)}` : `${roas.toFixed(2)}x`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </details>
      </div>

      {/* Meta Ad Set Performance */}
      {(selectedPlatform === 'all' || selectedPlatform === 'meta_ads') && metaAdsets && metaAdsets.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <details>
            <summary className="text-lg font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
              <span className="text-blue-600">📊</span>
              Meta Ad Set Performance ({metaAdsets.length} records)
            </summary>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Campaign</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ad Set</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Spend</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Impressions</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Clicks</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">CTR</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Conv.</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">
                      {businessType === 'leadgen' ? 'CPA' : 'ROAS'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {metaAdsets.map((adset: any) => {
                    const spend = adset.spend || 0
                    const impressions = adset.impressions || 0
                    const clicks = adset.clicks || 0
                    const conversions = adset.conversions || 0
                    const revenue = adset.revenue || 0
                    const roas = spend > 0 ? (revenue / spend) : 0
                    const cpa = conversions > 0 ? (spend / conversions) : 0
                    const ctr = impressions > 0 ? (clicks / impressions * 100) : 0

                    return (
                      <tr key={adset.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{adset.campaign_name}</td>
                        <td className="px-4 py-3 font-medium max-w-[200px] truncate">{adset.ad_set_name}</td>
                        <td className="px-4 py-3 text-right font-medium">${spend.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{impressions.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{clicks.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{ctr.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${conversions > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {conversions}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {businessType === 'leadgen'
                            ? (cpa > 0 ? `$${cpa.toFixed(2)}` : '-')
                            : (roas > 0 ? `${roas.toFixed(2)}x` : '-')}
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

      {/* Meta Ad Performance */}
      {(selectedPlatform === 'all' || selectedPlatform === 'meta_ads') && metaAds && metaAds.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <details>
            <summary className="text-lg font-semibold text-gray-900 mb-4 cursor-pointer flex items-center gap-2">
              <span className="text-blue-600">🎯</span>
              Meta Ad Performance ({metaAds.length} records)
            </summary>
            <div className="overflow-x-auto mt-4">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Client</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ad Account</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Campaign</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Adset</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ad Name</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Spend</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Conv.</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">
                      {businessType === 'leadgen' ? 'CPA' : 'ROAS'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {metaAds.map((ad: any) => {
                    const spend = ad.spend || 0
                    const conversions = ad.conversions || 0
                    const revenue = ad.revenue || 0
                    const roas = spend > 0 ? (revenue / spend) : 0
                    const cpa = conversions > 0 ? (spend / conversions) : 0
                    const clientName = clients.find(c => c.id === ad.client_id)?.name || 'Unknown'

                    return (
                      <tr key={ad.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{ad.date}</td>
                        <td className="px-4 py-3 text-sm font-medium">{clientName}</td>
                        <td className="px-4 py-3 text-xs font-mono">{ad.ad_account_id}</td>
                        <td className="px-4 py-3 text-sm">{ad.campaign_name}</td>
                        <td className="px-4 py-3 text-sm">{ad.ad_set_name}</td>
                        <td className="px-4 py-3 text-sm font-medium">{ad.ad_name}</td>
                        <td className="px-4 py-3 text-right">${spend.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{conversions}</td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {businessType === 'leadgen' ? `$${cpa.toFixed(2)}` : `${roas.toFixed(2)}x`}
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

      {/* Meta Creative Table */}
      {(selectedPlatform === 'all' || selectedPlatform === 'meta_ads') && metaCreatives && metaCreatives.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <details open>
            <summary className="text-lg font-semibold text-gray-900 cursor-pointer flex items-center gap-2">
              <span className="text-purple-600">🎨</span>
              Meta Creative Performance ({metaCreatives.length} ads)
            </summary>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-16">Creative</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ad Name / Copy</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Campaign</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ad Set</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Spend</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Impressions</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">CTR</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Conv.</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">
                      {businessType === 'leadgen' ? 'CPA' : 'ROAS'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {metaCreatives.map((creative: any) => {
                    const spend = creative.spend || 0
                    const impressions = creative.impressions || 0
                    const clicks = creative.clicks || 0
                    const conversions = creative.conversions || 0
                    const revenue = creative.revenue || 0
                    const ctr = impressions > 0 ? (clicks / impressions * 100) : 0
                    const roas = spend > 0 ? (revenue / spend) : 0
                    const cpa = conversions > 0 ? (spend / conversions) : 0
                    const imgSrc = creative.image_url || creative.thumbnail_url

                    return (
                      <tr key={creative.id} className="hover:bg-purple-50 align-top">
                        <td className="px-4 py-3">
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={creative.ad_name}
                              className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 text-xs">N/A</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 max-w-[200px] truncate">{creative.ad_name}</div>
                          {creative.headline && (
                            <div className="text-xs text-gray-500 mt-0.5 max-w-[200px] truncate">{creative.headline}</div>
                          )}
                          {creative.primary_copy && (
                            <div className="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate italic">"{creative.primary_copy}"</div>
                          )}
                          {creative.call_to_action_type && (
                            <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                              {creative.call_to_action_type.replace(/_/g, ' ')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{creative.campaign_name}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{creative.ad_set_name}</td>
                        <td className="px-4 py-3 text-right font-medium">${spend.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{impressions.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{ctr.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${conversions > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {conversions}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {businessType === 'leadgen'
                            ? (cpa > 0 ? `$${cpa.toFixed(2)}` : '-')
                            : (roas > 0 ? `${roas.toFixed(2)}x` : '-')}
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

      {/* Google Keyword Performance */}
      {(selectedPlatform === 'all' || selectedPlatform === 'google_ads') && googleKeywords && googleKeywords.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <details>
            <summary className="text-lg font-semibold text-gray-900 mb-4 cursor-pointer flex items-center gap-2">
              <span className="text-red-600">🔑</span>
              Google Keywords ({googleKeywords.length} records)
            </summary>
            <div className="overflow-x-auto mt-4">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Keyword</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Campaign</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ad Group</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Match Type</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Spend</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Clicks</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">CTR</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Conv.</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">CPC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {googleKeywords.map((keyword: any) => (
                    <tr key={keyword.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{keyword.keyword}</td>
                      <td className="px-4 py-3 text-sm">{keyword.campaign_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{keyword.ad_group_name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">{keyword.match_type}</span>
                      </td>
                      <td className="px-4 py-3 text-right">${(keyword.spend || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">{keyword.clicks}</td>
                      <td className="px-4 py-3 text-right">{keyword.ctr ? `${Number(keyword.ctr).toFixed(2)}%` : '-'}</td>
                      <td className="px-4 py-3 text-right">{keyword.conversions}</td>
                      <td className="px-4 py-3 text-right">{keyword.cpc ? `$${Number(keyword.cpc).toFixed(2)}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      {/* Google Search Terms */}
      {(selectedPlatform === 'all' || selectedPlatform === 'google_ads') && googleSearchTerms && googleSearchTerms.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <details>
            <summary className="text-lg font-semibold text-gray-900 mb-4 cursor-pointer flex items-center gap-2">
              <span className="text-orange-600">🔍</span>
              Google Search Terms ({googleSearchTerms.length} records)
            </summary>
            <div className="overflow-x-auto mt-4">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Search Term</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Campaign</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ad Group</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Match</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Spend</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Impr.</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Clicks</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">CTR</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">CPC</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Conv.</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">CPA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {googleSearchTerms.map((term: any) => (
                    <tr key={term.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium max-w-[200px] truncate">{term.search_term}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px] truncate">{term.campaign_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[120px] truncate">{term.ad_group_name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{term.match_type}</span>
                      </td>
                      <td className="px-4 py-3 text-right">${(term.spend || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">{(term.impressions || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">{term.clicks || 0}</td>
                      <td className="px-4 py-3 text-right">{term.ctr ? `${(Number(term.ctr) * 100).toFixed(2)}%` : '-'}</td>
                      <td className="px-4 py-3 text-right">{term.cpc ? `$${Number(term.cpc).toFixed(2)}` : '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(term.conversions || 0) > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {term.conversions || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{term.cost_per_conversion ? `$${Number(term.cost_per_conversion).toFixed(2)}` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
