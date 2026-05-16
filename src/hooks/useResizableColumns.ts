import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'

export function useResizableColumns(tableId: string, defaults: Record<string, number>) {
  const storageKey = `uni_col_widths_${tableId}`

  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) return { ...defaults, ...(JSON.parse(raw) as Record<string, number>) }
    } catch { /* ignore */ }
    return { ...defaults }
  })

  const dragRef = useRef<{ colId: string; startX: number; startW: number } | null>(null)

  const onMove = useCallback((e: MouseEvent) => {
    const d = dragRef.current
    if (!d) return
    const next = Math.max(56, d.startW + (e.clientX - d.startX))
    setWidths(prev => ({ ...prev, [d.colId]: next }))
  }, [])

  const onUp = useCallback(() => {
    dragRef.current = null
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    setWidths(w => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(w))
      } catch { /* ignore */ }
      return w
    })
  }, [onMove, storageKey])

  const startResize = useCallback(
    (colId: string, e: ReactMouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = { colId, startX: e.clientX, startW: widths[colId] ?? defaults[colId] ?? 100 }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [widths, defaults, onMove, onUp],
  )

  return { widths, startResize }
}
