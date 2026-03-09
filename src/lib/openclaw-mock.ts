/**
 * Mock implementation of OpenClaw gateway functions
 * Used as fallback when the real gateway is unavailable
 */

import type { SpawnSessionResponse } from './openclaw'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const getMockAgentResponse = (agentId: string) => {
  const responses = [
    `Hello! I'm ${agentId}. How can I help you?`,
    `Task received. I'll start working on it right away.`,
    `I've completed the analysis. Here are my findings...`,
    `Let me check on that for you.`
  ]
  return responses[Math.floor(Math.random() * responses.length)]
}

// Track active mock sessions in memory
const activeMockSessions = new Map<string, {
  agentId: string
  status: 'running' | 'completed' | 'failed'
  messages: string[]
  createdAt: Date
}>()

/**
 * Mock version of spawnSession
 */
export async function spawnSessionMock(agentId: string, _task: string): Promise<SpawnSessionResponse> {
  await delay(500) // Simulate network delay

  const sessionKey = `mock-session-${agentId}-${Date.now()}`

  // Store session
  activeMockSessions.set(sessionKey, {
    agentId,
    status: 'running',
    messages: [getMockAgentResponse(agentId)],
    createdAt: new Date()
  })

  return {
    sessionKey,
    status: 'running'
  }
}

/**
 * Mock version of sendMessage
 */
export async function sendMessageMock(sessionKey: string, _message: string): Promise<void> {
  await delay(300)

  const session = activeMockSessions.get(sessionKey)
  if (!session) {
    throw new Error('Session not found')
  }

  // Add agent response after user message
  const response = getMockAgentResponse(session.agentId)
  session.messages.push(response)
}

/**
 * Mock version of getSessionStatus
 */
export async function getSessionStatusMock(sessionKey: string): Promise<{
  status: string
  lastMessage?: string
}> {
  await delay(200)

  const session = activeMockSessions.get(sessionKey)
  if (!session) {
    return {
      status: 'not_found'
    }
  }

  return {
    status: session.status,
    lastMessage: session.messages[session.messages.length - 1]
  }
}

/**
 * Mock version of listSessions
 */
export async function listSessionsMock(): Promise<any[]> {
  await delay(300)

  return Array.from(activeMockSessions.entries()).map(([sessionKey, session]) => ({
    sessionKey,
    agentId: session.agentId,
    status: session.status,
    startedAt: session.createdAt.toISOString()
  }))
}

/**
 * Mock version of uploadFile
 */
export async function uploadFileMock(sessionKey: string, file: File): Promise<string> {
  await delay(1000) // Simulate upload time

  const session = activeMockSessions.get(sessionKey)
  if (!session) {
    throw new Error('Session not found')
  }

  // Return mock file URL
  return `https://storage.mock.example.com/uploads/${file.name}`
}

/**
 * Mock version of subscribeToSession
 * Returns a cleanup function like the real implementation
 */
export function subscribeToSessionMock(
  sessionKey: string,
  onMessage: (message: any) => void,
  onError?: (error: Error) => void
): () => void {
  // Simulate periodic messages
  const interval = setInterval(() => {
    const session = activeMockSessions.get(sessionKey)
    if (!session) {
      if (onError) {
        onError(new Error('Session not found'))
      }
      clearInterval(interval)
      return
    }

    // Randomly send updates
    if (Math.random() > 0.7) {
      onMessage({
        type: 'status_update',
        status: session.status,
        message: getMockAgentResponse(session.agentId)
      })
    }
  }, 3000)

  return () => clearInterval(interval)
}
