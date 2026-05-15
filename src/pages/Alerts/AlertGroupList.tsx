import { useState, useMemo, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Layers, LayoutGrid, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '../../lib/api'
import { canMutateAlerts } from '../../lib/rbac'
import AlertActionPanel from './AlertActionPanel'
import type { AlertGroup, Alert, AlertSeverity, AlertStatus } from '../../types/alerts'

interface Props {
  groups: AlertGroup[]
  currentUserId: string
  currentUserRole: string
  visibleColumns: string[]
  readOnly?: boolean
  /** When set with callbacks, shows a leading checkbox column for bulk actions */
  bulkSelection?: Set<string>
  onBulkToggleOne?: (id: string) => void
  onBulkToggleMany?: (ids: string[], select: boolean) => void
}

const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-yellow-100 text-yellow-700',
  low:      'bg-blue-100 text-blue-700',
}

const STATUS_BADGE: Record<AlertStatus, string> = {
  new:          'bg-amber-100 text-amber-950 ring-2 ring-amber-400/90 font-semibold uppercase tracking-wide',
  in_progress:  'bg-blue-50 text-blue-700',
  snoozed:      'bg-amber-50 text-amber-700',
  resolved:     'bg-green-50 text-green-700',
  ignored:      'bg-gray-50 text-gray-500',
  dismissed:    'bg-slate-50 text-slate-500',
}

const PLATFORM_LABEL: Record<string, string> = {
  google_ads: 'Google',
  meta_ads:   'Meta',
  tiktok_ads: 'TikTok',
  all:        'All',
}

const PLATFORM_COLOR: Record<string, string> = {
  google_ads: 'bg-blue-100 text-blue-700',
  meta_ads:   'bg-indigo-100 text-indigo-700',
}

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return `${Math.round(diff)}s ago`
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

interface AlertRowProps {
  alert: Alert
  currentUserId: string
  currentUserRole: string
  visibleColumns: string[]
  readOnly?: boolean
  showBulk?: boolean
  bulkSelected?: boolean
  onBulkToggle?: (id: string) => void
  totalColumns: number
}

function missionPriorityFromSeverity(sev: string): 'low' | 'medium' | 'high' | 'critical' {
  if (sev === 'critical') return 'critical'
  if (sev === 'high') return 'high'
  if (sev === 'low') return 'low'
  return 'medium'
}

function SingleAlertRow({
  alert,
  currentUserId,
  currentUserRole,
  visibleColumns,
  readOnly,
  showBulk,
  bulkSelected,
  onBulkToggle,
  totalColumns,
}: AlertRowProps) {
  const [expanded, setExpanded] = useState(false)
  const queryClient = useQueryClient()
  const canQuick = !readOnly && canMutateAlerts(currentUserRole) && !!currentUserId

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['alerts'] })
    queryClient.invalidateQueries({ queryKey: ['alert-counts'] })
    queryClient.invalidateQueries({ queryKey: ['alert-open-count'] })
  }

  const missionQuick = useMutation({
    mutationFn: async () => {
      const existingId = await db.findMissionCardBySourceAlert(alert.id)
      if (existingId) return { existingId, created: false as const }
      const title = `${alert.account_name || 'Account'} — ${(alert.alert_type || 'alert').replace(/_/g, ' ')}`
      const body = [
        alert.message,
        alert.metric_name != null ? `${alert.metric_name}: ${alert.metric_value ?? ''} ${alert.metric_change ?? ''}`.trim() : '',
      ].filter(Boolean).join('\n\n')
      const row = await db.createMissionCard({
        title,
        body,
        client_id: alert.client_id ?? null,
        platform: alert.platform ?? null,
        priority: missionPriorityFromSeverity(alert.severity),
        source_alert_id: alert.id,
        created_by: currentUserId,
      })
      return { existingId: row.id, created: true as const }
    },
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['mission_cards'] })
      if (res.created) toast.success('Mission card created')
      else toast.message('Card already exists', { description: 'Open Mission Board to view it.' })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteQuick = useMutation({
    mutationFn: () => db.deleteAlert(alert.id),
    onSuccess: () => {
      invalidate()
      toast.success('Alert deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {showBulk && (
          <td className="px-2 py-3 w-10 align-middle" onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              className="rounded border-gray-300 text-[var(--brand-600)] focus:ring-[var(--brand-500)]"
              checked={!!bulkSelected}
              onChange={() => onBulkToggle?.(alert.id)}
              aria-label={`Select alert ${alert.id}`}
            />
          </td>
        )}
        {visibleColumns.includes('severity') && (
          <td className="px-4 py-3">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${SEVERITY_BADGE[alert.severity]}`}>
              {alert.severity}
            </span>
          </td>
        )}
        {visibleColumns.includes('account') && (
          <td className="px-4 py-3">
            <div className="text-sm font-medium text-gray-800">{alert.account_name || '—'}</div>
            {alert.platform && (
              <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${PLATFORM_COLOR[alert.platform] || 'bg-gray-100 text-gray-600'}`}>
                {PLATFORM_LABEL[alert.platform] || alert.platform}
              </span>
            )}
          </td>
        )}
        {visibleColumns.includes('platform') && (
          <td className="px-4 py-3">
            {alert.platform && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLATFORM_COLOR[alert.platform] || 'bg-gray-100 text-gray-600'}`}>
                {PLATFORM_LABEL[alert.platform] || alert.platform}
              </span>
            )}
          </td>
        )}
        {visibleColumns.includes('type') && (
          <td className="px-4 py-3 text-xs text-gray-500 capitalize">
            {(alert.alert_type || '—').replace(/_/g, ' ')}
          </td>
        )}
        {visibleColumns.includes('message') && (
          <td className="px-4 py-3">
            <p className="text-sm text-gray-700 line-clamp-2 max-w-sm">{alert.message}</p>
            {alert.metric_name && (
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-400">
                <span>{alert.metric_name}:</span>
                {alert.metric_value != null && <span className="font-medium text-gray-600">{alert.metric_value}</span>}
                {alert.metric_change && <span className="text-red-500">{alert.metric_change}</span>}
              </div>
            )}
          </td>
        )}
        {visibleColumns.includes('detected') && (
          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap" title={alert.created_at}>
            {relativeTime(alert.created_at)}
          </td>
        )}
        {visibleColumns.includes('status') && (
          <td className="px-4 py-3">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[alert.status]}`}>
              {alert.status.replace('_', ' ')}
            </span>
          </td>
        )}
        {visibleColumns.includes('assigned') && (
          <td className="px-4 py-3 text-xs text-gray-400">
            {alert.assigned_to ? '👤 Assigned' : '—'}
          </td>
        )}
        {visibleColumns.includes('actions') && (
          <td className="px-4 py-3 w-[1%] whitespace-nowrap" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-end gap-0.5">
              {canQuick && (
                <>
                  <button
                    type="button"
                    title="Create mission from this alert"
                    onClick={() => missionQuick.mutate()}
                    disabled={missionQuick.isPending}
                    className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 disabled:opacity-40"
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    type="button"
                    title="Delete alert"
                    onClick={() => {
                      if (!window.confirm('Permanently delete this alert?')) return
                      deleteQuick.mutate()
                    }}
                    disabled={deleteQuick.isPending}
                    className="p-1.5 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
              <button
                type="button"
                className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100"
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse row' : 'Expand row'}
                onClick={() => setExpanded(e => !e)}
              >
                <ChevronDown
                  size={16}
                  className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          </td>
        )}
      </tr>
      {expanded && (
        <tr>
          <td colSpan={totalColumns} className="p-0">
            <AlertActionPanel
              alert={alert}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              readOnly={readOnly}
            />
          </td>
        </tr>
      )}
    </>
  )
}

interface GroupRowProps {
  group: AlertGroup
  currentUserId: string
  currentUserRole: string
  visibleColumns: string[]
  readOnly?: boolean
  showBulk?: boolean
  bulkSelection?: Set<string>
  onBulkToggleOne?: (id: string) => void
  onBulkToggleMany?: (ids: string[], select: boolean) => void
  totalColumns: number
}

function GroupRow({
  group,
  currentUserId,
  currentUserRole,
  visibleColumns,
  readOnly,
  showBulk,
  bulkSelection,
  onBulkToggleOne,
  onBulkToggleMany,
  totalColumns,
}: GroupRowProps) {
  const [expanded, setExpanded] = useState(false)
  const rep = group.representative
  const groupIds = useMemo(() => group.all_alerts.map(a => a.id), [group.all_alerts])
  const allGroupSelected = !!(showBulk && groupIds.length > 0 && groupIds.every(id => bulkSelection?.has(id)))
  const someGroupSelected = !!(showBulk && groupIds.some(id => bulkSelection?.has(id)))
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const el = headerCheckboxRef.current
    if (!el) return
    el.indeterminate = someGroupSelected && !allGroupSelected
  }, [someGroupSelected, allGroupSelected])

  if (group.count === 1) {
    return (
      <SingleAlertRow
        alert={rep}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        visibleColumns={visibleColumns}
        readOnly={readOnly}
        showBulk={showBulk}
        bulkSelected={bulkSelection?.has(rep.id)}
        onBulkToggle={onBulkToggleOne}
        totalColumns={totalColumns}
      />
    )
  }

  return (
    <>
      {/* Group header row */}
      <tr
        className="hover:bg-blue-50/30 cursor-pointer transition-colors bg-slate-50/50"
        onClick={() => setExpanded(e => !e)}
      >
        {showBulk && (
          <td className="px-2 py-3 w-10 align-middle" onClick={e => e.stopPropagation()}>
            <input
              ref={headerCheckboxRef}
              type="checkbox"
              className="rounded border-gray-300 text-[var(--brand-600)] focus:ring-[var(--brand-500)]"
              checked={!!allGroupSelected}
              onChange={() => onBulkToggleMany?.(groupIds, !allGroupSelected)}
              aria-label="Select all alerts in this group"
            />
          </td>
        )}
        {visibleColumns.includes('severity') && (
          <td className="px-4 py-3">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${SEVERITY_BADGE[rep.severity]}`}>
              {rep.severity}
            </span>
          </td>
        )}
        {visibleColumns.includes('account') && (
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="text-sm font-medium text-gray-800">{rep.account_name || '—'}</div>
                {/* Stacked card visual indicator */}
                <div className="absolute -bottom-1 -right-1 flex gap-0.5">
                  {[...Array(Math.min(group.count - 1, 3))].map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 opacity-60" />
                  ))}
                </div>
              </div>
              <span className="flex items-center gap-1 bg-slate-700 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                <Layers size={10} /> {group.count}
              </span>
            </div>
            {rep.platform && (
              <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${PLATFORM_COLOR[rep.platform] || 'bg-gray-100 text-gray-600'}`}>
                {PLATFORM_LABEL[rep.platform] || rep.platform}
              </span>
            )}
          </td>
        )}
        {visibleColumns.includes('platform') && (
          <td className="px-4 py-3">
            {rep.platform && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLATFORM_COLOR[rep.platform] || 'bg-gray-100 text-gray-600'}`}>
                {PLATFORM_LABEL[rep.platform] || rep.platform}
              </span>
            )}
          </td>
        )}
        {visibleColumns.includes('type') && (
          <td className="px-4 py-3 text-xs text-gray-500 capitalize">
            {(rep.alert_type || '—').replace(/_/g, ' ')}
          </td>
        )}
        {visibleColumns.includes('message') && (
          <td className="px-4 py-3">
            <p className="text-sm text-gray-700 line-clamp-2 max-w-sm">{rep.message}</p>
            <span className="text-xs text-gray-400 mt-0.5">{group.count} alerts in this group</span>
          </td>
        )}
        {visibleColumns.includes('detected') && (
          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
            {relativeTime(rep.created_at)}
          </td>
        )}
        {visibleColumns.includes('status') && (
          <td className="px-4 py-3">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[rep.status]}`}>
              {rep.status.replace('_', ' ')}
            </span>
          </td>
        )}
        {visibleColumns.includes('assigned') && (
          <td className="px-4 py-3 text-xs text-gray-400">
            {rep.assigned_to ? '👤 Assigned' : '—'}
          </td>
        )}
        {visibleColumns.includes('actions') && (
          <td className="px-4 py-3 w-[1%]" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100"
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse group' : 'Expand group'}
              onClick={() => setExpanded(e => !e)}
            >
              <ChevronRight
                size={16}
                className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
              />
            </button>
          </td>
        )}
      </tr>

      {/* Expanded: show all alerts in the group */}
      {expanded && group.all_alerts.map(alert => (
        <SingleAlertRow
          key={alert.id}
          alert={alert}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          visibleColumns={visibleColumns}
          readOnly={readOnly}
          showBulk={showBulk}
          bulkSelected={bulkSelection?.has(alert.id)}
          onBulkToggle={onBulkToggleOne}
          totalColumns={totalColumns}
        />
      ))}
    </>
  )
}

export default function AlertGroupList({
  groups,
  currentUserId,
  currentUserRole,
  visibleColumns,
  readOnly = false,
  bulkSelection,
  onBulkToggleOne,
  onBulkToggleMany,
}: Props) {
  const showBulk = !readOnly && !!bulkSelection && !!onBulkToggleOne && !!onBulkToggleMany
  const totalColumns = visibleColumns.length + (showBulk ? 1 : 0)
  const pageAlertIds = useMemo(() => groups.flatMap(g => g.all_alerts.map(a => a.id)), [groups])
  const allPageSelected = !!(showBulk && pageAlertIds.length > 0 && pageAlertIds.every(id => bulkSelection!.has(id)))
  const somePageSelected = !!(showBulk && pageAlertIds.some(id => bulkSelection!.has(id)))
  const pageCheckboxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const el = pageCheckboxRef.current
    if (!el) return
    el.indeterminate = somePageSelected && !allPageSelected
  }, [somePageSelected, allPageSelected, showBulk])
  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">All clear</h3>
        <p className="text-sm text-gray-500">No alerts match your current filters.</p>
      </div>
    )
  }

  const COLUMN_HEADERS: Record<string, string> = {
    severity: 'Severity',
    account:  'Account',
    platform: 'Platform',
    type:     'Type',
    message:  'Description',
    detected: 'Detected',
    status:   'Status',
    assigned: 'Assigned',
    actions:  '',
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {showBulk && (
              <th className="px-2 py-3 w-10 text-left">
                <input
                  ref={pageCheckboxRef}
                  type="checkbox"
                  className="rounded border-gray-300 text-[var(--brand-600)] focus:ring-[var(--brand-500)]"
                  checked={!!allPageSelected}
                  onChange={() => onBulkToggleMany(pageAlertIds, !allPageSelected)}
                  title="Select all on this page"
                  aria-label="Select all alerts on this page"
                />
              </th>
            )}
            {visibleColumns.map(col => (
              <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {COLUMN_HEADERS[col] ?? col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {groups.map(group => (
            <GroupRow
              key={group.group_key}
              group={group}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              visibleColumns={visibleColumns}
              readOnly={readOnly}
              showBulk={showBulk}
              bulkSelection={bulkSelection}
              onBulkToggleOne={onBulkToggleOne}
              onBulkToggleMany={onBulkToggleMany}
              totalColumns={totalColumns}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
