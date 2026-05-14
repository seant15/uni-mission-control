import { useCallback, useMemo } from 'react'
import { useSearchParams, Navigate } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'
import MarketingOverview from './MarketingOverview'
import ClientsOverview from './ClientsOverview'
import DataAnalytics from './DataAnalytics'
import { useAuth } from '../contexts/AuthContext'
import { canAccessClientsByClientTab } from '../lib/rbac'

const TAB_IDS = ['all-clients', 'by-client', 'by-account'] as const
export type OverviewTabId = (typeof TAB_IDS)[number]

function isOverviewTab(v: string | null): v is OverviewTabId {
  return v !== null && (TAB_IDS as readonly string[]).includes(v)
}

export default function OverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { appUser } = useAuth()
  const showByClient = canAccessClientsByClientTab(appUser?.role)

  const tabParam = searchParams.get('tab')
  const tab: OverviewTabId = useMemo(() => {
    if (!isOverviewTab(tabParam)) return 'all-clients'
    if (tabParam === 'by-client' && !showByClient) return 'all-clients'
    return tabParam
  }, [tabParam, showByClient])

  const setTab = useCallback(
    (next: OverviewTabId) => {
      setSearchParams({ tab: next }, { replace: true })
    },
    [setSearchParams]
  )

  if (tabParam === 'by-client' && !showByClient) {
    return <Navigate to="/?tab=all-clients" replace />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-600 text-white">
            <LayoutDashboard size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Agency-wide, by client, or by ad account. All clients: use 24h–72h for rolling hourly windows (same grain as Real-time); 7d+ uses calendar days. By account keeps custom date range.
            </p>
          </div>
        </div>
        <div className="flex rounded-lg border border-gray-200 p-0.5 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setTab('all-clients')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              tab === 'all-clients' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            All clients
          </button>
          {showByClient && (
            <button
              type="button"
              onClick={() => setTab('by-client')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                tab === 'by-client' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              By client
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab('by-account')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              tab === 'by-account' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            By account
          </button>
        </div>
      </div>

      {tab === 'all-clients' && <MarketingOverview embedded />}
      {tab === 'by-client' && showByClient && <ClientsOverview embedded />}
      {tab === 'by-account' && <DataAnalytics embedded />}
    </div>
  )
}
