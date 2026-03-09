// Use Vercel API proxy to avoid HTTPS/HTTP mixed content issues
// In production (Vercel), use /api/openclaw proxy
// In development, can use direct connection if needed
const USE_PROXY = (import.meta as any).env.VITE_USE_PROXY !== 'false'
const PROXY_URL = '/api/openclaw'
const DIRECT_GATEWAY_URL = (import.meta as any).env.VITE_OPENCLAW_GATEWAY_URL || 'http://open.unippc24.com:9090'
const GATEWAY_TOKEN = (import.meta as any).env.VITE_OPENCLAW_GATEWAY_TOKEN || 'uni-random-token'

// Helper function to build API URL
function buildApiUrl(path: string): string {
  if (USE_PROXY) {
    // Use Vercel proxy - path will be passed as query param
    return `${PROXY_URL}?path=${encodeURIComponent(path)}`
  }
  return `${DIRECT_GATEWAY_URL}${path}`
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
  const response = await fetch(buildApiUrl('/api/sessions/spawn'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GATEWAY_TOKEN}`,
    },
    body: JSON.stringify({
      agentId,
      task,
      mode: 'run',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to spawn session: ${response.statusText}`);
  }

  return response.json();
}

export async function sendMessage(sessionKey: string, message: string): Promise<void> {
  const response = await fetch(buildApiUrl('/api/sessions/send'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GATEWAY_TOKEN}`,
    },
    body: JSON.stringify({
      sessionKey,
      message,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }
}

export async function getSessionStatus(sessionKey: string): Promise<any> {
  const response = await fetch(buildApiUrl(`/api/sessions/status?sessionKey=${sessionKey}`), {
    headers: {
      'Authorization': `Bearer ${GATEWAY_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get session status: ${response.statusText}`);
  }

  return response.json();
}

export async function listSessions(): Promise<any[]> {
  const response = await fetch(buildApiUrl('/api/sessions/list'), {
    headers: {
      'Authorization': `Bearer ${GATEWAY_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list sessions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Upload file to agent session
 */
export async function uploadFile(sessionKey: string, file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('sessionKey', sessionKey)

  const response = await fetch(buildApiUrl('/api/sessions/upload'), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GATEWAY_TOKEN}`,
    },
    body: formData
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`)
  }

  const data = await response.json()
  return data.fileUrl
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
