import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { db } from '../lib/api'
import RealtimeRhythmChart from './RealtimeRhythmChart'
import type { CalendarDateRange } from '../lib/dashboardDateRange'
import { AGENCY_REPORTING_TZ, resolveRhythmDisplayZone } from '../lib/hourlyBuckets'

type Props = {
  dateRange: CalendarDateRange
  selectedClient: string
  selectedPlatform: string
  scopedClientId?: string
  /** IANA zone for chart labels (default agency reporting TZ). */
  displayZone?: string
  accountTzHint?: string | null
  /** Paid ads only (Heated View) — matches daily KPI scope. */
  adsOnly?: boolean
  /** Period ROAS from daily paid-ads rows (matches top KPI); overrides hourly-derived period line. */
  periodRoasKpi?: number
}

export default function PerformanceRhythmSection({
  dateRange,
  selectedClient,
  selectedPlatform,
  scopedClientId,
  displayZone: displayZoneProp,
  accountTzHint,
  adsOnly = false,
  periodRoasKpi,
}: Props) {
  const clientId = scopedClientId || (selectedClient !== 'all' ? selectedClient : 'all')

  const { data: hourlyRows = [], isLoading, error } = useQuery({
    queryKey: [
      'rhythm_hourly_range',
      dateRange.start,
      dateRange.end,
      clientId,
      selectedPlatform,
      scopedClientId ?? '',
      adsOnly ? 'ads' : 'all',
    ],
    queryFn: () =>
      db.getHourlyPerformanceForDateRange({
        startDate: dateRange.start!,
        endDate: dateRange.end!,
        clientId,
        scopedClientId: scopedClientId || undefined,
        platform: selectedPlatform !== 'all' ? selectedPlatform : undefined,
        adsOnly,
      }),
    enabled: !!dateRange.start && !!dateRange.end,
    staleTime: 60_000,
  })

  const busy = isLoading && hourlyRows.length === 0

  const displayZone = useMemo(
    () =>
      displayZoneProp ??
      resolveRhythmDisplayZone(hourlyRows, {
        hint: accountTzHint,
        fallback: AGENCY_REPORTING_TZ,
      }),
    [hourlyRows, displayZoneProp, accountTzHint],
  )

  return (
    <div className="relative min-h-[200px]">
      {busy && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-white/90 backdrop-blur-[2px] border border-gray-200"
          aria-live="polite"
        >
          <Loader2 className="w-8 h-8 text-[var(--brand-600)] animate-spin mb-2" />
          <p className="text-sm font-medium text-gray-700">Loading rhythm data…</p>
          <p className="text-xs text-gray-500 mt-0.5">Pulling hourly rows for the selected range</p>
        </div>
      )}
      {error && (
        <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {(error as Error).message}
        </div>
      )}
      <RealtimeRhythmChart
        rows={hourlyRows}
        displayZone={displayZone}
        accountTzHint={accountTzHint}
        selectedClient={selectedClient}
        dateRange={dateRange}
        dimmed={busy}
        periodRoasKpi={periodRoasKpi}
      />
    </div>
  )
}
