/** Light / dark / system theme for Mission Control (personal preference). */

export type UiTheme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'uni_ui_theme'

export function getStoredUiTheme(): UiTheme {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'system'
}

export function setStoredUiTheme(theme: UiTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore */
  }
  applyUiThemeToDocument(theme)
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Resolve light/dark for DOM attribute. */
export function resolveUiTheme(theme?: UiTheme): 'light' | 'dark' {
  const t = theme ?? getStoredUiTheme()
  if (t === 'dark') return 'dark'
  if (t === 'light') return 'light'
  return systemPrefersDark() ? 'dark' : 'light'
}

export function applyUiThemeToDocument(theme?: UiTheme): void {
  const resolved = resolveUiTheme(theme)
  document.documentElement.setAttribute('data-theme', resolved)
  // Native controls follow active dashboard theme.
  document.documentElement.style.colorScheme = resolved
}

export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => onChange()
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
