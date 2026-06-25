import { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { AVATAR_PRESETS, type AvatarPresetId } from '../lib/avatarPresets'
import { AVATAR_ACCEPT, AVATAR_MAX_BYTES, cropAvatarToSquare, validateAvatarFile } from '../lib/avatar'
import UserAvatar from './UserAvatar'
import { formatSupabaseError } from '../lib/supabaseErrors'

export default function AvatarPickerModal({
  open,
  currentPreset,
  currentAvatarUrl,
  displayName,
  onClose,
  onSelectPreset,
  onUpload,
  onRemoveUpload,
}: {
  open: boolean
  currentPreset?: string | null
  currentAvatarUrl?: string | null
  displayName?: string | null
  onClose: () => void
  onSelectPreset: (presetId: AvatarPresetId) => void | Promise<void>
  onUpload: (file: File) => void | Promise<void>
  onRemoveUpload?: () => void | Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const resetUploadDraft = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPendingFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    resetUploadDraft()
    onClose()
  }

  const pickPreset = async (id: AvatarPresetId) => {
    setSaving(true)
    try {
      await onSelectPreset(id)
      resetUploadDraft()
      onClose()
      toast.success('Avatar updated')
    } catch (e) {
      toast.error(formatSupabaseError(e))
    } finally {
      setSaving(false)
    }
  }

  const handleFileChange = async (file: File | null) => {
    if (!file) return
    const validationError = validateAvatarFile(file)
    if (validationError) {
      toast.error(validationError)
      return
    }
    try {
      const cropped = await cropAvatarToSquare(file)
      const previewBlob = cropped.type ? cropped : new Blob([cropped], { type: 'image/webp' })
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(previewBlob))
      setPendingFile(file)
    } catch (e) {
      toast.error(formatSupabaseError(e))
    }
  }

  const saveUpload = async () => {
    if (!pendingFile) return
    setSaving(true)
    try {
      await onUpload(pendingFile)
      resetUploadDraft()
      onClose()
      toast.success('Photo uploaded')
    } catch (e) {
      toast.error(formatSupabaseError(e))
    } finally {
      setSaving(false)
    }
  }

  const removeUpload = async () => {
    if (!onRemoveUpload || !currentAvatarUrl) return
    setSaving(true)
    try {
      await onRemoveUpload()
      resetUploadDraft()
      onClose()
      toast.success('Custom photo removed')
    } catch (e) {
      toast.error(formatSupabaseError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button type="button" className="fixed inset-0 z-[80] bg-black/40" aria-label="Close" onClick={handleClose} />
      <div
        role="dialog"
        aria-labelledby="avatar-picker-title"
        className="fixed left-1/2 top-1/2 z-[90] w-[min(24rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-stone-200 bg-white p-4 shadow-xl dark:border-stone-700 dark:bg-stone-900"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 id="avatar-picker-title" className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            Profile avatar
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-md text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="w-11 h-11 rounded-full object-cover ring-2 ring-orange-200/70 shrink-0" />
          ) : (
            <UserAvatar
              displayName={displayName}
              avatarPreset={currentPreset}
              avatarUrl={currentAvatarUrl}
              size="lg"
            />
          )}
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Choose a color preset or upload a photo for {displayName || 'your account'}.
          </p>
        </div>

        <p className="text-xs font-medium text-stone-700 dark:text-stone-300 mb-2">Color presets</p>
        <div className="grid grid-cols-5 gap-2 mb-4">
          {AVATAR_PRESETS.map(p => {
            const active = !currentAvatarUrl && currentPreset === p.id
            return (
              <button
                key={p.id}
                type="button"
                disabled={saving}
                title={p.label}
                onClick={() => pickPreset(p.id)}
                className={`rounded-full p-0.5 transition ring-2 ${
                  active ? 'ring-[var(--brand-600)]' : 'ring-transparent hover:ring-stone-300 dark:hover:ring-stone-600'
                }`}
              >
                <span
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${p.gradient} flex items-center justify-center text-white text-xs font-bold`}
                >
                  {(displayName || 'U')[0].toUpperCase()}
                </span>
              </button>
            )
          })}
        </div>

        <div className="border-t border-stone-200 dark:border-stone-700 pt-4 space-y-3">
          <p className="text-xs font-medium text-stone-700 dark:text-stone-300">Upload photo</p>
          <input
            ref={fileInputRef}
            type="file"
            accept={AVATAR_ACCEPT}
            className="hidden"
            onChange={e => void handleFileChange(e.target.files?.[0] ?? null)}
          />
          {previewUrl ? (
            <div className="flex items-center gap-3">
              <img src={previewUrl} alt="Preview" className="w-12 h-12 rounded-full object-cover ring-2 ring-stone-200" />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveUpload()}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--brand-600)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  Save photo
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={resetUploadDraft}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800"
              >
                <Upload size={14} />
                Choose image
              </button>
              {currentAvatarUrl && onRemoveUpload ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void removeUpload()}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  Remove photo
                </button>
              ) : null}
            </div>
          )}
          <p className="text-[10px] text-stone-400">
            JPG, PNG, or WebP · max {(AVATAR_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB · auto square crop
          </p>
        </div>
      </div>
    </>
  )
}
