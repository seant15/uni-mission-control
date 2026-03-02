import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Database, Download, ChevronDown, ChevronRight, TrendingUp, TrendingDown,
  DollarSign, Target, MousePointer, Eye, ShoppingCart, CreditCard,
  AlertCircle, RefreshCw, Calendar
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts'

// Types based on actual Supabase schema
interface Client {
  id: string
  name: string
  industry: string
  website?: string
  created_at: string
}

interface DailyPerformance {
  id: string
  client_id: string
  date: string
  platform: string
  campaign_id?: string
  campaign_name?: string
  impressions: number
  clicks: number
  conversions: number
  spend: number
  conversion_value: number
}

export default function DataAnalytics() {
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('clients').select('*').order('name')
        if (error) {
          setError(`Failed to load clients: ${error.message}`)
          return []
        }
        return data as Client[] || []
      } catch (err: any) {
        setError(`Error loading clients: ${err.message}`)
        return []
      }
    },
  })

  // Fetch performance data
  const { data: performance, isLoading: perfLoading } = useQuery({
    queryKey: ['daily_performance', selectedClient, selectedPlatform],
    queryFn: async () => {
      try {
        let query = supabase.from('daily_performance').select('*').order('date', { ascending: false }).limit(100)
        if (selectedClient !== 'all') query = query.eq('client_id', selectedClient)
        if (selectedPlatform !== 'all') query = query.eq('platform', selectedPlatform)
        const { data, error } = await query
        if (error) {
          setError(`Failed to load performance: ${error.message}`)
          return []
        }
        return data as DailyPerformance[] || []
      } catch (err: any) {
        setError(`Error loading performance: ${err.message}`)
        return []
      }
    },
  })

  // Calculate totals
  const totals = performance?.reduce((acc, day) => ({
    spend: acc.spend + (day.spend || 0),
    impressions: acc.impressions + (day.impressions || 0),
    clicks: acc.clicks + (day.clicks || 0),
    conversions: acc.conversions + (day.conversions || 0),
    conversion_value: acc.conversion_value + (day.conversion_value || 0),
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 }) || { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 }

  const roas = totals.spend > 0 ? (totals.conversion_value / totals.spend).toFixed(2) : '0.00'

  // Aggregate by date for charts
  const dailyData = performance?.reduce((acc: any[], day) => {
    const existing = acc.find(d => d.date === day.date)
    if (existing) {
      existing.spend += day.spend || 0
      existing.conversion_value += day.conversion_value || 0
      existing.roas = existing.spend > 0 ? (existing.conversion_value / existing.spend).toFixed(2) : 0
    } else {
      acc.push({
        date: day.date,
        spend: day.spend || 0,
        conversion_value: day.conversion_value || 0,
        roas: day.spend > 0 ? ((day.conversion_value || 0) / day.spend).toFixed(2) : 0
      })
    }
    return acc
  }, []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || []

  const selectedClientName = selectedClient === 'all' ? 'All Clients' : clients?.find(c => c.id === selectedClient)?.name || 'Unknown'

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-600" size={20} />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">✕</button>
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
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative">
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Client</label>
            <button
              onClick={() => setShowClientDropdown(!showClientDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg min-w-[200px]"
            >
              <span className="flex-1 text-left">{clientsLoading ? 'Loading...' : selectedClientName}</span>
              <ChevronDown size={16} />
            </button>
            {showClientDropdown && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-60 overflow-y-auto">
                <button onClick={() => { setSelectedClient('all'); setShowClientDropdown(false) }} className="w-full text-left px-4 py-2 hover:bg-gray-50">All Clients</button>
                {clients?.map(client => (
                  <button key={client.id} onClick={() => { setSelectedClient(client.id); setShowClientDropdown(false) }} className="w-full text-left px-4 py-2 hover:bg-gray-50">
                    {client.name}
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
        <KPICard title="Total Spend" value={`$${totals.spend.toLocaleString()}`} icon={DollarSign} color="blue" />
        <KPICard title="Conversions" value={totals.conversions.toLocaleString()} icon={Target} color="emerald" />
        <KPICard title="Cost/Conv" value={`$${totals.conversions > 0 ? (totals.spend / totals.conversions).toFixed(2) : '0.00'}`} icon={CreditCard} color="violet" />
        <KPICard title="ROAS" value={`${roas}x`} icon={TrendingUp} color="amber" />
      </div>

      {/* ROAS Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">ROAS Trend (Daily)</h3>
        {dailyData.length === 0 ? (
          <div className="text-center py-12 text-gray-500"><Calendar className="mx-auto mb-2" size={32} /><p>No data available</p></div>
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

      {/* Campaign Performance Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign Performance</h3>
        {perfLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : performance?.length === 0 ? (
          <div className="text-center py-12 text-gray-500"><Database className="mx-auto mb-2" size={32} /><p>No campaign data available</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50"><tr><th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Campaign</th><th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Platform</th><th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Spend</th><th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Conv.</th><th className="text-right px-4 py-3 text-xs font-medium text-gray-500">ROAS</th></tr></thead>
              <tbody className="divide-y divide-gray-200">
                {performance?.slice(0, 20).map((day: any) => (
                  <tr key={day.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{day.campaign_name || 'Unknown'}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{day.platform}</span></td>
                    <td className="px-4 py-3 text-right">${day.spend?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right"><span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full text-sm">{day.conversions}</span></td>
                    <td className="px-4 py-3 text-right">{day.spend > 0 ? ((day.conversion_value || 0) / day.spend).toFixed(2) : '0.00'}x</td>
                  </tr>
                ))}
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