import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Save, Tags } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/api'
import { businessTypeLabel, normalizeBusinessType, type BusinessType } from '../lib/businessType'
import { formatSupabaseError } from '../lib/supabaseErrors'

type ClientRow = {
  id: string
  name: string
  business_type?: string | null
}

export default function ClientBusinessTypePanel({
  clients,
}: {
  clients: ClientRow[]
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Record<string, BusinessType>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const next: Record<string, BusinessType> = {}
    for (const c of clients) {
      next[c.id] = normalizeBusinessType(c.business_type)
    }
    setDraft(next)
  }, [clients])

  const sorted = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name)),
    [clients],
  )

  async function saveClient(clientId: string) {
    const bt = draft[clientId]
    if (!bt) return
    setSavingId(clientId)
    try {
      await db.updateClientBusinessType(clientId, bt)
      toast.success('Business type saved')
      await queryClient.invalidateQueries({ queryKey: ['clients_table'] })
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
        <Tags size={16} className="text-[var(--brand-600)] shrink-0" />
        <span className="text-sm font-semibold text-stone-800">Client business type</span>
        <span className="text-xs text-stone-500">ecommerce | leadgen — drives Overview / Heated KPIs and tables</span>
      </button>
      {expanded && (
        <div className="p-4 space-y-2 max-h-[420px] overflow-y-auto">
          {sorted.map(c => (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-2 py-2 border-b border-stone-50 last:border-0"
            >
              <span className="text-sm font-medium text-stone-800 min-w-[140px] truncate">{c.name}</span>
              <select
                value={draft[c.id] ?? 'ecommerce'}
                onChange={e => setDraft(prev => ({ ...prev, [c.id]: e.target.value as BusinessType }))}
                className="text-xs border border-stone-200 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="ecommerce">eCommerce</option>
                <option value="leadgen">Lead Gen</option>
              </select>
              <span className="text-[10px] text-stone-400">
                DB: {businessTypeLabel(normalizeBusinessType(c.business_type))}
              </span>
              <button
                type="button"
                disabled={savingId === c.id || draft[c.id] === normalizeBusinessType(c.business_type)}
                onClick={() => saveClient(c.id)}
                className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-stone-200 hover:bg-stone-50 disabled:opacity-40"
              >
                <Save size={12} />
                {savingId === c.id ? 'Saving…' : 'Save'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
