import { useState, useEffect, useRef, useMemo, type ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  DollarSign, TrendingUp, Target, MousePointer, Eye, MousePointer2, CreditCard,
  AlertTriangle, ArrowUpRight, ArrowDownRight, AlertCircle,
  Clock, CheckCircle, X, Users, ShoppingCart, ChevronDown,
} from 'lucide-react'
import { db } from '../lib/api'
import { getDashboardSettings } from '../lib/settings'
import AccountDateRangePicker from '../components/AccountDateRangePicker'
import { defaultCalendarRangeLastNDays, previousComparableCalendarRange } from '../lib/dashboardDateRange'
import { useAuth } from '../contexts/AuthContext'
import { scopedClientIdFromUser } from '../lib/rbac'
import FilterShell from '../components/FilterShell'
import AgencyClientBreakdown from '../components/AgencyClientBreakdown'
import AgencyInsightPies from '../components/AgencyInsightPies'

interface Client {
  id: string
  name: string
  business_type?: 'leadgen' | 'ecommerce'
  currency?: string
  currency_symbol?: string
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

const KPI_ICON_SHELL: Record<string, string> = {
  blue: 'p-1.5 rounded-md bg-[var(--brand-50)] text-[var(--brand-600)]',
  violet: 'p-1.5 rounded-md bg-violet-50 text-violet-600',
  emerald: 'p-1.5 rounded-md bg-emerald-50 text-emerald-600',
  amber: 'p-1.5 rounded-md bg-amber-50 text-amber-600',
  slate: 'p-1.5 rounded-md bg-slate-50 text-slate-600',
  cyan: 'p-1.5 rounded-md bg-cyan-50 text-cyan-600',
  indigo: 'p-1.5 rounded-md bg-indigo-50 text-indigo-600',
  teal: 'p-1.5 rounded-md bg-teal-50 text-teal-600',
}

function MetricCard({ title, value, change, icon: Icon, tone, invertTrend = false }: {
  title: string
  value: string
  change?: number
  icon: ComponentType<{ size?: number | string; className?: string }>
  tone: keyof typeof KPI_ICON_SHELL
  invertTrend?: boolean
}) {
  const isGood = change === undefined ? true : invertTrend ? change <= 0 : change >= 0
  const absChange = change !== undefined ? Math.abs(change) : undefined
  const shell = KPI_ICON_SHELL[tone] ?? KPI_ICON_SHELL.slate
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 transition-shadow hover:shadow-md hover:border-gray-300/80">
      <div className="flex items-start justify-between mb-1 gap-1">
        <div className={`${shell} shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-medium shrink-0 ${isGood ? 'text-green-600' : 'text-red-600'}`}>
            {isGood ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {fmtPct(absChange!)}
          </div>
        )}
      </div>
      <div className="text-lg sm:text-xl font-bold text-gray-900 leading-tight truncate">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5 leading-snug">{title}</div>
    </div>
  )
}

export default function MarketingOverview({
  embedded = false,
  showAgencyExtras = false,
}: {
  embedded?: boolean
  /** When true (Agency View), adds client rollup, attribution pies, and AI-notes / alerts rail. */
  showAgencyExtras?: boolean
}) {
  const { appUser } = useAuth()
  const scopedClientId = useMemo(() => scopedClientIdFromUser(appUser), [appUser])
  const [dateRange, setDateRange] = useState(() => defaultCalendarRangeLastNDays(30))
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all')
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>('')
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const [businessType, setBusinessType] = useState<'leadgen' | 'ecommerce'>('ecommerce')
  const [businessTypeManual, setBusinessTypeManual] = useState(false)
  const clientDropdownRef = useRef<HTMLDivElement>(null)

  const previousRange = useMemo(
    () => (dateRange.start && dateRange.end ? previousComparableCalendarRange(dateRange) : { start: '', end: '' }),
    [dateRange.start, dateRange.end]
  )

  useEffect(() => {
    if (scopedClientId) {
      setSelectedClient(scopedClientId)
      setSelectedAdAccount('')
    }
  }, [scopedClientId])

  useEffect(() => {
    getDashboardSettings('default_user').then(loaded => {
      setBusinessType(loaded.defaultBusinessType)
      setDateRange(defaultCalendarRangeLastNDays(loaded.defaultDateRange))
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
    queryKey: ['clients_table', scopedClientId ?? 'all'],
    queryFn: () => db.getClients(scopedClientId ? { scopedClientId } : undefined),
    staleTime: 10 * 60 * 1000,
  })

  const { data: platformsFromDB } = useQuery({
    queryKey: ['available_platforms'],
    queryFn: db.getAvailablePlatforms,
    staleTime: 10 * 60 * 1000,
  })

  const { data: adAccountsFromDB } = useQuery({
    queryKey: ['ad_accounts', selectedClient, selectedPlatform, scopedClientId ?? ''],
    queryFn: () => db.getAdAccounts({
      clientId: selectedClient,
      platform: selectedPlatform,
      scopedClientId: scopedClientId || undefined,
    }),
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

  const { data: dailyCurRows, isLoading: loadingDailyCur, error: errDailyCur } = useQuery({
    queryKey: ['mkt_cur', dateRange.start, dateRange.end, selectedClient, selectedPlatform, selectedAdAccount, scopedClientId ?? ''],
    queryFn: () => db.getDailyPerformance({
      clientId: selectedClient,
      platform: selectedPlatform,
      adAccountId: selectedAdAccount || undefined,
      startDate: dateRange.start,
      endDate: dateRange.end,
      scopedClientId: scopedClientId || undefined,
    }),
    enabled: !!dateRange.start && !!dateRange.end,
    refetchOnMount: 'always',
  })

  const { data: dailyPrevRows, isLoading: loadingDailyPrev } = useQuery({
    queryKey: ['mkt_prev', previousRange.start, previousRange.end, selectedClient, selectedPlatform, selectedAdAccount, scopedClientId ?? ''],
    queryFn: () => db.getDailyPerformance({
      clientId: selectedClient,
      platform: selectedPlatform,
      adAccountId: selectedAdAccount || undefined,
      startDate: previousRange.start,
      endDate: previousRange.end,
      scopedClientId: scopedClientId || undefined,
    }),
    enabled: !!previousRange.start && !!previousRange.end,
    refetchOnMount: 'always',
  })

  const curRows = dailyCurRows ?? []
  const prevRows = dailyPrevRows ?? []
  const isLoading = loadingDailyCur || loadingDailyPrev
  const error = errDailyCur

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

  const dailyTzFootnote = useMemo(() => {
    const rows = curRows || []
    if (rows.length === 0) return null
    const tzs = [...new Set(rows.map((r: { data_timezone?: string | null }) => r.data_timezone).filter(Boolean) as string[])]
    if (tzs.length === 1) {
      return `Daily totals use reporting timezone ${tzs[0]} on rows from daily sync. Days filled only from hourly rollup use UTC hour buckets and may show no timezone until daily sync arrives.`
    }
    if (tzs.length > 1) {
      return `Daily totals mix reporting timezones (${tzs.slice(0, 4).join(', ')}${tzs.length > 4 ? ', …' : ''}). Hourly gap-fill uses UTC buckets.`
    }
    return 'When daily sync lags, some days are summed from hourly UTC slices; they may lack data_timezone until the daily row lands.'
  }, [curRows])

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

  const periodLabel = `${dateRange.start} → ${dateRange.end}`

  const selectedClientName = selectedClient === 'all'
    ? 'All Clients'
    : clients.find(c => c.id === selectedClient)?.name || 'Unknown'

  const getSeverityColor = (s: string) =>
    s === 'critical' ? 'bg-red-100 text-red-700' :
    s === 'high' ? 'bg-orange-100 text-orange-700' :
    s === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-700'

  const getStatusIcon = (s: string) =>
    s === 'new' ? <AlertCircle size={14} /> :
    s === 'in_progress' ? <Clock size={14} /> :
    s === 'resolved' ? <CheckCircle size={14} /> : <X size={14} />

  const primaryLeadGen = cur && prev && (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
      <MetricCard title="Total Spend" value={fmtMoney(cur.spend)} change={spendChange} icon={DollarSign} tone="blue" />
      <MetricCard title="CTR" value={`${cur.ctr.toFixed(2)}%`} change={ctrChange} icon={MousePointer2} tone="violet" />
      <MetricCard title="Leads" value={fmtMetric(cur.conversions)} change={convChange} icon={Users} tone="emerald" />
      <MetricCard title="Cost Per Lead (CPL)" value={fmtMoney(cur.cpa)} change={cpaChange} icon={CreditCard} tone="amber" invertTrend />
    </div>
  )

  const primaryEcom = cur && prev && (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
      <MetricCard title="Total Spend" value={fmtMoney(cur.spend)} change={spendChange} icon={DollarSign} tone="blue" />
      <MetricCard title="CTR" value={`${cur.ctr.toFixed(2)}%`} change={ctrChange} icon={MousePointer2} tone="violet" />
      <MetricCard title="Purchases" value={fmtMetric(cur.conversions)} change={convChange} icon={ShoppingCart} tone="emerald" />
      <MetricCard title="ROAS" value={`${cur.roas.toFixed(2)}x`} change={roasChange} icon={TrendingUp} tone="amber" />
    </div>
  )

  return (
    <div
      className={
        showAgencyExtras
          ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_15rem] xl:gap-3 xl:items-start'
          : ''
      }
    >
      <div className={`min-w-0 ${showAgencyExtras ? 'space-y-3' : 'space-y-4'}`}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between lg:gap-3">
          {!embedded && (
            <div className="min-w-0 lg:max-w-xl">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">UNI Overview</h1>
              <p className="text-gray-500 text-sm mt-0.5 leading-snug">
                Cross-platform roll-up{showAgencyExtras ? ' — client leaderboard, attribution pies (sample), and a side rail for AI notes + alerts' : ''}. Same date range as Heated View.
              </p>
            </div>
          )}
        </div>

        <FilterShell>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full">
          <div className="flex rounded-md border border-gray-200 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => { setBusinessType('leadgen'); setBusinessTypeManual(true) }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1 ${businessType === 'leadgen' ? 'bg-[var(--brand-600)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Users size={13} /> Lead Gen
            </button>
            <button
              type="button"
              onClick={() => { setBusinessType('ecommerce'); setBusinessTypeManual(true) }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1 ${businessType === 'ecommerce' ? 'bg-[var(--brand-600)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <ShoppingCart size={13} /> eCommerce
            </button>
          </div>
          {businessTypeManual && (
            <button type="button" onClick={() => setBusinessTypeManual(false)} className="text-xs text-[var(--brand-600)] underline shrink-0">Auto</button>
          )}
          {scopedClientId ? (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-700 min-w-[140px]">
              <span className="flex-1 text-left truncate">{selectedClientName}</span>
            </div>
          ) : (
            <div className="relative" ref={clientDropdownRef}>
              <button
                type="button"
                onClick={() => setShowClientDropdown(!showClientDropdown)}
                className="flex items-center gap-2 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md text-xs min-w-[140px]"
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
          )}
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Platform">
            <button
              type="button"
              onClick={() => { setSelectedPlatform('all'); setSelectedAdAccount('') }}
              className={`px-2 py-1 rounded-md text-xs font-medium border transition ${selectedPlatform === 'all' ? 'bg-[var(--brand-600)] text-white border-transparent' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              All
            </button>
            {availablePlatforms.map((platform: { id: string; label: string }) => (
              <button
                key={platform.id}
                type="button"
                onClick={() => { setSelectedPlatform(platform.id); setSelectedAdAccount('') }}
                className={`px-2 py-1 rounded-md text-xs font-medium border transition ${selectedPlatform === platform.id ? 'bg-[var(--brand-600)] text-white border-transparent' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {platform.label}
              </button>
            ))}
          </div>
          {adAccountsFromDB && adAccountsFromDB.length > 0 && (
            <select
              value={selectedAdAccount}
              onChange={(e) => setSelectedAdAccount(e.target.value)}
              className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md text-xs min-w-[160px]"
            >
              <option value="">All Accounts</option>
              {adAccountsFromDB.map((account: any) => (
                <option key={account.id} value={account.id}>{account.label}</option>
              ))}
            </select>
          )}
          <AccountDateRangePicker dateRange={dateRange} onChange={setDateRange} className="w-full sm:w-auto" />
          {selectedClient !== 'all' && (
            <span className="px-2 py-0.5 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md text-[11px] font-mono font-semibold">
              {clients.find(c => c.id === selectedClient)?.currency || 'USD'}
            </span>
          )}
          </div>
        </FilterShell>

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
          <div className="inline-block w-8 h-8 border-4 border-[var(--brand-600)] border-t-transparent rounded-full animate-spin" />
          <div className="mt-2 text-gray-500">Loading metrics...</div>
        </div>
      )}

      {cur && (
        <>
          {businessType === 'leadgen' ? primaryLeadGen : primaryEcom}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            <MetricCard title="Impressions" value={fmtMetric(cur.impressions)} change={prev ? pctChange(cur.impressions, prev.impressions) : undefined} icon={Eye} tone="indigo" />
            <MetricCard title="Clicks" value={fmtMetric(cur.clicks)} change={prev ? pctChange(cur.clicks, prev.clicks) : undefined} icon={MousePointer} tone="cyan" />
            <MetricCard title="CTR (detail)" value={`${cur.ctr.toFixed(2)}%`} change={prev ? pctChange(cur.ctr, prev.ctr) : undefined} icon={Target} tone="teal" />
            <MetricCard title="CPC" value={fmtMoney(cur.cpc)} change={prev ? pctChange(cur.cpc, prev.cpc) : undefined} icon={DollarSign} tone="violet" invertTrend />
          </div>

          {businessType === 'ecommerce' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
              <MetricCard title="Total Revenue" value={fmtMoney(cur.revenue)} change={revChange} icon={TrendingUp} tone="emerald" />
              <MetricCard title="CPA (Cost Per Acquisition)" value={fmtMoney(cur.cpa)} change={cpaChange} icon={CreditCard} tone="amber" invertTrend />
            </div>
          )}
          {businessType === 'leadgen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
              <MetricCard title="Total Revenue (if tracked)" value={fmtMoney(cur.revenue)} change={revChange} icon={TrendingUp} tone="emerald" />
            </div>
          )}

          {showAgencyExtras && (
            <>
              <AgencyInsightPies />
              <AgencyClientBreakdown dateRange={dateRange} selectedPlatform={selectedPlatform} section="chart" />
            </>
          )}

          {platformBreakdown.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                Performance by Platform — {periodLabel}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Platform</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Spend</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">ROAS</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Conversions</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">CPA</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(platformBreakdown as any[]).map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm font-medium capitalize">{p.platform.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2 text-sm text-right">{fmtMoney(p.spend)}</td>
                        <td className="px-3 py-2 text-sm text-right text-green-600 font-medium">{fmtMoney(p.revenue)}</td>
                        <td className="px-3 py-2 text-sm text-right">
                          <span className={`font-semibold ${p.roas >= 2 ? 'text-green-600' : p.roas >= 1 ? 'text-[var(--brand-600)]' : 'text-red-600'}`}>
                            {p.roas.toFixed(2)}x
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-right">{fmtMetric(p.conversions)}</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-600">
                          {p.conversions > 0 ? fmtMoney(p.cpa) : '—'}
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-gray-500">
                          {cur.spend > 0 ? ((p.spend / cur.spend) * 100).toFixed(2) : '0.00'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showAgencyExtras && (
            <AgencyClientBreakdown dateRange={dateRange} selectedPlatform={selectedPlatform} section="table" />
          )}

          {dailyTzFootnote && (
            <p className="text-xs text-gray-500 max-w-4xl leading-relaxed">{dailyTzFootnote}</p>
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
      {showAgencyExtras && (
        <aside
          className="hidden xl:flex flex-col gap-2.5 w-full min-w-0 max-h-[calc(100vh-5rem)] sticky top-16 self-start"
          aria-label="AI notes and alerts"
        >
          <div className="rounded-xl border border-dashed border-slate-300/90 bg-gradient-to-b from-[var(--brand-50)]/90 to-white p-2.5 text-[11px] text-slate-600 shadow-sm">
            <span className="font-semibold text-[var(--brand-700)] uppercase tracking-wide text-[10px]">AI notes</span>
            <p className="mt-1.5 leading-snug text-slate-600">
              Reserved for auto summaries and next actions. Your notes can render above or below this block later.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm flex flex-col min-h-0 flex-1 overflow-hidden">
            <div className="flex items-center justify-between gap-1 mb-2 shrink-0">
              <span className="font-semibold text-slate-700 uppercase tracking-wide text-[10px]">Alerts</span>
              <Link to="/alerts" className="text-[10px] text-[var(--brand-600)] hover:opacity-90 font-semibold whitespace-nowrap">
                Open →
              </Link>
            </div>
            <div className="grid grid-cols-4 gap-1 mb-2 shrink-0 text-center">
              <div className="rounded-md bg-slate-50 px-0.5 py-1 border border-slate-100">
                <div className="text-[11px] font-bold text-slate-900 leading-none">{alertSummary.total}</div>
                <div className="text-[8px] text-slate-500 leading-tight mt-0.5">Tot</div>
              </div>
              <div className="rounded-md bg-red-50 px-0.5 py-1 border border-red-100">
                <div className="text-[11px] font-bold text-red-700 leading-none">{alertSummary.new}</div>
                <div className="text-[8px] text-red-600 leading-tight mt-0.5">New</div>
              </div>
              <div className="rounded-md bg-red-50 px-0.5 py-1 border border-red-100">
                <div className="text-[11px] font-bold text-red-700 leading-none">{alertSummary.critical}</div>
                <div className="text-[8px] text-red-600 leading-tight mt-0.5">Crit</div>
              </div>
              <div className="rounded-md bg-orange-50 px-0.5 py-1 border border-orange-100">
                <div className="text-[11px] font-bold text-orange-800 leading-none">{alertSummary.high}</div>
                <div className="text-[8px] text-orange-700 leading-tight mt-0.5">High</div>
              </div>
            </div>
            <div className="overflow-y-auto min-h-0 flex-1 space-y-1.5 pr-0.5">
              {recentAlerts.length > 0 ? (
                recentAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className="rounded-lg border border-slate-100 bg-slate-50/80 p-1.5 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`text-[9px] font-semibold uppercase px-1 py-0 rounded ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                        {getStatusIcon(alert.status)}
                        {new Date(alert.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="text-[10px] font-semibold text-slate-800 truncate mt-0.5" title={alert.account_name}>
                      {alert.account_name}
                    </div>
                    <p className="text-[10px] text-slate-600 leading-snug line-clamp-2 mt-0.5" title={alert.message}>
                      {alert.message}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-slate-400 text-center py-3">No alerts in scope</p>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}
