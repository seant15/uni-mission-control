import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Database, ChevronDown, TrendingUp, DollarSign, Target, CreditCard,
  AlertCircle, Calendar, RefreshCw
} from 'lucide-react'
import { supabase } from '../lib/supabase'
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

export default function DataAnalytics() {
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch clients from clients table
  const { data: clientsFromTable } = useQuery({
    queryKey: ['clients_table'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').order('name')
      if (error) {
        console.error('Clients table error:', error.message, error)
        setError(`Failed to load clients: ${error.message}`)
        return []
      }
      console.log('Clients loaded:', data?.length || 0, data)
      return data as Client[] || []
    },
  })

  // Fetch performance data
  const { data: allPerformance, isLoading: perfLoading } = useQuery({
    queryKey: ['all_performance'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('daily_performance')
          .select('*')
          .order('date', { ascending: false })
          .limit(2000)
        
        if (error) {
          setError(`Failed to load data: ${error.message}`)
          return []
        }
        return data as DailyPerformance[] || []
      } catch (err: any) {
        setError(`Error: ${err.message}`)
        return []
      }
    },
  })

  // Build client list from both sources
  const clients: Client[] = (() => {
    // First try clients table
    if (clientsFromTable && clientsFromTable.length > 0) {
      return clientsFromTable
    }
    
    // Fall back to extracting from performance data
    const uniqueClients = new Map<string, string>()
    allPerformance?.forEach(perf => {
      if (perf.client_id && !uniqueClients.has(perf.client_id)) {
        uniqueClients.set(perf.client_id, perf.client_name || `Client ${perf.client_id.slice(0, 8)}`)
      }
    })
    
    return Array.from(uniqueClients.entries()).map(([id, name]) => ({ id, name }))
  })()

  // Filter performance data
  const performance = allPerformance?.filter(day => {
    if (selectedClient !== 'all' && day.client_id !== selectedClient) return false
    if (selectedPlatform !== 'all' && day.platform !== selectedPlatform) return false
    if (dateRange.start && day.date < dateRange.start) return false
    if (dateRange.end && day.date > dateRange.end) return false
    return true
  }) || []

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

  // Aggregate by date for charts
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

  const isUsingFallbackClients = !clientsFromTable || clientsFromTable.length === 0

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-600" size={20} />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">✕</button>
        </div>
      )}

      {/* Warning if clients table is empty */}
      {isUsingFallbackClients && clients.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-amber-600" size={20} />
          <div className="flex-1">
            <p className="text-sm text-amber-800">
              <strong>Clients table is empty.</strong> Showing {clients.length} clients found in performance data.
              Client names may be missing. Please populate the clients table in Supabase.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Database className="text-blue-600" />
            Data Analytics
          </h1>
          <p className="text-gray-500 mt-1">Performance metrics across all platforms</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative">
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">
              Client ({clients.length} found)
            </label>
            <button
              onClick={() => setShowClientDropdown(!showClientDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg min-w-[250px]"
            >
              <span className="flex-1 text-left truncate">{perfLoading ? 'Loading...' : selectedClientName}</span>
              <ChevronDown size={16} />
            </button>
            {showClientDropdown && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-60 overflow-y-auto">
                <button onClick={() => { setSelectedClient('all'); setShowClientDropdown(false) }} className="w-full text-left px-4 py-2 hover:bg-gray-50">All Clients</button>
                {clients.length === 0 && (
                  <div className="px-4 py-2 text-gray-500 text-sm">No clients found</div>
                )}
                {clients?.map(client => (
                  <button key={client.id} onClick={() => { setSelectedClient(client.id); setShowClientDropdown(false) }} className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                    <div className="font-medium">{client.name}</div>
                    <div className="text-xs text-gray-400">ID: {client.id.slice(0, 8)}...</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Platform</label>
            <select value={selectedPlatform} onChange={(e) => setSelectedPlatform(e.target.value)} className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg min-w-[150px]">
              <option value="all">All Platforms</option>
              <option value="google_ads">Google Ads</option>
              <option value="meta_ads">Meta Ads</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Date Range</label>
            <div className="flex items-center gap-2">
              <input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg" />
              <span className="text-gray-400">to</span>
              <input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Spend" value={`$${totals.spend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} icon={DollarSign} color="blue" />
        <KPICard title="Conversions" value={totals.conversions.toLocaleString()} icon={Target} color="emerald" />
        <KPICard title="Cost/Conv" value={`$${totals.conversions > 0 ? (totals.spend / totals.conversions).toFixed(2) : '0.00'}`} icon={CreditCard} color="violet" />
        <KPICard title="ROAS" value={`${roas}x`} icon={TrendingUp} color="amber" />
      </div>

      {/* ROAS Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">ROAS Trend (Daily)</h3>
        {dailyData.length === 0 ? (
          <div className="text-center py-12 text-gray-500"><Calendar className="mx-auto mb-2" size={32} /><p>No data available for selected filters</p></div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyData}>
              <defs><linearGradient id="colorRoas" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [`${value}x`, 'ROAS']} />
              <Area type="monotone" dataKey="roas" stroke="#10b981" fillOpacity={1} fill="url(#colorRoas)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Data ({performance.length} records)</h3>
        {perfLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : performance?.length === 0 ? (
          <div className="text-center py-12 text-gray-500"><Database className="mx-auto mb-2" size={32} /><p>No data available</p><p className="text-sm">Try adjusting your filters</p></div>
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
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {performance?.slice(0, 50).map((day: any) => {
                  const spend = day.spend || day.cost || 0
                  const revenue = day.conversion_value || day.revenue || 0
                  const roas = spend > 0 ? (revenue / spend).toFixed(2) : '0.00'
                  const clientName = clients.find(c => c.id === day.client_id)?.name || day.client_name || `ID: ${day.client_id?.slice(0, 8)}`
                  return (
                    <tr key={day.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{day.date}</td>
                      <td className="px-4 py-3 font-medium">{clientName}</td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{day.platform}</span></td>
                      <td className="px-4 py-3 text-right">${spend.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="px-4 py-3 text-right"><span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full text-sm">{day.conversions}</span></td>
                      <td className="px-4 py-3 text-right">${revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="px-4 py-3 text-right">{roas}x</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function KPICard({ title, value, icon: Icon, color }: any) {
  const colors: Record<string, string> = { blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', violet: 'bg-violet-50 text-violet-600', amber: 'bg-amber-50 text-amber-600' }
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}><Icon size={24} /></div>
      </div>
    </div>
  )
}