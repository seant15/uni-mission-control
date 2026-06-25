import { supabase } from './supabase'

export const PROFILE_AVATAR_BUCKET = 'profile-avatars'
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp'
const AVATAR_OUTPUT_SIZE = 256

export function profileAvatarStoragePath(authUserId: string): string {
  return `${authUserId}/avatar.webp`
}

export function profileAvatarPublicUrl(storagePath: string, cacheBust?: number): string {
  const { data } = supabase.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(storagePath)
  if (!cacheBust) return data.publicUrl
  const sep = data.publicUrl.includes('?') ? '&' : '?'
  return `${data.publicUrl}${sep}t=${cacheBust}`
}

export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_ACCEPT.split(',').includes(file.type)) {
    return 'Use JPG, PNG, or WebP.'
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return 'Image must be 2 MB or smaller.'
  }
  return null
}

/** Center-crop to square and export as WebP. */
export async function cropAvatarToSquare(file: File, size = AVATAR_OUTPUT_SIZE): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const sx = Math.floor((bitmap.width - side) / 2)
    const sy = Math.floor((bitmap.height - side) / 2)

    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not prepare image canvas.')

    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.9))
    if (!blob) throw new Error('Could not process image.')
    return blob
  } finally {
    bitmap.close()
  }
}

export async function uploadProfileAvatar(authUserId: string, file: File): Promise<string> {
  const validationError = validateAvatarFile(file)
  if (validationError) throw new Error(validationError)

  const blob = await cropAvatarToSquare(file)
  const path = profileAvatarStoragePath(authUserId)

  const { error } = await supabase.storage
    .from(PROFILE_AVATAR_BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'image/webp' })
  if (error) throw error
  return path
}

export async function deleteProfileAvatar(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([storagePath])
  if (error) throw error
}
