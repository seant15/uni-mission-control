import { Search, X } from 'lucide-react'
import type { FeedbackFilters, FeedbackCategory, FeedbackSeverity, FeedbackPriority, FeedbackStatus } from '../../types/feedback'
import { CATEGORY_LABELS, STATUS_LABELS } from '../../types/feedback'

interface Props {
  filters: FeedbackFilters
  onChange: (f: FeedbackFilters) => void
}

const STATUS_OPTIONS: FeedbackStatus[] = ['new','acknowledged','in_progress','resolved','wont_fix','duplicate']
const SEVERITY_OPTIONS: FeedbackSeverity[] = ['low','medium','high','critical']
const PRIORITY_OPTIONS: FeedbackPriority[] = ['low','medium','high','critical']
const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as FeedbackCategory[]

const STATUS_ACTIVE: Record<FeedbackStatus, string> = {
  new:          'bg-sky-600 text-white border-sky-600',
  acknowledged: 'bg-indigo-600 text-white border-indigo-600',
  in_progress:  'bg-amber-500 text-white border-amber-500',
  resolved:     'bg-green-600 text-white border-green-600',
  wont_fix:     'bg-gray-500 text-white border-gray-500',
  duplicate:    'bg-rose-500 text-white border-rose-500',
}

export default function FeedbackFilters({ filters, onChange }: Props) {
  const toggleStatus = (s: FeedbackStatus) => {
    const current = filters.status ?? []
    const next = current.includes(s) ? current.filter(x => x !== s) : [...current, s]
    onChange({ ...filters, status: next.length ? next : undefined })
  }

  const hasFilters = !!(
    (filters.status?.length) ||
    filters.category ||
    filters.severity ||
    filters.priority ||
    filters.search ||
    filters.dateFrom ||
    filters.dateTo
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* Search + clear */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search message or user..."
            value={filters.search ?? ''}
            onChange={e => onChange({ ...filters, search: e.target.value || undefined })}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {hasFilters && (
          <button
            onClick={() => onChange({})}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        {/* Status pills */}
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1.5">Status</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={`
                  px-2.5 py-1 rounded-full text-xs font-medium border capitalize transition-colors
                  ${(filters.status ?? []).includes(s)
                    ? STATUS_ACTIVE[s]
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'}
                `}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1.5">Category</p>
          <select
            value={filters.category ?? ''}
            onChange={e => onChange({ ...filters, category: (e.target.value as FeedbackCategory) || undefined })}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>

        {/* Severity */}
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1.5">Severity</p>
          <select
            value={filters.severity ?? ''}
            onChange={e => onChange({ ...filters, severity: (e.target.value as FeedbackSeverity) || undefined })}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Priority */}
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1.5">Priority</p>
          <select
            value={filters.priority ?? ''}
            onChange={e => onChange({ ...filters, priority: (e.target.value as FeedbackPriority) || undefined })}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Date range */}
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1.5">Date range</p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={e => onChange({ ...filters, dateFrom: e.target.value || undefined })}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400">—</span>
            <input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={e => onChange({ ...filters, dateTo: e.target.value || undefined })}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
