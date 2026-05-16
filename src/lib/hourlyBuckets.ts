/**
 * Hourly rhythm bucketing for `hourly_performance`.
 *
 * Warehouse contract (sync_hourly_performance.py v2):
 * - `date` + `hour` = UTC calendar bucket start
 * - `account_local_hour` = clock hour (0–23) in `account_timezone` for that UTC bucket
 * - `account_timezone` = IANA id when known (`advertiser_tz` = Meta placeholder → treat as unknown)
 */

export type HourlyPerfRow = {
  date: string
  hour: number | string
  account_local_hour?: number | string | null
  account_timezone?: string | null
}

export const AGENCY_REPORTING_TZ = 'America/Phoenix'

export function normalizeAccountTimezone(raw: string | null | undefined): string | null {
  const t = String(raw || '').trim()
  if (!t || t === 'advertiser_tz') return null
  try {
    Intl.DateTimeFormat('en-US', { timeZone: t })
    return t
  } catch {
    return null
  }
}

/** UTC instant for warehouse row (date + hour are UTC buckets). */
export function hourlyRowUtcMs(row: HourlyPerfRow): number {
  const h = Number(row.hour)
  if (!row.date || Number.isNaN(h) || h < 0 || h > 23) return NaN
  return Date.parse(`${row.date}T${String(h).padStart(2, '0')}:00:00.000Z`)
}

export function hourInTimeZone(utcMs: number, zone: string): number {
  if (!Number.isFinite(utcMs)) return -1
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date(utcMs))
  const hi = Number(parts.find(p => p.type === 'hour')?.value ?? -1)
  return hi >= 0 && hi < 24 ? hi : -1
}

export function weekdayIndexInTimeZone(utcMs: number, zone: string): number {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
  if (!Number.isFinite(utcMs)) return 0
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' }).format(
    new Date(utcMs),
  )
  const idx = labels.indexOf(wd as (typeof labels)[number])
  return idx >= 0 ? idx : 0
}

/** Pick display zone: explicit hint → single-account consensus → agency default. */
export function resolveRhythmDisplayZone(
  rows: HourlyPerfRow[],
  opts: { hint?: string | null; fallback?: string },
): string {
  const fallback = opts.fallback ?? AGENCY_REPORTING_TZ
  const hinted = normalizeAccountTimezone(opts.hint)
  if (hinted) return hinted

  const counts = new Map<string, number>()
  for (const r of rows) {
    const tz = normalizeAccountTimezone(r.account_timezone)
    if (!tz) continue
    counts.set(tz, (counts.get(tz) ?? 0) + 1)
  }
  if (counts.size === 1) return [...counts.keys()][0]!
  if (counts.size > 1) return fallback
  return fallback
}

/**
 * Map one row to a 0–23 display-hour bucket.
 * When the row's account TZ matches the display zone, prefer `account_local_hour` (sync denormalized).
 */
export function rhythmBucketHour(row: HourlyPerfRow, displayZone: string): number {
  const acctTz = normalizeAccountTimezone(row.account_timezone)
  const localH = row.account_local_hour != null ? Number(row.account_local_hour) : NaN
  if (acctTz && acctTz === displayZone && !Number.isNaN(localH) && localH >= 0 && localH < 24) {
    return localH
  }
  return hourInTimeZone(hourlyRowUtcMs(row), displayZone)
}

export function rhythmBucketWeekday(row: HourlyPerfRow, displayZone: string): number {
  return weekdayIndexInTimeZone(hourlyRowUtcMs(row), displayZone)
}

export function rhythmTimezoneFootnote(displayZone: string, rows: HourlyPerfRow[]): string {
  const acctTzs = new Set<string>()
  let hasLocalHour = false
  for (const r of rows) {
    const tz = normalizeAccountTimezone(r.account_timezone)
    if (tz) acctTzs.add(tz)
    if (r.account_local_hour != null) hasLocalHour = true
  }
  if (acctTzs.size === 1 && [...acctTzs][0] === displayZone && hasLocalHour) {
    return `Clock hours in ${displayZone} (warehouse UTC buckets + account-local hour).`
  }
  if (acctTzs.size > 1) {
    return `Mixed account timezones (${[...acctTzs].slice(0, 3).join(', ')}${acctTzs.size > 3 ? ', …' : ''}); chart rolled up in ${displayZone} from UTC buckets.`
  }
  return `UTC hour buckets in the warehouse, displayed in ${displayZone}.`
}
