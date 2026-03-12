import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, DollarSign, Target, Users, AlertTriangle,
  ArrowUpRight, ArrowDownRight, ArrowUpDown
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from '../lib/supabase'
import type { TimePeriod } from '../types'

type ChartMetric = 'total_spend' | 'total_revenue' | 'roas' | 'conversions'
type SortField = 'account_name' | 'total_spend' | 'total_revenue' | 'roas' | 'conversions' | 'platform'
type SortDir = 'asc' | 'desc'

const PLATFORM_OPTIONS = [
  { id: 'all', label: 'All Platforms' },
  { id: 'meta_ads', label: 'Meta Ads' },
  { id: 'google_ads', label: 'Google Ads' },
  { id: 'tiktok_ads', label: 'TikTok Ads' },
]

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

const PLATFORM_DISPLAY: Record<string, string> = {
  meta_ads: 'Meta Ads', google_ads: 'Google Ads', tiktok_ads: 'TikTok Ads',
  linkedin_ads: 'LinkedIn Ads', twitter_ads: 'Twitter Ads',
}

function getDates(period: TimePeriod) {
  const end = new Date()
  const start = new Date()
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365
  start.setDate(end.getDate() - days)
  const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - days)
  return {
    cur: { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] },
    prev: { start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] },
  }
}

function pct(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0
  return ((cur - prev) / prev) * 100
}

function aggregateByClient(rows: any[], clients: any[]) {
  return clients.map(client => {
    const cd = rows.filter(r => r.client_id === client.id)
    const spend = cd.reduce((s, r) => s + (Number(r.cost) || 0), 0)
    const revenue = cd.reduce((s, r) => s + (Number(r.revenue) || 0), 0)
    const conversions = cd.reduce((s, r) => s + (Number(r.conversions) || 0), 0)
    const impressions = cd.reduce((s, r) => s + (Number(r.impressions) || 0), 0)
    const clicks = cd.reduce((s, r) => s + (Number(r.clicks) || 0), 0)
    const roas = spend > 0 ? revenue / spend : 0
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
    const cpc = clicks > 0 ? spend / clicks : 0

    // Primary platform by spend
    const platSpend = cd.reduce((acc: any, r) => {
      const p = r.platform || 'Unknown'
      acc[p] = (acc[p] || 0) + (Number(r.cost) || 0)
      return acc
    }, {})
    const platform = Object.keys(platSpend).length
      ? Object.keys(platSpend).reduce((a, b) => platSpend[a] > platSpend[b] ? a : b)
      : 'Unknown'

    const sym = client.currency_symbol || '$'
    return {
      id: client.id,
      account_name: client.name,
      platform: PLATFORM_DISPLAY[platform] || platform,
      total_spend: spend,
      total_revenue: revenue,
      roas,
      conversions,
      ctr,
      cpc,
      status: client.status || 'active',
      currency: client.currency || 'USD',
      currency_symbol: sym,
    }
  }).filter(a => a.total_spend > 0)
}

export default function ClientsOverview() {
  const [period, setPeriod] = useState<TimePeriod>('30d')
  const [selectedPlatform, setSelectedPlatform] = useState('all')
  const [chartMetric, setChartMetric] = useState<ChartMetric>('total_spend')
  const [sortField, setSortField] = useState<SortField>('total_spend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const dates = getDates(period)

  const fetchPerf = async (start: string, end: string) => {
    let q = supabase.from('daily_performance')
      .select('client_id, cost, revenue, impressions, clicks, conversions, platform')
      .gte('date', start).lte('date', end)
    if (selectedPlatform !== 'all') q = q.eq('platform', selectedPlatform)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return data || []
  }

  const { data: clients, isLoading: cLoading, error: cError } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('id, name, status, business_type, currency, currency_symbol').order('name')
      if (error) throw new Error(error.message)
      return data || []
    },
  })

  const { data: curRows, isLoading: perfLoading, error: perfError } = useQuery({
    queryKey: ['co_cur', period, selectedPlatform],
    queryFn: () => fetchPerf(dates.cur.start, dates.cur.end),
  })

  const { data: prevRows } = useQuery({
    queryKey: ['co_prev', period, selectedPlatform],
    queryFn: () => fetchPerf(dates.prev.start, dates.prev.end),
  })

  const isLoading = cLoading || perfLoading
  const error = cError || perfError

  const curAccounts = clients && curRows ? aggregateByClient(curRows, clients) : []
  const prevAccounts = clients && prevRows ? aggregateByClient(prevRows, clients) : []

  // Summary totals
  const sumField = (arr: typeof curAccounts, f: keyof typeof arr[0]) =>
    arr.reduce((s, a) => s + (Number(a[f]) || 0), 0)

  const curSpend = sumField(curAccounts, 'total_spend')
  const curRevenue = sumField(curAccounts, 'total_revenue')
  const curConv = sumField(curAccounts, 'conversions')
  const curRoas = curSpend > 0 ? curRevenue / curSpend : 0

  const prevSpend = sumField(prevAccounts, 'total_spend')
  const prevRevenue = sumField(prevAccounts, 'total_revenue')
  const prevConv = sumField(prevAccounts, 'conversions')
  const prevRoas = prevSpend > 0 ? prevRevenue / prevSpend : 0

  const kpis: { key: ChartMetric; label: string; value: string; change: number; icon: any; color: string }[] = [
    { key: 'total_spend',   label: 'Total Spend',   value: formatCurrency(curSpend),   change: pct(curSpend, prevSpend),     icon: DollarSign,  color: 'bg-blue-600' },
    { key: 'total_revenue', label: 'Total Revenue', value: formatCurrency(curRevenue), change: pct(curRevenue, prevRevenue), icon: TrendingUp,  color: 'bg-green-600' },
    { key: 'roas',          label: 'Avg ROAS',      value: `${curRoas.toFixed(2)}x`,   change: pct(curRoas, prevRoas),       icon: Target,      color: 'bg-purple-600' },
    { key: 'conversions',   label: 'Conversions',   value: formatNumber(curConv),      change: pct(curConv, prevConv),       icon: TrendingUp,  color: 'bg-orange-600' },
  ]

  // Chart data sorted by selected metric
  const chartData = [...curAccounts]
    .sort((a, b) => {
      const av = chartMetric === 'roas' ? a.roas : chartMetric === 'conversions' ? a.conversions : chartMetric === 'total_revenue' ? a.total_revenue : a.total_spend
      const bv = chartMetric === 'roas' ? b.roas : chartMetric === 'conversions' ? b.conversions : chartMetric === 'total_revenue' ? b.total_revenue : b.total_spend
      return bv - av
    })
    .slice(0, 10)
    .map(a => ({
      name: a.account_name.length > 12 ? a.account_name.substring(0, 12) + '…' : a.account_name,
      value: chartMetric === 'roas' ? Number(a.roas.toFixed(2))
           : chartMetric === 'conversions' ? a.conversions
           : chartMetric === 'total_revenue' ? a.total_revenue
           : a.total_spend,
    }))

  const activeKpi = kpis.find(k => k.key === chartMetric)!
  const chartLabel = activeKpi.label

  // Sorted table
  const sorted = [...curAccounts].sort((a, b) => {
    let av: any = a[sortField as keyof typeof a]
    let bv: any = b[sortField as keyof typeof b]
    if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv as string).toLowerCase() }
    return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
  })

  const handleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('desc') }
  }

  const periodLabel = period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : period === '90d' ? '90 Days' : '1 Year'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="text-blue-600" />
            Clients Overview
          </h1>
          <p className="text-gray-500 mt-1">Account performance across all clients</p>
        </div>
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d', '1yr'] as TimePeriod[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}>
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : '1 Year'}
            </button>
          ))}
        </div>
      </div>

      {/* Platform Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600">Platform:</span>
          <div className="flex rounded-lg border border-gray-200 p-1 gap-1">
            {PLATFORM_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => setSelectedPlatform(opt.id)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                  selectedPlatform === opt.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
          <AlertTriangle size={20} />
          <div>
            <div className="font-medium">Failed to load data</div>
            <div className="text-sm">{(error as Error).message}</div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <div className="mt-2 text-gray-500">Loading...</div>
        </div>
      )}

      {!isLoading && (
        <>
          {/* KPI Cards — clickable, drive chart */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {kpis.map(kpi => {
              const isPos = kpi.change >= 0
              return (
                <div key={kpi.key} onClick={() => setChartMetric(kpi.key)}
                  className={`bg-white rounded-xl shadow-sm border-2 cursor-pointer transition-all p-6 ${
                    chartMetric === kpi.key ? 'border-blue-500 shadow-lg scale-105' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-3 rounded-lg ${kpi.color}`}>
                      <kpi.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-medium ${isPos ? 'text-green-600' : 'text-red-600'}`}>
                      {isPos ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {Math.abs(kpi.change).toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
                  <div className="text-sm text-gray-500 mt-1">{kpi.label}</div>
                  {chartMetric === kpi.key && (
                    <div className="text-xs text-blue-600 font-medium mt-1">↓ Chart below</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Chart — top 10 by selected metric */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Top Accounts by {chartLabel} — Last {periodLabel}
            </h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) =>
                      chartMetric === 'total_spend' || chartMetric === 'total_revenue'
                        ? formatCurrency(v)
                        : chartMetric === 'roas'
                        ? `${v}x`
                        : v.toLocaleString()
                    }
                  />
                  <Bar dataKey="value" name={chartLabel} radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">No data</div>
            )}
          </div>

          {/* Table */}
          {sorted.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {([
                      ['account_name', 'Account', 'left'],
                      ['platform', 'Platform', 'left'],
                      ['total_spend', 'Spend', 'right'],
                      ['total_revenue', 'Revenue', 'right'],
                      ['roas', 'ROAS', 'right'],
                      ['conversions', 'Conv.', 'right'],
                    ] as [SortField, string, string][]).map(([f, l, align]) => (
                      <th key={f} className={`px-4 py-3 text-${align}`}>
                        <button onClick={() => handleSort(f)}
                          className={`flex items-center gap-1 text-xs font-medium text-gray-500 uppercase hover:text-gray-800 ${align === 'right' ? 'ml-auto' : ''}`}>
                          {l}
                          {sortField === f && <ArrowUpDown size={12} />}
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CTR</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sorted.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.account_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{a.platform}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{a.currency_symbol}{a.total_spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">{a.currency_symbol}{a.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`font-semibold ${a.roas >= 2 ? 'text-green-600' : a.roas >= 1 ? 'text-blue-600' : 'text-red-600'}`}>
                          {a.roas.toFixed(2)}x
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{a.conversions.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{a.ctr.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-xs font-mono px-2 py-0.5 bg-gray-100 rounded text-gray-600">{a.currency || 'USD'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                          a.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!error && sorted.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No client data found for the selected period and platform.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
}

function formatNumber(v: number) {
  return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0)
}
