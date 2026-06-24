import type { ReactNode, MouseEvent as ReactMouseEvent } from 'react'

type Align = 'left' | 'right' | 'center'

const VARIANT_CLASS: Record<string, string> = {
  default: 'relative px-4 py-3 text-xs font-medium text-gray-500',
  'data-table': 'relative uni-data-table-th',
  compact: 'relative px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase',
}

type Props = {
  id: string
  widths: Record<string, number>
  startResize: (colId: string, e: ReactMouseEvent) => void
  align?: Align
  variant?: keyof typeof VARIANT_CLASS
  className?: string
  children?: ReactNode
}

export default function ResizableTh({
  id,
  widths,
  startResize,
  align = 'left',
  variant = 'default',
  className = '',
  children,
}: Props) {
  const w = widths[id]
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  return (
    <th
      style={{ width: w, minWidth: w, maxWidth: w }}
      className={`${VARIANT_CLASS[variant] ?? VARIANT_CLASS.default} ${alignClass} ${className}`.trim()}
    >
      <span className={align === 'right' ? 'pr-2 inline-block' : ''}>{children}</span>
      <div
        aria-hidden
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-[var(--brand-600)]/25"
        onMouseDown={e => startResize(id, e)}
      />
    </th>
  )
}
