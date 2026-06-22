import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { db } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { canMutateAlerts } from '../lib/rbac'
import AlertSummaryBar from './Alerts/AlertSummaryBar'
import AlertFilterBar from './Alerts/AlertFilterBar'
import AlertGroupList from './Alerts/AlertGroupList'
import AlertColumnCustomizer from './Alerts/AlertColumnCustomizer'
import AlertRulesTab from './Alerts/AlertRulesTab'
import AbTestDeliveryTab from './Alerts/AbTestDeliveryTab'
import AlertSystemGuideLink from '../components/AlertSystemGuideLink'
import TabPageShell from '../components/ui/TabPageShell'
import type { TabNavItem } from '../components/ui/TabNav'
import DashboardSection from '../components/ui/DataTable'
import type {
  Alert,
  AlertGroup,
  AlertFilterState,
  AlertColumnDef,
} from '../types/alerts'
import { DEFAULT_ALERT_COLUMNS as DEFAULT_COLS } from '../types/alerts'

const PAGE_SIZE = 25
const TABS = ['Alerts', 'Alert Rules', 'A/B & delivery'] as const
type Tab = typeof TABS[number]

const TAB_NAV_ITEMS: TabNavItem[] = [
  { id: 'Alerts', label: 'Alerts' },
  { id: 'Alert Rules', label: 'Alert Rules' },
  { id: 'A/B & delivery', label: 'A/B & delivery' },
]

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
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(new Set())

  const canManageRules = canMutateAlerts(appUser?.role)

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

  useEffect(() => { setSelectedAlertIds(new Set()) }, [filters])

  // Supabase Realtime: refresh when new alerts come in
  useEffect(() => {
    const channel = supabase
      .channel('alerts-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
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

  const toggleBulkOne = useCallback((id: string) => {
    setSelectedAlertIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }, [])

  const toggleBulkMany = useCallback((ids: string[], select: boolean) => {
    setSelectedAlertIds(prev => {
      const n = new Set(prev)
      for (const id of ids) {
        if (select) n.add(id)
        else n.delete(id)
      }
      return n
    })
  }, [])

  const alertById = useMemo(() => {
    const m = new Map<string, Alert>()
    for (const g of groups) {
      for (const a of g.all_alerts) m.set(a.id, a)
    }
    return m
  }, [groups])

  const bulkCreateMissions = useMutation({
    mutationFn: async () => {
      if (!appUser?.id) throw new Error('Not signed in')
      let created = 0
      let skipped = 0
      for (const id of selectedAlertIds) {
        const alert = alertById.get(id)
        if (!alert) continue
        const existingId = await db.findMissionCardBySourceAlert(alert.id)
        if (existingId) {
          skipped++
          continue
        }
        const title = `${alert.account_name || 'Account'} — ${(alert.alert_type || 'alert').replace(/_/g, ' ')}`
        const body = [
          alert.message,
          alert.metric_name != null ? `${alert.metric_name}: ${alert.metric_value ?? ''} ${alert.metric_change ?? ''}`.trim() : '',
        ].filter(Boolean).join('\n\n')
        await db.createMissionCard({
          title,
          body,
          client_id: alert.client_id ?? null,
          platform: alert.platform ?? null,
          priority: alert.severity === 'critical' ? 'critical' : alert.severity === 'high' ? 'high' : alert.severity === 'low' ? 'low' : 'medium',
          source_alert_id: alert.id,
          created_by: appUser.id,
        })
        created++
      }
      return { created, skipped }
    },
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['mission_cards'] })
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      setSelectedAlertIds(new Set())
      toast.success(`Created ${res.created} mission card(s)${res.skipped ? ` · ${res.skipped} already had a card` : ''}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bulkDismiss = useMutation({
    mutationFn: async () => {
      if (!appUser?.id) throw new Error('Not signed in')
      await Promise.all([...selectedAlertIds].map(id => db.dismissAlert(id, appUser.id)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alert-counts'] })
      queryClient.invalidateQueries({ queryKey: ['alert-open-count'] })
      setSelectedAlertIds(new Set())
      toast.success('Archived (dismissed) selected alerts')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const bulkDelete = useMutation({
    mutationFn: async () => {
      await Promise.all([...selectedAlertIds].map(id => db.deleteAlert(id)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alert-counts'] })
      queryClient.invalidateQueries({ queryKey: ['alert-open-count'] })
      setSelectedAlertIds(new Set())
      toast.success('Deleted selected alerts')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const alertTabs = TAB_NAV_ITEMS.filter(t => t.id === 'Alerts' || canManageRules)

  return (
    <TabPageShell
      title="Alerts"
      subtitle="Performance monitoring across all clients"
      tabs={alertTabs}
      activeTabId={activeTab}
      onTabChange={id => setActiveTab(id as Tab)}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end -mt-2">
        <p className="text-xs text-gray-500 sm:mr-auto max-w-md leading-snug hidden sm:block">
          Architecture, severities, engines, and tuning — opens in a new tab (read-only).
        </p>
        <AlertSystemGuideLink variant="page" />
      </div>

      {activeTab === 'Alerts' ? (
        <>
          {/* Summary stats */}
          <AlertSummaryBar />

          {/* Filter bar */}
          <AlertFilterBar filters={filters} onChange={setFilters} />

          {canManageRules && selectedAlertIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/95 shadow-sm px-4 py-3 text-sm text-gray-800">
              <span className="font-medium">{selectedAlertIds.size} selected</span>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                disabled={bulkCreateMissions.isPending}
                onClick={() => bulkCreateMissions.mutate()}
                className="px-3 py-1.5 rounded-lg bg-[var(--brand-600)] text-white text-xs font-medium hover:bg-[var(--brand-700)] disabled:opacity-50"
              >
                Create missions
              </button>
              <button
                type="button"
                disabled={bulkDismiss.isPending}
                onClick={() => {
                  if (!window.confirm(`Archive (dismiss) ${selectedAlertIds.size} alert(s)?`)) return
                  bulkDismiss.mutate()
                }}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Archive
              </button>
              <button
                type="button"
                disabled={bulkDelete.isPending}
                onClick={() => {
                  if (!window.confirm(`Permanently delete ${selectedAlertIds.size} alert(s)? This cannot be undone.`)) return
                  bulkDelete.mutate()
                }}
                className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs font-medium hover:bg-red-100 disabled:opacity-50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setSelectedAlertIds(new Set())}
                className="ml-auto text-xs text-gray-500 hover:text-gray-800 underline"
              >
                Clear selection
              </button>
            </div>
          )}

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
            <DashboardSection bodyClassName="animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-[var(--uni-border)]">
                  <div className="h-5 w-16 bg-[var(--uni-border)] rounded-full" />
                  <div className="h-4 w-28 bg-[var(--uni-border)] rounded" />
                  <div className="h-4 flex-1 bg-[var(--uni-border)] rounded" />
                  <div className="h-5 w-14 bg-[var(--uni-border)] rounded-full" />
                </div>
              ))}
            </DashboardSection>
          )}

          {/* Alert group list */}
          {!isLoading && (
            <AlertGroupList
              groups={groups}
              currentUserId={appUser?.id ?? ''}
              currentUserRole={appUser?.role ?? 'client_user'}
              visibleColumns={visibleColumns}
              readOnly={!canManageRules}
              bulkSelection={canManageRules ? selectedAlertIds : undefined}
              onBulkToggleOne={canManageRules ? toggleBulkOne : undefined}
              onBulkToggleMany={canManageRules ? toggleBulkMany : undefined}
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
      ) : activeTab === 'Alert Rules' ? (
        <AlertRulesTab currentUserId={appUser?.id ?? ''} />
      ) : (
        <AbTestDeliveryTab currentUserId={appUser?.id ?? ''} />
      )}
    </TabPageShell>
  )
}
