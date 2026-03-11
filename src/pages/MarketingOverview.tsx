import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  DollarSign, TrendingUp, Target, MousePointer,
  Eye, AlertTriangle, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type Period = '7d' | '30d' | '90d'

function getDateRanges(period: Period) {
  const end = new Date()
  const start = new Date()
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  start.setDate(end.getDate() - days)

  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - days)

  return {
    current: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    },
    previous: {
      start: prevStart.toISOString().split('T')[0],
      end: prevEnd.toISOString().split('T')[0],
    },
  }
}

function aggregate(rows: any[]) {
  const spend = rows.reduce((s, r) => s + (Number(r.cost) || 0), 0)
  const revenue = rows.reduce((s, r) => s + (Number(r.revenue) || 0), 0)
  const impressions = rows.reduce((s, r) => s + (Number(r.impressions) || 0), 0)
  const clicks = rows.reduce((s, r) => s + (Number(r.clicks) || 0), 0)
  const conversions = rows.reduce((s, r) => s + (Number(r.conversions) || 0), 0)
  return {
    spend,
    revenue,
    impressions,
    clicks,
    conversions,
    roas: spend > 0 ? revenue / spend : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
  }
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export default function MarketingOverview() {
  const [period, setPeriod] = useState<Period>('30d')
  const ranges = getDateRanges(period)

  const fetchRows = async (start: string, end: string) => {
    const { data, error } = await supabase
      .from('daily_performance')
      .select('cost, revenue, impressions, clicks, conversions, platform')
      .gte('date', start)
      .lte('date', end)
    if (error) throw new Error(error.message)
    return data || []
  }

  const { data: currentRows, isLoading, error } = useQuery({
    queryKey: ['mkt_current', period],
    queryFn: () => fetchRows(ranges.current.start, ranges.current.end),
  })

  const { data: prevRows } = useQuery({
    queryKey: ['mkt_prev', period],
    queryFn: () => fetchRows(ranges.previous.start, ranges.previous.end),
  })

  const cur = currentRows ? aggregate(currentRows) : null
  const prev = prevRows ? aggregate(prevRows) : null

  const platformBreakdown = currentRows
    ? Object.values(
        currentRows.reduce((acc: any, row) => {
          const p = row.platform || 'Unknown'
          if (!acc[p]) acc[p] = { platform: p, spend: 0, revenue: 0 }
          acc[p].spend += Number(row.cost) || 0
          acc[p].revenue += Number(row.revenue) || 0
          return acc
        }, {})
      ).map((p: any) => ({ ...p, roas: p.spend > 0 ? p.revenue / p.spend : 0 }))
    : []

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
  const formatNumber = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0)
  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

  const MetricCard = ({
    title, value, change, icon: Icon, color, format = 'number',
  }: {
    title: string; value: number; change?: number; icon: any; color: string; format?: string
  }) => {
    const isPos = change === undefined || change >= 0
    const display =
      format === 'currency' ? formatCurrency(value) :
      format === 'percent'  ? `${value.toFixed(2)}%` :
      format === 'roas'     ? `${value.toFixed(2)}x` :
      formatNumber(value)

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          {change !== undefined && (
            <div className={`flex items-center gap-1 text-sm font-medium ${isPos ? 'text-green-600' : 'text-red-600'}`}>
              {isPos ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {fmtPct(Math.abs(change))}
            </div>
          )}
        </div>
        <div className="text-2xl font-bold text-gray-900">{display}</div>
        <div className="text-sm text-gray-500 mt-1">{title}</div>
      </div>
    )
  }

  const periodLabel = period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : 'Last 90 Days'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketing Overview</h1>
          <p className="text-gray-500 mt-1">Performance metrics across all platforms</p>
        </div>
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
          <AlertTriangle size={20} />
          <div>
            <div className="font-medium">Failed to load metrics</div>
            <div className="text-sm">{(error as Error).message}</div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <div className="mt-2 text-gray-500">Loading metrics...</div>
        </div>
      )}

      {cur && (
        <>
          {/* Primary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Total Spend" value={cur.spend} change={prev ? pctChange(cur.spend, prev.spend) : undefined} icon={DollarSign} color="bg-blue-600" format="currency" />
            <MetricCard title="Total Revenue" value={cur.revenue} change={prev ? pctChange(cur.revenue, prev.revenue) : undefined} icon={TrendingUp} color="bg-green-600" format="currency" />
            <MetricCard title="ROAS" value={cur.roas} change={prev ? pctChange(cur.roas, prev.roas) : undefined} icon={Target} color="bg-purple-600" format="roas" />
            <MetricCard title="Conversions" value={cur.conversions} change={prev ? pctChange(cur.conversions, prev.conversions) : undefined} icon={TrendingUp} color="bg-orange-600" format="number" />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Impressions" value={cur.impressions} change={prev ? pctChange(cur.impressions, prev.impressions) : undefined} icon={Eye} color="bg-indigo-600" format="number" />
            <MetricCard title="Clicks" value={cur.clicks} change={prev ? pctChange(cur.clicks, prev.clicks) : undefined} icon={MousePointer} color="bg-cyan-600" format="number" />
            <MetricCard title="CTR" value={cur.ctr} change={prev ? pctChange(cur.ctr, prev.ctr) : undefined} icon={Target} color="bg-teal-600" format="percent" />
            <MetricCard title="CPC" value={cur.cpc} change={prev ? pctChange(cur.cpc, prev.cpc) : undefined} icon={DollarSign} color="bg-pink-600" format="currency" />
          </div>

          {/* CPA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard title="CPA (Cost Per Acquisition)" value={cur.cpa} change={prev ? pctChange(cur.cpa, prev.cpa) : undefined} icon={DollarSign} color="bg-rose-600" format="currency" />
          </div>

          {/* Platform Breakdown */}
          {platformBreakdown.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Performance by Platform — {periodLabel}</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platform</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Spend</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ROAS</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(platformBreakdown as any[]).sort((a, b) => b.spend - a.spend).map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium capitalize">{p.platform.replace('_', ' ')}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(p.spend)}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">{formatCurrency(p.revenue)}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className={`font-semibold ${p.roas >= 2 ? 'text-green-600' : p.roas >= 1 ? 'text-blue-600' : 'text-red-600'}`}>
                            {p.roas.toFixed(2)}x
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-500">
                          {cur.spend > 0 ? ((p.spend / cur.spend) * 100).toFixed(1) : '0'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!isLoading && !error && !cur && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No data available for {periodLabel}</p>
        </div>
      )}
    </div>
  )
}
