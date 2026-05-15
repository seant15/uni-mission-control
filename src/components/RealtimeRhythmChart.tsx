import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import AccountDateRangePicker from './AccountDateRangePicker'
import { defaultCalendarRangeLastNDays } from '../lib/dashboardDateRange'
import type { CalendarDateRange } from '../lib/dashboardDateRange'

export type RhythmMode = 'hourly' | 'weekday'
export type RhythmMetric = 'cost' | 'revenue' | 'conversions' | 'clicks' | 'impressions'

const METRIC_LABELS: Record<RhythmMetric, string> = {
  cost: 'Spend',
  revenue: 'Revenue',
  conversions: 'Conversions',
  clicks: 'Clicks',
  impressions: 'Impressions',
}

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

function bucketKey(isoUtc: string, zone: string, mode: RhythmMode): number {
  const d = new Date(isoUtc)
  if (mode === 'hourly') {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(d)
    const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0)
    return h
  }
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' }).format(d)
  const idx = WEEKDAY_LABELS.indexOf(wd)
  return idx >= 0 ? idx : 0
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
}: {
  rows: HourlyRow[]
  tzMode: 'utc' | 'browser' | 'account'
  accountTzHint?: string | null
  selectedClient: string
}) {
  const [mode, setMode] = useState<RhythmMode>('hourly')
  const [metric, setMetric] = useState<RhythmMetric>('cost')
  const [dateRange, setDateRange] = useState<CalendarDateRange>(() => defaultCalendarRangeLastNDays(7))

  const zone = resolveZone(tzMode, accountTzHint)

  const chartData = useMemo(() => {
    const filtered = rows.filter(r => {
      if (!dateRange.start || !dateRange.end) return true
      return r.date >= dateRange.start && r.date <= dateRange.end
    })

    if (mode === 'hourly') {
      const buckets = Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, '0')}:00`, value: 0 }))
      for (const r of filtered) {
        const iso = `${r.date}T${String(r.hour).padStart(2, '0')}:00:00.000Z`
        const h = bucketKey(iso, zone, 'hourly')
        buckets[h].value += Number(r[metric]) || 0
      }
      return buckets
    }

    const buckets = WEEKDAY_LABELS.map(label => ({ label, value: 0 }))
    for (const r of filtered) {
      const iso = `${r.date}T${String(r.hour).padStart(2, '0')}:00:00.000Z`
      const wd = bucketKey(iso, zone, 'weekday')
      buckets[wd].value += Number(r[metric]) || 0
    }
    return mode === 'weekday' ? buckets.slice(0, 5) : buckets
  }, [rows, mode, metric, dateRange, zone])

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Performance rhythm</h3>
          <p className="text-xs text-gray-500 mt-0.5 max-w-xl">
            {mode === 'hourly'
              ? `Hour-of-day totals (0–23) in ${zone}. Only hourly and weekday modes; buckets use UTC hour rows relabeled in your display timezone.`
              : `Weekday totals (Mon–Fri) in ${zone} across the selected calendar range.`}
            {selectedClient !== 'all' ? ' Filtered to selected client.' : ' All clients in scope.'}
          </p>
        </div>
        <AccountDateRangePicker dateRange={dateRange} onChange={setDateRange} className="shrink-0" />
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
            onClick={() => setMode('weekday')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium ${mode === 'weekday' ? 'bg-[var(--brand-600)] text-white' : 'text-gray-600'}`}
          >
            By weekday (Mon–Fri)
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
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => [v.toLocaleString(), METRIC_LABELS[metric]]} />
          <Legend />
          <Line type="monotone" dataKey="value" name={METRIC_LABELS[metric]} stroke="var(--brand-600)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

