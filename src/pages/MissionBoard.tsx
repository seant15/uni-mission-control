import { useState, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { LayoutGrid, Plus, RefreshCw, ExternalLink, Pencil, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { MISSION_COLUMNS, type MissionCardRow, type MissionColumn, type MissionCardPriority } from '../types/mission'

const PRIORITY_OPTIONS: { id: MissionCardPriority; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'critical', label: 'Critical' },
]

const PLATFORM_FORM_OPTIONS = [
  { id: '', label: '— Not set' },
  { id: 'meta_ads', label: 'Meta Ads' },
  { id: 'google_ads', label: 'Google Ads' },
  { id: 'tiktok_ads', label: 'TikTok Ads' },
]

function platformLabel(id: string | null | undefined): string {
  if (!id) return ''
  const o = PLATFORM_FORM_OPTIONS.find(x => x.id === id)
  return o?.label ?? id
}

function parseClickUpTask(input: string): { id: string; url: string } | null {
  const raw = input.trim()
  if (!raw) return null
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`)
    const m = u.pathname.match(/\/t\/([a-zA-Z0-9]+)/)
    if (m?.[1]) return { id: m[1], url: u.toString() }
  } catch {
    /* ignore */
  }
  const m2 = raw.match(/(?:clickup\.com\/[^/]+\/)?t\/([a-zA-Z0-9]+)/i)
  if (m2?.[1]) {
    const id = m2[1]
    const url = raw.includes('://') ? raw : `https://app.clickup.com/t/${id}`
    return { id, url }
  }
  return null
}

export default function MissionBoard() {
  const { appUser } = useAuth()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [columnStatus, setColumnStatus] = useState<MissionColumn>('new')
  const [clickupLinkInput, setClickupLinkInput] = useState('')
  const [modalClientId, setModalClientId] = useState<string>('')
  const [modalPlatform, setModalPlatform] = useState<string>('')
  const [modalPriority, setModalPriority] = useState<MissionCardPriority>('medium')
  const [filterClientId, setFilterClientId] = useState<string>('')
  const [filterPlatform, setFilterPlatform] = useState<string>('')
  const [filterPriority, setFilterPriority] = useState<string>('')

  const { data: cards = [], isLoading, error, refetch } = useQuery({
    queryKey: ['mission_cards'],
    queryFn: db.listMissionCards.bind(db),
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['mission-board-clients'],
    queryFn: () => db.getClients(),
    staleTime: 5 * 60_000,
  })

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of clients as { id: string; name: string }[]) m.set(c.id, c.name)
    return m
  }, [clients])

  const filteredCards = useMemo(() => {
    return (cards as MissionCardRow[]).filter(c => {
      if (filterClientId && c.client_id !== filterClientId) return false
      if (filterPlatform && (c.platform || '') !== filterPlatform) return false
      if (filterPriority && (c.priority || 'medium') !== filterPriority) return false
      return true
    })
  }, [cards, filterClientId, filterPlatform, filterPriority])

  function openCreate() {
    setModalMode('create')
    setEditingId(null)
    setTitle('')
    setBody('')
    setColumnStatus('new')
    setClickupLinkInput('')
    setModalClientId('')
    setModalPlatform('')
    setModalPriority('medium')
    setModalOpen(true)
  }

  function openEdit(card: MissionCardRow) {
    setModalMode('edit')
    setEditingId(card.id)
    setTitle(card.title)
    setBody(card.body || '')
    setColumnStatus(card.column_status)
    setClickupLinkInput(card.clickup_task_url?.trim() || '')
    setModalClientId(card.client_id || '')
    setModalPlatform(card.platform || '')
    setModalPriority((card.priority as MissionCardPriority) || 'medium')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setClickupLinkInput('')
  }

  const createMutation = useMutation({
    mutationFn: () => {
      if (!appUser?.id) throw new Error('Not signed in')
      const parsed = parseClickUpTask(clickupLinkInput)
      return db.createMissionCard({
        title: title.trim() || 'Untitled',
        body: body.trim(),
        column_status: columnStatus,
        created_by: appUser.id,
        client_id: modalClientId || null,
        platform: modalPlatform || null,
        priority: modalPriority,
        ...(parsed
          ? { clickup_task_id: parsed.id, clickup_task_url: parsed.url, synced_from_clickup: false }
          : {}),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mission_cards'] })
      closeModal()
      toast.success('Card created')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const saveEditMutation = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error('No card selected')
      const parsed = parseClickUpTask(clickupLinkInput)
      const patch: Parameters<typeof db.updateMissionCard>[1] = {
        title: title.trim() || 'Untitled',
        body: body.trim(),
        column_status: columnStatus,
        client_id: modalClientId || null,
        platform: modalPlatform || null,
        priority: modalPriority,
      }
      if (parsed) {
        patch.clickup_task_id = parsed.id
        patch.clickup_task_url = parsed.url
      } else if (!clickupLinkInput.trim()) {
        patch.clickup_task_id = null
        patch.clickup_task_url = null
      }
      return db.updateMissionCard(editingId, patch)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mission_cards'] })
      closeModal()
      toast.success('Card updated')
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
    acc[col.id] = filteredCards.filter((c: MissionCardRow) => c.column_status === col.id)
    return acc
  }, {} as Record<MissionColumn, MissionCardRow[]>)

  const savePending = modalMode === 'create' ? createMutation.isPending : saveEditMutation.isPending

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <LayoutGrid className="text-[var(--brand-600)]" />
            Mission Board
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track work from alerts and notes. Use Edit on a card to change title, notes, or column.
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
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--brand-600)] text-white text-sm font-medium hover:bg-[var(--brand-700)]"
          >
            <Plus size={16} /> New card
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filters</span>
        <select
          value={filterClientId}
          onChange={e => setFilterClientId(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 min-w-[140px]"
        >
          <option value="">Agency (all clients)</option>
          {(clients as { id: string; name: string }[]).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterPlatform}
          onChange={e => setFilterPlatform(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 min-w-[130px]"
        >
          <option value="">All platforms</option>
          {PLATFORM_FORM_OPTIONS.filter(o => o.id).map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 min-w-[120px]"
        >
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        {(filterClientId || filterPlatform || filterPriority) && (
          <button
            type="button"
            className="text-xs text-[var(--brand-600)] hover:underline"
            onClick={() => { setFilterClientId(''); setFilterPlatform(''); setFilterPriority('') }}
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {(error as Error).message}. If the table is missing, run{' '}
          <code className="rounded bg-amber-100 px-1">supabase/migrations/20260512140000_mission_cards.sql</code>
          {' '}and{' '}
          <code className="rounded bg-amber-100 px-1">20260516120000_mission_platform_priority.sql</code>{' '}
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-gray-900 text-sm leading-snug flex-1 min-w-0">{card.title}</div>
                      {card.synced_from_clickup && card.clickup_task_url && (
                        <a
                          href={card.clickup_task_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 hover:bg-purple-200"
                          title="Open in ClickUp"
                        >
                          <Zap size={10} />
                          ClickUp
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {card.client_id && (
                        <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {clientNameById.get(card.client_id) || 'Client'}
                        </span>
                      )}
                      {card.platform && (
                        <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                          {platformLabel(card.platform)}
                        </span>
                      )}
                      <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 capitalize">
                        {card.priority || 'medium'}
                      </span>
                    </div>
                    {card.body && (
                      <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap line-clamp-6">{card.body}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select
                        value={card.column_status}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
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
                      <button
                        type="button"
                        onClick={() => openEdit(card)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <Pencil size={12} /> Edit
                      </button>
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
            <h2 className="text-lg font-semibold text-gray-900">
              {modalMode === 'create' ? 'New mission card' : 'Edit mission card'}
            </h2>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Client</label>
                <select
                  value={modalClientId}
                  onChange={e => setModalClientId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm"
                >
                  <option value="">— None</option>
                  {(clients as { id: string; name: string }[]).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Platform</label>
                <select
                  value={modalPlatform}
                  onChange={e => setModalPlatform(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm"
                >
                  {PLATFORM_FORM_OPTIONS.map(o => (
                    <option key={o.id || 'none'} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                <select
                  value={modalPriority}
                  onChange={e => setModalPriority(e.target.value as MissionCardPriority)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm"
                >
                  {PRIORITY_OPTIONS.map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Link ClickUp task (optional)</label>
              <input
                value={clickupLinkInput}
                onChange={e => setClickupLinkInput(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="https://app.clickup.com/t/…"
              />
              <p className="text-[11px] text-gray-500 mt-1">Paste a ClickUp task URL to store task id and link on this card.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Column</label>
              <select
                value={columnStatus}
                onChange={e => setColumnStatus(e.target.value as MissionColumn)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {MISSION_COLUMNS.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savePending}
                onClick={() => (modalMode === 'create' ? createMutation.mutate() : saveEditMutation.mutate())}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {modalMode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
