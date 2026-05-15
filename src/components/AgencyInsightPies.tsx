import { useMemo, useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { db } from '../lib/api'
import { useAgency } from '../contexts/AgencyContext'
import { useAuth } from '../contexts/AuthContext'
import { scopedClientIdFromUser } from '../lib/rbac'
import type { CalendarDateRange } from '../lib/dashboardDateRange'

type DailyRow = {
  platform?: string | null
  cost?: number | null
  revenue?: number | null
  conversions?: number | null
}

type InsightDim = 'platforms' | 'devices' | 'ages' | 'demographics'

const CHART_COLORS = [
  'var(--uni-chart-1)',
  'var(--uni-chart-2)',
  'var(--uni-chart-3)',
  'var(--uni-chart-4)',
  'var(--uni-chart-5)',
  'var(--uni-chart-6)',
]

const DIM_DB: Record<Exclude<InsightDim, 'platforms'>, 'device' | 'age' | 'demographic'> = {
  devices: 'device',
  ages: 'age',
  demographics: 'demographic',
}

const DIM_LABELS: Record<InsightDim, string> = {
  platforms: 'Platforms',
  devices: 'Devices',
  ages: 'Age bands',
  demographics: 'Demographics',
}

function labelPlatform(raw: string) {
  const key = raw.toLowerCase()
  const labels: Record<string, string> = {
    meta_ads: 'Meta Ads',
    google_ads: 'Google Ads',
    shopify: 'Shopify',
    tiktok_ads: 'TikTok Ads',
  }
  if (labels[key]) return labels[key]
  const s = raw.replace(/_/g, ' ')
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Unknown'
}

function labelSliceValue(dim: InsightDim, raw: string) {
  if (dim === 'platforms') return labelPlatform(raw)
  return raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || 'Unknown'
}

function aggregateSlices(
  rows: Array<{ dimension_value?: string; platform?: string; cost?: number | null; revenue?: number | null }>,
  dim: InsightDim,
  valueKey: 'spend' | 'revenue',
) {
  const map = new Map<string, number>()
  for (const r of rows) {
    const key =
      dim === 'platforms'
        ? (r.platform || 'unknown').toLowerCase()
        : (r.dimension_value || 'unknown')
    const add = valueKey === 'spend' ? Number(r.cost) || 0 : Number(r.revenue) || 0
    map.set(key, (map.get(key) || 0) + add)
  }
  const total = [...map.values()].reduce((s, x) => s + x, 0)
  const toPct = (v: number) =>
    total > 0 ? Math.round((v / total) * 1000) / 10 : v > 0 ? 100 : 0

  const slices = [...map.entries()]
    .map(([k, v]) => ({ name: labelSliceValue(dim, k), value: toPct(v) }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value)

  return { slices, total }
}

function aggregatePlatformSlices(rows: DailyRow[]) {
  const shaped = rows.map(r => ({
    platform: r.platform ?? undefined,
    cost: r.cost,
    revenue: r.revenue,
  }))
  const spend = aggregateSlices(shaped, 'platforms', 'spend')
  const rev = aggregateSlices(shaped, 'platforms', 'revenue')
  return { spendSlices: spend.slices, revSlices: rev.slices, spendTotal: spend.total, revTotal: rev.total }
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
  const syncAttempted = useRef<string | null>(null)
  const queryClient = useQueryClient()

  const platformAgg = useMemo(() => aggregatePlatformSlices(dailyRows), [dailyRows])
  const hasRows = dailyRows.length > 0
  const hasSpend = platformAgg.spendTotal > 0
  const hasRevenue = platformAgg.revTotal > 0

  const breakdownEnabled = activeDim !== 'platforms'
  const dbDimension = breakdownEnabled ? DIM_DB[activeDim] : null

  const breakdownQueryKey = [
    'perf-breakdown',
    activeDim,
    dateRange.start,
    dateRange.end,
    selectedPlatform,
    effectiveClient ?? 'all',
    currentAgencyId ?? 'all',
  ] as const

  const {
    data: breakdownRows = [],
    isLoading: breakdownLoading,
    isFetching: breakdownFetching,
  } = useQuery({
    queryKey: breakdownQueryKey,
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

  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (!breakdownEnabled || !dateRange.start || !dateRange.end) return
    if (breakdownLoading || breakdownFetching || syncing) return
    if (breakdownRows.length > 0) return

    const attemptKey = `${activeDim}|${dateRange.start}|${dateRange.end}|${effectiveClient ?? 'all'}`
    if (syncAttempted.current === attemptKey) return
    syncAttempted.current = attemptKey

    let cancelled = false
    ;(async () => {
      setSyncing(true)
      const result = await db.requestPerformanceBreakdownSync({
        startDate: dateRange.start,
        endDate: dateRange.end,
        clientId: effectiveClient,
      })
      if (!cancelled && result.ok) {
        await queryClient.invalidateQueries({ queryKey: ['perf-breakdown'] })
      }
      if (!cancelled) setSyncing(false)
    })()

    return () => {
      cancelled = true
    }
  }, [
    activeDim,
    breakdownEnabled,
    breakdownFetching,
    breakdownLoading,
    breakdownRows.length,
    dateRange.end,
    dateRange.start,
    effectiveClient,
    queryClient,
    syncing,
  ])

  const breakdownAgg = useMemo(() => {
    if (!breakdownEnabled) return null
    const spend = aggregateSlices(breakdownRows, activeDim, 'spend')
    const rev = aggregateSlices(breakdownRows, activeDim, 'revenue')
    return { spendSlices: spend.slices, revSlices: rev.slices, spendTotal: spend.total, revTotal: rev.total }
  }, [activeDim, breakdownEnabled, breakdownRows])

  const spendSlices = useMemo(() => {
    if (activeDim === 'platforms') {
      if (!hasRows) return [{ name: 'No data', value: 100 }]
      return platformAgg.spendSlices.length > 0 ? platformAgg.spendSlices : [{ name: 'No ad spend', value: 100 }]
    }
    if (breakdownLoading || syncing) return [{ name: 'Loading…', value: 100 }]
    if (!breakdownAgg || breakdownAgg.spendSlices.length === 0) {
      return [{ name: syncing ? 'Syncing…' : 'No data', value: 100 }]
    }
    return breakdownAgg.spendSlices
  }, [activeDim, breakdownAgg, breakdownLoading, hasRows, platformAgg.spendSlices, syncing])

  const revSlices = useMemo(() => {
    if (activeDim === 'platforms') {
      if (!hasRows) return [{ name: 'No data', value: 100 }]
      return platformAgg.revSlices.length > 0 ? platformAgg.revSlices : [{ name: 'No revenue', value: 100 }]
    }
    if (breakdownLoading || syncing) return [{ name: 'Loading…', value: 100 }]
    if (!breakdownAgg || breakdownAgg.revSlices.length === 0) {
      return [{ name: syncing ? 'Syncing…' : 'No data', value: 100 }]
    }
    return breakdownAgg.revSlices
  }, [activeDim, breakdownAgg, breakdownLoading, hasRows, platformAgg.revSlices, syncing])

  const titleByDim: Record<InsightDim, string> = {
    platforms: 'Spend & revenue by platform',
    devices: 'Spend & revenue by device',
    ages: 'Spend & revenue by age band',
    demographics: 'Spend & revenue by demographic',
  }

  return (
    <div className="uni-card">
      <div className="uni-card-header flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="uni-section-label mb-2">Attribution</p>
          <h3 className="uni-card-title">{titleByDim[activeDim]}</h3>
        </div>
        <span className="uni-badge-live">
          {syncing || breakdownFetching ? 'Syncing…' : 'Warehouse · live'}
        </span>
      </div>
      <div className="uni-card-body space-y-3">
        <p className="uni-panel-muted">
          {activeDim === 'platforms'
            ? 'Shares from synced daily_performance plus Shopify store revenue (hourly gap-fill when daily lags).'
            : 'Device, age, and demographic splits from daily_performance_breakdown (Meta + Google). Empty ranges trigger an on-demand sync.'}
        </p>
        {activeDim === 'platforms' && !hasRows && (
          <p className="uni-callout-warn">
            No rows in the selected date range. Run marketing sync and{' '}
            <code className="font-mono text-[10px]">sync_shopify_data.py --backfill-days 7</code> to populate.
          </p>
        )}
        {activeDim === 'platforms' && hasRows && !hasSpend && hasRevenue && (
          <p className="uni-callout-warn">
            Spend share is empty but revenue exists (e.g. Shopify-only). Revenue pie reflects store orders.
          </p>
        )}
        {breakdownEnabled && !breakdownLoading && !syncing && breakdownRows.length === 0 && (
          <p className="uni-callout-warn">
            No breakdown rows yet for this range. Sync is running or use{' '}
            <code className="font-mono text-[10px]">sync_performance_breakdowns.py --backfill-days 7</code>.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="min-h-[200px]">
            <p className="uni-table-head mb-2 text-center">Spend share</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={spendSlices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={72}
                  paddingAngle={2}
                >
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
                <Pie
                  data={revSlices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={72}
                  paddingAngle={2}
                >
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
          {(Object.keys(DIM_LABELS) as InsightDim[]).map(dim => (
            <button
              key={dim}
              type="button"
              onClick={() => setActiveDim(dim)}
              className={`uni-pill transition-colors ${
                activeDim === dim ? 'uni-pill-active' : 'uni-pill hover:opacity-90'
              }`}
            >
              {DIM_LABELS[dim]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
