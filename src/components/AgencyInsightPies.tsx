import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
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

const CHART_COLORS = [
  'var(--uni-chart-1)',
  'var(--uni-chart-2)',
  'var(--uni-chart-3)',
  'var(--uni-chart-4)',
  'var(--uni-chart-5)',
  'var(--uni-chart-6)',
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
  demo_age: 'Age bands: Meta age breakdown vs Google age_range_view — slice labels include platform when viewing All.',
  demo_gender: 'Gender: Meta gender breakdown vs Google gender_view — slice labels include platform when viewing All.',
}

function labelSliceValue(dim: InsightDim, raw: string) {
  if (dim === 'platforms') return platformLabel(raw)
  return raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || 'Unknown'
}

function aggregateSlices(
  rows: Array<{ dimension_value?: string; platform?: string; cost?: number | null; revenue?: number | null }>,
  dim: InsightDim,
  valueKey: 'spend' | 'revenue',
  tagByPlatform: boolean,
) {
  const map = new Map<string, number>()
  for (const r of rows) {
    let key: string
    if (dim === 'platforms') {
      key = (r.platform || 'unknown').toLowerCase()
    } else {
      const val = labelSliceValue(dim, r.dimension_value || 'unknown')
      key = tagByPlatform && r.platform ? `${val} · ${platformLabel(r.platform)}` : val
    }
    const add = valueKey === 'spend' ? Number(r.cost) || 0 : Number(r.revenue) || 0
    map.set(key, (map.get(key) || 0) + add)
  }
  const total = [...map.values()].reduce((s, x) => s + x, 0)
  const toPct = (v: number) =>
    total > 0 ? Math.round((v / total) * 1000) / 10 : v > 0 ? 100 : 0

  const slices = [...map.entries()]
    .map(([k, v]) => ({
      name: dim === 'platforms' ? platformLabel(k) : k,
      value: toPct(v),
    }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value)

  return { slices, total }
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
  const tagByPlatform = selectedPlatform === 'all'
  const [activeDim, setActiveDim] = useState<InsightDim>('platforms')

  const platformAgg = useMemo(() => {
    const shaped = dailyRows.map(r => ({ platform: r.platform ?? undefined, cost: r.cost, revenue: r.revenue }))
    const spend = aggregateSlices(shaped, 'platforms', 'spend', false)
    const rev = aggregateSlices(shaped, 'platforms', 'revenue', false)
    return { spendSlices: spend.slices, revSlices: rev.slices, spendTotal: spend.total, revTotal: rev.total }
  }, [dailyRows])

  const hasRows = dailyRows.length > 0
  const breakdownEnabled = activeDim !== 'platforms'
  const dbDimension = breakdownEnabled ? DIM_DB[activeDim] : null

  const { data: breakdownRows = [], isLoading: breakdownLoading } = useQuery({
    queryKey: [
      'perf-breakdown',
      activeDim,
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

  const breakdownAgg = useMemo(() => {
    if (!breakdownEnabled) return null
    const spend = aggregateSlices(breakdownRows, activeDim, 'spend', tagByPlatform)
    const rev = aggregateSlices(breakdownRows, activeDim, 'revenue', tagByPlatform)
    return { spendSlices: spend.slices, revSlices: rev.slices }
  }, [activeDim, breakdownEnabled, breakdownRows, tagByPlatform])

  const spendSlices = useMemo(() => {
    if (activeDim === 'platforms') {
      if (!hasRows) return [{ name: 'No data', value: 100 }]
      return platformAgg.spendSlices.length > 0 ? platformAgg.spendSlices : [{ name: 'No ad spend', value: 100 }]
    }
    if (breakdownLoading) return [{ name: 'Loading…', value: 100 }]
    if (!breakdownAgg?.spendSlices.length) return [{ name: 'No data', value: 100 }]
    return breakdownAgg.spendSlices
  }, [activeDim, breakdownAgg, breakdownLoading, hasRows, platformAgg.spendSlices])

  const revSlices = useMemo(() => {
    if (activeDim === 'platforms') {
      if (!hasRows) return [{ name: 'No data', value: 100 }]
      return platformAgg.revSlices.length > 0 ? platformAgg.revSlices : [{ name: 'No revenue', value: 100 }]
    }
    if (breakdownLoading) return [{ name: 'Loading…', value: 100 }]
    if (!breakdownAgg?.revSlices.length) return [{ name: 'No data', value: 100 }]
    return breakdownAgg.revSlices
  }, [activeDim, breakdownAgg, breakdownLoading, hasRows, platformAgg.revSlices])

  const titleByDim: Record<InsightDim, string> = {
    platforms: 'Spend & revenue by platform',
    devices: 'Spend & revenue by device',
    demographics: 'Spend & revenue by demographic',
    demo_age: 'Spend & revenue by age band',
    demo_gender: 'Spend & revenue by gender',
  }

  const pillOrder: InsightDim[] = ['platforms', 'devices', 'demographics', 'demo_age', 'demo_gender']

  return (
    <div className="uni-card">
      <div className="uni-card-header flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="uni-section-label mb-2">Attribution</p>
          <h3 className="uni-card-title">{titleByDim[activeDim]}</h3>
        </div>
        <span className="uni-badge-live">Warehouse · live</span>
      </div>
      <div className="uni-card-body space-y-3">
        <p className="uni-panel-muted">{DIM_HELP[activeDim]}</p>
        {breakdownEnabled && !breakdownLoading && breakdownRows.length === 0 && (
          <p className="uni-callout-warn">
            No breakdown rows for this range. Run{' '}
            <code className="font-mono text-[10px]">sync_performance_breakdowns.py --backfill-days 7</code> locally.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="min-h-[200px]">
            <p className="uni-table-head mb-2 text-center">Spend share</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={spendSlices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                  {spendSlices.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v}%`, 'Share']} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="min-h-[200px]">
            <p className="uni-table-head mb-2 text-center">Revenue share</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={revSlices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                  {revSlices.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v}%`, 'Share']} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 pt-1 border-t border-[var(--uni-border)]">
          {pillOrder.map(dim => (
            <button
              key={dim}
              type="button"
              onClick={() => setActiveDim(dim)}
              className={`uni-pill transition-colors ${activeDim === dim ? 'uni-pill-active' : 'uni-pill hover:opacity-90'}`}
            >
              {DIM_LABELS[dim]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

