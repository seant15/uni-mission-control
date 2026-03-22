import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trash2, Eye, Paperclip, Pencil, Check } from 'lucide-react'
import { db } from '../../lib/api'
import type { FeedbackRow, FeedbackCategory, FeedbackStatus, FeedbackPriority, FeedbackSeverity } from '../../types/feedback'
import { CATEGORY_LABELS, STATUS_LABELS } from '../../types/feedback'

interface Props {
  rows: FeedbackRow[]
  onViewDetail: (row: FeedbackRow) => void
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

function fmt(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    super_admin:  'bg-purple-100 text-purple-700',
    team_member:  'bg-blue-100 text-blue-700',
    client_user:  'bg-gray-100 text-gray-600',
  }
  return <Badge label={role.replace('_', ' ')} className={colors[role] ?? 'bg-gray-100 text-gray-600'} />
}

interface InlineSelectProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}
function InlineSelect<T extends string>({ value, options, onChange }: InlineSelectProps<T>) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as T)}
      onClick={e => e.stopPropagation()}
      className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white cursor-pointer"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export default function FeedbackTable({ rows, onViewDetail }: Props) {
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')

  const { data: admins } = useQuery({
    queryKey: ['admin-users'],
    queryFn: db.getAdminUsers,
    staleTime: 5 * 60 * 1000,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<FeedbackRow> }) =>
      db.updateFeedback(id, updates as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] })
      toast.success('Saved')
    },
    onError: () => toast.error('Failed to save — check your connection'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => db.deleteFeedback(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] })
      toast.success('Deleted')
      setDeletingId(null)
    },
    onError: () => {
      toast.error('Failed to delete')
      setDeletingId(null)
    },
  })

  const update = (id: string, updates: Partial<FeedbackRow>) =>
    updateMutation.mutate({ id, updates })

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-20 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
          <Paperclip size={20} className="text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-500">No feedback found</p>
        <p className="text-xs text-gray-400">Adjust your filters or wait for new submissions.</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              {['#','Submitted','User','Page','Category','Severity','Message','Files','Priority','Status','Owner','Notes','Actions'].map(h => (
                <th key={h} className="px-3 py-3 text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.id}
                onClick={() => onViewDetail(row)}
                className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                {/* # */}
                <td className="px-3 py-3 text-xs text-gray-400">{idx + 1}</td>

                {/* Submitted */}
                <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(row.created_at)}</td>

                {/* User */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <p className="text-xs font-medium text-gray-800">{row.display_name}</p>
                  <RoleBadge role={row.role} />
                </td>

                {/* Page */}
                <td className="px-3 py-3 max-w-[140px]">
                  <p className="text-xs text-gray-600 truncate" title={row.page_url}>
                    {row.page_title || row.page_url}
                  </p>
                </td>

                {/* Category inline edit */}
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <InlineSelect
                    value={row.category}
                    options={(Object.keys(CATEGORY_LABELS) as FeedbackCategory[]).map(c => ({ value: c, label: CATEGORY_LABELS[c] }))}
                    onChange={v => update(row.id, { category: v })}
                  />
                </td>

                {/* Severity inline edit */}
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <InlineSelect
                    value={(row.severity ?? '') as any}
                    options={[
                      { value: '' as any, label: '—' },
                      ...(['low','medium','high','critical'] as FeedbackSeverity[]).map(s => ({ value: s, label: s }))
                    ]}
                    onChange={v => update(row.id, { severity: (v as FeedbackSeverity) || undefined })}
                  />
                </td>

                {/* Message */}
                <td className="px-3 py-3 max-w-[200px]">
                  <p className="text-xs text-gray-700 truncate">{row.message}</p>
                </td>

                {/* Attachments count */}
                <td className="px-3 py-3 text-center">
                  {row.attachment_count > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                      <Paperclip size={12} />
                      {row.attachment_count}
                    </span>
                  )}
                </td>

                {/* Priority inline edit */}
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <InlineSelect
                    value={row.priority}
                    options={(['low','medium','high','critical'] as FeedbackPriority[]).map(p => ({ value: p, label: p }))}
                    onChange={v => update(row.id, { priority: v })}
                  />
                </td>

                {/* Status inline edit */}
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <InlineSelect
                    value={row.status}
                    options={(Object.keys(STATUS_LABELS) as FeedbackStatus[]).map(s => ({ value: s, label: STATUS_LABELS[s] }))}
                    onChange={v => update(row.id, { status: v })}
                  />
                </td>

                {/* Owner inline edit */}
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <select
                    value={row.handled_by ?? ''}
                    onChange={e => update(row.id, { handled_by: e.target.value || null })}
                    onClick={e => e.stopPropagation()}
                    className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white max-w-[120px]"
                  >
                    <option value="">—</option>
                    {(admins ?? []).map(a => (
                      <option key={a.id} value={a.id}>{a.display_name}</option>
                    ))}
                  </select>
                </td>

                {/* Notes inline edit */}
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  {editingNotes === row.id ? (
                    <div className="flex items-start gap-1">
                      <textarea
                        autoFocus
                        value={notesDraft}
                        onChange={e => setNotesDraft(e.target.value)}
                        onBlur={() => {
                          update(row.id, { admin_notes: notesDraft })
                          setEditingNotes(null)
                        }}
                        rows={2}
                        className="text-xs border border-gray-200 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 w-32"
                      />
                      <button
                        onMouseDown={() => {
                          update(row.id, { admin_notes: notesDraft })
                          setEditingNotes(null)
                        }}
                        className="text-green-600 mt-1"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setNotesDraft(row.admin_notes ?? '')
                        setEditingNotes(row.id)
                      }}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                    >
                      <Pencil size={11} />
                      <span className="truncate max-w-[80px]">{row.admin_notes || 'Add note'}</span>
                    </button>
                  )}
                </td>

                {/* Actions */}
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onViewDetail(row)}
                      title="View detail"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Eye size={14} />
                    </button>
                    {deletingId === row.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => deleteMutation.mutate(row.id)}
                          className="text-xs text-red-600 font-medium hover:underline"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="text-xs text-gray-400 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(row.id)}
                        title="Delete"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
