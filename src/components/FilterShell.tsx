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
      className={`sticky z-30 rounded-xl border border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm px-2.5 py-2 sm:px-3 sm:py-2 flex flex-wrap items-center gap-1.5 sm:gap-2 ${
        stickyBelowHeader ? 'uni-filter-sticky-below-header' : 'top-0'
      } ${className}`}
    >
      {children}
    </div>
  )
}
