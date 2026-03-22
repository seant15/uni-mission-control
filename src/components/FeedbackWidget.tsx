import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquarePlus, X, CheckCircle } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../lib/api'
import { supabase } from '../lib/supabase'
import FeedbackAttachmentZone, { type PendingFile } from './FeedbackAttachmentZone'
import type { FeedbackSeverity, FeedbackCategory, AttachmentMeta } from '../types/feedback'
import { CATEGORY_LABELS } from '../types/feedback'

const MAX_CHARS = 600
const SUBMIT_COOLDOWN_MS = 30_000
const AUTO_CLOSE_MS = 4_000

const SEVERITY_OPTIONS: FeedbackSeverity[] = ['low', 'medium', 'high', 'critical']
const SEVERITY_PILL: Record<FeedbackSeverity, string> = {
  low:      'border-gray-300 text-gray-600 hover:bg-gray-50',
  medium:   'border-yellow-400 text-yellow-700 hover:bg-yellow-50',
  high:     'border-orange-400 text-orange-700 hover:bg-orange-50',
  critical: 'border-red-400 text-red-700 hover:bg-red-50',
}
const SEVERITY_ACTIVE: Record<FeedbackSeverity, string> = {
  low:      'bg-gray-100 border-gray-400 text-gray-700',
  medium:   'bg-yellow-100 border-yellow-500 text-yellow-800',
  high:     'bg-orange-100 border-orange-500 text-orange-800',
  critical: 'bg-red-100 border-red-500 text-red-800',
}

export default function FeedbackWidget() {
  const { appUser, user } = useAuth()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<FeedbackSeverity | null>(null)
  const [files, setFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [aiCategory, setAiCategory] = useState<FeedbackCategory>('general')
  const [cooldown, setCooldown] = useState(false)
  const [cooldownSecs, setCooldownSecs] = useState(0)
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Capture page context when widget opens
  const pageUrl = useRef('')
  const pageTitle = useRef('')

  const handleClose = useCallback(() => {
    // Revoke any object URLs to avoid memory leaks
    // (Files haven't been uploaded to Storage yet in our flow, so no remote cleanup needed)
    setFiles(prev => {
      prev.forEach(pf => { if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl) })
      return []
    })
    setOpen(false)
    setMessage('')
    setSeverity(null)
    setSubmitted(false)
    setSubmittedId(null)
    setAiCategory('general')
  }, [])

  useEffect(() => {
    if (open) {
      pageUrl.current = window.location.href
      pageTitle.current = document.title
    }
  }, [open])

  // Focus trap + Escape to close
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, handleClose])

  // Auto-close after success
  useEffect(() => {
    if (submitted) {
      autoCloseTimer.current = setTimeout(() => handleClose(), AUTO_CLOSE_MS)
    }
    return () => { if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current) }
  }, [submitted, handleClose])

  const startCooldown = () => {
    setCooldown(true)
    setCooldownSecs(Math.ceil(SUBMIT_COOLDOWN_MS / 1000))
    cooldownTimer.current = setInterval(() => {
      setCooldownSecs(s => {
        if (s <= 1) {
          clearInterval(cooldownTimer.current!)
          setCooldown(false)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!appUser || !user) throw new Error('Not authenticated')
      setUploading(true)

      // 1. Insert feedback row (without attachments first)
      const { id } = await db.submitFeedback({
        user_id: appUser.id,
        auth_user_id: user.id,
        display_name: appUser.display_name,
        email: appUser.email,
        role: appUser.role,
        page_url: pageUrl.current,
        page_title: pageTitle.current,
        message,
        severity: severity ?? undefined,
        attachments: [],
        attachment_count: 0,
      })

      // 2. Upload any attachments and collect metadata (non-fatal if Storage not yet configured)
      if (files.length > 0) {
        try {
          const attachments: AttachmentMeta[] = await Promise.all(
            files.map(pf => db.uploadFeedbackAttachment(id, pf.file))
          )
          await supabase
            .from('feedback')
            .update({ attachments, attachment_count: attachments.length })
            .eq('id', id)
        } catch (uploadErr) {
          console.warn('[FeedbackWidget] attachment upload failed (Storage may not be configured):', uploadErr)
          // Feedback row is already saved — don't fail the whole submission
        }
      }

      setUploading(false)
      return id
    },
    onSuccess: (id) => {
      setSubmittedId(id)
      setSubmitted(true)
      startCooldown()
      queryClient.invalidateQueries({ queryKey: ['feedback'] })
      toast.success('Feedback sent — thank you!')
    },
    onError: (err: Error) => {
      setUploading(false)
      toast.error('Failed to send feedback. Try again.')
      console.error('[FeedbackWidget] submit error:', err)
    },
  })

  const categoryOverrideMutation = useMutation({
    mutationFn: (category: FeedbackCategory) => {
      if (!submittedId) throw new Error('No feedback id')
      return db.updateFeedbackCategory(submittedId, category)
    },
    onSuccess: () => toast.success('Category updated'),
    onError: () => toast.error('Failed to update category'),
  })

  const canSubmit = message.trim().length > 0 && !uploading && !submitMutation.isPending

  if (!appUser) return null

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => { if (!cooldown) setOpen(true) }}
        aria-label="Submit feedback"
        title={cooldown ? `Please wait ${cooldownSecs}s` : 'Send feedback'}
        className={`
          fixed bottom-6 right-6 z-50
          flex items-center gap-2 px-4 py-3 rounded-full shadow-lg
          transition-all duration-200
          ${cooldown
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-xl hover:scale-105'}
        `}
      >
        <MessageSquarePlus size={18} />
        <span className="text-sm font-medium hidden sm:inline">
          {cooldown ? `${cooldownSecs}s` : 'Feedback'}
        </span>
      </button>

      {/* Overlay backdrop (mobile only for non-intrusive feel) */}
      {open && (
        <div
          className="fixed inset-0 z-40 sm:pointer-events-none"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-out Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Feedback panel"
        className={`
          fixed z-50 bg-white shadow-2xl border border-gray-200
          transition-all duration-300 ease-out
          bottom-0 right-0
          w-full sm:w-[420px] sm:bottom-20 sm:right-6 sm:rounded-2xl
          ${open ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Send Feedback</h2>
          <button
            onClick={handleClose}
            aria-label="Close feedback panel"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          // ── Success State ──────────────────────────────────────────
          <div className="px-5 py-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={28} className="text-green-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">Thanks! Feedback received.</p>
              <p className="text-xs text-gray-500 mt-1">Panel closes automatically in a few seconds.</p>
            </div>

            {/* AI category override */}
            <div className="w-full bg-gray-50 rounded-xl px-4 py-3 text-left">
              <p className="text-xs text-gray-500 mb-2">We categorised this as:</p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-800 bg-white border border-gray-200 rounded-full px-3 py-1">
                  {CATEGORY_LABELS[aiCategory]}
                </span>
                <span className="text-xs text-gray-400">— Is this right?</span>
              </div>
              <select
                value={aiCategory}
                onChange={e => {
                  const val = e.target.value as FeedbackCategory
                  setAiCategory(val)
                  categoryOverrideMutation.mutate(val)
                }}
                className="mt-2 w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {(Object.keys(CATEGORY_LABELS) as FeedbackCategory[]).map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          // ── Form State ──────────────────────────────────────────────
          <div className="px-5 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Page context pill */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-400 truncate flex-1">
                {window.location.pathname}
              </span>
              <span className="text-xs text-gray-300 flex-shrink-0">auto-captured</span>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Severity <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                {SEVERITY_OPTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(severity === s ? null : s)}
                    className={`
                      px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition-colors
                      ${severity === s ? SEVERITY_ACTIVE[s] : SEVERITY_PILL[s]}
                    `}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label htmlFor="feedback-message" className="block text-xs font-medium text-gray-700 mb-2">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={e => setMessage(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Describe the issue or suggestion..."
                rows={5}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                style={{ minHeight: 120 }}
              />
              <p className={`text-xs text-right mt-1 ${message.length >= MAX_CHARS ? 'text-red-500' : 'text-gray-400'}`}>
                {message.length}/{MAX_CHARS}
              </p>
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Attachments <span className="text-gray-400 font-normal">(optional, max 5)</span>
              </label>
              <FeedbackAttachmentZone
                files={files}
                onChange={setFiles}
                disabled={uploading || submitMutation.isPending}
              />
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={!canSubmit}
              className={`
                w-full py-2.5 rounded-xl text-sm font-semibold transition-all
                ${canSubmit
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
              `}
            >
              {uploading || submitMutation.isPending ? 'Sending...' : 'Send Feedback'}
            </button>

            {/* Footer note */}
            <p className="text-xs text-center text-gray-400 pb-1">
              Your name and current page are automatically included.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
