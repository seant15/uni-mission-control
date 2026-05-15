import type { ReactNode } from 'react'

/**
 * Shared sticky filter strip for overview / analytics pages (compact, consistent).
 */
export default function FilterShell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`sticky top-0 z-30 rounded-xl border border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm px-2.5 py-2 sm:px-3 sm:py-2 flex flex-wrap items-center gap-1.5 sm:gap-2 ${className}`}
    >
      {children}
    </div>
  )
}
