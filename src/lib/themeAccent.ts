export type AccentId = 'orange' | 'blue'

const STORAGE_KEY = 'uni_accent'

export function getStoredAccent(): AccentId {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'blue' ? 'blue' : 'orange'
  } catch {
    return 'orange'
  }
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
