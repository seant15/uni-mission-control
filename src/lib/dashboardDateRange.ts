/**
 * Shared calendar date presets aligned with Overview → By account (DataAnalytics).
 */

export type CalendarDateRange = { start: string; end: string }

export type AccountDatePreset =
  | { label: string; days: number }
  | { label: string; type: 'month' | 'last_month' | 'this_year' | 'last_year' }

export const ACCOUNT_DATE_PRESETS: AccountDatePreset[] = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 14 Days', days: 14 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'This Month', type: 'month' },
  { label: 'Last Month', type: 'last_month' },
  { label: 'This Year', type: 'this_year' },
  { label: 'Last Year', type: 'last_year' },
]

export function applyAccountDatePreset(preset: AccountDatePreset): CalendarDateRange {
  const end = new Date()
  const start = new Date()
  if ('type' in preset) {
    if (preset.type === 'month') {
      start.setDate(1)
    } else if (preset.type === 'last_month') {
      start.setMonth(start.getMonth() - 1)
      start.setDate(1)
      end.setDate(0)
    } else if (preset.type === 'this_year') {
      start.setMonth(0)
      start.setDate(1)
    } else if (preset.type === 'last_year') {
      start.setFullYear(start.getFullYear() - 1)
      start.setMonth(0)
      start.setDate(1)
      end.setFullYear(end.getFullYear() - 1)
      end.setMonth(11)
      end.setDate(31)
    }
  } else {
    start.setDate(end.getDate() - preset.days)
  }
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

/** Inclusive day span between start and end (date strings yyyy-mm-dd). */
export function calendarRangeInclusiveDays(startStr: string, endStr: string): number {
  const start = new Date(startStr)
  const end = new Date(endStr)
  const ms = end.getTime() - start.getTime()
  return Math.round(ms / 86400000) + 1
}

/** Prior window with the same inclusive length, ending the day before `start`. */
export function previousComparableCalendarRange(cur: CalendarDateRange): CalendarDateRange {
  const span = calendarRangeInclusiveDays(cur.start, cur.end)
  const start = new Date(cur.start)
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - span + 1)
  return {
    start: prevStart.toISOString().split('T')[0],
    end: prevEnd.toISOString().split('T')[0],
  }
}

export function defaultCalendarRangeLastNDays(days: number): CalendarDateRange {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}
