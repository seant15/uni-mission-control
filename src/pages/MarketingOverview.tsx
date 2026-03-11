import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  DollarSign, TrendingUp, Target, MousePointer, Eye,
  AlertTriangle, ArrowUpRight, ArrowDownRight, AlertCircle,
  Clock, CheckCircle, X, Users, BarChart3
} from 'lucide-react'
import { db } from '../lib/api'

type Period = '7d' | '30d' | '90d'

function getDateRanges(period: Period) {
  const end = new Date()
  const start = new Date()
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  start.setDate(end.getDate() - days)
  const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - days)
  return {
    current: { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] },
    previous: { start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] },
  }
}

function aggregate(rows: any[]) {
  const spend = rows.reduce((s, r) => s + (Number(r.cost) || 0), 0)
  const revenue = rows.reduce((s, r) => s + (Number(r.revenue) || 0), 0)
  const impressions = rows.reduce((s, r) => s + (Number(r.impressions) || 0), 0)
  const clicks = rows.reduce((s, r) => s + (Number(r.clicks) || 0), 0)
  const conversions = rows.reduce((s, r) => s + (Number(r.conversions) || 0), 0)
  return {
    spend, revenue, impressions, clicks, conversions,
    roas: spend > 0 ? revenue / spend : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
  }
}

function pctChange(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0
  return ((cur - prev) / prev) * 100
}

const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
const fmtN = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0)
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

function MetricCard({ title, value, change, icon: Icon, color, invertTrend = false }: {
  title: string; value: string; change?: number; icon: any; color: string; invertTrend?: boolean
}) {
  const isGood = change === undefined ? true : invertTrend ? change <= 0 : change >= 0
  const absChange = change !== undefined ? Math.abs(change) : undefined
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-medium ${isGood ? 'text-green-600' : 'text-red-600'}`}>
            {isGood ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {fmtPct(absChange!)}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{title}</div>
    </div>
  )
}

export default function MarketingOverview() {
  const [period, setPeriod] = useState<Period>('30d')
  const ranges = getDateRanges(period)

  // Current + previous period performance
  const { data: curRows, isLoading, error } = useQuery({
    queryKey: ['mkt_cur', period],
    queryFn: () => db.getDailyPerformance({ startDate: ranges.current.start, endDate: ranges.current.end }),
  })
  const { data: prevRows } = useQuery({
    queryKey: ['mkt_prev', period],
    queryFn: () => db.getDailyPerformance({ startDate: ranges.previous.start, endDate: ranges.previous.end }),
  })

  // Alert summary
  const { data: alertsData } = useQuery({
    queryKey: ['uni_alerts'],
    queryFn: db.getAlertSummary,
    staleTime: 2 * 60 * 1000,
  })

  // Client spend breakdown
  const { data: clientSpend } = useQuery({
    queryKey: ['client_spend', period],
    queryFn: () => db.getClientSpendSummary({ startDate: ranges.current.start, endDate: ranges.current.end }),
    staleTime: 5 * 60 * 1000,
  })

  const cur = curRows ? aggregate(curRows) : null
  const prev = prevRows ? aggregate(prevRows) : null

  // Platform breakdown
  const platformBreakdown = curRows
    ? Object.values(
        curRows.reduce((acc: any, row) => {
          const p = row.platform || 'Unknown'
          if (!acc[p]) acc[p] = { platform: p, spend: 0, revenue: 0, conversions: 0 }
          acc[p].spend += Number(row.cost) || 0
          acc[p].revenue += Number(row.revenue) || 0
          acc[p].conversions += Number(row.conversions) || 0
          return acc
        }, {})
      ).map((p: any) => ({
        ...p,
        roas: p.spend > 0 ? p.revenue / p.spend : 0,
        cpa: p.conversions > 0 ? p.spend / p.conversions : 0,
      })).sort((a: any, b: any) => b.spend - a.spend)
    : []

  // Alert summary counts
  const alertSummary = alertsData?.reduce(
    (acc, a) => {
      acc.total++
      if (a.status === 'new') acc.new++
      if (a.severity === 'critical') acc.critical++
      if (a.severity === 'high') acc.high++
      return acc
    },
    { total: 0, new: 0, critical: 0, high: 0 }
  ) || { total: 0, new: 0, critical: 0, high: 0 }

  const recentAlerts = alertsData?.slice(0, 5) || []

  // Client spend max for bar scaling
  const maxSpend = clientSpend?.[0]?.spend || 1

  const periodLabel = period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'

  const getSeverityColor = (s: string) =>
    s === 'critical' ? 'bg-red-100 text-red-700' :
    s === 'high' ? 'bg-orange-100 text-orange-700' :
    s === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'

  const getStatusIcon = (s: string) =>
    s === 'new' ? <AlertCircle size={14} /> :
    s === 'in_progress' ? <Clock size={14} /> :
    s === 'resolved' ? <CheckCircle size={14} /> : <X size={14} />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">UNI Overview</h1>
          <p className="text-gray-500 mt-1">Cross-platform performance summary</p>
        </div>
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}>
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
            <MetricCard title="Total Spend" value={fmt$(cur.spend)} change={prev ? pctChange(cur.spend, prev.spend) : undefined} icon={DollarSign} color="bg-blue-600" />
            <MetricCard title="Total Revenue" value={fmt$(cur.revenue)} change={prev ? pctChange(cur.revenue, prev.revenue) : undefined} icon={TrendingUp} color="bg-green-600" />
            <MetricCard title="ROAS" value={`${cur.roas.toFixed(2)}x`} change={prev ? pctChange(cur.roas, prev.roas) : undefined} icon={Target} color="bg-purple-600" />
            <MetricCard title="Conversions" value={fmtN(cur.conversions)} change={prev ? pctChange(cur.conversions, prev.conversions) : undefined} icon={TrendingUp} color="bg-orange-600" />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Impressions" value={fmtN(cur.impressions)} change={prev ? pctChange(cur.impressions, prev.impressions) : undefined} icon={Eye} color="bg-indigo-600" />
            <MetricCard title="Clicks" value={fmtN(cur.clicks)} change={prev ? pctChange(cur.clicks, prev.clicks) : undefined} icon={MousePointer} color="bg-cyan-600" />
            <MetricCard title="CTR" value={`${cur.ctr.toFixed(2)}%`} change={prev ? pctChange(cur.ctr, prev.ctr) : undefined} icon={Target} color="bg-teal-600" />
            <MetricCard title="CPC" value={fmt$(cur.cpc)} change={prev ? pctChange(cur.cpc, prev.cpc) : undefined} icon={DollarSign} color="bg-pink-600" invertTrend />
          </div>

          {/* CPA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard title="CPA (Cost Per Acquisition)" value={fmt$(cur.cpa)} change={prev ? pctChange(cur.cpa, prev.cpa) : undefined} icon={DollarSign} color="bg-rose-600" invertTrend />
          </div>

          {/* Platform Breakdown */}
          {platformBreakdown.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Performance by Platform — Last {periodLabel}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platform</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Spend</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ROAS</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Conversions</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CPA</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(platformBreakdown as any[]).map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium capitalize">{p.platform.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-sm text-right">{fmt$(p.spend)}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">{fmt$(p.revenue)}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className={`font-semibold ${p.roas >= 2 ? 'text-green-600' : p.roas >= 1 ? 'text-blue-600' : 'text-red-600'}`}>
                            {p.roas.toFixed(2)}x
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">{fmtN(p.conversions)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          {p.conversions > 0 ? fmt$(p.cpa) : '—'}
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

          {/* Clients Ad Spend */}
          {clientSpend && clientSpend.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users size={20} className="text-blue-600" />
                Client Ad Spend — Last {periodLabel}
              </h2>
              <div className="space-y-3">
                {clientSpend.map((client, i) => (
                  <div key={client.client_id} className="flex items-center gap-4">
                    <div className="w-5 text-xs text-gray-400 text-right">{i + 1}</div>
                    <div className="w-40 text-sm font-medium text-gray-800 truncate">{client.client_name}</div>
                    <div className="flex-1">
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className="bg-blue-500 h-2.5 rounded-full transition-all"
                          style={{ width: `${Math.max((client.spend / maxSpend) * 100, 2)}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-24 text-sm font-semibold text-gray-900 text-right">{fmt$(client.spend)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alert Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 size={20} className="text-orange-500" />
                Alert Overview
              </h2>
              <Link to="/alerts" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                View all alerts →
              </Link>
            </div>

            {/* Alert summary cards */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-900">{alertSummary.total}</div>
                <div className="text-xs text-gray-500 mt-1">Total</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-700">{alertSummary.new}</div>
                <div className="text-xs text-red-600 mt-1">New</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-700">{alertSummary.critical}</div>
                <div className="text-xs text-red-600 mt-1">Critical</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-700">{alertSummary.high}</div>
                <div className="text-xs text-orange-600 mt-1">High</div>
              </div>
            </div>

            {/* Recent alerts */}
            {recentAlerts.length > 0 ? (
              <div className="space-y-2">
                {recentAlerts.map(alert => (
                  <div key={alert.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                    <span className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{alert.account_name}</div>
                      <div className="text-xs text-gray-500 truncate">{alert.message}</div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1 text-xs text-gray-400">
                      {getStatusIcon(alert.status)}
                      {new Date(alert.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 text-sm">No recent alerts</div>
            )}
          </div>
        </>
      )}

      {!isLoading && !error && !cur && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No data available for last {periodLabel}</p>
        </div>
      )}
    </div>
  )
}
