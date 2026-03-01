import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Database, Download, ChevronDown, ChevronRight, TrendingUp, TrendingDown,
  DollarSign, Target, MousePointer, Eye, ShoppingCart, CreditCard,
  AlertCircle, RefreshCw
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

// Types
interface Client {
  id: string
  name: string
  industry: string
  platforms: string[]
}

interface Campaign {
  id: string
  name: string
  platform: string
  status: string
  budget: number
  spend: number
  impressions: number
  clicks: number
  conversions: number
  conversion_value: number
  cost_per_conversion: number
  ctr: number
  conversion_rate: number
  roas: number
}

interface DailyMetrics {
  date: string
  impressions: number
  clicks: number
  conversions: number
  spend: number
  conversion_value: number
}

export default function DataAnalytics() {
  // State
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch clients from Superbase
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .order('name')
        
        if (error) {
          console.error('Clients fetch error:', error)
          setError(`Failed to load clients: ${error.message}`)
          return []
        }
        return data as Client[] || []
      } catch (err: any) {
        console.error('Clients fetch exception:', err)
        setError(`Error loading clients: ${err.message}`)
        return []
      }
    },
  })

  // Fetch campaigns with filters
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', selectedClient, selectedPlatform],
    queryFn: async () => {
      try {
        let query = supabase.from('campaigns').select('*')
        
        if (selectedClient !== 'all') {
          query = query.eq('client_id', selectedClient)
        }
        if (selectedPlatform !== 'all') {
          query = query.eq('platform', selectedPlatform)
        }
        
        const { data, error } = await query.order('created_at', { ascending: false })
        
        if (error) {
          console.error('Campaigns fetch error:', error)
          setError(`Failed to load campaigns: ${error.message}`)
          return []
        }
        return data as Campaign[] || []
      } catch (err: any) {
        console.error('Campaigns fetch exception:', err)
        setError(`Error loading campaigns: ${err.message}`)
        return []
      }
    },
  })

  // Fetch daily metrics for chart
  const { data: dailyMetrics } = useQuery({
    queryKey: ['dailyMetrics', selectedClient, selectedPlatform],
    queryFn: async () => {
      try {
        let query = supabase
          .from('daily_metrics')
          .select('*')
          .order('date', { ascending: true })
          .limit(30)
        
        if (selectedClient !== 'all') {
          query = query.eq('client_id', selectedClient)
        }
        if (selectedPlatform !== 'all') {
          query = query.eq('platform', selectedPlatform)
        }
        
        const { data, error } = await query
        
        if (error) {
          console.error('Metrics fetch error:', error)
          return []
        }
        return data as DailyMetrics[] || []
      } catch (err: any) {
        console.error('Metrics fetch exception:', err)
        return []
      }
    },
  })

  // Calculate totals
  const totals = campaigns?.reduce((acc, camp) => ({
    spend: acc.spend + (camp.spend || 0),
    impressions: acc.impressions + (camp.impressions || 0),
    clicks: acc.clicks + (camp.clicks || 0),
    conversions: acc.conversions + (camp.conversions || 0),
    conversion_value: acc.conversion_value + (camp.conversion_value || 0),
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 }) || { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 }

  const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100).toFixed(2) : '0.00'
  const avgConversionRate = totals.clicks > 0 ? (totals.conversions / totals.clicks * 100).toFixed(2) : '0.00'
  const avgCostPerConversion = totals.conversions > 0 ? (totals.spend / totals.conversions).toFixed(2) : '0.00'
  const roas = totals.spend > 0 ? (totals.conversion_value / totals.spend).toFixed(2) : '0.00'

  // Get selected client name
  const selectedClientName = selectedClient === 'all' 
    ? 'All Clients' 
    : clients?.find(c => c.id === selectedClient)?.name || 'Unknown'

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  return (
    <div className="space-y-6">
      {/* Error Notification */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 animate-in slide-in-from-top">
          <AlertCircle className="text-red-600" size={20} />
          <div className="flex-1">
            <p className="font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Database className="text-blue-600" />
            Data Analytics
          </h1>
          <p className="text-gray-500 mt-1">Performance metrics across all platforms</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Download size={18} />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Client Selector */}
          <div className="relative">
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Client</label>
            <button
              onClick={() => setShowClientDropdown(!showClientDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors min-w-[200px]"
            >
              <span className="flex-1 text-left">{selectedClientName}</span>
              <ChevronDown size={16} className="text-gray-400" />
            </button>
            
            {showClientDropdown && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-60 overflow-y-auto">
                <button
                  onClick={() => { setSelectedClient('all'); setShowClientDropdown(false) }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${selectedClient === 'all' ? 'bg-blue-50 text-blue-700' : ''}`}
                >
                  All Clients
                </button>
                {clients?.map(client => (
                  <button
                    key={client.id}
                    onClick={() => { setSelectedClient(client.id); setShowClientDropdown(false) }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${selectedClient === client.id ? 'bg-blue-50 text-blue-700' : ''}`}
                  >
                    {client.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Platform Filter */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Platform</label>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg min-w-[150px]"
            >
              <option value="all">All Platforms</option>
              <option value="google_ads">Google Ads</option>
              <option value="meta_ads">Meta Ads</option>
              <option value="shopify">Shopify</option>
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Date Range</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Spend"
          value={`$${totals.spend.toLocaleString()}`}
          trend="-5.2%"
          trendUp={false}
          icon={DollarSign}
          color="blue"
        />
        <KPICard
          title="Conversions"
          value={totals.conversions.toLocaleString()}
          trend="+12.8%"
          trendUp={true}
          icon={Target}
          color="emerald"
        />
        <KPICard
          title="Cost Per Conversion"
          value={`$${avgCostPerConversion}`}
          trend="-8.4%"
          trendUp={true}
          icon={CreditCard}
          color="violet"
        />
        <KPICard
          title="ROAS"
          value={`${roas}x`}
          trend="+15.3%"
          trendUp={true}
          icon={TrendingUp}
          color="amber"
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Impressions" value={totals.impressions.toLocaleString()} icon={Eye} />
        <MetricCard title="Clicks" value={totals.clicks.toLocaleString()} icon={MousePointer} />
        <MetricCard title="CTR" value={`${avgCtr}%`} icon={TrendingUp} />
        <MetricCard title="Conv. Rate" value={`${avgConversionRate}%`} icon={ShoppingCart} />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend & Conversions Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Spend vs Conversions</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyMetrics || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line yAxisId="left" type="monotone" dataKey="spend" stroke="#3b82f6" name="Spend ($)" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="conversions" stroke="#10b981" name="Conversions" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion Value Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Value</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyMetrics || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="conversion_value" fill="#8b5cf6" name="Revenue ($)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Funnel Visualization */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Conversion Funnel</h3>
        <div className="flex items-center justify-between">
          <FunnelStage 
            title="Impressions"
            value={totals.impressions}
            percentage={100}
            color="bg-blue-500"
            icon={Eye}
          />
          <ChevronRight className="text-gray-300" size={24} />
          <FunnelStage 
            title="Clicks"
            value={totals.clicks}
            percentage={totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0}
            color="bg-indigo-500"
            icon={MousePointer}
          />
          <ChevronRight className="text-gray-300" size={24} />
          <FunnelStage 
            title="Add to Cart"
            value={Math.floor(totals.clicks * 0.15)}
            percentage={15}
            color="bg-violet-500"
            icon={ShoppingCart}
          />
          <ChevronRight className="text-gray-300" size={24} />
          <FunnelStage 
            title="Conversions"
            value={totals.conversions}
            percentage={totals.clicks > 0 ? (totals.conversions / totals.clicks * 100) : 0}
            color="bg-emerald-500"
            icon={Target}
          />
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Campaign Performance</h3>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View All Campaigns →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Campaign</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Platform</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Spend</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Impr.</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Clicks</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">CTR</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Conv.</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Cost/Conv</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {campaigns?.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    <Database className="mx-auto mb-2 text-gray-300" size={32} />
                    <p>No campaign data available</p>
                    <p className="text-sm">Connect your ad accounts to see data</p>
                  </td>
                </tr>
              ) : (
                campaigns?.map(campaign => (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{campaign.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          campaign.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {campaign.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <PlatformBadge platform={campaign.platform} />
                    </td>
                    <td className="px-6 py-4 text-right font-medium">${campaign.spend?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-gray-600">{campaign.impressions?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-gray-600">{campaign.clicks?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-blue-600 font-medium">{campaign.ctr?.toFixed(2)}%</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full text-sm font-medium">
                        {campaign.conversions}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">${campaign.cost_per_conversion?.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={campaign.roas >= 3 ? 'text-emerald-600 font-medium' : campaign.roas >= 2 ? 'text-amber-600' : 'text-red-600'}>
                        {campaign.roas?.toFixed(1)}x
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Helper Components
function KPICard({ title, value, trend, trendUp, icon: Icon, color }: any) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          <div className={`flex items-center gap-1 mt-2 ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
            {trendUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span className="text-sm font-medium">{trend}</span>
          </div>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  )
}

function MetricCard({ title, value, icon: Icon }: any) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-4">
      <div className="p-2 bg-gray-50 rounded-lg">
        <Icon size={20} className="text-gray-600" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function FunnelStage({ title, value, percentage, color, icon: Icon }: any) {
  return (
    <div className="flex-1 text-center">
      <div className={`w-16 h-16 ${color} rounded-2xl flex items-center justify-center mx-auto mb-3`}>
        <Icon size={28} className="text-white" />
      </div>
      <p className="font-semibold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{percentage.toFixed(1)}%</p>
    </div>
  )
}

function PlatformBadge({ platform }: { platform: string }) {
  const badges: Record<string, { bg: string; text: string; label: string }> = {
    google_ads: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Google' },
    meta_ads: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Meta' },
    shopify: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Shopify' },
  }
  
  const badge = badges[platform] || { bg: 'bg-gray-100', text: 'text-gray-700', label: platform }
  
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  )
}
