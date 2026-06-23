import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import ReportSectionHeader from './ReportSectionHeader'
import type { CalendarDateRange } from '../lib/dashboardDateRange'
import {
  AGENCY_REPORTING_TZ,
  type HourlyPerfRow,
  resolveRhythmDisplayZone,
  rhythmBucketHour,
  rhythmBucketWeekday,
  rhythmTimezoneFootnote,
  hourlyRowUtcMs,
} from '../lib/hourlyBuckets'
import { useChartAxisStroke, useChartGridStroke } from '../lib/chartTheme'

export type RhythmMode = 'hourly' | 'weekday'
export type RhythmMetric =
  | 'cost'
  | 'revenue'
  | 'conversions'
  | 'clicks'
  | 'impressions'
  | 'roas'
  | 'cpa'
  | 'ctr'

const METRIC_LABELS: Record<RhythmMetric, string> = {
  cost: 'Spend',
  revenue: 'Revenue',
  conversions: 'Conversions',
  clicks: 'Clicks',
  impressions: 'Impressions',
  roas: 'ROAS',
  cpa: 'CPA',
  ctr: 'CTR %',
}

const METRIC_COLORS: Record<RhythmMetric, string> = {
  cost: 'var(--uni-chart-1)',
  revenue: 'var(--uni-chart-3)',
  conversions: 'var(--uni-chart-2)',
  clicks: 'var(--uni-chart-4)',
  impressions: 'var(--uni-chart-5)',
  roas: '#7c3aed',
  cpa: '#d97706',
  ctr: '#0891b2',
}

const ALL_METRICS: RhythmMetric[] = [
  'cost', 'revenue', 'conversions', 'clicks', 'impressions', 'roas', 'cpa', 'ctr',
]

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function calendarDayInZone(utcMs: number, zone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(utcMs),
  )
}

type HourlyRow = HourlyPerfRow & {
  cost?: number
  revenue?: number
  conversions?: number
  clicks?: number
  impressions?: number
}

type Bucket = {
  cost: number
  revenue: number
  conversions: number
  clicks: number
  impressions: number
}

function emptyBucket(): Bucket {
  return { cost: 0, revenue: 0, conversions: 0, clicks: 0, impressions: 0 }
}

function addRow(b: Bucket, r: HourlyRow) {
  b.cost += Number(r.cost) || 0
  b.revenue += Number(r.revenue) || 0
  b.conversions += Number(r.conversions) || 0
  b.clicks += Number(r.clicks) || 0
  b.impressions += Number(r.impressions) || 0
}

function bucketToMetrics(b: Bucket, divisor: number, roasScale = 1) {
  const n = Math.max(1, divisor)
  const slotRoas = b.cost > 0 ? b.revenue / b.cost : 0
  return {
    cost: b.cost / n,
    revenue: b.revenue / n,
    conversions: b.conversions / n,
    clicks: b.clicks / n,
    impressions: b.impressions / n,
    // Slot ROAS from hourly buckets; scale to daily KPI when hourly warehouse overstates revenue.
    roas: slotRoas > 0 ? slotRoas * roasScale : 0,
    cpa: b.conversions > 0 ? b.cost / b.conversions : 0,
    ctr: b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0,
  }
}

export default function RealtimeRhythmChart({
  rows,
  displayZone: displayZoneProp,
  accountTzHint,
  selectedClient,
  dateRange,
  dimmed = false,
  periodRoasKpi,
}: {
  rows: HourlyRow[]
  /** When set (Heated View), overrides browser TZ — agency default America/Phoenix. */
  displayZone?: string
  accountTzHint?: string | null
  selectedClient: string
  dateRange: CalendarDateRange
  dimmed?: boolean
  /** When set, dashed reference line matches Heated View KPI (daily paid-ads sync). */
  periodRoasKpi?: number
}) {
  const [mode, setMode] = useState<RhythmMode>('hourly')
  const [selectedMetrics, setSelectedMetrics] = useState<Set<RhythmMetric>>(
    () => new Set<RhythmMetric>(['cost', 'revenue']),
  )
  const chartGridStroke = useChartGridStroke()
  const chartAxisStroke = useChartAxisStroke()

  const displayZone = useMemo(
    () =>
      displayZoneProp ??
      resolveRhythmDisplayZone(rows, { hint: accountTzHint, fallback: AGENCY_REPORTING_TZ }),
    [rows, displayZoneProp, accountTzHint],
  )

  const tzFootnote = useMemo(() => rhythmTimezoneFootnote(displayZone, rows), [displayZone, rows])

  const periodRoasHourly = useMemo(() => {
    let cost = 0
    let revenue = 0
    for (const r of rows) {
      if (dateRange.start && r.date < dateRange.start) continue
      if (dateRange.end && r.date > dateRange.end) continue
      cost += Number(r.cost) || 0
      revenue += Number(r.revenue) || 0
    }
    return cost > 0 ? revenue / cost : 0
  }, [rows, dateRange.start, dateRange.end])

  const periodRoas =
    periodRoasKpi != null && periodRoasKpi > 0 ? periodRoasKpi : periodRoasHourly
  const periodRoasSource =
    periodRoasKpi != null && periodRoasKpi > 0 ? 'daily paid-ads sync (KPI)' : 'hourly warehouse'

  const roasDisplayScale = useMemo(() => {
    if (periodRoasKpi == null || periodRoasKpi <= 0 || periodRoasHourly <= 0) return 1
    if (periodRoasHourly / periodRoasKpi > 1.15) return periodRoasKpi / periodRoasHourly
    return 1
  }, [periodRoasKpi, periodRoasHourly])

  const chartData = useMemo(() => {
    const filtered = rows.filter(r => {
      if (!dateRange.start || !dateRange.end) return true
      return r.date >= dateRange.start && r.date <= dateRange.end
    })

    if (mode === 'hourly') {
      const buckets = Array.from({ length: 24 }, () => emptyBucket())
      const daySets: Set<string>[] = Array.from({ length: 24 }, () => new Set())
      for (const r of filtered) {
        const hi = rhythmBucketHour(r, displayZone)
        const ms = hourlyRowUtcMs(r)
        if (hi < 0 || hi > 23 || !Number.isFinite(ms)) continue
        addRow(buckets[hi], r)
        daySets[hi].add(calendarDayInZone(ms, displayZone))
      }
      return buckets.map((b, h) => ({
        label: `${String(h).padStart(2, '0')}:00`,
        ...bucketToMetrics(b, daySets[h].size, roasDisplayScale),
      }))
    }

    const buckets = WEEKDAY_LABELS.map(() => emptyBucket())
    const weekdayDaySets: Set<string>[] = WEEKDAY_LABELS.map(() => new Set())
    for (const r of filtered) {
      const wi = rhythmBucketWeekday(r, displayZone)
      const ms = hourlyRowUtcMs(r)
      if (!Number.isFinite(ms)) continue
      addRow(buckets[wi], r)
      weekdayDaySets[wi].add(calendarDayInZone(ms, displayZone))
    }
    return buckets.map((b, i) => ({
      label: WEEKDAY_LABELS[i],
      ...bucketToMetrics(b, weekdayDaySets[i].size, roasDisplayScale),
    }))
  }, [rows, mode, dateRange, displayZone, roasDisplayScale])

  const toggleMetric = (m: RhythmMetric) => {
    setSelectedMetrics(prev => {
      const next = new Set(prev)
      if (next.has(m)) {
        if (next.size > 1) next.delete(m)
      } else {
        next.add(m)
      }
      return next
    })
  }

  const active = ALL_METRICS.filter(m => selectedMetrics.has(m))

  return (
    <div className={`uni-card transition-opacity ${dimmed ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="uni-card-body">
        <ReportSectionHeader
          sectionLabel="Performance"
          title="Performance rhythm"
          badge={<span className="uni-badge-live">Hourly warehouse</span>}
        />
        <p className="uni-panel-muted mt-2 mb-1">
          {mode === 'hourly'
            ? `Average per clock hour (0–23) in ${displayZone} — each point is total spend/metrics for that hour divided by number of calendar days with data.`
            : `Average per weekday (Mon–Sun) in ${displayZone} — each point is the mean across all Mondays, Tuesdays, etc. in the range (not one summed week).`}
          {selectedClient !== 'all' ? ' Filtered to selected client.' : ''}
        </p>
        <p className="text-[10px] text-stone-500 mb-1">{tzFootnote}</p>
        {selectedMetrics.has('roas') && periodRoas > 0 && (
          <p className="text-[10px] text-stone-500 mb-3">
            Period ROAS ({periodRoasSource}):{' '}
            <span className="font-semibold text-stone-700">{periodRoas.toFixed(2)}x</span> — dashed line matches the
            KPI above when on Heated View. Each point is slot ROAS (revenue ÷ spend for that hour or weekday bucket);
            low-spend slots can look higher than the period average.
            {roasDisplayScale < 1 && (
              <span>
                {' '}
                Slot curve scaled to daily KPI (hourly warehouse summed to {periodRoasHourly.toFixed(2)}x vs{' '}
                {periodRoas.toFixed(2)}x daily).
              </span>
            )}
          </p>
        )}
        {!selectedMetrics.has('roas') && <p className="mb-3" />}

        <div className="flex flex-wrap gap-2 mb-3">
          <div className="flex rounded-lg border border-gray-200 p-0.5">
            <button
              type="button"
              onClick={() => setMode('hourly')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium ${mode === 'hourly' ? 'bg-[var(--brand-600)] text-white' : 'text-gray-600'}`}
            >
              By hour (0–23)
            </button>
            <button
              type="button"
              onClick={() => setMode('weekday')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium ${mode === 'weekday' ? 'bg-[var(--brand-600)] text-white' : 'text-gray-600'}`}
            >
              By weekday (Mon–Sun)
            </button>
          </div>
        </div>

        <p className="text-[10px] text-stone-500 mb-1.5">Metrics (multi-select)</p>
        <div className="flex flex-wrap gap-1 mb-4">
          {ALL_METRICS.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMetric(m)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition ${
                selectedMetrics.has(m)
                  ? 'bg-[var(--brand-50)] border-[var(--brand-200)] text-[var(--brand-800)]'
                  : 'bg-stone-100 border-stone-200 text-stone-400'
              }`}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>

        {chartData.length === 0 || active.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">No hourly rows or no metrics selected.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartAxisStroke }} />
              <YAxis tick={{ fontSize: 10, fill: chartAxisStroke }} width={48} />
              <Tooltip
                formatter={(v: number, name: string) => {
                  const m = name as RhythmMetric
                  if (m === 'ctr') return [`${Number(v).toFixed(2)}%`, METRIC_LABELS[m]]
                  if (m === 'roas') return [`${Number(v).toFixed(2)}x`, METRIC_LABELS[m]]
                  if (m === 'cpa') return [`$${Number(v).toFixed(2)}`, METRIC_LABELS[m]]
                  return [Number(v).toLocaleString(), METRIC_LABELS[m] ?? name]
                }}
              />
              <Legend />
              {selectedMetrics.has('roas') && periodRoas > 0 && (
                <ReferenceLine
                  y={periodRoas}
                  stroke="#94a3b8"
                  strokeDasharray="6 4"
                  label={{ value: `Period ${periodRoas.toFixed(2)}x`, position: 'insideTopRight', fontSize: 10 }}
                />
              )}
              {active.map(m => (
                <Line
                  key={m}
                  type="monotone"
                  dataKey={m}
                  name={METRIC_LABELS[m]}
                  stroke={METRIC_COLORS[m]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
