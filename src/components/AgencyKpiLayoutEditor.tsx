import { ArrowDown, ArrowUp, RotateCcw, Save, X } from 'lucide-react'
import type { AgencyKpiCardId, AgencyKpiLayout } from '../lib/agencyKpiLayout'
import { AGENCY_KPI_CARD_LABELS, defaultAgencyKpiLayout } from '../lib/agencyKpiLayout'

export default function AgencyKpiLayoutEditor({
  layout,
  onChange,
  onSave,
  onClose,
  saving,
  saveError,
}: {
  layout: AgencyKpiLayout
  onChange: (next: AgencyKpiLayout) => void
  onSave: () => void | Promise<void>
  onClose: () => void
  saving: boolean
  saveError?: string | null
}) {
  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= layout.order.length) return
    const next = [...layout.order]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    onChange({ ...layout, order: next })
  }

  function toggle(id: AgencyKpiCardId) {
    const cur = !!layout.hidden[id]
    onChange({
      ...layout,
      hidden: { ...layout.hidden, [id]: !cur },
    })
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-stone-200 max-w-lg w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Agency view</p>
            <p className="text-sm font-semibold text-stone-900">Customize KPI cards</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-stone-500 px-4 pt-3">
          Uncheck to hide a card. Use arrows to reorder. Lead gen vs eCommerce only shows applying cards.
        </p>
        <div className="overflow-y-auto flex-1 px-4 py-2 space-y-1">
          {layout.order.map((id, idx) => {
            const label = AGENCY_KPI_CARD_LABELS[id]
            const off = !!layout.hidden[id]
            return (
              <div
                key={id}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${off ? 'border-stone-100 bg-stone-50 opacity-70' : 'border-stone-200 bg-white'}`}
              >
                <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                  <input type="checkbox" checked={!off} onChange={() => toggle(id)} className="rounded" />
                  <span className="truncate">{label}</span>
                </label>
                <div className="flex flex-col shrink-0">
                  <button
                    type="button"
                    aria-label="Move up"
                    onClick={() => move(idx, -1)}
                    className="p-0.5 rounded hover:bg-stone-100 text-stone-500"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    onClick={() => move(idx, 1)}
                    className="p-0.5 rounded hover:bg-stone-100 text-stone-500"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        {saveError && <p className="text-xs text-red-600 px-4">{saveError}</p>}
        <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-stone-100">
          <button
            type="button"
            onClick={() => onChange(defaultAgencyKpiLayout())}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-stone-200 rounded-lg hover:bg-stone-50"
          >
            <RotateCcw size={14} /> Reset default
          </button>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs border border-stone-200 rounded-lg">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--brand-600)] text-white disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
