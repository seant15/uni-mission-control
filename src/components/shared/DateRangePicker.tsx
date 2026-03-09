import { useState } from 'react'

interface DateRangePickerProps {
  value: { start: string; end: string }
  onChange: (range: { start: string; end: string }) => void
  presets?: Array<{ label: string; days?: number; type?: string }>
}

const DEFAULT_PRESETS = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 14 Days', days: 14 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'This Month', type: 'month' },
  { label: 'Last Month', type: 'last_month' },
]

export function DateRangePicker({ value, onChange, presets = DEFAULT_PRESETS }: DateRangePickerProps) {
  const [showPresets, setShowPresets] = useState(false)

  const applyPreset = (preset: any) => {
    const end = new Date()
    const start = new Date()

    if (preset.type === 'month') {
      start.setDate(1)
    } else if (preset.type === 'last_month') {
      start.setMonth(start.getMonth() - 1)
      start.setDate(1)
      end.setDate(0)
    } else if (preset.days) {
      start.setDate(end.getDate() - preset.days)
    }

    onChange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    })
    setShowPresets(false)
  }

  return (
    <div className="relative">
      <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Date Range</label>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={value.start}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
        />
        <span className="text-gray-400">to</span>
        <input
          type="date"
          value={value.end}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
        />
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
        >
          Presets
        </button>
      </div>

      {showPresets && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {presets.map(preset => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
