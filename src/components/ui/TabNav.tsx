export type TabNavItem = {
  id: string
  label: string
  badge?: number | string
}

/** In-page tab bar — locked styling via .uni-tab-nav */
export default function TabNav({
  tabs,
  activeId,
  onChange,
  className = '',
}: {
  tabs: TabNavItem[]
  activeId: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div className={`uni-tab-nav ${className}`} role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeId === tab.id}
          onClick={() => onChange(tab.id)}
          className={`uni-tab-nav-item ${activeId === tab.id ? 'uni-tab-nav-item-active' : ''}`}
        >
          {tab.label}
          {tab.badge != null && Number(tab.badge) > 0 && (
            <span className="ml-1.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {typeof tab.badge === 'number' && tab.badge > 99 ? '99+' : tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
