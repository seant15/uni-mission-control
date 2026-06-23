import { useSyncExternalStore } from 'react'

const GRID_LIGHT = '#e5e7eb'
const GRID_DARK = 'rgba(255, 255, 255, 0.07)'
const AXIS_LIGHT = '#64748b'
const AXIS_DARK = 'rgba(255, 255, 255, 0.45)'

function subscribeTheme(onChange: () => void): () => void {
  if (typeof document === 'undefined') return () => {}
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  mq.addEventListener('change', onChange)
  return () => {
    observer.disconnect()
    mq.removeEventListener('change', onChange)
  }
}

function getThemeSnapshot(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export function useResolvedUiTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => 'light')
}

export function useChartGridStroke(): string {
  return useResolvedUiTheme() === 'dark' ? GRID_DARK : GRID_LIGHT
}

export function useChartAxisStroke(): string {
  return useResolvedUiTheme() === 'dark' ? AXIS_DARK : AXIS_LIGHT
}
