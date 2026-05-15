import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { toast } from 'sonner'

const CHAT_URL = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_OPENCLAW_CHAT_URL

type Layout = 'standalone' | 'dock'

/**
 * OpenClaw chat FAB. Use `layout="dock"` when stacked with Feedback (bottom-right).
 */
export default function OpenClawChatWidget({ layout = 'standalone' }: { layout?: Layout }) {
  const [open, setOpen] = useState(false)

  function handleOpen() {
    if (!CHAT_URL?.trim()) {
      toast.message('OpenClaw URL not configured', {
        description: 'Set VITE_OPENCLAW_CHAT_URL in .env.local (e.g. your OpenClaw or embed URL).',
      })
      return
    }
    setOpen(true)
  }

  const fabClass =
    layout === 'dock'
      ? 'flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg ring-2 ring-white/90 transition hover:bg-slate-900 hover:scale-105'
      : 'fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg transition hover:bg-slate-900 hover:scale-105'

  return (
    <>
      <button type="button" onClick={handleOpen} title="Open OpenClaw chat" className={fabClass}>
        <MessageCircle size={layout === 'dock' ? 22 : 26} />
      </button>

      {open && CHAT_URL && (
        <div className="fixed inset-0 z-[90] flex items-end justify-start sm:items-center sm:justify-center sm:p-6 pointer-events-auto">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close overlay"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 flex h-[min(640px,85vh)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl pointer-events-auto">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <span className="font-semibold text-gray-900">OpenClaw</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <iframe
              title="OpenClaw chat"
              src={CHAT_URL}
              className="min-h-0 flex-1 w-full border-0 bg-white"
            />
          </div>
        </div>
      )}
    </>
  )
}
