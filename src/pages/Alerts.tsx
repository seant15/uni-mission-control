import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import AlertSummaryBar from './Alerts/AlertSummaryBar'
import AlertFilterBar from './Alerts/AlertFilterBar'
import AlertGroupList from './Alerts/AlertGroupList'
import AlertColumnCustomizer from './Alerts/AlertColumnCustomizer'
import AlertRulesTab from './Alerts/AlertRulesTab'
import type {
  Alert,
  AlertGroup,
  AlertFilterState,
  AlertColumnDef,
} from '../types/alerts'
import { DEFAULT_ALERT_COLUMNS as DEFAULT_COLS } from '../types/alerts'

const PAGE_SIZE = 25
const TABS = ['Alerts', 'Alert Rules'] as const
type Tab = typeof TABS[number]

// Group alerts by group_key (client-side)
function groupAlerts(alerts: Alert[]): AlertGroup[] {
  const map = new Map<string, Alert[]>()

  for (const alert of alerts) {
    const key = alert.group_key || `__ungrouped_${alert.id}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(alert)
  }

  return Array.from(map.entries()).map(([group_key, all_alerts]) => {
    // Sort within group: critical first, then by created_at desc
    const sorted = [...all_alerts].sort((a, b) => {
      const sev = { critical: 0, high: 1, medium: 2, low: 3 }
      const diff = (sev[a.severity] ?? 4) - (sev[b.severity] ?? 4)
      if (diff !== 0) return diff
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return {
      group_key,
      representative: sorted[0],
      all_alerts: sorted,
      count: sorted.length,
    }
  })
}

export default function Alerts() {
  const { appUser } = useAuth()
  const queryClient = useQueryClient()

  const [activeTab,    setActiveTab]    = useState<Tab>('Alerts')
  const [filters,      setFilters]      = useState<AlertFilterState>({
    severity: [], status: [], platform: [], clientId: [],
    search: '', dateRange: null, assignedToMe: false,
  })
  const [page,         setPage]         = useState(1)
  const [columns,      setColumns]      = useState<AlertColumnDef[]>(DEFAULT_COLS)

  const isAdmin = ['super_admin', 'team_member'].includes(appUser?.role ?? '')

  // Load saved column preferences on mount
  useEffect(() => {
    if (!appUser?.id) return
    db.getAlertColumnPreferences(appUser.id).then(saved => {
      if (saved && saved.length > 0) setColumns(saved)
    }).catch(() => {/* use defaults */})
  }, [appUser?.id])

  // Save column preferences (debounced)
  const saveColTimeout = useRef<ReturnType<typeof setTimeout>>()
  function handleColumnsChange(next: AlertColumnDef[]) {
    setColumns(next)
    if (!appUser?.id) return
    clearTimeout(saveColTimeout.current)
    saveColTimeout.current = setTimeout(() => {
      db.saveAlertColumnPreferences(appUser.id, next)
    }, 500)
  }

  // Fetch paginated alerts
  const { data, isLoading, error } = useQuery({
    queryKey: ['alerts', filters, page],
    queryFn:  () => db.getAlerts(filters, page, PAGE_SIZE),
    placeholderData: prev => prev,
  })

  const alerts = data?.data ?? []
  const totalCount = data?.count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [filters])

  // Supabase Realtime: refresh when new alerts come in
  useEffect(() => {
    const channel = supabase
      .channel('alerts-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['alerts'] })
          queryClient.invalidateQueries({ queryKey: ['alert-counts'] })
          queryClient.invalidateQueries({ queryKey: ['alert-open-count'] })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  const groups = groupAlerts(alerts)
  const visibleColumns = columns.filter(c => c.visible).map(c => c.key)

  return (
    <div className="space-y-5">
      {/* Page header + tabs */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
          <p className="text-sm text-gray-400 mt-0.5">Performance monitoring across all clients</p>
        </div>
        <div className="flex border-b border-gray-200">
          {TABS.filter(t => t === 'Alerts' || isAdmin).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Alerts' ? (
        <>
          {/* Summary stats */}
          <AlertSummaryBar />

          {/* Filter bar */}
          <AlertFilterBar filters={filters} onChange={setFilters} />

          {/* Table header: count + column customizer */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {isLoading ? 'Loading…' : `${totalCount} alert${totalCount !== 1 ? 's' : ''}`}
              {totalCount > 0 && ` · Page ${page} of ${totalPages}`}
            </span>
            <AlertColumnCustomizer columns={columns} onChange={handleColumnsChange} />
          </div>

          {/* Error state */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              Failed to load alerts: {(error as Error).message}
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-gray-50">
                  <div className="h-5 w-16 bg-gray-100 rounded-full" />
                  <div className="h-4 w-28 bg-gray-100 rounded" />
                  <div className="h-4 flex-1 bg-gray-100 rounded" />
                  <div className="h-5 w-14 bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          )}

          {/* Alert group list */}
          {!isLoading && (
            <AlertGroupList
              groups={groups}
              currentUserId={appUser?.id ?? ''}
              currentUserRole={appUser?.role ?? 'client_user'}
              visibleColumns={visibleColumns}
            />
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        /* Alert Rules tab */
        <AlertRulesTab currentUserId={appUser?.id ?? ''} />
      )}
    </div>
  )
}
