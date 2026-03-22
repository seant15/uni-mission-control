import { useState, useEffect } from 'react'
import { X, ExternalLink, Pencil, Check } from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { db } from '../../lib/api'
import type { FeedbackRow, FeedbackCategory, FeedbackStatus, FeedbackPriority } from '../../types/feedback'
import { CATEGORY_LABELS, STATUS_LABELS } from '../../types/feedback'

interface Props {
  row: FeedbackRow | null
  onClose: () => void
}

function fmt(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function FeedbackDrawer({ row, onClose }: Props) {
  const queryClient = useQueryClient()
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (row) {
      setNotes(row.admin_notes ?? '')
      setSignedUrls({})
      // Pre-sign attachment URLs
      row.attachments.forEach(async att => {
        try {
          const url = await db.getFeedbackAttachmentUrl(att.url)
          setSignedUrls(prev => ({ ...prev, [att.url]: url }))
        } catch { /* ignore */ }
      })
    }
  }, [row?.id])

  const { data: admins } = useQuery({
    queryKey: ['admin-users'],
    queryFn: db.getAdminUsers,
    staleTime: 5 * 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: (updates: Partial<FeedbackRow>) => db.updateFeedback(row!.id, updates as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] })
      toast.success('Saved')
    },
    onError: () => toast.error('Failed to save — check your connection'),
  })

  const saveNotes = () => {
    mutation.mutate({ admin_notes: notes } as any)
    setEditingNotes(false)
  }

  if (!row) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-full w-full sm:w-[520px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">Feedback Detail</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Message */}
          <div>
            <p className="text-xs font-medium text-gray-400 mb-1">Message</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{row.message}</p>
          </div>

          {/* Inline status / priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
              <select
                value={row.status}
                onChange={e => mutation.mutate({ status: e.target.value as FeedbackStatus })}
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(Object.keys(STATUS_LABELS) as FeedbackStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Priority</label>
              <select
                value={row.priority}
                onChange={e => mutation.mutate({ priority: e.target.value as FeedbackPriority })}
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(['low','medium','high','critical'] as FeedbackPriority[]).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
              <select
                value={row.category}
                onChange={e => mutation.mutate({ category: e.target.value as FeedbackCategory })}
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(Object.keys(CATEGORY_LABELS) as FeedbackCategory[]).map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Owner</label>
              <select
                value={row.handled_by ?? ''}
                onChange={e => mutation.mutate({ handled_by: e.target.value || null })}
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {(admins ?? []).map(a => (
                  <option key={a.id} value={a.id}>{a.display_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-xs">
            <Row label="Submitted by" value={`${row.display_name} (${row.role})`} />
            <Row label="Email" value={row.email} />
            <Row label="Page">
              <a href={row.page_url} target="_blank" rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1">
                {row.page_title || row.page_url}
                <ExternalLink size={10} />
              </a>
            </Row>
            <Row label="Severity" value={row.severity ?? '—'} />
            <Row label="AI confidence" value={row.category_confidence != null ? `${(row.category_confidence * 100).toFixed(0)}%` : '—'} />
            <Row label="Submitted" value={fmt(row.created_at)} />
            <Row label="Updated" value={fmt(row.updated_at)} />
            <Row label="Resolved" value={fmt(row.resolved_at)} />
          </div>

          {/* Attachments */}
          {row.attachments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2">Attachments ({row.attachment_count})</p>
              <div className="grid grid-cols-2 gap-3">
                {row.attachments.map((att, i) => {
                  const url = signedUrls[att.url]
                  const isImage = att.type.startsWith('image/')
                  const isVideo = att.type.startsWith('video/')
                  return (
                    <div key={i} className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                      {url && isImage && (
                        <img src={url} alt={att.name} className="w-full h-32 object-cover" />
                      )}
                      {url && isVideo && (
                        <video src={url} controls className="w-full h-32 object-cover" />
                      )}
                      <div className="px-2 py-1.5 flex items-center justify-between">
                        <span className="text-xs text-gray-600 truncate">{att.name}</span>
                        {url && (
                          <a href={url} download={att.name} className="text-blue-600 text-xs ml-2 flex-shrink-0">
                            ↓
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Admin notes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-gray-400">Admin Notes</p>
              {!editingNotes && (
                <button onClick={() => setEditingNotes(true)} className="text-gray-400 hover:text-gray-600">
                  <Pencil size={12} />
                </button>
              )}
              {editingNotes && (
                <button onClick={saveNotes} className="text-green-600 hover:text-green-700">
                  <Check size={14} />
                </button>
              )}
            </div>
            {editingNotes ? (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={saveNotes}
                autoFocus
                rows={4}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-sm text-gray-600 whitespace-pre-wrap min-h-[2rem]">
                {row.admin_notes || <span className="text-gray-300 italic">No notes yet</span>}
              </p>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-gray-400 w-28 flex-shrink-0">{label}</span>
      <span className="text-gray-700 flex-1">{children ?? value}</span>
    </div>
  )
}
