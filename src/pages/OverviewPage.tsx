import { useCallback, useMemo } from 'react'
import { useSearchParams, Navigate } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'
import MarketingOverview from './MarketingOverview'
import DataAnalytics from './DataAnalytics'

const TAB_IDS = ['agency', 'heated'] as const
export type OverviewTabId = (typeof TAB_IDS)[number]

function isOverviewTab(v: string | null): v is OverviewTabId {
  return v !== null && (TAB_IDS as readonly string[]).includes(v)
}

/** Map legacy ?tab= values to current ids. */
function normalizeOverviewTabParam(raw: string | null): OverviewTabId {
  if (raw === 'heated' || raw === 'agency') return raw
  if (raw === 'by-account') return 'heated'
  if (raw === 'all-clients' || raw === 'by-client') return 'agency'
  if (!raw || !isOverviewTab(raw)) return 'agency'
  return 'agency'
}

export default function OverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const normalized = useMemo(() => normalizeOverviewTabParam(tabParam), [tabParam])

  if (tabParam === 'all-clients' || tabParam === 'by-client' || tabParam === 'by-account') {
    return <Navigate to={`/?tab=${normalized}`} replace />
  }

  const tab = normalized

  const setTab = useCallback(
    (next: OverviewTabId) => {
      setSearchParams({ tab: next }, { replace: true })
    },
    [setSearchParams]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-[var(--brand-600)] text-white shrink-0">
            <LayoutDashboard size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Overview</h1>
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">
              Agency View rolls up clients, platforms, and daily breakdown. Heated View is account-level performance. Same calendar everywhere.
            </p>
          </div>
        </div>
        <div className="flex rounded-lg border border-gray-200 p-0.5 bg-white shadow-sm shrink-0">
          <button
            type="button"
            onClick={() => setTab('agency')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
              tab === 'agency' ? 'bg-[var(--brand-600)] text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Agency View
          </button>
          <button
            type="button"
            onClick={() => setTab('heated')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
              tab === 'heated' ? 'bg-[var(--brand-600)] text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Heated View
          </button>
        </div>
      </div>

      {tab === 'agency' && <MarketingOverview embedded showAgencyExtras />}
      {tab === 'heated' && <DataAnalytics embedded />}
    </div>
  )
}
