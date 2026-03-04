const GATEWAY_URL = (import.meta as any).env.VITE_OPENCLAW_GATEWAY_URL || 'https://open.unippc24.com';
const GATEWAY_TOKEN = (import.meta as any).env.VITE_OPENCLAW_GATEWAY_TOKEN || 'uni-random-token';

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
  const response = await fetch(`${GATEWAY_URL}/api/sessions/spawn`, {
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
  const response = await fetch(`${GATEWAY_URL}/api/sessions/send`, {
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
  const response = await fetch(`${GATEWAY_URL}/api/sessions/status?sessionKey=${sessionKey}`, {
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
  const response = await fetch(`${GATEWAY_URL}/api/sessions/list`, {
    headers: {
      'Authorization': `Bearer ${GATEWAY_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list sessions: ${response.statusText}`);
  }

  return response.json();
}
