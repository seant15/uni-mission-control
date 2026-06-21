export type AccentId = 'orange' | 'blue' | 'uni'

const STORAGE_KEY = 'uni_accent'

export function getStoredAccent(): AccentId {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'blue' || v === 'orange' || v === 'uni') return v
  } catch {
    /* ignore */
  }
  return 'uni'
}

export function setStoredAccent(id: AccentId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
  applyAccentToDocument(id)
}

export function applyAccentToDocument(id?: AccentId): void {
  const accent = id ?? getStoredAccent()
  document.documentElement.setAttribute('data-accent', accent)
}
