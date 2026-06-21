import { useState, useEffect, useRef } from 'react'
import { Calendar } from 'lucide-react'
import {
  ACCOUNT_DATE_PRESETS,
  applyAccountDatePreset,
  type CalendarDateRange,
  type AccountDatePreset,
} from '../lib/dashboardDateRange'

type Props = {
  dateRange: CalendarDateRange
  onChange: (next: CalendarDateRange) => void
  className?: string
  /** Defaults to ACCOUNT_DATE_PRESETS when omitted */
  presets?: AccountDatePreset[]
}

export default function AccountDateRangePicker({
  dateRange,
  onChange,
  className,
  presets = ACCOUNT_DATE_PRESETS,
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const pick = (preset: AccountDatePreset) => {
    onChange(applyAccountDatePreset(preset))
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={`relative flex items-center gap-1.5 flex-wrap ${className ?? ''}`}>
      <input
        type="date"
        value={dateRange.start}
        onChange={e => onChange({ ...dateRange, start: e.target.value })}
        className="uni-native-field px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 max-w-[11rem]"
      />
      <span className="text-gray-400 text-xs">to</span>
      <input
        type="date"
        value={dateRange.end}
        onChange={e => onChange({ ...dateRange, end: e.target.value })}
        className="uni-native-field px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 max-w-[11rem]"
      />
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="px-2 py-1.5 bg-[var(--brand-50)] text-[var(--brand-700)] rounded-lg hover:bg-[var(--brand-100)] text-xs font-medium inline-flex items-center gap-1 border border-[var(--brand-100)]"
      >
        <Calendar size={13} /> Presets
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-72 overflow-y-auto">
          {presets.map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => pick(preset)}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-900 first:rounded-t-lg last:rounded-b-lg"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
