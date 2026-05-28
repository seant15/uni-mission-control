import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import type { ChatMessage, WorkflowType } from '../types/chat'

const STORAGE_KEY = 'uni_ai_chat_conversation_id'

export function useChat() {
  const { user } = useAuth()
  const [conversationId, setConversationId] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
  })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load existing messages when conversationId is set
  useEffect(() => {
    if (!conversationId) { setMessages([]); return }
    setIsLoadingHistory(true)
    supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .then(({ data, error: err }) => {
        if (!err && data) setMessages(data as ChatMessage[])
        setIsLoadingHistory(false)
      })
  }, [conversationId])

  // Subscribe to realtime new messages for current conversation
  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`ai-messages-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ai_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages(prev => {
            const incoming = payload.new as ChatMessage
            // avoid duplicates (optimistic updates may already have it)
            if (prev.some(m => m.id === incoming.id)) return prev
            return [...prev, incoming]
          })
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [conversationId])

  const createConversation = useCallback(async (workflowType?: WorkflowType): Promise<string | null> => {
    if (!user) return null
    const { data, error: err } = await supabase
      .from('ai_conversations')
      .insert({ user_id: user.id, workflow_type: workflowType ?? null })
      .select()
      .single()
    if (err || !data) { console.error('create conversation failed:', err); return null }
    const id = (data as { id: string }).id
    setConversationId(id)
    try { localStorage.setItem(STORAGE_KEY, id) } catch { /* ignore */ }
    return id
  }, [user])

  const sendMessage = useCallback(async (content: string, workflowType?: WorkflowType) => {
    if (!user || !content.trim()) return
    setError(null)
    setIsLoading(true)

    try {
      // Create conversation on first message
      let convId = conversationId
      if (!convId) {
        convId = await createConversation(workflowType)
        if (!convId) throw new Error('Could not create conversation')
      }

      // Optimistic user message
      const tempId = `temp-${Date.now()}`
      const tempMsg: ChatMessage = {
        id: tempId,
        conversation_id: convId,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
        action_type: workflowType ?? null,
      }
      setMessages(prev => [...prev, tempMsg])

      // Save user message to Supabase
      const { data: savedUserMsg, error: saveErr } = await supabase
        .from('ai_messages')
        .insert({
          conversation_id: convId,
          role: 'user',
          content,
          action_type: workflowType ?? null,
        })
        .select()
        .single()

      if (saveErr) throw saveErr

      // Replace temp message with real one
      setMessages(prev => prev.map(m => m.id === tempId ? (savedUserMsg as ChatMessage) : m))

      // Update conversation title from first user message
      if (messages.length === 0) {
        const title = content.slice(0, 80) + (content.length > 80 ? '...' : '')
        void supabase.from('ai_conversations').update({ title }).eq('id', convId)
      }

      // Build history for API (exclude temp and system messages)
      const history = [...messages.filter(m => m.role !== 'system'), savedUserMsg as ChatMessage]
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      // Call Claude API — assistant message is saved server-side
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId, messages: history }),
      })

      if (!res.ok) {
        const { error: apiErr } = await res.json().catch(() => ({ error: 'AI error' }))
        throw new Error(apiErr || `API ${res.status}`)
      }

      // messages table gets the assistant reply via realtime subscription above

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [user, conversationId, messages, createConversation])

  const startNewChat = useCallback(() => {
    setConversationId(null)
    setMessages([])
    setError(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  return { messages, isLoading, isLoadingHistory, error, sendMessage, startNewChat, conversationId }
}
