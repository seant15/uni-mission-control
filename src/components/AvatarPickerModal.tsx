import { useState } from 'react'
import { X } from 'lucide-react'
import { AVATAR_PRESETS, avatarPresetImageUrl, type AvatarPresetId } from '../lib/avatarPresets'

export default function AvatarPickerModal({
  open,
  currentPreset,
  displayName,
  onClose,
  onSelect,
}: {
  open: boolean
  currentPreset?: string | null
  displayName?: string | null
  onClose: () => void
  onSelect: (presetId: AvatarPresetId) => void | Promise<void>
}) {
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const pick = async (id: AvatarPresetId) => {
    setSaving(true)
    try {
      await onSelect(id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button type="button" className="fixed inset-0 z-[80] bg-black/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-labelledby="avatar-picker-title"
        className="fixed left-1/2 top-1/2 z-[90] w-[min(22rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-stone-200 bg-white p-4 shadow-xl"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 id="avatar-picker-title" className="text-sm font-semibold text-stone-900">
            Choose profile avatar
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-stone-500 hover:bg-stone-100">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-stone-500 mb-3">
          Pick a preset for {displayName || 'your account'}. Custom upload can be added later.
        </p>
        <div className="grid grid-cols-5 gap-2">
          {AVATAR_PRESETS.map(p => {
            const active = currentPreset === p.id
            return (
              <button
                key={p.id}
                type="button"
                disabled={saving}
                title={p.label}
                onClick={() => pick(p.id)}
                className={`relative rounded-full p-0.5 transition ring-2 ${
                  active ? 'ring-[var(--brand-600)]' : 'ring-transparent hover:ring-stone-300'
                }`}
              >
                <img
                  src={avatarPresetImageUrl(p.id)}
                  alt={p.label}
                  onError={e => {
                    const el = e.target as HTMLImageElement
                    el.style.display = 'none'
                    el.nextElementSibling?.classList.remove('hidden')
                  }}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <span
                  className={`hidden w-10 h-10 rounded-full bg-gradient-to-br ${p.gradient} flex items-center justify-center text-white text-xs font-bold`}
                >
                  {(displayName || 'U')[0].toUpperCase()}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-stone-400 mt-3">
          Optional PNGs: place files at <code className="font-mono">public/avatars/preset-01.png</code> …{' '}
          <code className="font-mono">preset-10.png</code>
        </p>
      </div>
    </>
  )
}
