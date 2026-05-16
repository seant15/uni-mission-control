import { useMemo, useState } from 'react'
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
import type { CalendarDateRange } from '../lib/dashboardDateRange'

type DailyRow = {
  platform?: string | null
  cost?: number | null
  revenue?: number | null
}

type InsightDim = 'platforms' | 'devices' | 'demographics' | 'demo_age' | 'demo_gender'
type ViewMode = 'pie' | 'bar' | 'table'
type MetricFocus = 'spend' | 'revenue' | 'both'
type BarMetric = 'spend' | 'revenue' | 'roas' | 'ctr' | 'cpa'

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
  demo_age: 'Demo · Age',
  demo_gender: 'Demo · Gender',
}

const DIM_HELP: Record<InsightDim, string> = {
  platforms: 'Shares from daily_performance + Shopify (hourly gap-fill when daily lags).',
  devices: 'Device splits from warehouse. Meta uses device_platform; Google uses campaign device segment.',
  demographics: 'Meta age+gender combined. Google does not supply this combined slice in the warehouse.',
  demo_age: 'Age bands: Meta age breakdown vs Google age_range_view — labels include platform when viewing All.',
  demo_gender: 'Gender: Meta gender breakdown vs Google gender_view — labels include platform when viewing All.',
}

type SegmentRow = {
  name: string
  spend: number
  revenue: number
  spendPct: number
  revPct: number
}

function labelSliceValue(dim: InsightDim, raw: string) {
  if (dim === 'platforms') return platformLabel(raw)
  return raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || 'Unknown'
}

function buildSegments(
  rows: Array<{ dimension_value?: string; platform?: string; cost?: number | null; revenue?: number | null }>,
  dim: InsightDim,
  opts: { tagByPlatform: boolean; mergePlatforms: boolean },
): SegmentRow[] {
  const map = new Map<string, { spend: number; revenue: number }>()
  for (const r of rows) {
    let key: string
    if (dim === 'platforms') {
      key = platformLabel((r.platform || 'unknown').toLowerCase())
    } else {
      const val = labelSliceValue(dim, r.dimension_value || 'unknown')
      const splitByPlatform = opts.tagByPlatform && !opts.mergePlatforms && r.platform
      key = splitByPlatform ? `${val} · ${platformLabel(r.platform)}` : val
    }
    if (!map.has(key)) map.set(key, { spend: 0, revenue: 0 })
    const e = map.get(key)!
    e.spend += Number(r.cost) || 0
    e.revenue += Number(r.revenue) || 0
  }
  const spendTotal = [...map.values()].reduce((s, x) => s + x.spend, 0)
  const revTotal = [...map.values()].reduce((s, x) => s + x.revenue, 0)
  const pct = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 1000) / 10 : v > 0 ? 100 : 0)

  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      spend: v.spend,
      revenue: v.revenue,
      spendPct: pct(v.spend, spendTotal),
      revPct: pct(v.revenue, revTotal),
    }))
    .filter(r => r.spend > 0 || r.revenue > 0)
    .sort((a, b) => b.spend - a.spend)
}

function toPieData(segments: SegmentRow[], focus: MetricFocus) {
  if (focus === 'revenue') {
    return segments.map(s => ({ name: s.name, value: s.revPct }))
  }
  return segments.map(s => ({ name: s.name, value: s.spendPct }))
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
  const [selectedDims, setSelectedDims] = useState<Set<InsightDim>>(() => new Set(['platforms']))
  const [viewMode, setViewMode] = useState<ViewMode>('pie')
  const [metricFocus, setMetricFocus] = useState<MetricFocus>('both')
  const [aggregateMode, setAggregateMode] = useState(true)
  const [hiddenSegments, setHiddenSegments] = useState<Set<string>>(new Set())
  const [barMetrics, setBarMetrics] = useState<Set<BarMetric>>(() => new Set(['spend', 'revenue']))

  const primaryBreakdownDim = useMemo((): Exclude<InsightDim, 'platforms'> | null => {
    if (selectedDims.has('demo_age')) return 'demo_age'
    if (selectedDims.has('demo_gender')) return 'demo_gender'
    if (selectedDims.has('demographics')) return 'demographics'
    if (selectedDims.has('devices')) return 'devices'
    return null
  }, [selectedDims])

  const showPlatforms = selectedDims.has('platforms')
  const tagByPlatform = showPlatforms && selectedPlatform === 'all' && !aggregateMode
  const mergePlatforms = !showPlatforms || aggregateMode

  const platformSegments = useMemo(() => {
    if (!showPlatforms) return []
    const shaped = dailyRows.map(r => ({ platform: r.platform ?? undefined, cost: r.cost, revenue: r.revenue }))
    return buildSegments(shaped, 'platforms', { tagByPlatform: false, mergePlatforms: true })
  }, [dailyRows, showPlatforms])

  const breakdownEnabled = primaryBreakdownDim !== null
  const dbDimension = breakdownEnabled ? DIM_DB[primaryBreakdownDim] : null

  const { data: breakdownRows = [], isLoading: breakdownLoading } = useQuery({
    queryKey: [
      'perf-breakdown',
      primaryBreakdownDim,
      dateRange.start,
      dateRange.end,
      selectedPlatform,
      effectiveClient ?? 'all',
      currentAgencyId ?? 'all',
    ],
    queryFn: () =>
      db.getPerformanceBreakdown({
        dimension: dbDimension!,
        clientId: effectiveClient || 'all',
        platform: selectedPlatform,
        startDate: dateRange.start,
        endDate: dateRange.end,
        scopedClientId: scopedClientId || undefined,
      }),
    enabled: breakdownEnabled && !!dateRange.start && !!dateRange.end && !!dbDimension,
  })

  const allSegments = useMemo(() => {
    if (showPlatforms && !primaryBreakdownDim) return platformSegments
    if (breakdownLoading || !primaryBreakdownDim) return platformSegments
    return buildSegments(breakdownRows, primaryBreakdownDim, { tagByPlatform, mergePlatforms })
  }, [showPlatforms, primaryBreakdownDim, platformSegments, breakdownRows, breakdownLoading, tagByPlatform, mergePlatforms])

  const visibleSegments = useMemo(() => {
    const top = allSegments.slice(0, 16)
    return top.filter(s => !hiddenSegments.has(s.name))
  }, [allSegments, hiddenSegments])

  const sectionTitle = useMemo(() => {
    const parts: string[] = []
    if (showPlatforms) parts.push('platform')
    if (primaryBreakdownDim === 'demo_age') parts.push('age')
    else if (primaryBreakdownDim === 'demo_gender') parts.push('gender')
    else if (primaryBreakdownDim === 'devices') parts.push('device')
    else if (primaryBreakdownDim === 'demographics') parts.push('demographic')
    if (parts.length === 0) return 'Spend & revenue'
    return `Spend & revenue by ${parts.join(' + ')}`
  }, [showPlatforms, primaryBreakdownDim])

  const pillOrder: InsightDim[] = ['platforms', 'devices', 'demographics', 'demo_age', 'demo_gender']

  const barData = useMemo(
    () =>
      visibleSegments.map(s => ({
        ...s,
        roas: s.spend > 0 ? s.revenue / s.spend : 0,
        ctr: 0,
        cpa: 0,
      })),
    [visibleSegments],
  )
  const pieSpend = toPieData(visibleSegments, 'spend')
  const pieRev = toPieData(visibleSegments, 'revenue')
  const barHeight = Math.max(220, visibleSegments.length * 28)

  const toggleSegment = (name: string) => {
    setHiddenSegments(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleDim = (dim: InsightDim) => {
    setSelectedDims(prev => {
      const next = new Set(prev)
      if (next.has(dim)) {
        if (next.size > 1) next.delete(dim)
      } else {
        next.add(dim)
      }
      return next
    })
    setHiddenSegments(new Set())
  }

  const toggleBarMetric = (m: BarMetric) => {
    setBarMetrics(prev => {
      const next = new Set(prev)
      if (next.has(m)) {
        if (next.size > 1) next.delete(m)
      } else {
        next.add(m)
      }
      return next
    })
  }

  const helpText = primaryBreakdownDim
    ? DIM_HELP[primaryBreakdownDim]
    : showPlatforms
      ? DIM_HELP.platforms
      : 'Select at least one dimension.'

  return (
    <div className="uni-card">
      <div className="uni-card-header flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="uni-section-label mb-2">Attribution</p>
          <h3 className="uni-card-title">{sectionTitle}</h3>
        </div>
        <span className="uni-badge-live">Warehouse · live</span>
      </div>

      <div className="uni-card-body">
        <p className="uni-panel-muted mb-3">{helpText}</p>

        {breakdownEnabled && !breakdownLoading && breakdownRows.length === 0 && (
          <p className="uni-callout-warn mb-3">
            No breakdown rows for this range. Run{' '}
            <code className="font-mono text-[10px]">sync_performance_breakdowns.py --backfill-days 7</code> locally.
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[10.5rem_minmax(0,1fr)] gap-4">
          <aside className="space-y-3 border-r border-[var(--uni-border)] pr-0 lg:pr-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Dimensions (multi)</p>
            <div className="flex flex-col gap-1">
              {pillOrder.map(dim => (
                <button
                  key={dim}
                  type="button"
                  onClick={() => toggleDim(dim)}
                  className={`text-left px-2 py-1.5 rounded-md text-xs font-medium border transition ${
                    selectedDims.has(dim)
                      ? 'bg-[var(--brand-600)] text-white border-transparent'
                      : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {DIM_LABELS[dim]}
                </button>
              ))}
            </div>
            {primaryBreakdownDim && (
              <label className="flex items-center gap-2 text-xs text-stone-700 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aggregateMode}
                  onChange={e => setAggregateMode(e.target.checked)}
                  className="rounded"
                />
                Aggregate across platforms (e.g. 18–24 not split by Meta/Google)
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
            {viewMode !== 'table' && (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 pt-1">Metric</p>
                <select
                  value={metricFocus}
                  onChange={e => setMetricFocus(e.target.value as MetricFocus)}
                  className="w-full text-xs border border-stone-200 rounded-md px-2 py-1.5 bg-white"
                >
                  <option value="both">Spend + revenue</option>
                  <option value="spend">Spend only</option>
                  <option value="revenue">Revenue only</option>
                </select>
              </>
            )}
          </aside>

          <div className="min-w-0 space-y-3">
            {breakdownLoading && primaryBreakdownDim ? (
              <p className="text-sm text-stone-500 py-12 text-center">Loading breakdown…</p>
            ) : visibleSegments.length === 0 ? (
              <p className="text-sm text-stone-500 py-12 text-center">No data for this dimension.</p>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : viewMode === 'bar' ? (
              <>
                <p className="text-[10px] text-stone-500 mb-1">Bar metrics (multi)</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(['spend', 'revenue', 'roas', 'ctr', 'cpa'] as BarMetric[]).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleBarMetric(m)}
                      className={`px-2 py-0.5 rounded-full text-[10px] border ${
                        barMetrics.has(m) ? 'bg-stone-800 text-white border-stone-800' : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={barHeight}>
                  <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    {barMetrics.has('spend') && <Bar dataKey="spend" name="Spend" fill="var(--uni-chart-1)" radius={[0, 4, 4, 0]} />}
                    {barMetrics.has('revenue') && <Bar dataKey="revenue" name="Revenue" fill="var(--uni-chart-3)" radius={[0, 4, 4, 0]} />}
                    {barMetrics.has('roas') && <Bar dataKey="roas" name="ROAS" fill="#7c3aed" radius={[0, 4, 4, 0]} />}
                    {barMetrics.has('ctr') && <Bar dataKey="ctr" name="CTR %" fill="#0891b2" radius={[0, 4, 4, 0]} />}
                    {barMetrics.has('cpa') && <Bar dataKey="cpa" name="CPA" fill="#d97706" radius={[0, 4, 4, 0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className={`grid gap-4 ${metricFocus === 'both' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                {(metricFocus === 'spend' || metricFocus === 'both') && (
                  <div className="min-h-[200px]">
                    <p className="uni-table-head mb-2 text-center">Spend share</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={pieSpend} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                          {pieSpend.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`${v}%`, 'Share']} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {(metricFocus === 'revenue' || metricFocus === 'both') && (
                  <div className="min-h-[200px]">
                    <p className="uni-table-head mb-2 text-center">Revenue share</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={pieRev} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                          {pieRev.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`${v}%`, 'Share']} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
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
