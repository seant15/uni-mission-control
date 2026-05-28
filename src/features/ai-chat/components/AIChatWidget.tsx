import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, X, Send, RotateCcw, Loader2, AlertCircle, Download } from 'lucide-react'
import { useChat } from '../hooks/useChat'
import { ChatMessage } from './ChatMessage'
import { QuickActionBar } from './QuickActionBar'
import type { WorkflowType } from '../types/chat'

export function AIChatWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [pendingWorkflow, setPendingWorkflow] = useState<WorkflowType | undefined>()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const { messages, isLoading, isLoadingHistory, error, sendMessage, startNewChat } = useChat()

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 80)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    setPendingWorkflow(undefined)
    await sendMessage(text, pendingWorkflow)
  }, [input, isLoading, pendingWorkflow, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleQuickAction = (template: string, workflowType: WorkflowType) => {
    setInput(template)
    setPendingWorkflow(workflowType)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const handleDownload = (content: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `uni-ai-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleNewChat = () => {
    startNewChat()
    setInput('')
    setPendingWorkflow(undefined)
  }

  const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant')

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-[4.5rem] right-6 z-50 w-[22rem] sm:w-[26rem] max-h-[75vh] bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden"
          style={{ maxHeight: 'min(75vh, 640px)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-800 text-white flex-shrink-0">
            <Bot size={18} className="text-[var(--brand-400,#fb923c)] flex-shrink-0" />
            <span className="font-semibold text-sm flex-1">UNI AI Assistant</span>
            <button
              onClick={handleNewChat}
              title="New chat"
              className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={() => setOpen(false)}
              title="Close"
              className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition"
            >
              <X size={16} />
            </button>
          </div>

          {/* Quick action buttons */}
          <QuickActionBar onSelect={handleQuickAction} disabled={isLoading} />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-stone-50">
            {isLoadingHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin text-stone-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                <Bot size={32} className="text-stone-300" />
                <p className="text-sm text-stone-500 font-medium">How can I help today?</p>
                <p className="text-xs text-stone-400">Pick a workflow above or type a message</p>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="group">
                  <ChatMessage message={msg} />
                  {msg.role === 'assistant' && msg.content.length > 80 && (
                    <div className="flex justify-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDownload(msg.content)}
                        className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-stone-600 transition"
                      >
                        <Download size={10} />
                        Download
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-2.5 items-center">
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <Loader2 size={13} className="animate-spin text-slate-200" />
                </div>
                <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                <AlertCircle size={13} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Download last response button */}
          {lastAssistantMessage && !isLoading && (
            <div className="px-3 pt-1 flex-shrink-0 bg-stone-50 border-t border-stone-100">
              <button
                onClick={() => handleDownload(lastAssistantMessage.content)}
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-[var(--brand-600)] py-1.5 transition"
              >
                <Download size={12} />
                Download last response
              </button>
            </div>
          )}

          {/* Input area */}
          <div className="px-3 pb-3 pt-2 border-t border-stone-100 flex-shrink-0 bg-white">
            <div className="flex items-end gap-2 bg-stone-50 rounded-xl border border-stone-200 focus-within:border-[var(--brand-400,#fb923c)] focus-within:ring-1 focus-within:ring-[var(--brand-300,#fdba74)] transition px-3 py-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Shift+Enter for new line)"
                rows={1}
                disabled={isLoading}
                className="flex-1 resize-none bg-transparent text-sm text-stone-800 placeholder-stone-400 outline-none leading-relaxed min-h-[24px] max-h-32 disabled:opacity-60"
                style={{ height: 'auto', overflowY: input.split('\n').length > 4 ? 'auto' : 'hidden' }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`
                }}
              />
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || isLoading}
                className="w-8 h-8 rounded-lg bg-[var(--brand-600,#ea580c)] text-white flex items-center justify-center hover:bg-[var(--brand-700,#c2410c)] disabled:opacity-40 disabled:cursor-not-allowed transition flex-shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
            <p className="text-[10px] text-stone-400 mt-1.5 text-center">
              Powered by Claude · Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        title={open ? 'Close AI Assistant' : 'Open AI Assistant'}
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          open
            ? 'bg-slate-700 text-white hover:bg-slate-600 rotate-0'
            : 'bg-slate-800 text-white hover:bg-slate-700 hover:scale-105'
        }`}
      >
        {open ? <X size={20} /> : <Bot size={22} />}
        {messages.length > 0 && !open && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-[var(--brand-500,#f97316)] rounded-full border-2 border-white" />
        )}
      </button>
    </>
  )
}
