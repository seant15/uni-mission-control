import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  DollarSign, TrendingUp, Target, MousePointer, Eye, MousePointer2, CreditCard,
  AlertTriangle, ArrowUpRight, ArrowDownRight, AlertCircle,
  Clock, CheckCircle, X, BarChart3, Users, ShoppingCart, ChevronDown,
} from 'lucide-react'
import { db } from '../lib/api'
import { getDashboardSettings } from '../lib/settings'

type Period = '7d' | '30d' | '90d'

interface Client {
  id: string
  name: string
  business_type?: 'leadgen' | 'ecommerce'
  currency?: string
  currency_symbol?: string
}

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
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [businessType, setBusinessType] = useState<'leadgen' | 'ecommerce'>('ecommerce')
  const [businessTypeManual, setBusinessTypeManual] = useState(false)
  const clientDropdownRef = useRef<HTMLDivElement>(null)

  const ranges = getDateRanges(period)

  useEffect(() => {
    getDashboardSettings('default_user').then(loaded => {
      setBusinessType(loaded.defaultBusinessType)
    })
  }, [])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const { data: clientsFromTable } = useQuery({
    queryKey: ['clients_table'],
    queryFn: db.getClients,
    staleTime: 10 * 60 * 1000,
  })

  const { data: platformsFromDB } = useQuery({
    queryKey: ['available_platforms'],
    queryFn: db.getAvailablePlatforms,
    staleTime: 10 * 60 * 1000,
  })

  const { data: adAccountsFromDB } = useQuery({
    queryKey: ['ad_accounts', selectedClient, selectedPlatform],
    queryFn: () => db.getAdAccounts({ clientId: selectedClient, platform: selectedPlatform }),
    staleTime: 10 * 60 * 1000,
  })

  const clients: Client[] = clientsFromTable || []
  const availablePlatforms = platformsFromDB || []

  useEffect(() => {
    if (businessTypeManual) return
    let clientId = selectedClient
    if (clientId === 'all' && selectedAdAccount && adAccountsFromDB) {
      const match = adAccountsFromDB.find((a: any) => a.id === selectedAdAccount)
      if (match?.client_id) clientId = match.client_id
    }
    if (clientId && clientId !== 'all') {
      const client = clients.find(c => c.id === clientId)
      if (client?.business_type) {
        setBusinessType(client.business_type)
      }
    }
  }, [selectedClient, selectedAdAccount, clients, adAccountsFromDB, businessTypeManual])

  const { data: curRows, isLoading, error } = useQuery({
    queryKey: ['mkt_cur', period, selectedClient, selectedPlatform, selectedAdAccount],
    queryFn: () => db.getDailyPerformance({
      clientId: selectedClient,
      platform: selectedPlatform,
      adAccountId: selectedAdAccount || undefined,
      startDate: ranges.current.start,
      endDate: ranges.current.end,
    }),
    refetchOnMount: 'always',
  })

  const { data: prevRows } = useQuery({
    queryKey: ['mkt_prev', period, selectedClient, selectedPlatform, selectedAdAccount],
    queryFn: () => db.getDailyPerformance({
      clientId: selectedClient,
      platform: selectedPlatform,
      adAccountId: selectedAdAccount || undefined,
      startDate: ranges.previous.start,
      endDate: ranges.previous.end,
    }),
    refetchOnMount: 'always',
  })

  const { data: alertsRaw } = useQuery({
    queryKey: ['uni_alerts'],
    queryFn: db.getAlertSummary,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: 'always',
  })

  const alertsData = alertsRaw?.filter(a => {
    if (selectedClient === 'all') return true
    return a.client_id === selectedClient
  })

  const cur = curRows ? aggregate(curRows) : null
  const prev = prevRows ? aggregate(prevRows) : null

  const spendChange = cur && prev ? pctChange(cur.spend, prev.spend) : undefined
  const ctrChange = cur && prev ? pctChange(cur.ctr, prev.ctr) : undefined
  const convChange = cur && prev ? pctChange(cur.conversions, prev.conversions) : undefined
  const cpaChange = cur && prev ? pctChange(cur.cpa, prev.cpa) : undefined
  const roasChange = cur && prev ? pctChange(cur.roas, prev.roas) : undefined
  const revChange = cur && prev ? pctChange(cur.revenue, prev.revenue) : undefined

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: selectedClient !== 'all' ? (clients.find(c => c.id === selectedClient)?.currency || 'USD') : 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)

  const fmtMetric = (v: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

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

  const periodLabel = period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'

  const selectedClientName = selectedClient === 'all'
    ? 'All Clients'
    : clients.find(c => c.id === selectedClient)?.name || 'Unknown'

  const getSeverityColor = (s: string) =>
    s === 'critical' ? 'bg-red-100 text-red-700' :
    s === 'high' ? 'bg-orange-100 text-orange-700' :
    s === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'

  const getStatusIcon = (s: string) =>
    s === 'new' ? <AlertCircle size={14} /> :
    s === 'in_progress' ? <Clock size={14} /> :
    s === 'resolved' ? <CheckCircle size={14} /> : <X size={14} />

  const primaryLeadGen = cur && prev && (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard title="Total Spend" value={fmtMoney(cur.spend)} change={spendChange} icon={DollarSign} color="bg-blue-600" />
      <MetricCard title="CTR" value={`${cur.ctr.toFixed(2)}%`} change={ctrChange} icon={MousePointer2} color="bg-violet-600" />
      <MetricCard title="Leads" value={fmtMetric(cur.conversions)} change={convChange} icon={Users} color="bg-emerald-600" />
      <MetricCard title="Cost Per Lead (CPL)" value={fmtMoney(cur.cpa)} change={cpaChange} icon={CreditCard} color="bg-amber-600" invertTrend />
    </div>
  )

  const primaryEcom = cur && prev && (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard title="Total Spend" value={fmtMoney(cur.spend)} change={spendChange} icon={DollarSign} color="bg-blue-600" />
      <MetricCard title="CTR" value={`${cur.ctr.toFixed(2)}%`} change={ctrChange} icon={MousePointer2} color="bg-violet-600" />
      <MetricCard title="Purchases" value={fmtMetric(cur.conversions)} change={convChange} icon={ShoppingCart} color="bg-emerald-600" />
      <MetricCard title="ROAS" value={`${cur.roas.toFixed(2)}x`} change={roasChange} icon={TrendingUp} color="bg-amber-600" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">UNI Overview</h1>
          <p className="text-gray-500 mt-1">Cross-platform performance summary — filters match Account Performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 p-0.5">
            <button
              type="button"
              onClick={() => { setBusinessType('leadgen'); setBusinessTypeManual(true) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1 ${businessType === 'leadgen' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Users size={13} /> Lead Gen
            </button>
            <button
              type="button"
              onClick={() => { setBusinessType('ecommerce'); setBusinessTypeManual(true) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1 ${businessType === 'ecommerce' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <ShoppingCart size={13} /> eCommerce
            </button>
          </div>
          {businessTypeManual && (
            <button type="button" onClick={() => setBusinessTypeManual(false)} className="text-xs text-blue-500 underline">Auto</button>
          )}
          <div className="relative" ref={clientDropdownRef}>
            <button
              type="button"
              onClick={() => setShowClientDropdown(!showClientDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm min-w-[160px]"
            >
              <span className="flex-1 text-left truncate">{selectedClientName}</span>
              <ChevronDown size={14} />
            </button>
            {showClientDropdown && (
              <div className="absolute top-full right-0 mt-1 w-full min-w-[200px] bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-56 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => { setSelectedClient('all'); setSelectedAdAccount(''); setBusinessTypeManual(false); setShowClientDropdown(false) }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                >
                  All Clients
                </button>
                {clients.map(client => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => { setSelectedClient(client.id); setSelectedAdAccount(''); setBusinessTypeManual(false); setShowClientDropdown(false) }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50"
                  >
                    <div className="text-sm font-medium">{client.name}</div>
                    {client.business_type && (
                      <div className="text-xs text-gray-500">{client.business_type === 'leadgen' ? 'Lead Gen' : 'eCommerce'}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <select
            value={selectedPlatform}
            onChange={(e) => { setSelectedPlatform(e.target.value); setSelectedAdAccount('') }}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm min-w-[140px]"
          >
            <option value="all">All Platforms</option>
            {availablePlatforms.map((platform: any) => (
              <option key={platform.id} value={platform.id}>{platform.label}</option>
            ))}
          </select>
          {adAccountsFromDB && adAccountsFromDB.length > 0 && (
            <select
              value={selectedAdAccount}
              onChange={(e) => setSelectedAdAccount(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm min-w-[180px]"
            >
              <option value="">All Accounts</option>
              {adAccountsFromDB.map((account: any) => (
                <option key={account.id} value={account.id}>{account.label}</option>
              ))}
            </select>
          )}
          {(['7d', '30d', '90d'] as Period[]).map(p => (
            <button key={p} type="button" onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}>
              {p === '7d' ? '7d' : p === '30d' ? '30d' : '90d'}
            </button>
          ))}
          {selectedClient !== 'all' && (
            <span className="px-2 py-1 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg text-xs font-mono font-semibold">
              {clients.find(c => c.id === selectedClient)?.currency || 'USD'}
            </span>
          )}
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
          {businessType === 'leadgen' ? primaryLeadGen : primaryEcom}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Impressions" value={fmtMetric(cur.impressions)} change={prev ? pctChange(cur.impressions, prev.impressions) : undefined} icon={Eye} color="bg-indigo-600" />
            <MetricCard title="Clicks" value={fmtMetric(cur.clicks)} change={prev ? pctChange(cur.clicks, prev.clicks) : undefined} icon={MousePointer} color="bg-cyan-600" />
            <MetricCard title="CTR (detail)" value={`${cur.ctr.toFixed(2)}%`} change={prev ? pctChange(cur.ctr, prev.ctr) : undefined} icon={Target} color="bg-teal-600" />
            <MetricCard title="CPC" value={fmtMoney(cur.cpc)} change={prev ? pctChange(cur.cpc, prev.cpc) : undefined} icon={DollarSign} color="bg-pink-600" invertTrend />
          </div>

          {businessType === 'ecommerce' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricCard title="Total Revenue" value={fmtMoney(cur.revenue)} change={revChange} icon={TrendingUp} color="bg-green-600" />
              <MetricCard title="CPA (Cost Per Acquisition)" value={fmtMoney(cur.cpa)} change={cpaChange} icon={CreditCard} color="bg-rose-600" invertTrend />
            </div>
          )}
          {businessType === 'leadgen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricCard title="Total Revenue (if tracked)" value={fmtMoney(cur.revenue)} change={revChange} icon={TrendingUp} color="bg-green-600" />
            </div>
          )}

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
                        <td className="px-4 py-3 text-sm text-right">{fmtMoney(p.spend)}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">{fmtMoney(p.revenue)}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className={`font-semibold ${p.roas >= 2 ? 'text-green-600' : p.roas >= 1 ? 'text-blue-600' : 'text-red-600'}`}>
                            {p.roas.toFixed(2)}x
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">{fmtMetric(p.conversions)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          {p.conversions > 0 ? fmtMoney(p.cpa) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-500">
                          {cur.spend > 0 ? ((p.spend / cur.spend) * 100).toFixed(2) : '0.00'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
