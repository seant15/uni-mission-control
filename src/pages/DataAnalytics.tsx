import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Database, ChevronDown, TrendingUp, DollarSign, Target, CreditCard,
  AlertCircle, Calendar, RefreshCw, Bug, Bell, X, Paperclip, Mic, Send
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts'

interface DailyPerformance {
  id: string
  client_id: string
  client_name?: string
  date: string
  platform: string
  impressions: number
  clicks: number
  conversions: number
  spend?: number
  cost?: number
  conversion_value?: number
  revenue?: number
}

interface Client {
  id: string
  name: string
  industry?: string
}

interface MetaCreative {
  id: string
  client_id: string
  ad_name: string
  campaign_name: string
  creative_type: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
}

interface GoogleKeyword {
  id: string
  client_id: string
  keyword: string
  campaign_name: string
  ad_group_name: string
  match_type: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
}

const DATE_PRESETS = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 14 Days', days: 14 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'This Month', type: 'month' },
  { label: 'Last Month', type: 'last_month' },
]

export default function DataAnalytics() {
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [showDatePresets, setShowDatePresets] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [notifications, setNotifications] = useState<string[]>(['New task assigned', 'Report ready'])
  const [showNotifications, setShowNotifications] = useState(false)

  // Fetch clients
  const { data: clientsFromTable } = useQuery({
    queryKey: ['clients_table'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name')
      if (error) {
        console.error('Clients error:', error)
        return []
      }
      return data as Client[] || []
    },
  })

  // Fetch performance data
  const { data: allPerformance } = useQuery({
    queryKey: ['all_performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_performance')
        .select('*')
        .order('date', { ascending: false })
        .limit(5000)
      
      if (error) {
        setError(`Failed to load data: ${error.message}`)
        return []
      }
      return data as DailyPerformance[] || []
    },
  })

  // Fetch Meta creatives (only when Meta selected)
  const { data: metaCreatives } = useQuery({
    queryKey: ['meta_creatives', selectedClient],
    queryFn: async () => {
      if (selectedPlatform !== 'all' && selectedPlatform !== 'meta_ads') return []
      let query = supabase.from('meta_creatives').select('*').limit(50)
      if (selectedClient !== 'all') query = query.eq('client_id', selectedClient)
      const { data } = await query
      return data as MetaCreative[] || []
    },
    enabled: selectedPlatform === 'all' || selectedPlatform === 'meta_ads',
  })

  // Fetch Google keywords (only when Google selected)
  const { data: googleKeywords } = useQuery({
    queryKey: ['google_keywords', selectedClient],
    queryFn: async () => {
      if (selectedPlatform !== 'all' && selectedPlatform !== 'google_ads') return []
      let query = supabase.from('google_keywords').select('*').limit(50)
      if (selectedClient !== 'all') query = query.eq('client_id', selectedClient)
      const { data } = await query
      return data as GoogleKeyword[] || []
    },
    enabled: selectedPlatform === 'all' || selectedPlatform === 'google_ads',
  })

  // Get unique platforms from data
  const availablePlatforms = allPerformance ? 
    Array.from(new Set(allPerformance.map(p => p.platform))).filter(Boolean) : []

  // Build client list
  const clients: Client[] = clientsFromTable && clientsFromTable.length > 0 
    ? clientsFromTable 
    : (() => {
        const uniqueClients = new Map<string, string>()
        allPerformance?.forEach(perf => {
          if (perf.client_id && !uniqueClients.has(perf.client_id)) {
            uniqueClients.set(perf.client_id, perf.client_name || `Client ${perf.client_id.slice(0, 8)}`)
          }
        })
        return Array.from(uniqueClients.entries()).map(([id, name]) => ({ id, name }))
      })()

  // Filter performance
  const performance = allPerformance?.filter(day => {
    if (selectedClient !== 'all' && day.client_id !== selectedClient) return false
    if (selectedPlatform !== 'all' && day.platform !== selectedPlatform) return false
    if (dateRange.start && day.date < dateRange.start) return false
    if (dateRange.end && day.date > dateRange.end) return false
    return true
  }) || []

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
  const totals = performance?.reduce((acc, day) => {
    const spend = day.spend || day.cost || 0
    const revenue = day.conversion_value || day.revenue || 0
    return {
      spend: acc.spend + spend,
      impressions: acc.impressions + (day.impressions || 0),
      clicks: acc.clicks + (day.clicks || 0),
      conversions: acc.conversions + (day.conversions || 0),
      conversion_value: acc.conversion_value + revenue,
    }
  }, { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 }) || { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 }

  const roas = totals.spend > 0 ? (totals.conversion_value / totals.spend).toFixed(2) : '0.00'

  // Daily data for charts
  const dailyData = performance?.reduce((acc: any[], day) => {
    const existing = acc.find(d => d.date === day.date)
    const spend = day.spend || day.cost || 0
    const revenue = day.conversion_value || day.revenue || 0
    
    if (existing) {
      existing.spend += spend
      existing.conversion_value += revenue
      existing.roas = existing.spend > 0 ? (existing.conversion_value / existing.spend).toFixed(2) : 0
    } else {
      acc.push({
        date: day.date,
        spend: spend,
        conversion_value: revenue,
        roas: spend > 0 ? (revenue / spend).toFixed(2) : 0
      })
    }
    return acc
  }, []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || []

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
    start.setDate(end.getDate() - 30)
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    })
  }, [])

  return (
    <div className="space-y-6">
      {/* Top Header with Notifications */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Database className="text-blue-600" />
            Data Analytics
          </h1>
          <p className="text-gray-500 mt-1">Performance metrics across all platforms</p>
        </div>
        
        {/* Notification Bell */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Bell size={24} />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold">Notifications</h3>
                <button onClick={() => setShowNotifications(false)}><X size={16} /></button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-gray-500 text-center">No notifications</div>
                ) : (
                  notifications.map((notif, i) => (
                    <div key={i} className="p-3 border-b border-gray-100 hover:bg-gray-50">
                      {notif}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-600" size={20} />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">✕</button>
        </div>
      )}

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
              {availablePlatforms.map(platform => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </select>
          </div>

          {/* Date Range with Presets */}
          <div className="relative">
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Date Range</label>
            <div className="flex items-center gap-2">
              <input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg" />
              <span className="text-gray-400">to</span>
              <input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg" />
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Spend" value={`$${totals.spend.toLocaleString()}`} icon={DollarSign} color="blue" />
        <KPICard title="Conversions" value={totals.conversions.toLocaleString()} icon={Target} color="emerald" />
        <KPICard title="Cost/Conv" value={`$${totals.conversions > 0 ? (totals.spend / totals.conversions).toFixed(2) : '0.00'}`} icon={CreditCard} color="violet" />
        <KPICard title="ROAS" value={`${roas}x`} icon={TrendingUp} color="amber" />
      </div>

      {/* ROAS Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">ROAS Trend (Daily)</h3>
        {dailyData.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="mx-auto mb-2" size={32} />
            <p>No data available for selected filters</p>
            <p className="text-sm mt-2">Selected: {selectedClientName} | {selectedPlatform} | {dateRange.start} to {dateRange.end}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="colorRoas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [`${value}x`, 'ROAS']} />
              <Area type="monotone" dataKey="roas" stroke="#10b981" fillOpacity={1} fill="url(#colorRoas)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Performance Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Data ({performance.length} records)</h3>
        {performance?.length === 0 ? (
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
                {performance?.slice(0, 50).map((day: any) => {
                  const spend = day.spend || day.cost || 0
                  const revenue = day.conversion_value || day.revenue || 0
                  const roas = spend > 0 ? (revenue / spend).toFixed(2) : '0.00'
                  const clientName = clients.find(c => c.id === day.client_id)?.name || day.client_name
                  return (
                    <tr key={day.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{day.date}</td>
                      <td className="px-4 py-3 font-medium">{clientName}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{day.platform}</span>
                      </td>
                      <td className="px-4 py-3 text-right">${spend.toLocaleString()}</td>
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
                      <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">{creative.creative_type}</span>
                    </td>
                    <td className="px-4 py-3 text-right">${creative.spend?.toLocaleString()}</td>
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
                    <td className="px-4 py-3 text-right">${keyword.spend?.toLocaleString()}</td>
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

function KPICard({ title, value, icon: Icon, color }: any) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600'
  }
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  )
}