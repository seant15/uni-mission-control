import type { ReactNode } from 'react'

/**
 * Shared sticky filter strip for overview / analytics pages (compact, consistent).
 */
export default function FilterShell({
  children,
  className = '',
  stickyBelowHeader = false,
}: {
  children: ReactNode
  className?: string
  stickyBelowHeader?: boolean
}) {
  return (
    <div
      className={`uni-filter-shell ${stickyBelowHeader ? 'uni-filter-sticky-below-header' : 'top-0'} ${className}`}
    >
      {children}
    </div>
  )
}
