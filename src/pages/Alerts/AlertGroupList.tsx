import { useState } from 'react'
import { ChevronDown, ChevronRight, Layers } from 'lucide-react'
import AlertActionPanel from './AlertActionPanel'
import type { AlertGroup, Alert, AlertSeverity, AlertStatus } from '../../types/alerts'

interface Props {
  groups: AlertGroup[]
  currentUserId: string
  currentUserRole: string
  visibleColumns: string[]
}

const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-yellow-100 text-yellow-700',
  low:      'bg-blue-100 text-blue-700',
}

const STATUS_BADGE: Record<AlertStatus, string> = {
  new:          'bg-red-50 text-red-700',
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
}

function SingleAlertRow({ alert, currentUserId, currentUserRole, visibleColumns }: AlertRowProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
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
          <td className="px-4 py-3">
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </td>
        )}
      </tr>
      {expanded && (
        <tr>
          <td colSpan={visibleColumns.length + 1} className="p-0">
            <AlertActionPanel
              alert={alert}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
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
}

function GroupRow({ group, currentUserId, currentUserRole, visibleColumns }: GroupRowProps) {
  const [expanded, setExpanded] = useState(false)
  const rep = group.representative

  if (group.count === 1) {
    return (
      <SingleAlertRow
        alert={rep}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        visibleColumns={visibleColumns}
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
          <td className="px-4 py-3">
            <ChevronRight
              size={16}
              className={`text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
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
        />
      ))}
    </>
  )
}

export default function AlertGroupList({ groups, currentUserId, currentUserRole, visibleColumns }: Props) {
  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
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
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
