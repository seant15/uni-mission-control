import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity, AlertTriangle, ChevronDown, TrendingUp, TrendingDown,
  Minus, RefreshCw, Clock
} from 'lucide-react'
import { db } from '../lib/api'
import type { HourWindow } from '../lib/api'

const WINDOW_OPTIONS: { label: string; value: HourWindow }[] = [
  { label: '1h', value: 1 },
  { label: '2h', value: 2 },
  { label: '6h', value: 6 },
  { label: '12h', value: 12 },
  { label: '24h', value: 24 },
  { label: '48h', value: 48 },
  { label: '72h', value: 72 },
]

const fmt$ = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`
const fmtN = (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toString()
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

function pctChange(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0
  return ((cur - prev) / prev) * 100
}

function aggregateRows(rows: any[]) {
  return rows.reduce((acc, r) => ({
    impressions: acc.impressions + (r.impressions || 0),
    clicks: acc.clicks + (r.clicks || 0),
    conversions: acc.conversions + (r.conversions || 0),
    cost: acc.cost + (r.cost || 0),
    revenue: acc.revenue + (r.revenue || 0),
  }), { impressions: 0, clicks: 0, conversions: 0, cost: 0, revenue: 0 })
}

function PctBadge({ change, invertTrend = false }: { change: number; invertTrend?: boolean }) {
  const isGood = invertTrend ? change <= 0 : change >= 0
  const Icon = Math.abs(change) < 0.1 ? Minus : change > 0 ? TrendingUp : TrendingDown
  const color = Math.abs(change) < 0.1
    ? 'text-gray-500 bg-gray-100'
    : isGood
      ? 'text-green-700 bg-green-100'
      : 'text-red-700 bg-red-100'

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Icon size={12} />
      {fmtPct(change)}
    </span>
  )
}

export default function RealtimePerformance() {
  const [windowHours, setWindowHours] = useState<HourWindow>(24)
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState(new Date())

  const { data: clients } = useQuery({
    queryKey: ['clients_table'],
    queryFn: db.getClients,
    staleTime: 10 * 60 * 1000,
  })

  const { data: hourlyData, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['hourly_performance', windowHours, selectedClient],
    queryFn: () => db.getHourlyPerformance({ windowHours, clientId: selectedClient }),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 minutes
  })

  const { data: recentAlerts } = useQuery({
    queryKey: ['recent_alerts', windowHours],
    queryFn: () => db.getRecentAlerts(windowHours),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (dataUpdatedAt) setLastRefreshed(new Date(dataUpdatedAt))
  }, [dataUpdatedAt])

  const currentRows = hourlyData?.current || []
  const previousRows = hourlyData?.previous || []

  // Aggregate overall KPIs
  const curTotals = aggregateRows(currentRows)
  const prevTotals = aggregateRows(previousRows)

  const curRoas = curTotals.cost > 0 ? curTotals.revenue / curTotals.cost : 0
  const prevRoas = prevTotals.cost > 0 ? prevTotals.revenue / prevTotals.cost : 0
  const curCpa = curTotals.conversions > 0 ? curTotals.cost / curTotals.conversions : 0
  const prevCpa = prevTotals.conversions > 0 ? prevTotals.cost / prevTotals.conversions : 0

  // Per-account breakdown
  const accountMap = new Map<string, { account_id: string; client_name: string; cur: any; prev: any }>()

  currentRows.forEach((r: any) => {
    const key = r.ad_account_id || r.client_id
    if (!accountMap.has(key)) {
      accountMap.set(key, {
        account_id: r.ad_account_id || r.client_id,
        client_name: r.client_name || r.client_id,
        cur: { impressions: 0, clicks: 0, conversions: 0, cost: 0, revenue: 0 },
        prev: { impressions: 0, clicks: 0, conversions: 0, cost: 0, revenue: 0 },
      })
    }
    const entry = accountMap.get(key)!
    entry.cur.impressions += r.impressions || 0
    entry.cur.clicks += r.clicks || 0
    entry.cur.conversions += r.conversions || 0
    entry.cur.cost += r.cost || 0
    entry.cur.revenue += r.revenue || 0
  })

  previousRows.forEach((r: any) => {
    const key = r.ad_account_id || r.client_id
    if (!accountMap.has(key)) {
      accountMap.set(key, {
        account_id: r.ad_account_id || r.client_id,
        client_name: r.client_name || r.client_id,
        cur: { impressions: 0, clicks: 0, conversions: 0, cost: 0, revenue: 0 },
        prev: { impressions: 0, clicks: 0, conversions: 0, cost: 0, revenue: 0 },
      })
    }
    const entry = accountMap.get(key)!
    entry.prev.impressions += r.impressions || 0
    entry.prev.clicks += r.clicks || 0
    entry.prev.conversions += r.conversions || 0
    entry.prev.cost += r.cost || 0
    entry.prev.revenue += r.revenue || 0
  })

  const accounts = Array.from(accountMap.values()).sort((a, b) => b.cur.cost - a.cur.cost)

  const selectedClientName = selectedClient === 'all'
    ? 'All Clients'
    : clients?.find((c: any) => c.id === selectedClient)?.name || selectedClient

  const alertsBySeverity = recentAlerts?.reduce((acc: any, a: any) => {
    acc[a.severity] = (acc[a.severity] || 0) + 1
    return acc
  }, {}) || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Activity className="text-green-600" />
            Real-time Performance
          </h1>
          <p className="text-gray-500 mt-1">
            Live window comparison — current vs previous {windowHours}h
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Clock size={14} />
          <span>Last updated: {lastRefreshed.toLocaleTimeString()}</span>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-6 flex-wrap">
        {/* Window selector */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Time Window</label>
          <div className="flex gap-1">
            {WINDOW_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setWindowHours(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  windowHours === opt.value
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Client filter */}
        <div className="relative">
          <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Client</label>
          <button
            onClick={() => setShowClientDropdown(!showClientDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg min-w-[200px]"
          >
            <span className="flex-1 text-left">{selectedClientName}</span>
            <ChevronDown size={16} />
          </button>
          {showClientDropdown && (
            <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-60 overflow-y-auto">
              <button
                onClick={() => { setSelectedClient('all'); setShowClientDropdown(false) }}
                className="w-full text-left px-4 py-2 hover:bg-gray-50"
              >
                All Clients
              </button>
              {clients?.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedClient(c.id); setShowClientDropdown(false) }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          <div className="mt-2 text-gray-600">Loading real-time data...</div>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Spend', cur: curTotals.cost, prev: prevTotals.cost, fmt: fmt$, invert: false },
              { label: 'Impressions', cur: curTotals.impressions, prev: prevTotals.impressions, fmt: fmtN, invert: false },
              { label: 'Clicks', cur: curTotals.clicks, prev: prevTotals.clicks, fmt: fmtN, invert: false },
              { label: 'Conversions', cur: curTotals.conversions, prev: prevTotals.conversions, fmt: fmtN, invert: false },
              { label: 'ROAS', cur: curRoas, prev: prevRoas, fmt: (v: number) => `${v.toFixed(2)}x`, invert: false },
            ].map(kpi => {
              const change = pctChange(kpi.cur, kpi.prev)
              return (
                <div key={kpi.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="text-xs text-gray-500 mb-1">{kpi.label}</div>
                  <div className="text-2xl font-bold text-gray-900">{kpi.fmt(kpi.cur)}</div>
                  <div className="flex items-center justify-between mt-2">
                    <PctBadge change={change} invertTrend={kpi.invert} />
                    <span className="text-xs text-gray-400">vs prev {windowHours}h</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Prev: {kpi.fmt(kpi.prev)}</div>
                </div>
              )
            })}
          </div>

          {/* CPA KPI */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">CPA (Cost Per Conversion)</div>
              <div className="text-2xl font-bold text-gray-900">{curCpa > 0 ? fmt$(curCpa) : '-'}</div>
              {curCpa > 0 && prevCpa > 0 && (
                <div className="flex items-center justify-between mt-2">
                  <PctBadge change={pctChange(curCpa, prevCpa)} invertTrend={true} />
                  <span className="text-xs text-gray-400">vs prev {windowHours}h</span>
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Revenue</div>
              <div className="text-2xl font-bold text-gray-900">{fmt$(curTotals.revenue)}</div>
              <div className="flex items-center justify-between mt-2">
                <PctBadge change={pctChange(curTotals.revenue, prevTotals.revenue)} />
                <span className="text-xs text-gray-400">vs prev {windowHours}h</span>
              </div>
            </div>
          </div>

          {/* Per-Account Comparison Table */}
          {accounts.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Per-Account Comparison — Current {windowHours}h vs Previous {windowHours}h
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Account</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Client</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Spend</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">vs Prev</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Conv.</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">vs Prev</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">ROAS</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">vs Prev</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {accounts.map(acc => {
                      const curRoasAcc = acc.cur.cost > 0 ? acc.cur.revenue / acc.cur.cost : 0
                      const prevRoasAcc = acc.prev.cost > 0 ? acc.prev.revenue / acc.prev.cost : 0
                      return (
                        <tr key={acc.account_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs">{acc.account_id}</td>
                          <td className="px-4 py-3 font-medium">{acc.client_name}</td>
                          <td className="px-4 py-3 text-right">{fmt$(acc.cur.cost)}</td>
                          <td className="px-4 py-3 text-right">
                            <PctBadge change={pctChange(acc.cur.cost, acc.prev.cost)} />
                          </td>
                          <td className="px-4 py-3 text-right">{acc.cur.conversions}</td>
                          <td className="px-4 py-3 text-right">
                            <PctBadge change={pctChange(acc.cur.conversions, acc.prev.conversions)} />
                          </td>
                          <td className="px-4 py-3 text-right">{curRoasAcc > 0 ? `${curRoasAcc.toFixed(2)}x` : '-'}</td>
                          <td className="px-4 py-3 text-right">
                            {curRoasAcc > 0 || prevRoasAcc > 0
                              ? <PctBadge change={pctChange(curRoasAcc, prevRoasAcc)} />
                              : <span className="text-gray-400">-</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentRows.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
              <Activity className="mx-auto mb-3 text-gray-300" size={48} />
              <p className="font-medium">No hourly data for the last {windowHours} hours</p>
              <p className="text-sm mt-1">Make sure the <code className="bg-gray-100 px-1 rounded">hourly_performance</code> table has recent data.</p>
            </div>
          )}

          {/* Recent Alerts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="text-orange-500" size={20} />
                Alerts — Last {windowHours}h ({recentAlerts?.length || 0} total)
              </h3>
              <div className="flex gap-2">
                {['critical', 'high', 'medium', 'low'].map(sev => {
                  const count = alertsBySeverity[sev] || 0
                  if (!count) return null
                  const color = sev === 'critical' ? 'bg-red-100 text-red-700' :
                    sev === 'high' ? 'bg-orange-100 text-orange-700' :
                    sev === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                  return (
                    <span key={sev} className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${color}`}>
                      {sev}: {count}
                    </span>
                  )
                })}
              </div>
            </div>

            {recentAlerts && recentAlerts.length > 0 ? (
              <div className="space-y-2">
                {recentAlerts.slice(0, 10).map((alert: any) => {
                  const severityColor = alert.severity === 'critical' ? 'border-red-300 bg-red-50' :
                    alert.severity === 'high' ? 'border-orange-300 bg-orange-50' :
                    alert.severity === 'medium' ? 'border-yellow-300 bg-yellow-50' : 'border-blue-300 bg-blue-50'
                  return (
                    <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg border ${severityColor}`}>
                      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-orange-500" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{alert.account_name}</span>
                          <span className="text-xs text-gray-500 capitalize">{(alert.alert_type || '').replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-sm text-gray-700 mt-0.5">{alert.message}</p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  )
                })}
                {recentAlerts.length > 10 && (
                  <p className="text-sm text-center text-gray-400 pt-2">
                    +{recentAlerts.length - 10} more alerts — view all in the Alerts tab
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No alerts in the last {windowHours} hours</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
