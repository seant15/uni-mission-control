import { useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

const VIRTUAL_THRESHOLD = 35

type VirtualizedTableShellProps<T> = {
  rows: T[]
  colSpan: number
  maxHeight?: number
  rowHeight?: number
  tableClassName?: string
  thead: ReactNode
  tbodyClassName?: string
  renderRow: (row: T, index: number) => ReactNode
  wrapperClassName?: string
}

/**
 * Scrollable table with optional row virtualization for large drill-down lists.
 * Uses spacer rows so markup stays a valid HTML table.
 */
export default function VirtualizedTableShell<T>({
  rows,
  colSpan,
  maxHeight = 480,
  rowHeight = 49,
  tableClassName = 'w-full text-sm',
  thead,
  tbodyClassName = 'divide-y divide-gray-200',
  renderRow,
  wrapperClassName = '',
}: VirtualizedTableShellProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const useVirtual = rows.length >= VIRTUAL_THRESHOLD

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  })

  const virtualRows = useVirtual ? virtualizer.getVirtualItems() : []

  const tbodyContent = useVirtual ? (
    <>
      {virtualRows.length > 0 && virtualRows[0]!.start > 0 && (
        <tr aria-hidden="true">
          <td
            colSpan={colSpan}
            style={{ height: virtualRows[0]!.start, padding: 0, border: 'none', lineHeight: 0 }}
          />
        </tr>
      )}
      {virtualRows.map(vRow => renderRow(rows[vRow.index]!, vRow.index))}
      {virtualRows.length > 0 && (
        <tr aria-hidden="true">
          <td
            colSpan={colSpan}
            style={{
              height: virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1]!.end,
              padding: 0,
              border: 'none',
              lineHeight: 0,
            }}
          />
        </tr>
      )}
    </>
  ) : (
    rows.map((row, index) => renderRow(row, index))
  )

  return (
    <div
      ref={useVirtual ? scrollRef : undefined}
      className={`${useVirtual ? 'overflow-auto' : 'overflow-x-auto overflow-y-auto'} ${wrapperClassName}`.trim()}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className={tableClassName}>
        <thead className={useVirtual ? 'sticky top-0 z-10 bg-gray-50' : 'bg-gray-50'}>{thead}</thead>
        <tbody className={tbodyClassName}>{tbodyContent}</tbody>
      </table>
    </div>
  )
}
