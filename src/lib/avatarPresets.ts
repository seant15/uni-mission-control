/** Preset avatars — gradient swatches; optional PNGs under /public/avatars/ are unused by default. */

export type AvatarPresetId =
  | 'preset-01'
  | 'preset-02'
  | 'preset-03'
  | 'preset-04'
  | 'preset-05'
  | 'preset-06'
  | 'preset-07'
  | 'preset-08'
  | 'preset-09'
  | 'preset-10'

export const AVATAR_PRESETS: { id: AvatarPresetId; label: string; gradient: string }[] = [
  { id: 'preset-01', label: 'Sunset', gradient: 'from-orange-400 to-rose-600' },
  { id: 'preset-02', label: 'Ocean', gradient: 'from-cyan-500 to-blue-700' },
  { id: 'preset-03', label: 'Forest', gradient: 'from-emerald-400 to-green-800' },
  { id: 'preset-04', label: 'Grape', gradient: 'from-violet-400 to-purple-800' },
  { id: 'preset-05', label: 'Gold', gradient: 'from-amber-300 to-orange-700' },
  { id: 'preset-06', label: 'Slate', gradient: 'from-slate-400 to-slate-800' },
  { id: 'preset-07', label: 'Coral', gradient: 'from-pink-400 to-red-600' },
  { id: 'preset-08', label: 'Mint', gradient: 'from-teal-300 to-emerald-700' },
  { id: 'preset-09', label: 'Sky', gradient: 'from-sky-300 to-indigo-600' },
  { id: 'preset-10', label: 'Lava', gradient: 'from-red-500 to-amber-600' },
]

export function avatarPresetImageUrl(id: AvatarPresetId): string {
  return `/avatars/${id}.png`
}

export function isAvatarPresetId(v: string | null | undefined): v is AvatarPresetId {
  return !!v && AVATAR_PRESETS.some(p => p.id === v)
}
