import type { ReactNode } from 'react'

/** Matches Spend & revenue by platform (uni-card) title styling. */
export default function ReportSectionHeader({
  sectionLabel = 'Attribution',
  title,
  badge,
  className = '',
}: {
  sectionLabel?: string
  title: string
  badge?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div>
        {sectionLabel ? <p className="uni-section-label mb-2">{sectionLabel}</p> : null}
        <h3 className="uni-card-title">{title}</h3>
      </div>
      {badge}
    </div>
  )
}
