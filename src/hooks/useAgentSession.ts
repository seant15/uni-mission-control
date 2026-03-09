import { useState, useCallback, useRef, useEffect } from 'react'
import { spawnSession, sendMessage, getSessionStatus } from '../lib/openclaw'

export interface ChatMessage {
  id: string
  agent: string
  from: 'user' | 'agent'
  message: string
  type: 'text' | 'voice' | 'attachment'
  timestamp: string
  attachmentUrl?: string
}

interface UseAgentSessionOptions {
  onMessage?: (message: ChatMessage) => void
  onError?: (error: Error) => void
}

/**
 * Hook for managing agent chat sessions
 */
export function useAgentSession(agentName: string, options: UseAgentSessionOptions = {}) {
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isPolling, setIsPolling] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Spawn a new session
  const spawn = useCallback(async (initialTask: string) => {
    try {
      const session = await spawnSession(agentName, initialTask)
      setSessionKey(session.sessionKey)
      return session
    } catch (error) {
      options.onError?.(error as Error)
      throw error
    }
  }, [agentName, options])

  // Send a message to the session
  const send = useCallback(async (message: string) => {
    if (!sessionKey) throw new Error('No active session')

    try {
      await sendMessage(sessionKey, message)
    } catch (error) {
      options.onError?.(error as Error)
      throw error
    }
  }, [sessionKey, options])

  // Start polling for responses
  const startPolling = useCallback((key: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current)

    let consecutiveErrors = 0
    const maxErrors = 3
    setIsPolling(true)

    pollingRef.current = setInterval(async () => {
      try {
        const status = await getSessionStatus(key)
        consecutiveErrors = 0

        if (status.lastMessage) {
          const agentResponse: ChatMessage = {
            id: Date.now().toString(),
            agent: agentName,
            from: 'agent',
            message: status.lastMessage,
            type: 'text',
            timestamp: new Date().toISOString()
          }

          setMessages(prev => {
            const last = prev[prev.length - 1]
            if (last?.from === 'agent' && last.message === status.lastMessage) {
              return prev
            }
            return [...prev, agentResponse]
          })

          options.onMessage?.(agentResponse)

          if (status.status === 'completed' || status.status === 'failed') {
            stopPolling()
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
        consecutiveErrors++

        if (consecutiveErrors >= maxErrors) {
          const errorMsg: ChatMessage = {
            id: Date.now().toString(),
            agent: agentName,
            from: 'agent',
            message: '⚠️ Connection lost. Please try again.',
            type: 'text',
            timestamp: new Date().toISOString()
          }
          setMessages(prev => [...prev, errorMsg])
          options.onError?.(new Error('Connection lost'))
          stopPolling()
        }
      }
    }, 2000)
  }, [agentName, options])

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setIsPolling(false)
    setSessionKey(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  // Add a message to the chat
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message])
  }, [])

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return {
    sessionKey,
    messages,
    isPolling,
    spawn,
    send,
    startPolling,
    stopPolling,
    addMessage,
    clearMessages,
    setMessages,
  }
}
