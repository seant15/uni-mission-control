import type { ReactNode } from 'react'

/** Zero-row / all-clear block inside uni-section-panel */
export default function EmptyState({
  icon,
  title,
  description,
  children,
  className = '',
}: {
  icon?: ReactNode
  title: string
  description?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={`uni-empty-state ${className}`}>
      {icon ? <div className="mb-3 flex justify-center text-3xl">{icon}</div> : null}
      <p className="uni-empty-state-title">{title}</p>
      {description ? <p className="uni-empty-state-body">{description}</p> : null}
      {children}
    </div>
  )
}
