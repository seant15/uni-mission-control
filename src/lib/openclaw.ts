// OpenClaw Gateway configuration
// OpenClaw primarily uses WebSocket for communication, not REST API
const DIRECT_GATEWAY_URL = (import.meta as any).env.VITE_OPENCLAW_GATEWAY_URL || 'http://open.unippc24.com:9090'
const GATEWAY_TOKEN = (import.meta as any).env.VITE_OPENCLAW_GATEWAY_TOKEN || 'uni-random-token'
const USE_PROXY = (import.meta as any).env.VITE_USE_PROXY === 'true'

// Check if we're in HTTPS context (can't use WS, only WSS)
const isHttpsContext = typeof window !== 'undefined' && window.location.protocol === 'https:'

// Helper to build API URL (for HTTP fallback)
function buildApiUrl(path: string): string {
  if (USE_PROXY || isHttpsContext) {
    // Use Vercel serverless function proxy
    return `/api/openclaw?path=${encodeURIComponent(path)}`
  }
  return `${DIRECT_GATEWAY_URL}${path}`
}

// WebSocket connection for real-time communication (only in HTTP context)
let ws: WebSocket | null = null
const messageHandlers = new Map<string, (data: any) => void>()

// Initialize WebSocket connection (only works in HTTP context)
function getWebSocket(): WebSocket | null {
  // Cannot use WebSocket in HTTPS context with HTTP backend
  if (isHttpsContext) {
    console.warn('[OpenClaw] WebSocket disabled in HTTPS context, using HTTP fallback')
    return null
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    return ws
  }

  const wsUrl = DIRECT_GATEWAY_URL.replace('https', 'wss').replace('http', 'ws')
  ws = new WebSocket(`${wsUrl}/?token=${GATEWAY_TOKEN}`)

  ws.onopen = () => {
    console.log('[OpenClaw] WebSocket connected')
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      console.log('[OpenClaw] Received:', data)

      // Call registered handlers
      messageHandlers.forEach(handler => handler(data))
    } catch (error) {
      console.error('[OpenClaw] Failed to parse message:', error)
    }
  }

  ws.onerror = (error) => {
    console.error('[OpenClaw] WebSocket error:', error)
  }

  ws.onclose = () => {
    console.log('[OpenClaw] WebSocket closed')
    ws = null
  }

  return ws
}

// Send message via WebSocket or HTTP fallback
async function sendWebSocketMessage(message: any): Promise<any> {
  const socket = getWebSocket()

  // HTTP fallback for HTTPS contexts
  if (!socket) {
    console.log('[OpenClaw] Using HTTP fallback for:', message.type)

    // Map WebSocket message types to HTTP endpoints
    const endpoint = getHttpEndpoint(message)
    const response = await fetch(buildApiUrl(endpoint.path), {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
      },
      body: endpoint.method !== 'GET' ? JSON.stringify(endpoint.body) : undefined,
    })

    if (!response.ok) {
      throw new Error(`HTTP request failed: ${response.statusText}`)
    }

    return response.json()
  }

  // WebSocket path (for HTTP contexts)
  return new Promise((resolve, reject) => {
    if (socket.readyState !== WebSocket.OPEN) {
      reject(new Error('WebSocket not connected'))
      return
    }

    const messageId = crypto.randomUUID()
    const messageWithId = { ...message, id: messageId }

    // Register handler for response
    const handler = (data: any) => {
      if (data.id === messageId) {
        messageHandlers.delete(messageId)
        resolve(data)
      }
    }
    messageHandlers.set(messageId, handler)

    // Send message
    socket.send(JSON.stringify(messageWithId))

    // Timeout after 30 seconds
    setTimeout(() => {
      if (messageHandlers.has(messageId)) {
        messageHandlers.delete(messageId)
        reject(new Error('Request timeout'))
      }
    }, 30000)
  })
}

// Map WebSocket message types to HTTP endpoints
function getHttpEndpoint(message: any): { path: string; method: string; body?: any } {
  switch (message.type) {
    case 'spawn_session':
      return {
        path: '/api/sessions/spawn',
        method: 'POST',
        body: {
          agentId: message.agentId,
          task: message.task,
          mode: message.mode,
        },
      }
    case 'send_message':
      return {
        path: '/api/sessions/send',
        method: 'POST',
        body: {
          sessionKey: message.sessionKey,
          message: message.message,
        },
      }
    case 'get_session_status':
      return {
        path: `/api/sessions/status?sessionKey=${message.sessionKey}`,
        method: 'GET',
      }
    case 'list_sessions':
      return {
        path: '/api/sessions/list',
        method: 'GET',
      }
    case 'upload_file':
      return {
        path: '/api/sessions/upload',
        method: 'POST',
        body: {
          sessionKey: message.sessionKey,
          fileName: message.fileName,
          fileType: message.fileType,
          fileData: message.fileData,
        },
      }
    default:
      throw new Error(`Unknown message type: ${message.type}`)
  }
}

export interface SpawnSessionRequest {
  agentId: string;
  task: string;
  timeoutSeconds?: number;
}

export interface SpawnSessionResponse {
  sessionKey: string;
  status: string;
}

export async function spawnSession(agentId: string, task: string): Promise<SpawnSessionResponse> {
  const response = await sendWebSocketMessage({
    type: 'spawn_session',
    agentId,
    task,
    mode: 'run',
  })

  if (response.error) {
    throw new Error(`Failed to spawn session: ${response.error}`)
  }

  return {
    sessionKey: response.sessionKey,
    status: response.status,
  }
}

export async function sendMessage(sessionKey: string, message: string): Promise<void> {
  const response = await sendWebSocketMessage({
    type: 'send_message',
    sessionKey,
    message,
  })

  if (response.error) {
    throw new Error(`Failed to send message: ${response.error}`)
  }
}

export async function getSessionStatus(sessionKey: string): Promise<any> {
  const response = await sendWebSocketMessage({
    type: 'get_session_status',
    sessionKey,
  })

  if (response.error) {
    throw new Error(`Failed to get session status: ${response.error}`)
  }

  return response
}

export async function listSessions(): Promise<any[]> {
  const response = await sendWebSocketMessage({
    type: 'list_sessions',
  })

  if (response.error) {
    throw new Error(`Failed to list sessions: ${response.error}`)
  }

  return response.sessions || []
}

/**
 * Upload file to agent session
 * Note: File uploads may need to be handled differently via WebSocket
 */
export async function uploadFile(sessionKey: string, file: File): Promise<string> {
  // Convert file to base64 for WebSocket transmission
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const response = await sendWebSocketMessage({
    type: 'upload_file',
    sessionKey,
    fileName: file.name,
    fileType: file.type,
    fileData: base64,
  })

  if (response.error) {
    throw new Error(`Upload failed: ${response.error}`)
  }

  return response.fileUrl
}

/**
 * Subscribe to session updates via WebSocket (if available)
 * Falls back to polling if WebSocket not supported
 * Note: WebSocket connections cannot use the HTTP proxy, must connect directly
 */
export function subscribeToSession(
  sessionKey: string,
  onMessage: (message: any) => void,
  onError?: (error: Error) => void
): () => void {
  // Check if WebSocket is available
  if (typeof WebSocket === 'undefined') {
    console.warn('WebSocket not available, using polling instead')
    return () => {} // Return empty cleanup function
  }

  try {
    // WebSocket connections cannot use the proxy, must use direct connection
    const wsUrl = DIRECT_GATEWAY_URL.replace('https', 'wss').replace('http', 'ws')
    const ws = new WebSocket(`${wsUrl}/api/sessions/${sessionKey}`)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      if (onError) {
        onError(new Error('WebSocket connection failed'))
      }
    }

    ws.onclose = () => {
      console.log('WebSocket connection closed')
    }

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }
  } catch (error) {
    console.error('Failed to create WebSocket:', error)
    if (onError) {
      onError(error as Error)
    }
    return () => {}
  }
}
