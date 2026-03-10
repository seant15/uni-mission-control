import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Database, ChevronDown, TrendingUp, DollarSign, CreditCard,
  AlertCircle, Calendar, Settings, MousePointer2, ShoppingCart, Users
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
]

type MetricKey = 'spend' | 'ctr' | 'conversions' | 'costperconv' | 'roas'

export default function DataAnalytics() {
  const navigate = useNavigate()

  // Core states
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [showDatePresets, setShowDatePresets] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // NEW: Business Type and Selected Metric
  const [businessType, setBusinessType] = useState<'leadgen' | 'ecommerce'>('ecommerce')
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

  // Fetch performance data
  const { data: performance, isLoading: performanceLoading, error: performanceError } = useQuery({
    queryKey: ['performance', selectedClient, selectedPlatform, dateRange],
    queryFn: () => db.getDailyPerformance({
      clientId: selectedClient,
      platform: selectedPlatform,
      startDate: dateRange.start,
      endDate: dateRange.end,
    }),
    staleTime: settings.cacheTimeout * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const performanceData: DailyPerformance[] = (performance as DailyPerformance[]) || []

  // Fetch creatives/keywords conditionally
  const { data: metaCreatives } = useQuery({
    queryKey: ['meta_creatives', selectedClient],
    queryFn: () => db.getMetaCreatives(selectedClient),
    enabled: selectedPlatform === 'all' || selectedPlatform === 'meta_ads',
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  const { data: googleKeywords } = useQuery({
    queryKey: ['google_keywords', selectedClient],
    queryFn: () => db.getGoogleKeywords(selectedClient),
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
    } else {
      start.setDate(end.getDate() - preset.days)
    }

    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    })
    setShowDatePresets(false)
  }

  // Calculate totals
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

  const roas = totals.cost > 0 ? (totals.revenue / totals.cost).toFixed(2) : '0.00'
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100).toFixed(2) : '0.00'
  const costPerConv = totals.conversions > 0 ? (totals.cost / totals.conversions).toFixed(2) : '0.00'

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

  // KPI definitions
  const leadGenKPIs = [
    {
      title: "Total Spend",
      value: `$${totals.cost.toLocaleString()}`,
      icon: DollarSign,
      color: "blue",
      key: "spend" as MetricKey
    },
    {
      title: "CTR",
      value: `${ctr}%`,
      icon: MousePointer2,
      color: "violet",
      key: "ctr" as MetricKey
    },
    {
      title: "Leads",
      value: totals.conversions.toLocaleString(),
      icon: Users,
      color: "emerald",
      key: "conversions" as MetricKey
    },
    {
      title: "Cost Per Lead (CPL)",
      value: `$${costPerConv}`,
      icon: CreditCard,
      color: "amber",
      key: "costperconv" as MetricKey
    },
  ]

  const ecommerceKPIs = [
    {
      title: "Total Spend",
      value: `$${totals.cost.toLocaleString()}`,
      icon: DollarSign,
      color: "blue",
      key: "spend" as MetricKey
    },
    {
      title: "CTR",
      value: `${ctr}%`,
      icon: MousePointer2,
      color: "violet",
      key: "ctr" as MetricKey
    },
    {
      title: "Purchases",
      value: totals.conversions.toLocaleString(),
      icon: ShoppingCart,
      color: "emerald",
      key: "conversions" as MetricKey
    },
    {
      title: "ROAS",
      value: `${roas}x`,
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
            Data Analytics
          </h1>
          <p className="text-gray-500 mt-1">Performance metrics across all platforms</p>
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
            <div className="flex rounded-lg border border-gray-200 p-1">
              <button
                onClick={() => setBusinessType('leadgen')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
                  businessType === 'leadgen'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Users size={16} />
                Lead Gen
              </button>
              <button
                onClick={() => setBusinessType('ecommerce')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
                  businessType === 'ecommerce'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <ShoppingCart size={16} />
                eCommerce
              </button>
            </div>
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

      {/* Debug Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <details>
          <summary className="text-sm font-medium text-gray-600 cursor-pointer">Debug Info (click to expand)</summary>
          <div className="mt-2 text-xs text-gray-500 space-y-1 font-mono">
            <p>Performance Loading: {performanceLoading ? 'YES' : 'NO'}</p>
            <p>Performance Error: {performanceError ? (performanceError as any).message : 'None'}</p>
            <p>Records Loaded: {performanceData.length}</p>
            <p>Available Platforms: {availablePlatforms.join(', ') || 'None'}</p>
            <p>Clients Loaded: {clients.length}</p>
            <p>Business Type: {businessType}</p>
            <p>Selected Metric: {selectedMetric}</p>
          </div>
        </details>
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
                <button onClick={() => { setSelectedClient('all'); setShowClientDropdown(false) }} className="w-full text-left px-4 py-2 hover:bg-gray-50">All Clients</button>
                {clients?.map(client => (
                  <button key={client.id} onClick={() => { setSelectedClient(client.id); setShowClientDropdown(false) }} className="w-full text-left px-4 py-2 hover:bg-gray-50">
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
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg min-w-[200px]"
            >
              <option value="all">All Platforms</option>
              {availablePlatforms.map((platform: any) => (
                <option key={platform.id} value={platform.id}>{platform.label}</option>
              ))}
            </select>
          </div>

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
        {currentKPIs.map(kpi => (
          <div
            key={kpi.key}
            onClick={() => setSelectedMetric(kpi.key)}
            className={`bg-white rounded-xl shadow-sm border-2 cursor-pointer transition-all ${
              selectedMetric === kpi.key
                ? 'border-blue-500 shadow-lg scale-105'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
            } p-6`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{kpi.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
              </div>
              <div className={`p-3 rounded-lg bg-${kpi.color}-50 text-${kpi.color}-600`}>
                <kpi.icon size={24} />
              </div>
            </div>
            {selectedMetric === kpi.key && (
              <div className="mt-2 text-xs text-blue-600 font-medium">
                ↓ Showing in chart below
              </div>
            )}
          </div>
        ))}
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

      {/* Performance Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Data ({performanceData.length} records)</h3>
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
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Platform</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Spend</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Conv.</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {performanceData.slice(0, settings.rowsPerPage).map((day: any) => {
                  const cost = day.cost || 0
                  const revenue = day.revenue || 0
                  const roas = cost > 0 ? (revenue / cost).toFixed(2) : '0.00'
                  const clientName = clients.find(c => c.id === day.client_id)?.name || day.client_name
                  return (
                    <tr key={day.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{day.date}</td>
                      <td className="px-4 py-3 font-medium">{clientName}</td>
                      <td className="px-4 py-3">
                        {settings.showPlatformBadge && (
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{day.platform}</span>
                        )}
                        {!settings.showPlatformBadge && <span className="text-sm">{day.platform}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">${cost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full text-sm">{day.conversions}</span>
                      </td>
                      <td className="px-4 py-3 text-right">{roas}x</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Meta Ad Creative Report */}
      {(selectedPlatform === 'all' || selectedPlatform === 'meta_ads') && metaCreatives && metaCreatives.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-blue-600">📘</span>
            Meta Ad Creative Report
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Ad Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Campaign</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Spend</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Conv.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {metaCreatives.map((creative: any) => (
                  <tr key={creative.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{creative.ad_name}</td>
                    <td className="px-4 py-3 text-sm">{creative.campaign_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">Ad</span>
                    </td>
                    <td className="px-4 py-3 text-right">${(creative.spend || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{creative.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Google Keyword Performance */}
      {(selectedPlatform === 'all' || selectedPlatform === 'google_ads') && googleKeywords && googleKeywords.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-red-600">🔍</span>
            Google Search Term / Keyword Performance
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Keyword</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Campaign</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Match Type</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Spend</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Clicks</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Conv.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {googleKeywords.map((keyword: any) => (
                  <tr key={keyword.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{keyword.keyword}</td>
                    <td className="px-4 py-3 text-sm">{keyword.campaign_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">{keyword.match_type}</span>
                    </td>
                    <td className="px-4 py-3 text-right">${(keyword.spend || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{keyword.clicks}</td>
                    <td className="px-4 py-3 text-right">{keyword.conversions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
