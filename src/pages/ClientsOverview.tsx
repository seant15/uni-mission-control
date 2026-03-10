import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, DollarSign, Target,
  Users, AlertTriangle, ArrowUpDown
} from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { supabase } from '../lib/supabase'
import type { ClientAccount, ClientsOverviewSummary, TimePeriod } from '../types'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

type SortField = 'account_name' | 'total_spend' | 'total_revenue' | 'roas' | 'platform'
type SortDirection = 'asc' | 'desc'

export default function ClientsOverview() {
  const [period, setPeriod] = useState<TimePeriod>('30d')
  const [sortField, setSortField] = useState<SortField>('total_spend')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Calculate date range based on period
  const getDateRange = (period: TimePeriod) => {
    const endDate = new Date()
    const startDate = new Date()

    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7)
        break
      case '30d':
        startDate.setDate(startDate.getDate() - 30)
        break
      case '90d':
        startDate.setDate(startDate.getDate() - 90)
        break
      case '1yr':
        startDate.setFullYear(startDate.getFullYear() - 1)
        break
    }

    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    }
  }

  // Fetch clients and their performance data
  const { data: clients, isLoading: clientsLoading, error: clientsError } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name')

      if (error) throw new Error(error.message)
      return data
    },
  })

  const { data: performanceData, isLoading: perfLoading, error: perfError } = useQuery({
    queryKey: ['daily_performance_by_client', period],
    queryFn: async () => {
      const dateRange = getDateRange(period)

      const { data, error } = await supabase
        .from('daily_performance')
        .select('*')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)

      if (error) throw new Error(error.message)
      return data
    },
  })

  const isLoading = clientsLoading || perfLoading
  const error = clientsError || perfError

  // Aggregate performance by client
  const accounts: ClientAccount[] | undefined = (clients && performanceData) ?
    clients.map(client => {
      // Filter performance data for this client
      const clientData = performanceData.filter(row => row.client_id === client.id)

      const total_spend = clientData.reduce((sum, row) => sum + (Number(row.cost) || 0), 0)
      const total_revenue = clientData.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0)
      const impressions = clientData.reduce((sum, row) => sum + (Number(row.impressions) || 0), 0)
      const clicks = clientData.reduce((sum, row) => sum + (Number(row.clicks) || 0), 0)
      const conversions = clientData.reduce((sum, row) => sum + (Number(row.conversions) || 0), 0)

      const roas = total_spend > 0 ? total_revenue / total_spend : 0
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
      const cpc = clicks > 0 ? total_spend / clicks : 0

      // Determine primary platform (platform with most spend)
      const platformSpend = clientData.reduce((acc: any, row) => {
        const platform = row.platform || 'Unknown'
        acc[platform] = (acc[platform] || 0) + (Number(row.cost) || 0)
        return acc
      }, {})
      const platform = Object.keys(platformSpend).reduce((a, b) =>
        platformSpend[a] > platformSpend[b] ? a : b, 'Unknown'
      )

      // Map platform names to display format
      const platformMap: { [key: string]: string } = {
        'meta_ads': 'Meta Ads',
        'google_ads': 'Google Ads',
        'tiktok_ads': 'TikTok Ads',
        'linkedin_ads': 'LinkedIn Ads',
        'twitter_ads': 'Twitter Ads',
      }

      return {
        id: client.id,
        account_name: client.name,
        platform: (platformMap[platform] || platform) as any,
        total_spend,
        total_revenue,
        roas,
        ctr,
        cpc,
        impressions,
        clicks,
        conversions,
        active_campaigns: 0, // Not available in daily_performance
        total_campaigns: 0,
        status: client.status || 'active',
        health_score: undefined,
        last_updated: new Date().toISOString(),
        created_at: client.created_at,
      } as ClientAccount
    }).filter(account => account.total_spend > 0) // Only show accounts with spend
  : undefined

  // Calculate summary
  const summary: ClientsOverviewSummary = accounts?.reduce(
    (acc, account) => {
      acc.total_accounts++
      if (account.status === 'active') acc.active_accounts++
      acc.total_spend += account.total_spend
      acc.total_revenue += account.total_revenue
      acc.total_conversions += account.conversions
      return acc
    },
    {
      total_accounts: 0,
      active_accounts: 0,
      total_spend: 0,
      total_revenue: 0,
      average_roas: 0,
      total_conversions: 0,
      period,
    }
  ) || {
    total_accounts: 0,
    active_accounts: 0,
    total_spend: 0,
    total_revenue: 0,
    average_roas: 0,
    total_conversions: 0,
    period,
  }

  if (summary.total_spend > 0) {
    summary.average_roas = summary.total_revenue / summary.total_spend
  }

  // Sort accounts
  const sortedAccounts = accounts ? [...accounts].sort((a, b) => {
    let aVal: any = a[sortField]
    let bVal: any = b[sortField]

    if (sortField === 'account_name' || sortField === 'platform') {
      aVal = aVal.toLowerCase()
      bVal = bVal.toLowerCase()
    }

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  }) : []

  // Platform breakdown for pie chart
  const platformData = accounts?.reduce((acc, account) => {
    const existing = acc.find(p => p.platform === account.platform)
    if (existing) {
      existing.spend += account.total_spend
      existing.revenue += account.total_revenue
    } else {
      acc.push({
        platform: account.platform,
        spend: account.total_spend,
        revenue: account.total_revenue,
      })
    }
    return acc
  }, [] as { platform: string; spend: number; revenue: number }[]) || []

  // Top performers for bar chart
  const topPerformers = accounts
    ? [...accounts]
        .sort((a, b) => b.roas - a.roas)
        .slice(0, 10)
        .map(a => ({
          name: a.account_name.length > 15
            ? a.account_name.substring(0, 15) + '...'
            : a.account_name,
          roas: Number(a.roas.toFixed(2)),
          spend: a.total_spend,
        }))
    : []

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value)
  }

  const getPeriodLabel = (p: TimePeriod) => {
    switch (p) {
      case '7d': return 'Last 7 Days'
      case '30d': return 'Last 30 Days'
      case '90d': return 'Last 90 Days'
      case '1yr': return 'Last Year'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-700 bg-green-100'
      case 'paused': return 'text-gray-700 bg-gray-100'
      case 'warning': return 'text-yellow-700 bg-yellow-100'
      case 'error': return 'text-red-700 bg-red-100'
      default: return 'text-gray-700 bg-gray-100'
    }
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Clients Overview</h1>

        {/* Period Selector */}
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d', '1yr'] as TimePeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {getPeriodLabel(p)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Total Accounts</div>
              <div className="text-3xl font-bold mt-1">{summary.total_accounts}</div>
              <div className="text-sm text-green-600 mt-1">
                {summary.active_accounts} active
              </div>
            </div>
            <Users className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Total Spend</div>
              <div className="text-3xl font-bold mt-1">{formatCurrency(summary.total_spend)}</div>
              <div className="text-sm text-gray-500 mt-1">{getPeriodLabel(period)}</div>
            </div>
            <DollarSign className="w-10 h-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Total Revenue</div>
              <div className="text-3xl font-bold mt-1">{formatCurrency(summary.total_revenue)}</div>
              <div className="text-sm text-gray-500 mt-1">{getPeriodLabel(period)}</div>
            </div>
            <TrendingUp className="w-10 h-10 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Average ROAS</div>
              <div className="text-3xl font-bold mt-1">{summary.average_roas.toFixed(2)}x</div>
              <div className="text-sm text-gray-500 mt-1">Return on Ad Spend</div>
            </div>
            <Target className="w-10 h-10 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">Conversions</div>
              <div className="text-3xl font-bold mt-1">{formatNumber(summary.total_conversions)}</div>
              <div className="text-sm text-gray-500 mt-1">{getPeriodLabel(period)}</div>
            </div>
            <TrendingUp className="w-10 h-10 text-green-500" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Top Performers by ROAS */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Top Performers by ROAS</h2>
          {topPerformers.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topPerformers}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="roas" fill="#3b82f6" name="ROAS" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>

        {/* Platform Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Spend by Platform</h2>
          {platformData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={platformData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ platform, percent }) => `${platform} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="spend"
                >
                  {platformData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle size={20} />
            <div>
              <div className="font-medium">Failed to load client accounts</div>
              <div className="text-sm">{error.message}</div>
              <div className="text-xs mt-1 text-red-600">
                Please check your Supabase configuration in environment variables
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <div className="mt-2 text-gray-600">Loading client accounts...</div>
        </div>
      )}

      {/* Accounts Table */}
      {!isLoading && sortedAccounts && sortedAccounts.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('account_name')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-600 uppercase hover:text-gray-900"
                  >
                    Account
                    {sortField === 'account_name' && <ArrowUpDown size={14} />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('platform')}
                    className="flex items-center gap-1 text-xs font-medium text-gray-600 uppercase hover:text-gray-900"
                  >
                    Platform
                    {sortField === 'platform' && <ArrowUpDown size={14} />}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('total_spend')}
                    className="flex items-center gap-1 justify-end text-xs font-medium text-gray-600 uppercase hover:text-gray-900"
                  >
                    Spend
                    {sortField === 'total_spend' && <ArrowUpDown size={14} />}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('total_revenue')}
                    className="flex items-center gap-1 justify-end text-xs font-medium text-gray-600 uppercase hover:text-gray-900"
                  >
                    Revenue
                    {sortField === 'total_revenue' && <ArrowUpDown size={14} />}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('roas')}
                    className="flex items-center gap-1 justify-end text-xs font-medium text-gray-600 uppercase hover:text-gray-900"
                  >
                    ROAS
                    {sortField === 'roas' && <ArrowUpDown size={14} />}
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">CTR</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">CPC</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Conversions</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Campaigns</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedAccounts.map(account => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{account.account_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{account.platform}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(account.total_spend)}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-green-600">{formatCurrency(account.total_revenue)}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={`font-semibold ${account.roas >= 2 ? 'text-green-600' : account.roas >= 1 ? 'text-blue-600' : 'text-red-600'}`}>
                      {account.roas.toFixed(2)}x
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{account.ctr.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCurrency(account.cpc)}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">{formatNumber(account.conversions)}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600">
                    {account.active_campaigns} / {account.total_campaigns}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(account.status)}`}>
                      {account.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && sortedAccounts && sortedAccounts.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No client accounts found</h3>
          <p className="text-gray-600">
            Add client accounts to start tracking their performance.
          </p>
        </div>
      )}
    </div>
  )
}
