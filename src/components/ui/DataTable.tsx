import type { ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes, HTMLAttributes } from 'react'
import ReportSectionHeader from '../ReportSectionHeader'

type Align = 'left' | 'right' | 'center'

function alignClass(align?: Align) {
  if (align === 'right') return 'uni-data-table-th-right'
  if (align === 'center') return 'uni-data-table-th-center'
  return ''
}

/** Card wrapper for tables — replaces raw bg-white rounded-xl shells */
export function DataTableShell({
  children,
  className = '',
  flush = false,
}: {
  children: ReactNode
  className?: string
  /** No overflow:hidden — for dropdowns inside cells */
  flush?: boolean
}) {
  return (
    <div className={`uni-section-panel ${flush ? 'uni-section-panel-flush' : ''} uni-data-table-shell ${className}`}>
      {children}
    </div>
  )
}

export function DataTable({
  children,
  className = '',
  minWidth,
  style,
  ...rest
}: TableHTMLAttributes<HTMLTableElement> & { minWidth?: number | string }) {
  const mergedStyle =
    minWidth != null
      ? { ...style, minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth }
      : style
  return (
    <table className={`uni-data-table ${className}`.trim()} style={mergedStyle} {...rest}>
      {children}
    </table>
  )
}

export function DataTableHead({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <thead className={`uni-data-table-head ${className}`.trim()}>{children}</thead>
}

export function DataTableHeadCell({
  children,
  className = '',
  align,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: Align }) {
  return (
    <th className={`uni-data-table-th ${alignClass(align)} ${className}`.trim()} {...rest}>
      {children}
    </th>
  )
}

export function DataTableBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <tbody className={`uni-data-table-body ${className}`.trim()}>{children}</tbody>
}

export function DataTableRow({
  children,
  className = '',
  clickable,
  ...rest
}: HTMLAttributes<HTMLTableRowElement> & { clickable?: boolean }) {
  return (
    <tr
      className={`uni-data-table-row ${clickable ? 'uni-data-table-row-clickable' : ''} ${className}`.trim()}
      {...rest}
    >
      {children}
    </tr>
  )
}

export function DataTableCell({
  children,
  className = '',
  muted,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { muted?: boolean }) {
  return (
    <td
      className={`uni-data-table-cell ${muted ? 'uni-data-table-cell-muted' : ''} ${className}`.trim()}
      {...rest}
    >
      {children}
    </td>
  )
}

/** Section card with optional ReportSectionHeader */
export default function DashboardSection({
  sectionLabel,
  title,
  badge,
  header,
  children,
  className = '',
  flush = false,
  bodyClassName = '',
}: {
  sectionLabel?: string
  title?: string
  badge?: ReactNode
  header?: ReactNode
  children: ReactNode
  className?: string
  flush?: boolean
  bodyClassName?: string
}) {
  const showBuiltHeader = title != null

  return (
    <section className={`uni-section-panel ${flush ? 'uni-section-panel-flush' : ''} ${className}`}>
      {header}
      {showBuiltHeader && (
        <div className="uni-card-header">
          <ReportSectionHeader sectionLabel={sectionLabel} title={title!} badge={badge} />
        </div>
      )}
      <div className={bodyClassName || (showBuiltHeader || header ? 'uni-card-body' : '')}>{children}</div>
    </section>
  )
}
