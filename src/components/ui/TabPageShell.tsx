import type { ReactNode } from 'react'
import { useDensitySectionClass } from '../../contexts/UiDensityContext'
import TabNav, { type TabNavItem } from './TabNav'

export type { TabNavItem }

/** Top-level tab route wrapper — title, optional tabs, density-aware stack */
export default function TabPageShell({
  title,
  subtitle,
  icon,
  headerExtra,
  tabs,
  activeTabId,
  onTabChange,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  headerExtra?: ReactNode
  tabs?: TabNavItem[]
  activeTabId?: string
  onTabChange?: (id: string) => void
  children: ReactNode
  className?: string
}) {
  const sectionClass = useDensitySectionClass()

  return (
    <div className={`uni-tab-page ${sectionClass} ${className}`}>
      <header className="uni-tab-page-header">
        <div className="uni-tab-page-heading">
          {icon ? <span className="uni-tab-page-icon">{icon}</span> : null}
          <div>
            <h1 className="uni-tab-page-title">{title}</h1>
            {subtitle ? <p className="uni-tab-page-subtitle">{subtitle}</p> : null}
          </div>
        </div>
        {tabs && activeTabId && onTabChange ? (
          <TabNav tabs={tabs} activeId={activeTabId} onChange={onTabChange} />
        ) : null}
        {headerExtra}
      </header>
      {children}
    </div>
  )
}
