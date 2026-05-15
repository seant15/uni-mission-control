import { useEffect, useState } from 'react'
import { Building2, ChevronDown } from 'lucide-react'
import { useAgency } from '../contexts/AgencyContext'

/**
 * Super-admin: switch agency container (UNI vs Demo). Locks data scope for clients, performance, alerts.
 */
export default function AgencySwitcher({ collapsed }: { collapsed?: boolean }) {
  const { agencies, currentAgencyId, currentAgency, setCurrentAgencyId, canSwitchAgency, loading } = useAgency()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!canSwitchAgency || agencies.length === 0) return
    if (currentAgencyId && agencies.some(a => a.id === currentAgencyId)) return
    const uni = agencies.find(a => a.slug === 'uni')
    setCurrentAgencyId(uni?.id ?? agencies[0].id)
  }, [agencies, currentAgencyId, canSwitchAgency, setCurrentAgencyId])

  if (!canSwitchAgency) return null

  const label = currentAgency?.name ?? (loading ? 'Loading…' : 'All agencies')

  return (
    <div className={`relative ${collapsed ? 'lg:hidden' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="uni-sidebar-control-shell mt-1.5 w-full flex items-start gap-1.5 rounded-lg border px-2 py-1.5 transition"
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Switch agency account (clients and users under this org)"
      >
        <Building2 size={14} className="shrink-0 text-orange-300 mt-0.5" aria-hidden />
        <span className="flex-1 min-w-0">{label}</span>
        <ChevronDown size={13} className="shrink-0 opacity-80" aria-hidden />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] cursor-default"
            aria-label="Close agency menu"
            onClick={() => setOpen(false)}
          />
          <ul
            className="uni-sidebar-control-menu absolute left-0 right-0 top-full z-[70] mt-1 max-h-48 overflow-y-auto rounded-lg border py-1"
            role="listbox"
          >
            <li>
              <button
                type="button"
                role="option"
                className={`w-full px-2 py-1.5 text-left text-[11px] font-semibold ${
                  !currentAgencyId ? 'is-selected' : ''
                }`}
                onClick={() => {
                  setCurrentAgencyId(null)
                  setOpen(false)
                }}
              >
                All agencies (combined)
              </button>
            </li>
            {agencies.map(a => (
              <li key={a.id}>
                <button
                  type="button"
                  role="option"
                  className={`w-full px-2 py-1.5 text-left text-[11px] font-medium ${
                    currentAgencyId === a.id ? 'is-selected' : ''
                  }`}
                  onClick={() => {
                    setCurrentAgencyId(a.id)
                    setOpen(false)
                  }}
                >
                  {a.name}
                  <span className="text-stone-500 font-normal"> · {a.slug}</span>
                </button>
              </li>
            ))}
            {agencies.length === 0 && !loading && (
              <li className="px-2 py-2 text-[10px] text-amber-200/90 leading-snug">
                Run migration 20260517120000_agencies_and_scoping.sql in Supabase to enable agency switching.
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  )
}
