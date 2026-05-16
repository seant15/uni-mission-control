import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { db } from '../lib/api'
import { useAgency } from '../contexts/AgencyContext'
import { useAuth } from '../contexts/AuthContext'
import { scopedClientIdFromUser } from '../lib/rbac'
import { platformLabel } from '../lib/platformStyles'
import { filterAdsDailyRows } from '../lib/adsRows'
import type { CalendarDateRange } from '../lib/dashboardDateRange'

type DailyRow = {
  platform?: string | null
  cost?: number | null
  revenue?: number | null
  conversions?: number | null
}

type InsightDim = 'platforms' | 'devices' | 'demographics' | 'demo_age' | 'demo_gender'
type ViewMode = 'pie' | 'bar' | 'table'
type ChartMetric = 'spend' | 'revenue' | 'roas' | 'cpa'

const CHART_COLORS = [
  'var(--uni-chart-1)',
  'var(--uni-chart-2)',
  'var(--uni-chart-3)',
  'var(--uni-chart-4)',
  'var(--uni-chart-5)',
  'var(--uni-chart-6)',
  'var(--uni-chart-7)',
  'var(--uni-chart-8)',
]

const DIM_DB: Record<Exclude<InsightDim, 'platforms'>, 'device' | 'age' | 'gender' | 'demographic'> = {
  devices: 'device',
  demographics: 'demographic',
  demo_age: 'age',
  demo_gender: 'gender',
}

const DIM_LABELS: Record<InsightDim, string> = {
  platforms: 'Platforms',
  devices: 'Devices',
  demographics: 'Demographics',
  demo_age: 'Age',
  demo_gender: 'Gender',
}

const DIM_HELP: Record<InsightDim, string> = {
  platforms: 'Paid ads only (Meta + Google). Use the page platform filter for a single network.',
  devices: 'Device splits from warehouse. Respects client, date, and platform filters above.',
  demographics: 'Meta age×gender plus Google/Meta age and gender when platform = All.',
  demo_age: 'Age bands. When platform = All, segments are merged across Meta and Google.',
  demo_gender: 'Gender. When platform = All, segments are merged across Meta and Google.',
}

type SegmentRow = {
  name: string
  spend: number
  revenue: number
  conversions: number
  spendPct: number
  revPct: number
}

function normalizeDeviceLabel(raw: string): string {
  const s = raw.replace(/_/g, ' ').trim().toLowerCase()
  if (!s || s === 'unknown') return 'Unknown'
  if (s === 'mobile app' || s === 'mobile_app') return 'Mobile app'
  if (s === 'mobile web' || s === 'mobile_web') return 'Mobile web'
  if (s === 'desktop') return 'Desktop'
  if (s === 'tablet') return 'Tablet'
  if (s === 'connected tv' || s === 'connected-tv') return 'Connected TV'
  if (s === 'mobile') return 'Mobile'
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

function labelSliceValue(dim: InsightDim, raw: string) {
  if (dim === 'platforms') return platformLabel(raw)
  if (dim === 'devices') return normalizeDeviceLabel(raw)
  return raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || 'Unknown'
}

function buildSegments(
  rows: Array<{
    dimension_value?: string
    platform?: string
    cost?: number | null
    revenue?: number | null
    conversions?: number | null
  }>,
  dim: InsightDim,
  opts: { tagByPlatform: boolean },
): SegmentRow[] {
  const map = new Map<string, { spend: number; revenue: number; conversions: number }>()
  for (const r of rows) {
    let key: string
    if (dim === 'platforms') {
      key = platformLabel((r.platform || 'unknown').toLowerCase())
    } else {
      const val = labelSliceValue(dim, r.dimension_value || 'unknown')
      key = opts.tagByPlatform && r.platform ? `${val} · ${platformLabel(r.platform)}` : val
    }
    if (!map.has(key)) map.set(key, { spend: 0, revenue: 0, conversions: 0 })
    const e = map.get(key)!
    e.spend += Number(r.cost) || 0
    e.revenue += Number(r.revenue) || 0
    e.conversions += Number(r.conversions) || 0
  }
  const spendTotal = [...map.values()].reduce((s, x) => s + x.spend, 0)
  const revTotal = [...map.values()].reduce((s, x) => s + x.revenue, 0)
  const pct = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 1000) / 10 : v > 0 ? 100 : 0)

  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      spend: v.spend,
      revenue: v.revenue,
      conversions: v.conversions,
      spendPct: pct(v.spend, spendTotal),
      revPct: pct(v.revenue, revTotal),
    }))
    .filter(r => r.spend > 0 || r.revenue > 0)
    .sort((a, b) => b.spend - a.spend)
}

type BreakdownDbDim = 'device' | 'age' | 'gender' | 'demographic'

function effectiveBreakdownDims(
  activeDim: InsightDim,
  selectedPlatform: string,
): { dims: BreakdownDbDim[] | null; note?: string } {
  if (activeDim === 'platforms') return { dims: null }
  if (activeDim === 'demographics') {
    if (selectedPlatform === 'google_ads') {
      return {
        dims: ['age', 'gender'],
        note: 'Google age and gender bands (no combined age×gender slice in the warehouse).',
      }
    }
    if (selectedPlatform === 'meta_ads') {
      return { dims: ['demographic'] }
    }
    return {
      dims: ['demographic', 'age', 'gender'],
      note: 'Meta age×gender plus age and gender bands for Google and Meta.',
    }
  }
  return { dims: [DIM_DB[activeDim]] }
}

type Props = {
  dailyRows?: DailyRow[]
  dateRange: CalendarDateRange
  selectedClient?: string
  selectedPlatform?: string
}

export default function AgencyInsightPies({
  dailyRows = [],
  dateRange,
  selectedClient = 'all',
  selectedPlatform = 'all',
}: Props) {
  const { appUser } = useAuth()
  const { currentAgencyId } = useAgency()
  const scopedClientId = useMemo(() => scopedClientIdFromUser(appUser), [appUser])
  const effectiveClient = scopedClientId || (selectedClient !== 'all' ? selectedClient : undefined)

  const [activeDim, setActiveDim] = useState<InsightDim>('platforms')
  const [viewMode, setViewMode] = useState<ViewMode>('pie')
  const [chartMetrics, setChartMetrics] = useState<Set<ChartMetric>>(() => new Set(['spend', 'revenue']))
  const [aggregateMode, setAggregateMode] = useState(true)
  const [hiddenSegments, setHiddenSegments] = useState<Set<string>>(new Set())

  const adsDailyRows = useMemo(() => filterAdsDailyRows(dailyRows), [dailyRows])

  const { dims: breakdownDims, note: breakdownNote } = useMemo(
    () => effectiveBreakdownDims(activeDim, selectedPlatform),
    [activeDim, selectedPlatform],
  )

  const tagByPlatform = selectedPlatform === 'all' && !aggregateMode

  const platformSegments = useMemo(() => {
    const shaped = adsDailyRows.map(r => ({
      platform: r.platform ?? undefined,
      cost: r.cost,
      revenue: r.revenue,
      conversions: r.conversions,
    }))
    return buildSegments(shaped, 'platforms', { tagByPlatform: false })
  }, [adsDailyRows])

  const { data: breakdownRows = [], isLoading: breakdownLoading } = useQuery({
    queryKey: [
      'perf-breakdown',
      breakdownDims?.join('+') ?? 'none',
      dateRange.start,
      dateRange.end,
      selectedPlatform,
      effectiveClient ?? 'all',
      currentAgencyId ?? 'all',
    ],
    queryFn: () =>
      db.getPerformanceBreakdownSlices({
        dimensions: breakdownDims!,
        clientId: effectiveClient || 'all',
        platform: selectedPlatform,
        startDate: dateRange.start,
        endDate: dateRange.end,
        scopedClientId: scopedClientId || undefined,
      }),
    enabled: breakdownDims !== null && breakdownDims.length > 0 && !!dateRange.start && !!dateRange.end,
  })

  useEffect(() => {
    setHiddenSegments(new Set())
  }, [activeDim, selectedPlatform, aggregateMode, selectedClient, dateRange.start, dateRange.end])

  const allSegments = useMemo(() => {
    if (activeDim === 'platforms') return platformSegments
    if (breakdownLoading || !breakdownDims?.length) return []
    return buildSegments(breakdownRows, activeDim, { tagByPlatform })
  }, [activeDim, platformSegments, breakdownRows, breakdownLoading, breakdownDims, tagByPlatform])

  const visibleSegments = useMemo(() => {
    return allSegments.slice(0, 16).filter(s => !hiddenSegments.has(s.name))
  }, [allSegments, hiddenSegments])

  const sectionTitle = useMemo(() => {
    if (activeDim === 'platforms') return 'Spend & revenue by platform'
    if (activeDim === 'demographics') return 'Spend & revenue by demographics'
    if (activeDim === 'demo_age') return 'Spend & revenue by age'
    if (activeDim === 'demo_gender') return 'Spend & revenue by gender'
    return 'Spend & revenue by device'
  }, [activeDim])

  const barData = useMemo(
    () =>
      visibleSegments.map(s => ({
        ...s,
        roas: s.spend > 0 ? s.revenue / s.spend : 0,
        cpa: s.conversions > 0 ? s.spend / s.conversions : 0,
      })),
    [visibleSegments],
  )

  const barHeight = Math.max(220, visibleSegments.length * 28)
  const pillOrder: InsightDim[] = ['platforms', 'devices', 'demographics', 'demo_age', 'demo_gender']

  const toggleDim = (dim: InsightDim) => setActiveDim(dim)

  const toggleChartMetric = (m: ChartMetric) => {
    setChartMetrics(prev => {
      const next = new Set(prev)
      if (next.has(m)) {
        if (next.size > 1) next.delete(m)
      } else {
        next.add(m)
      }
      return next
    })
  }

  const toggleSegment = (name: string) => {
    setHiddenSegments(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const pieForMetric = (m: ChartMetric) => {
    if (m === 'spend') return visibleSegments.map(s => ({ name: s.name, value: s.spendPct }))
    if (m === 'revenue') return visibleSegments.map(s => ({ name: s.name, value: s.revPct }))
    if (m === 'roas') {
      const max = Math.max(...visibleSegments.map(s => (s.spend > 0 ? s.revenue / s.spend : 0)), 0.01)
      return visibleSegments.map(s => ({
        name: s.name,
        value: s.spend > 0 ? Math.round(((s.revenue / s.spend) / max) * 1000) / 10 : 0,
      }))
    }
    return visibleSegments.map(s => ({
      name: s.name,
      value: s.spend > 0 ? Math.round((s.spend / visibleSegments.reduce((a, x) => a + x.spend, 0)) * 1000) / 10 : 0,
    }))
  }

  const metricPieTitle: Record<ChartMetric, string> = {
    spend: 'Spend share',
    revenue: 'Revenue share',
    roas: 'ROAS (relative)',
    cpa: 'Spend share (CPA proxy)',
  }

  return (
    <div className="uni-card">
      <div className="uni-card-header flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="uni-section-label mb-2">Attribution</p>
          <h3 className="uni-card-title">{sectionTitle}</h3>
        </div>
        <span className="uni-badge-live">Paid ads · warehouse</span>
      </div>

      <div className="uni-card-body">
        <p className="uni-panel-muted mb-2">{DIM_HELP[activeDim]}</p>
        {breakdownNote && <p className="uni-callout-warn mb-2 text-xs">{breakdownNote}</p>}
        {breakdownDims &&
          !breakdownLoading &&
          breakdownRows.length === 0 && (
          <p className="uni-callout-warn mb-3 text-xs">
            No breakdown rows for this date range, client, and platform filter. Confirm rows in{' '}
            <code className="font-mono text-[10px]">daily_performance_breakdown</code> for dimension{' '}
            {breakdownDims.join(' / ')}. If the warehouse is empty, run on the sync host:{' '}
            <code className="font-mono text-[10px]">python sync_performance_breakdowns.py --backfill-days 7</code>
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[10.5rem_minmax(0,1fr)] gap-4">
          <aside className="space-y-3 border-r border-[var(--uni-border)] pr-0 lg:pr-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Dimension</p>
            <div className="flex flex-col gap-1">
              {pillOrder.map(dim => (
                <button
                  key={dim}
                  type="button"
                  onClick={() => toggleDim(dim)}
                  className={`text-left px-2 py-1.5 rounded-md text-xs font-medium border transition ${
                    activeDim === dim
                      ? 'bg-[var(--brand-600)] text-white border-transparent'
                      : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {DIM_LABELS[dim]}
                </button>
              ))}
            </div>
            {activeDim !== 'platforms' && selectedPlatform === 'all' && (
              <label className="flex items-center gap-2 text-xs text-stone-700 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aggregateMode}
                  onChange={e => setAggregateMode(e.target.checked)}
                  className="rounded"
                />
                Merge Meta + Google labels
              </label>
            )}
            <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 pt-1">View</p>
            <div className="flex flex-col gap-1">
              {(['pie', 'bar', 'table'] as ViewMode[]).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setViewMode(v)}
                  className={`text-left px-2 py-1.5 rounded-md text-xs font-medium border transition ${
                    viewMode === v
                      ? 'bg-stone-800 text-white border-transparent'
                      : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {v === 'pie' ? 'Pie chart' : v === 'bar' ? 'Horizontal bars' : 'Table'}
                </button>
              ))}
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 pt-1">Metrics</p>
            <div className="flex flex-col gap-1">
              {(['spend', 'revenue', 'roas', 'cpa'] as ChartMetric[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleChartMetric(m)}
                  className={`text-left px-2 py-1.5 rounded-md text-xs font-medium border transition ${
                    chartMetrics.has(m)
                      ? 'bg-stone-800 text-white border-transparent'
                      : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </aside>

          <div className="min-w-0 space-y-3">
            {breakdownLoading && breakdownDims?.length ? (
              <p className="text-sm text-stone-500 py-12 text-center">Loading breakdown…</p>
            ) : visibleSegments.length === 0 ? (
              <p className="text-sm text-stone-500 py-12 text-center">No paid-ads data for this dimension and filters.</p>
            ) : viewMode === 'table' ? (
              <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded-md border border-stone-100">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-stone-500">Segment</th>
                      <th className="px-2 py-1.5 text-right font-medium text-stone-500">Spend</th>
                      <th className="px-2 py-1.5 text-right font-medium text-stone-500">Spend %</th>
                      <th className="px-2 py-1.5 text-right font-medium text-stone-500">Revenue</th>
                      <th className="px-2 py-1.5 text-right font-medium text-stone-500">Rev %</th>
                      <th className="px-2 py-1.5 text-right font-medium text-stone-500">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {visibleSegments.map(s => (
                      <tr key={s.name} className="hover:bg-stone-50/80">
                        <td className="px-2 py-1 font-medium text-stone-800">{s.name}</td>
                        <td className="px-2 py-1 text-right tabular-nums">${s.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{s.spendPct}%</td>
                        <td className="px-2 py-1 text-right tabular-nums text-green-700">${s.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{s.revPct}%</td>
                        <td className="px-2 py-1 text-right tabular-nums">{s.spend > 0 ? (s.revenue / s.spend).toFixed(2) : '—'}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : viewMode === 'bar' ? (
              <ResponsiveContainer width="100%" height={barHeight}>
                <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  {chartMetrics.has('spend') && <Bar dataKey="spend" name="Spend" fill="var(--uni-chart-1)" radius={[0, 4, 4, 0]} />}
                  {chartMetrics.has('revenue') && <Bar dataKey="revenue" name="Revenue" fill="var(--uni-chart-3)" radius={[0, 4, 4, 0]} />}
                  {chartMetrics.has('roas') && <Bar dataKey="roas" name="ROAS" fill="#7c3aed" radius={[0, 4, 4, 0]} />}
                    {chartMetrics.has('cpa') && <Bar dataKey="cpa" name="CPA" fill="#d97706" radius={[0, 4, 4, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={`grid gap-4 ${[...chartMetrics].length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                {[...chartMetrics].map(m => {
                  const pie = pieForMetric(m)
                  return (
                    <div key={m} className="min-h-[200px]">
                      <p className="uni-table-head mb-2 text-center">{metricPieTitle[m]}</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                            {pie.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => [`${v}%`, 'Share']} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )
                })}
              </div>
            )}

            {allSegments.length > 0 && (
              <div className="pt-2 border-t border-[var(--uni-border)]">
                <p className="text-[10px] text-stone-500 mb-1.5">Compare segments (toggle off to hide)</p>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {allSegments.slice(0, 20).map(s => {
                    const on = !hiddenSegments.has(s.name)
                    return (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => toggleSegment(s.name)}
                        className={`px-2 py-0.5 rounded-full text-[10px] border transition ${
                          on
                            ? 'bg-[var(--brand-50)] border-[var(--brand-200)] text-[var(--brand-800)]'
                            : 'bg-stone-100 border-stone-200 text-stone-400 line-through'
                        }`}
                      >
                        {s.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
