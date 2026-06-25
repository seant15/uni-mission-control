import { AVATAR_PRESETS, isAvatarPresetId } from '../lib/avatarPresets'
import { profileAvatarPublicUrl } from '../lib/avatar'

export default function UserAvatar({
  displayName,
  avatarPreset,
  avatarUrl,
  avatarCacheBust,
  size = 'md',
  className = '',
}: {
  displayName?: string | null
  avatarPreset?: string | null
  avatarUrl?: string | null
  avatarCacheBust?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const initial = (displayName || 'U')[0].toUpperCase()
  const preset = isAvatarPresetId(avatarPreset) ? avatarPreset : null
  const presetMeta = preset ? AVATAR_PRESETS.find(p => p.id === preset) : null

  const dim =
    size === 'sm' ? 'w-8 h-8 text-[10px]' : size === 'lg' ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-[11px]'

  if (avatarUrl) {
    return (
      <img
        src={profileAvatarPublicUrl(avatarUrl, avatarCacheBust)}
        alt=""
        className={`${dim} rounded-full object-cover ring-2 ring-orange-200/70 shrink-0 ${className}`}
      />
    )
  }

  const grad = presetMeta?.gradient ?? 'from-[var(--brand-400)] to-[var(--brand-700)]'

  return (
    <div
      className={`${dim} rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-semibold shadow-md shadow-black/15 shrink-0 ring-2 ring-orange-200/60 ${className}`}
      aria-hidden
    >
      {initial}
    </div>
  )
}
