import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, Trash2, MessageSquare } from 'lucide-react'
import { db } from '../../lib/api'
import type { AlertNote } from '../../types/alerts'

interface Props {
  alertId: string
  currentUserId: string
}

export default function NoteThread({ alertId, currentUserId }: Props) {
  const [content, setContent]       = useState('')
  const [actionTaken, setActionTaken] = useState('')
  const queryClient = useQueryClient()

  const { data: notes, isLoading } = useQuery<AlertNote[]>({
    queryKey: ['alert-notes', alertId],
    queryFn:  () => db.getAlertNotes(alertId),
  })

  const addMutation = useMutation({
    mutationFn: () => db.addAlertNote(alertId, currentUserId, content.trim(), actionTaken.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-notes', alertId] })
      setContent('')
      setActionTaken('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => db.deleteAlertNote(noteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-notes', alertId] }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    addMutation.mutate()
  }

  if (isLoading) return (
    <div className="py-4 text-center text-sm text-gray-400">Loading notes…</div>
  )

  return (
    <div className="space-y-3">
      {/* Note list */}
      {notes && notes.length > 0 ? (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {notes.map(note => (
            <div key={note.id} className="flex gap-2.5 group">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 mt-0.5">
                {(note.user_display_name || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-gray-700">{note.user_display_name || 'Unknown'}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(note.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {note.action_taken && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded capitalize">
                      {note.action_taken}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mt-0.5">{note.content}</p>
              </div>
              {note.user_id === currentUserId && (
                <button
                  onClick={() => deleteMutation.mutate(note.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0 mt-1"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <MessageSquare size={14} />
          No notes yet
        </div>
      )}

      {/* Add note form */}
      <form onSubmit={handleSubmit} className="space-y-2 pt-2 border-t border-gray-100">
        <input
          type="text"
          value={actionTaken}
          onChange={e => setActionTaken(e.target.value)}
          placeholder="Action taken (optional, e.g. 'Paused campaign')"
          className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Add a note…"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!content.trim() || addMutation.isPending}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  )
}
