import { useMemo, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { CalendarDateRange } from '../lib/dashboardDateRange'

export type RhythmMode = 'hourly' | 'weekly'
export type RhythmMetric = 'cost' | 'revenue' | 'conversions' | 'clicks' | 'impressions'

const METRIC_LABELS: Record<RhythmMetric, string> = {
  cost: 'Spend',
  revenue: 'Revenue',
  conversions: 'Conversions',
  clicks: 'Clicks',
  impressions: 'Impressions',
}

function resolveZone(tzMode: 'utc' | 'browser' | 'account', accountTz?: string | null): string {
  if (tzMode === 'utc') return 'UTC'
  if (tzMode === 'account' && accountTz && accountTz !== 'advertiser_tz') return accountTz
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function bucketKey(isoUtc: string, zone: string, mode: RhythmMode): string {
  const d = new Date(isoUtc)
  if (mode === 'hourly') {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(d)
    const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0)
    return String(h).padStart(2, '0')
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find(p => p.type === 'year')?.value ?? '1970'
  const m = parts.find(p => p.type === 'month')?.value ?? '01'
  const day = parts.find(p => p.type === 'day')?.value ?? '01'
  const local = new Date(`${y}-${m}-${day}T12:00:00`)
  const dow = local.getUTCDay()
  const monday = new Date(local)
  monday.setUTCDate(local.getUTCDate() - ((dow + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

function formatWeekLabel(isoMonday: string): string {
  const start = new Date(`${isoMonday}T12:00:00Z`)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `${fmt(start)} – ${fmt(end)}`
}

type HourlyRow = {
  date: string
  hour: number | string
  client_id?: string
  cost?: number
  revenue?: number
  conversions?: number
  clicks?: number
  impressions?: number
  account_timezone?: string | null
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
  const [metric, setMetric] = useState<RhythmMetric>('cost')
  const [chartType, setChartType] = useState<'line' | 'bar'>('line')

  const zone = resolveZone(tzMode, accountTzHint)

  const chartData = useMemo(() => {
    const filtered = rows.filter(r => {
      if (!dateRange.start || !dateRange.end) return true
      return r.date >= dateRange.start && r.date <= dateRange.end
    })

    if (mode === 'hourly') {
      const buckets = Array.from({ length: 24 }, (_, h) => ({
        label: `${String(h).padStart(2, '0')}:00`,
        sortKey: String(h).padStart(2, '0'),
        value: 0,
      }))
      for (const r of filtered) {
        const iso = `${r.date}T${String(r.hour).padStart(2, '0')}:00:00.000Z`
        const h = bucketKey(iso, zone, 'hourly')
        const idx = Number(h)
        if (idx >= 0 && idx < 24) buckets[idx].value += Number(r[metric]) || 0
      }
      return buckets
    }

    const map = new Map<string, number>()
    for (const r of filtered) {
      const iso = `${r.date}T${String(r.hour).padStart(2, '0')}:00:00.000Z`
      const wk = bucketKey(iso, zone, 'weekly')
      map.set(wk, (map.get(wk) || 0) + (Number(r[metric]) || 0))
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([wk, value]) => ({
        label: formatWeekLabel(wk),
        sortKey: wk,
        value,
      }))
  }, [rows, mode, metric, dateRange, zone])

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 transition-opacity ${
        dimmed ? 'opacity-40 pointer-events-none' : ''
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Performance rhythm</h3>
          <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
            {mode === 'hourly'
              ? `Hour-of-day totals (0–23) in ${zone} for ${dateRange.start} → ${dateRange.end}.`
              : `Calendar-week totals (Mon–Sun) in ${zone} across the selected range.`}
            {selectedClient !== 'all' ? ' Filtered to selected client.' : ' All clients in scope.'}
          </p>
        </div>
      </div>

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
            onClick={() => setMode('weekly')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium ${mode === 'weekly' ? 'bg-[var(--brand-600)] text-white' : 'text-gray-600'}`}
          >
            By week
          </button>
        </div>
        <select
          value={metric}
          onChange={e => setMetric(e.target.value as RhythmMetric)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-gray-50"
        >
          {(Object.keys(METRIC_LABELS) as RhythmMetric[]).map(m => (
            <option key={m} value={m}>{METRIC_LABELS[m]}</option>
          ))}
        </select>
        <select
          value={chartType}
          onChange={e => setChartType(e.target.value as 'line' | 'bar')}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-gray-50"
        >
          <option value="line">Line</option>
          <option value="bar">Bar</option>
        </select>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No hourly rows in this range yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          {chartType === 'line' ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={mode === 'weekly' ? 0 : 'preserveStartEnd'} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [v.toLocaleString(), METRIC_LABELS[metric]]} />
              <Legend />
              <Line type="monotone" dataKey="value" name={METRIC_LABELS[metric]} stroke="var(--brand-600)" strokeWidth={2} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={mode === 'weekly' ? 0 : 'preserveStartEnd'} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [v.toLocaleString(), METRIC_LABELS[metric]]} />
              <Legend />
              <Bar dataKey="value" name={METRIC_LABELS[metric]} fill="var(--brand-600)" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  )
}
