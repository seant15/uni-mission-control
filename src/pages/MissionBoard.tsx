import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { LayoutGrid, Plus, RefreshCw, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { MISSION_COLUMNS, type MissionCardRow, type MissionColumn } from '../types/mission'

export default function MissionBoard() {
  const { appUser } = useAuth()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const { data: cards = [], isLoading, error, refetch } = useQuery({
    queryKey: ['mission_cards'],
    queryFn: db.listMissionCards.bind(db),
  })

  const createMutation = useMutation({
    mutationFn: () => {
      if (!appUser?.id) throw new Error('Not signed in')
      return db.createMissionCard({
        title: title.trim() || 'Untitled',
        body: body.trim(),
        created_by: appUser.id,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mission_cards'] })
      setModalOpen(false)
      setTitle('')
      setBody('')
      toast.success('Card created')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateColumnMutation = useMutation({
    mutationFn: ({ id, column_status }: { id: string; column_status: MissionColumn }) =>
      db.updateMissionCard(id, { column_status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mission_cards'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const byColumn = MISSION_COLUMNS.reduce((acc, col) => {
    acc[col.id] = cards.filter((c: MissionCardRow) => c.column_status === col.id)
    return acc
  }, {} as Record<MissionColumn, MissionCardRow[]>)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <LayoutGrid className="text-blue-600" />
            Mission Board
          </h1>
          <p className="text-gray-500 mt-1">
            Track work from alerts and notes. Cards are not changed when an alert is archived or deleted.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> New card
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {(error as Error).message}. If the table is missing, run{' '}
          <code className="rounded bg-amber-100 px-1">supabase/migrations/20260512140000_mission_cards.sql</code>{' '}
          in the Supabase SQL editor.
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12 text-gray-500">Loading board…</div>
      )}

      {!isLoading && (
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[420px]">
          {MISSION_COLUMNS.map(col => (
            <div
              key={col.id}
              className="flex-shrink-0 w-[280px] bg-slate-100/80 rounded-xl border border-slate-200 flex flex-col max-h-[70vh]"
            >
              <div className="px-3 py-2 border-b border-slate-200 font-semibold text-sm text-slate-700 flex justify-between items-center">
                <span>{col.label}</span>
                <span className="text-xs font-normal text-slate-500">{byColumn[col.id].length}</span>
              </div>
              <div className="p-2 overflow-y-auto flex-1 space-y-2">
                {byColumn[col.id].map(card => (
                  <div
                    key={card.id}
                    className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:border-blue-200 transition-colors"
                  >
                    <div className="font-medium text-gray-900 text-sm leading-snug">{card.title}</div>
                    {card.body && (
                      <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap line-clamp-6">{card.body}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select
                        value={card.column_status}
                        onChange={e =>
                          updateColumnMutation.mutate({
                            id: card.id,
                            column_status: e.target.value as MissionColumn,
                          })
                        }
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white max-w-full"
                      >
                        {MISSION_COLUMNS.map(c => (
                          <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                      </select>
                      {card.source_alert_id && (
                        <Link
                          to="/alerts"
                          className="text-xs text-blue-600 hover:underline inline-flex items-center gap-0.5"
                        >
                          Alert ref <ExternalLink size={10} />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">New mission card</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Short title"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes (plain text or links)</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={5}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                placeholder="Details…"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
