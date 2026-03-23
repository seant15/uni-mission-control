import { useQuery } from '@tanstack/react-query'
import { Filter, X, Search } from 'lucide-react'
import { db } from '../../lib/api'
import type { AlertFilterState, AlertSeverity, AlertStatus } from '../../types/alerts'

interface Props {
  filters: AlertFilterState
  onChange: (filters: AlertFilterState) => void
}

const SEVERITIES: AlertSeverity[] = ['critical', 'high', 'medium', 'low']
const STATUSES: AlertStatus[]     = ['new', 'in_progress', 'snoozed', 'resolved', 'ignored', 'dismissed']

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  low:      'bg-blue-100 text-blue-700 border-blue-200',
}

const STATUS_COLORS: Record<AlertStatus, string> = {
  new:          'bg-red-50 text-red-700 border-red-200',
  in_progress:  'bg-blue-50 text-blue-700 border-blue-200',
  snoozed:      'bg-amber-50 text-amber-700 border-amber-200',
  resolved:     'bg-green-50 text-green-700 border-green-200',
  ignored:      'bg-gray-50 text-gray-600 border-gray-200',
  dismissed:    'bg-slate-50 text-slate-600 border-slate-200',
}

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
}

export default function AlertFilterBar({ filters, onChange }: Props) {
  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn:  db.getClients.bind(db),
    staleTime: 300_000,
  })

  const isDirty =
    filters.severity.length > 0 || filters.status.length > 0 ||
    filters.platform.length > 0 || filters.clientId.length > 0 ||
    filters.search !== '' || filters.dateRange !== null || filters.assignedToMe

  const reset = () => onChange({
    severity: [], status: [], platform: [], clientId: [],
    search: '', dateRange: null, assignedToMe: false,
  })

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
      {/* Row 1: search + text filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search alerts…"
            value={filters.search}
            onChange={e => onChange({ ...filters, search: e.target.value })}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Client filter */}
        <select
          value={filters.clientId[0] ?? ''}
          onChange={e => onChange({ ...filters, clientId: e.target.value ? [e.target.value] : [] })}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Clients</option>
          {(clients ?? []).map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Assigned to me toggle */}
        <button
          onClick={() => onChange({ ...filters, assignedToMe: !filters.assignedToMe })}
          className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
            filters.assignedToMe
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          Assigned to me
        </button>

        {isDirty && (
          <button
            onClick={reset}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 ml-auto"
          >
            <X size={13} /> Clear all
          </button>
        )}
      </div>

      {/* Row 2: pill filters */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter size={13} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Severity</span>
          {SEVERITIES.map(s => (
            <button
              key={s}
              onClick={() => onChange({ ...filters, severity: toggle(filters.severity, s) })}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                filters.severity.includes(s)
                  ? SEVERITY_COLORS[s]
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</span>
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => onChange({ ...filters, status: toggle(filters.status, s) })}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                filters.status.includes(s)
                  ? STATUS_COLORS[s]
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Platform</span>
          {(['google_ads', 'meta_ads'] as const).map(p => (
            <button
              key={p}
              onClick={() => onChange({ ...filters, platform: toggle(filters.platform, p) })}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                filters.platform.includes(p)
                  ? p === 'google_ads'
                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {p === 'google_ads' ? 'Google' : 'Meta'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
