const STORAGE_KEY = 'uni_shell_preview_user_id'

export function getShellPreviewUserId(): string | null {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY)?.trim()
    return v || null
  } catch {
    return null
  }
}

export function setShellPreviewUserIdStorage(id: string | null) {
  try {
    if (id) sessionStorage.setItem(STORAGE_KEY, id)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}
