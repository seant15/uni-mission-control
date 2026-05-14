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
      className={`sticky top-0 z-30 rounded-lg border border-slate-200/90 bg-white/95 backdrop-blur-sm shadow-sm px-2 py-1.5 sm:px-2.5 sm:py-2 flex flex-wrap items-center gap-1.5 sm:gap-2 ${className}`}
    >
      {children}
    </div>
  )
}
