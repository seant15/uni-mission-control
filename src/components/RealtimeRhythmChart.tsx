import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import ReportSectionHeader from './ReportSectionHeader'
import type { CalendarDateRange } from '../lib/dashboardDateRange'

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

function resolveZone(tzMode: 'utc' | 'browser' | 'account', accountTz?: string | null): string {
  if (tzMode === 'utc') return 'UTC'
  if (tzMode === 'account' && accountTz && accountTz !== 'advertiser_tz') return accountTz
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function weekdayIndex(isoUtc: string, zone: string): number {
  const d = new Date(isoUtc)
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' }).format(d)
  const idx = WEEKDAY_LABELS.indexOf(wd)
  return idx >= 0 ? idx : 0
}

type HourlyRow = {
  date: string
  hour: number | string
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

function bucketToMetrics(b: Bucket) {
  return {
    cost: b.cost,
    revenue: b.revenue,
    conversions: b.conversions,
    clicks: b.clicks,
    impressions: b.impressions,
    roas: b.cost > 0 ? b.revenue / b.cost : 0,
    cpa: b.conversions > 0 ? b.cost / b.conversions : 0,
    ctr: b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0,
  }
}

export default function RealtimeRhythmChart({
  rows,
  tzMode,
  accountTzHint,
  selectedClient,
  dateRange,
  dimmed = false,
}: {
  rows: HourlyRow[]
  tzMode: 'utc' | 'browser' | 'account'
  accountTzHint?: string | null
  selectedClient: string
  dateRange: CalendarDateRange
  dimmed?: boolean
}) {
  const [mode, setMode] = useState<RhythmMode>('hourly')
  const [selectedMetrics, setSelectedMetrics] = useState<Set<RhythmMetric>>(
    () => new Set<RhythmMetric>(['cost', 'revenue']),
  )

  const zone = resolveZone(tzMode, accountTzHint)

  const chartData = useMemo(() => {
    const filtered = rows.filter(r => {
      if (!dateRange.start || !dateRange.end) return true
      return r.date >= dateRange.start && r.date <= dateRange.end
    })

    if (mode === 'hourly') {
      const buckets = Array.from({ length: 24 }, () => emptyBucket())
      for (const r of filtered) {
        const iso = `${r.date}T${String(r.hour).padStart(2, '0')}:00:00.000Z`
        const h = new Date(iso)
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: zone,
          hour: 'numeric',
          hour12: false,
        }).formatToParts(h)
        const hi = Number(parts.find(p => p.type === 'hour')?.value ?? 0)
        if (hi >= 0 && hi < 24) addRow(buckets[hi], r)
      }
      return buckets.map((b, h) => ({
        label: `${String(h).padStart(2, '0')}:00`,
        ...bucketToMetrics(b),
      }))
    }

    const buckets = WEEKDAY_LABELS.map(() => emptyBucket())
    for (const r of filtered) {
      const iso = `${r.date}T${String(r.hour).padStart(2, '0')}:00:00.000Z`
      const wi = weekdayIndex(iso, zone)
      addRow(buckets[wi], r)
    }
    return buckets.map((b, i) => ({
      label: WEEKDAY_LABELS[i],
      ...bucketToMetrics(b),
    }))
  }, [rows, mode, dateRange, zone])

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
        <p className="uni-panel-muted mt-2 mb-3">
          {mode === 'hourly'
            ? `Totals by hour (0–23) in ${zone} for ${dateRange.start} → ${dateRange.end}.`
            : `Totals by weekday (Mon–Sun) in ${zone} — each day of week is its own series point, not summed into calendar weeks.`}
          {selectedClient !== 'all' ? ' Filtered to selected client.' : ''}
        </p>

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
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} width={48} />
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
