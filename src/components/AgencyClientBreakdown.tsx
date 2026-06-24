import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, DollarSign, Target, Users, AlertTriangle,
  ArrowUpDown,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { db } from '../lib/api'
import { useAgency } from '../contexts/AgencyContext'
import { useAuth } from '../contexts/AuthContext'
import { scopedClientIdFromUser } from '../lib/rbac'
import type { CalendarDateRange } from '../lib/dashboardDateRange'
import { previousComparableCalendarRange } from '../lib/dashboardDateRange'
import ResizableColgroup from '../components/ResizableColgroup'
import ResizableTh from '../components/ResizableTh'
import { useResizableColumns } from '../hooks/useResizableColumns'
import { AGENCY_BY_ACCOUNT_COL_WIDTHS } from '../lib/tableResizeDefaults'
import { useChartAxisStroke, useChartGridStroke } from '../lib/chartTheme'

type ChartMetric = 'total_spend' | 'total_revenue' | 'roas' | 'conversions'
type SortField = 'account_name' | 'total_spend' | 'total_revenue' | 'roas' | 'conversions' | 'platform'
type SortDir = 'asc' | 'desc'

const COLORS = ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#0ea5e9', '#38bdf8', '#22c55e', '#a855f7']

const PLATFORM_DISPLAY: Record<string, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  tiktok_ads: 'TikTok Ads',
  linkedin_ads: 'LinkedIn Ads',
  twitter_ads: 'Twitter Ads',
  shopify: 'Shopify',
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

    const platSpend = cd.reduce((acc: Record<string, number>, r) => {
      const p = r.platform || 'Unknown'
      acc[p] = (acc[p] || 0) + (Number(r.cost) || 0)
      return acc
    }, {})
    const platRev = cd.reduce((acc: Record<string, number>, r) => {
      const p = r.platform || 'Unknown'
      acc[p] = (acc[p] || 0) + (Number(r.revenue) || 0)
      return acc
    }, {})
    const spendKeys = Object.keys(platSpend).filter(k => platSpend[k] > 0)
    const revKeys = Object.keys(platRev).filter(k => platRev[k] > 0)
    const dominantKey = spendKeys.length
      ? spendKeys.reduce((a, b) => (platSpend[a] > platSpend[b] ? a : b))
      : revKeys.length
        ? revKeys.reduce((a, b) => (platRev[a] > platRev[b] ? a : b))
        : 'Unknown'
    const platform = PLATFORM_DISPLAY[dominantKey] || dominantKey

    const sym = client.currency_symbol || '$'
    return {
      id: client.id,
      account_name: client.name,
      platform,
      total_spend: spend,
      total_revenue: revenue,
      roas,
      conversions,
      ctr,
      status: client.status || 'active',
      currency: client.currency || 'USD',
      currency_symbol: sym,
    }
  }).filter(a => a.total_spend > 0 || a.total_revenue > 0 || a.conversions > 0)
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
}

type Props = {
  dateRange: CalendarDateRange
  selectedPlatform: string
  /** `chart` = metric + bar only; `table` = account grid only; `full` = both (default). */
  section?: 'full' | 'chart' | 'table'
}

export default function AgencyClientBreakdown({ dateRange, selectedPlatform, section = 'full' }: Props) {
  const { appUser } = useAuth()
  const { currentAgencyId } = useAgency()
  const scopedClientId = useMemo(() => scopedClientIdFromUser(appUser), [appUser])
  const [chartMetric, setChartMetric] = useState<ChartMetric>('total_spend')
  const [sortField, setSortField] = useState<SortField>('total_spend')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const chartGridStroke = useChartGridStroke()
  const chartAxisStroke = useChartAxisStroke()
  const accountTableCols = ['account_name', 'platform', 'total_spend', 'total_revenue', 'roas', 'conversions', 'ctr', 'currency'] as const
  const { widths: accountColW, startResize: accountColResize } = useResizableColumns(
    'agency-by-account-v1',
    AGENCY_BY_ACCOUNT_COL_WIDTHS,
  )

  const previousRange = useMemo(
    () => (dateRange.start && dateRange.end ? previousComparableCalendarRange(dateRange) : { start: '', end: '' }),
    [dateRange.start, dateRange.end]
  )

  const fetchPerf = async (start: string, end: string) => {
    const rows = await db.getDailyPerformance({
      clientId: 'all',
      platform: selectedPlatform,
      startDate: start,
      endDate: end,
      scopedClientId: scopedClientId || undefined,
    })
    return rows.map((r: any) => ({
      client_id: r.client_id,
      cost: r.cost,
      revenue: r.revenue,
      impressions: r.impressions,
      clicks: r.clicks,
      conversions: r.conversions,
      platform: r.platform,
    }))
  }

  const { data: clients = [], isLoading: cLoading, error: cError } = useQuery({
    queryKey: ['agency-co-clients', scopedClientId ?? 'all', currentAgencyId ?? 'all'],
    queryFn: () => db.getClients(scopedClientId ? { scopedClientId } : undefined),
  })

  const { data: curRows, isLoading: perfLoading, error: perfError } = useQuery({
    queryKey: ['agency-co-cur', dateRange.start, dateRange.end, selectedPlatform, scopedClientId ?? 'all', currentAgencyId ?? 'all'],
    queryFn: () => fetchPerf(dateRange.start, dateRange.end),
    enabled: !!dateRange.start && !!dateRange.end,
  })

  const { data: prevRows } = useQuery({
    queryKey: ['agency-co-prev', previousRange.start, previousRange.end, selectedPlatform, scopedClientId ?? 'all', currentAgencyId ?? 'all'],
    queryFn: () => fetchPerf(previousRange.start, previousRange.end),
    enabled: !!previousRange.start && !!previousRange.end,
  })

  const isLoading = cLoading || perfLoading
  const error = cError || perfError

  const curAccounts = clients && curRows ? aggregateByClient(curRows, clients) : []
  const prevAccounts = clients && prevRows ? aggregateByClient(prevRows, clients) : []

  const sumField = (arr: typeof curAccounts, f: keyof (typeof curAccounts)[0]) =>
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
    { key: 'total_spend', label: 'Total Spend', value: formatCurrency(curSpend), change: pct(curSpend, prevSpend), icon: DollarSign, color: 'bg-[var(--brand-600)]' },
    { key: 'total_revenue', label: 'Total Revenue', value: formatCurrency(curRevenue), change: pct(curRevenue, prevRevenue), icon: TrendingUp, color: 'bg-emerald-600' },
    { key: 'roas', label: 'Avg ROAS', value: `${curRoas.toFixed(2)}x`, change: pct(curRoas, prevRoas), icon: Target, color: 'bg-violet-600' },
    { key: 'conversions', label: 'Conversions', value: curConv >= 1000 ? `${(curConv / 1000).toFixed(1)}K` : String(Math.round(curConv)), change: pct(curConv, prevConv), icon: TrendingUp, color: 'bg-amber-600' },
  ]

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
  const rangeLabel = `${dateRange.start} → ${dateRange.end}`

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

  const showHeader = section === 'full' || section === 'chart'
  const showChart = section === 'full' || section === 'chart'
  const showTable = section === 'full' || section === 'table'

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-center gap-2">
          <Users size={16} className="text-[var(--brand-600)] shrink-0" />
          <h2 className="uni-card-title text-sm">Client breakdown</h2>
          <span className="uni-badge-live">Warehouse · live</span>
          <span className="uni-panel-muted">Same date range &amp; platform as filters above</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 flex gap-2 items-center">
          <AlertTriangle size={16} />
          {(error as Error).message}
        </div>
      )}

      {isLoading && (
        <div className="text-center py-8 text-slate-500 text-sm">Loading client rollup…</div>
      )}

      {!isLoading && (
        <>
          {showChart && (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="agency-client-chart-metric" className="text-xs text-slate-600 shrink-0">
              Chart metric
            </label>
            <select
              id="agency-client-chart-metric"
              value={chartMetric}
              onChange={e => setChartMetric(e.target.value as ChartMetric)}
              className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-800 min-w-[10rem]"
            >
              {kpis.map(k => (
                <option key={k.key} value={k.key}>{k.label}</option>
              ))}
            </select>
            <span className="text-[11px] text-slate-500 tabular-nums">
              Δ vs prior: {activeKpi.change >= 0 ? '+' : ''}{activeKpi.change.toFixed(1)}%
            </span>
          </div>
          )}

          {showChart && (
          <div className="uni-card uni-card-body">
            <h3 className="uni-card-title text-xs mb-2">
              Top accounts by {chartLabel} — {rangeLabel}
            </h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ bottom: 28, left: 4, right: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                  <XAxis dataKey="name" angle={-30} textAnchor="end" tick={{ fontSize: 10, fill: chartAxisStroke }} height={50} />
                  <YAxis tick={{ fontSize: 10, fill: chartAxisStroke }} width={36} />
                  <Tooltip
                    formatter={(v: number) =>
                      chartMetric === 'total_spend' || chartMetric === 'total_revenue'
                        ? formatCurrency(v)
                        : chartMetric === 'roas'
                          ? `${v}x`
                          : v.toLocaleString()
                    }
                  />
                  <Bar dataKey="value" name={chartLabel} radius={[3, 3, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">No client spend in range</div>
            )}
          </div>
          )}

          {showTable && sorted.length > 0 && (
            <div className="uni-card overflow-hidden">
              <div className="uni-card-header py-2">
                <span className="uni-table-head">By account</span>
              </div>
              <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                <table className="w-full text-sm table-fixed">
                  <ResizableColgroup cols={[...accountTableCols]} widths={accountColW} />
                  <thead className="uni-table-head-row sticky top-0">
                    <tr>
                      {([
                        ['account_name', 'Account', 'text-left'],
                        ['platform', 'Platform', 'text-left'],
                        ['total_spend', 'Spend', 'text-right'],
                        ['total_revenue', 'Revenue', 'text-right'],
                        ['roas', 'ROAS', 'text-right'],
                        ['conversions', 'Conv.', 'text-right'],
                      ] as [SortField, string, string][]).map(([f, l, alignClass]) => (
                        <ResizableTh
                          key={f}
                          id={f}
                          widths={accountColW}
                          startResize={accountColResize}
                          align={alignClass === 'text-right' ? 'right' : 'left'}
                          variant="compact"
                        >
                          <button
                            type="button"
                            onClick={() => handleSort(f)}
                            className={`flex items-center gap-1 hover:text-slate-800 ${alignClass === 'text-right' ? 'ml-auto' : ''}`}
                          >
                            {l}
                            {sortField === f && <ArrowUpDown size={10} />}
                          </button>
                        </ResizableTh>
                      ))}
                      <ResizableTh id="ctr" widths={accountColW} startResize={accountColResize} variant="compact">CTR</ResizableTh>
                      <ResizableTh id="currency" widths={accountColW} startResize={accountColResize} variant="compact">CCY</ResizableTh>
                    </tr>
                  </thead>
                  <tbody className="uni-table-body divide-y divide-slate-100">
                    {sorted.map(a => (
                      <tr key={a.id} className="uni-table-row-hover">
                        <td className="px-2 py-1.5 font-medium text-slate-900 whitespace-nowrap max-w-[140px] truncate">{a.account_name}</td>
                        <td className="px-2 py-1.5 text-slate-600 text-xs">{a.platform}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{a.currency_symbol}{a.total_spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-2 py-1.5 text-right text-emerald-700 font-medium tabular-nums">{a.currency_symbol}{a.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          <span className={`font-semibold ${a.roas >= 2 ? 'text-emerald-600' : a.roas >= 1 ? 'text-[var(--brand-600)]' : 'text-red-600'}`}>
                            {a.roas.toFixed(2)}x
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">{a.conversions.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-slate-500 tabular-nums text-xs">{a.ctr.toFixed(2)}%</td>
                        <td className="px-2 py-1.5 text-[10px] font-mono text-slate-500">{a.currency || 'USD'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
