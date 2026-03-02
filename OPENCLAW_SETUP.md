# OpenClaw Integration Setup

## Environment Variables

Add these to your Vercel project environment variables:

```bash
VITE_OPENCLAW_GATEWAY_URL=https://open.unippc24.com
VITE_OPENCLAW_GATEWAY_TOKEN=uni-random-token
```

## API Client

Create `src/lib/openclaw.ts`:

```typescript
const GATEWAY_URL = import.meta.env.VITE_OPENCLAW_GATEWAY_URL;
const GATEWAY_TOKEN = import.meta.env.VITE_OPENCLAW_GATEWAY_TOKEN;

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
```

## Update Chat Function

In `MissionControl.tsx`, replace the mock `sendChatMessage`:

```typescript
import { spawnSession, sendMessage } from '../lib/openclaw';

const sendChatMessage = async () => {
  if (!chatMessage.trim()) return;
  
  // Add user message to UI
  const newMessage: ChatMessage = {
    id: Date.now().toString(),
    agent: chatAgent,
    from: 'user',
    message: chatMessage,
    type: 'text',
    timestamp: new Date().toISOString()
  };
  
  setChatMessages(prev => [...prev, newMessage]);
  setChatMessage('');
  
  try {
    // Spawn a session with the agent
    const session = await spawnSession(chatAgent, chatMessage);
    
    // Poll for response (you'll want to set up webhooks for production)
    const checkResponse = async () => {
      const status = await getSessionStatus(session.sessionKey);
      if (status.lastMessage) {
        const agentResponse: ChatMessage = {
          id: (Date.now() + 1).toString(),
          agent: chatAgent,
          from: 'agent',
          message: status.lastMessage,
          type: 'text',
          timestamp: new Date().toISOString()
        };
        setChatMessages(prev => [...prev, agentResponse]);
      }
    };
    
    // Check for response after a delay
    setTimeout(checkResponse, 2000);
    
  } catch (error) {
    console.error('Failed to communicate with agent:', error);
    // Show error in chat
    const errorMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      agent: chatAgent,
      from: 'agent',
      message: 'Sorry, I could not process your request. Please try again.',
      type: 'text',
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, errorMessage]);
  }
};
```

## Available Agents

Your OpenClaw has these agents available:
- `clover` 🍀 (Management)
- `mary` 📡 (Communications)
- `openclaw` 🛡️ (Monitoring)
- `nexus` 🔗 (Integrations)
- `writer` ✍️ (Content)
- `kimi` 🧪 (Technology)

## API Endpoints

The Gateway API is at: `https://open.unippc24.com`

Available endpoints:
- `POST /api/sessions/spawn` - Create new agent session
- `POST /api/sessions/send` - Send message to session
- `GET /api/sessions/status` - Get session status
- `GET /api/sessions/list` - List active sessions
