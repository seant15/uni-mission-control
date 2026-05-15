import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useShellPreview } from '../contexts/ShellPreviewContext'

type Row = { id: string; display_name: string | null; role: string | null }

/**
 * Super-admin: preview org shell (title / logo / density) as another app user would see it.
 * Stored in sessionStorage under `uni_shell_preview_user_id`.
 */
export default function ShellPreviewControl({
  collapsed,
  isSuperAdmin,
  currentUserId,
}: {
  collapsed?: boolean
  isSuperAdmin: boolean
  currentUserId: string | undefined
}) {
  const shellPreview = useShellPreview()
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isSuperAdmin || !open) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('app_users')
        .select('id, display_name, role')
        .order('display_name', { ascending: true })
        .limit(80)
      if (!cancelled && !error && data) setUsers(data as Row[])
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [isSuperAdmin, open])

  if (!isSuperAdmin || !shellPreview || !currentUserId) return null

  const previewId = shellPreview.previewUserId
  const activeLabel =
    previewId === 'default_user'
      ? 'Org default'
      : previewId && previewId !== currentUserId
        ? users.find(u => u.id === previewId)?.display_name?.trim() || `${previewId.slice(0, 8)}…`
        : 'My account'

  return (
    <div className={`relative ${collapsed ? 'lg:hidden' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="uni-sidebar-control mt-1 w-full flex items-start justify-between gap-1 rounded-lg border border-white/25 bg-white/10 px-2 py-1.5 hover:bg-white/15 transition"
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Preview shell branding as another user (sidebar + header only)"
      >
        <span className="uni-sidebar-control-label min-w-0 flex-1">Shell: {activeLabel}</span>
        <ChevronDown size={14} className="shrink-0 opacity-80" aria-hidden />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-[60] cursor-default" aria-label="Close menu" onClick={() => setOpen(false)} />
          <ul
            className="absolute left-0 right-0 top-full z-[70] mt-1 max-h-52 overflow-y-auto rounded-lg border border-slate-600/80 bg-slate-900 py-1 shadow-xl"
            role="listbox"
          >
            <li>
              <button
                type="button"
                role="option"
                className="w-full px-2 py-1.5 text-left text-[11px] text-slate-100 hover:bg-slate-800"
                onClick={() => {
                  shellPreview.setPreviewUserId(null)
                  setOpen(false)
                }}
              >
                My account (signed-in)
              </button>
            </li>
            <li>
              <button
                type="button"
                role="option"
                className="w-full px-2 py-1.5 text-left text-[11px] text-slate-100 hover:bg-slate-800"
                onClick={() => {
                  shellPreview.setPreviewUserId('default_user')
                  setOpen(false)
                }}
              >
                Org row (default_user)
              </button>
            </li>
            {loading && <li className="px-2 py-1 text-[10px] text-slate-400">Loading…</li>}
            {!loading &&
              users
                .filter(u => u.id !== currentUserId)
                .map(u => (
                  <li key={u.id}>
                    <button
                      type="button"
                      role="option"
                      className={`w-full px-2 py-1.5 text-left text-[11px] hover:bg-slate-800 ${
                        previewId === u.id ? 'text-[var(--brand-300)]' : 'text-slate-200'
                      }`}
                      onClick={() => {
                        shellPreview.setPreviewUserId(u.id)
                        setOpen(false)
                      }}
                    >
                      {(u.display_name || u.id).slice(0, 40)}
                      {u.role ? <span className="text-slate-500"> · {u.role}</span> : null}
                    </button>
                  </li>
                ))}
          </ul>
        </>
      )}
    </div>
  )
}
