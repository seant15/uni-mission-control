import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Save, Target } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '../lib/api'
import { parseAdSpendTargets } from '../lib/adSpendTarget'
import { formatSupabaseError } from '../lib/supabaseErrors'
import ResizableColgroup from './ResizableColgroup'
import ResizableTh from './ResizableTh'
import { useResizableColumns } from '../hooks/useResizableColumns'
import { CLIENT_SPEND_TARGETS_COL_WIDTHS } from '../lib/tableResizeDefaults'

type ClientRow = {
  id: string
  name: string
  target_ad_spend_30d_by_platform?: unknown
}

export default function ClientAdSpendTargetsPanel({
  clients,
  onSaved,
}: {
  clients: ClientRow[]
  onSaved?: () => void
}) {
  const [draft, setDraft] = useState<Record<string, { meta: string; google: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const spendTargetCols = ['client', 'meta', 'google', 'actions'] as const
  const { widths: spendColW, startResize: spendColResize } = useResizableColumns(
    'client-spend-targets-v1',
    CLIENT_SPEND_TARGETS_COL_WIDTHS,
  )

  useEffect(() => {
    const next: Record<string, { meta: string; google: string }> = {}
    for (const c of clients) {
      const t = parseAdSpendTargets(c.target_ad_spend_30d_by_platform)
      next[c.id] = {
        meta: t.meta_ads != null ? String(t.meta_ads) : '',
        google: t.google_ads != null ? String(t.google_ads) : '',
      }
    }
    setDraft(next)
  }, [clients])

  const sorted = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name)),
    [clients],
  )

  async function saveClient(clientId: string) {
    const row = draft[clientId]
    if (!row) return
    setSavingId(clientId)
    try {
      await db.updateClientAdSpendTargets(clientId, {
        meta_ads: row.meta.trim() ? Number(row.meta) : null,
        google_ads: row.google.trim() ? Number(row.google) : null,
      })
      toast.success('30d spend targets saved')
      onSaved?.()
    } catch (e: unknown) {
      toast.error(formatSupabaseError(e))
    } finally {
      setSavingId(null)
    }
  }

  if (!sorted.length) return null

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full px-4 py-3 border-b border-stone-100 flex items-center gap-2 text-left hover:bg-stone-50/80 transition"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown size={16} className="text-stone-500 shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-stone-500 shrink-0" />
        )}
        <Target size={16} className="text-[var(--brand-600)] shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-stone-900">Client ad spend targets (30d)</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Rolling 30-day caps per platform. Shown in Agency View platform table and Heated spend pace line.
          </p>
        </div>
        <span className="text-[11px] text-stone-400 shrink-0">{sorted.length} clients</span>
      </button>
      {expanded && (
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <ResizableColgroup cols={[...spendTargetCols]} widths={spendColW} />
          <thead className="uni-table-head-row text-xs text-stone-500 uppercase">
            <tr>
              <ResizableTh id="client" widths={spendColW} startResize={spendColResize} variant="compact">Client</ResizableTh>
              <ResizableTh id="meta" widths={spendColW} startResize={spendColResize} variant="compact">Meta ($ / 30d)</ResizableTh>
              <ResizableTh id="google" widths={spendColW} startResize={spendColResize} variant="compact">Google ($ / 30d)</ResizableTh>
              <ResizableTh id="actions" widths={spendColW} startResize={spendColResize} variant="compact" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {sorted.map(c => {
              const d = draft[c.id] ?? { meta: '', google: '' }
              return (
                <tr key={c.id} className="hover:bg-stone-50/80">
                  <td className="px-4 py-2 font-medium text-stone-800 whitespace-nowrap">{c.name}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={d.meta}
                      onChange={e => setDraft(prev => ({
                        ...prev,
                        [c.id]: { ...d, meta: e.target.value },
                      }))}
                      className="w-28 text-sm border border-stone-200 rounded-lg px-2 py-1.5"
                      placeholder="10000"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={d.google}
                      onChange={e => setDraft(prev => ({
                        ...prev,
                        [c.id]: { ...d, google: e.target.value },
                      }))}
                      className="w-28 text-sm border border-stone-200 rounded-lg px-2 py-1.5"
                      placeholder="35000"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={savingId === c.id}
                      onClick={() => saveClient(c.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 hover:bg-stone-100 disabled:opacity-50"
                    >
                      <Save size={12} />
                      {savingId === c.id ? '…' : 'Save'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}
