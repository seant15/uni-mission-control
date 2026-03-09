# 🏗️ Architecture: Mock vs Real Data Flow

---

## 📊 Current Architecture (Mock Mode)

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Frontend)                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           MissionControl.tsx                          │  │
│  │  - Agent Fleet Display                                │  │
│  │  - Task Queue Table                                   │  │
│  │  - Chat Interface                                     │  │
│  └────────────┬─────────────────────────────┬────────────┘  │
│               │                             │                │
│               ▼                             ▼                │
│  ┌─────────────────────┐     ┌──────────────────────────┐  │
│  │   api.ts            │     │   openclaw.ts            │  │
│  │   getTasks()        │     │   spawnSession()         │  │
│  └──────┬──────────────┘     └────────┬─────────────────┘  │
│         │                              │                    │
│         │ if USE_MOCK_DATA = true      │ if USE_MOCK = true│
│         │                              │                    │
│         ▼                              ▼                    │
│  ┌─────────────────────┐     ┌──────────────────────────┐  │
│  │  mock-data.ts       │     │  openclaw-mock.ts        │  │
│  │  - mockTasks        │     │  - spawnSessionMock()    │  │
│  │  - mockAgentHealth  │     │  - sendMessageMock()     │  │
│  │  - mockSessions     │     │  - getStatusMock()       │  │
│  └─────────────────────┘     └──────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘

         No Network Calls ✅
         No Database Queries ✅
         All Data In-Memory ✅
```

**Key Points (Mock Mode)**:
- ✅ Everything runs in browser memory
- ✅ No backend required
- ✅ Instant responses (simulated delays)
- ✅ Perfect for demos and UI development
- ❌ Data doesn't persist
- ❌ No real AI responses

---

## 🌐 Future Architecture (Real Mode)

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Frontend)                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           MissionControl.tsx                          │  │
│  │  - Agent Fleet Display                                │  │
│  │  - Task Queue Table                                   │  │
│  │  - Chat Interface                                     │  │
│  └────────────┬─────────────────────────────┬────────────┘  │
│               │                             │                │
│               ▼                             ▼                │
│  ┌─────────────────────┐     ┌──────────────────────────┐  │
│  │   api.ts            │     │   openclaw.ts            │  │
│  │   getTasks()        │     │   spawnSession()         │  │
│  └──────┬──────────────┘     └────────┬─────────────────┘  │
│         │                              │                    │
└─────────┼──────────────────────────────┼────────────────────┘
          │                              │
          │ if USE_MOCK_DATA = false     │ if USE_MOCK = false
          │                              │
          ▼                              ▼
┌─────────────────────┐        ┌──────────────────────────────┐
│   Supabase Cloud    │        │  OpenClaw Gateway            │
│   (Database)        │        │  open.unippc24.com           │
│                     │        │                              │
│  ┌───────────────┐  │        │  ┌────────────────────────┐ │
│  │ agent_health  │  │        │  │ POST /sessions/spawn   │ │
│  │ agent_tasks   │  │        │  │ POST /sessions/send    │ │
│  │ agent_sessions│  │        │  │ GET  /sessions/status  │ │
│  │ chat_messages │  │        │  │ POST /sessions/upload  │ │
│  └───────────────┘  │        │  └────────────────────────┘ │
│                     │        │                              │
│  Real-time Updates  │        │  WebSocket Support           │
│  via Supabase       │        │  Real AI Agents              │
│  Subscriptions      │        │  File Storage                │
└─────────────────────┘        └──────────┬───────────────────┘
                                          │
                                          ▼
                               ┌──────────────────────┐
                               │  OpenClaw Agents     │
                               │  - clover            │
                               │  - mary              │
                               │  - openclaw          │
                               │  - nexus             │
                               │  - writer            │
                               │  - kimi              │
                               └──────────────────────┘
```

**Key Points (Real Mode)**:
- ✅ Persistent data in Supabase
- ✅ Real AI agent responses
- ✅ Real-time updates via WebSocket
- ✅ Production-ready
- ❌ Requires backend infrastructure
- ❌ Needs OpenClaw Gateway running
- ❌ Network latency

---

## 🔀 Switching Mechanism

### The Magic Line in `.env`:
```env
VITE_USE_MOCK_DATA=true   # Mock Mode 🎭
VITE_USE_MOCK_DATA=false  # Real Mode 🌐
```

### How It Works:

```typescript
// In api.ts
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true'

async getTasks(status?: string) {
    if (USE_MOCK_DATA) {
        // 🎭 Mock: Return in-memory data
        return mockTasks.filter(...)
    }

    // 🌐 Real: Query Supabase
    const { data } = await supabase.from('agent_tasks').select('*')
    return data
}
```

```typescript
// In MissionControl.tsx
const session = USE_MOCK_DATA
    ? await spawnSessionMock(agent, message)   // 🎭 Mock: Instant response
    : await spawnSession(agent, message)       // 🌐 Real: API call
```

---

## 📈 Data Flow Comparison

### Mock Mode Flow:
```
User Action
    ↓
Component (MissionControl.tsx)
    ↓
Check: USE_MOCK_DATA = true?
    ↓ YES
Mock Function (openclaw-mock.ts)
    ↓
Simulate Delay (500ms)
    ↓
Return Mock Data from Memory
    ↓
Update UI
    ↓
✅ Complete (Total: ~500ms)
```

### Real Mode Flow:
```
User Action
    ↓
Component (MissionControl.tsx)
    ↓
Check: USE_MOCK_DATA = false?
    ↓ NO (use real)
Real Function (openclaw.ts)
    ↓
HTTP Request to Gateway
    ↓
Gateway → OpenClaw Agent
    ↓
Agent Processes (may take seconds)
    ↓
Response → Gateway → Frontend
    ↓
Update Database (Supabase)
    ↓
Real-time Subscription Updates UI
    ↓
✅ Complete (Total: 2-10 seconds)
```

---

## 🎨 Component Hierarchy

```
App.tsx
  └── MissionControl.tsx
       ├── Agent Fleet Section
       │    └── AgentCard (x6)
       │         ├── Status Indicator
       │         ├── Active Tasks Count
       │         └── "Chat" Button
       │
       ├── Task Queue Section
       │    ├── Filter Dropdown
       │    ├── "New Task" Button
       │    └── Task Table
       │         └── TaskRow (x5 in mock)
       │              ├── Status Badge
       │              ├── Claim/Complete Buttons
       │              └── View/Delete Buttons
       │
       └── Modal Components
            ├── CreateTaskModal
            ├── TaskDetailModal
            └── ChatModal
                 ├── Message List
                 │    └── ChatMessage (user/agent)
                 └── Input Area
                      ├── File Upload Button
                      ├── Voice Record Button
                      ├── Text Input
                      └── Send Button
```

---

## 🔧 State Management

### React Query Cache (Both Modes):
```typescript
queryClient
  ├── ['health'] → Agent health data
  │    Mock: mockAgentHealth (6 agents)
  │    Real: Supabase agent_health table
  │
  ├── ['tasks', filter] → Task queue
  │    Mock: mockTasks (5 tasks)
  │    Real: Supabase agent_tasks table
  │
  └── ['activeSessions'] → Active chat sessions
       Mock: mockActiveSessions (2 sessions)
       Real: Gateway /api/sessions/list
```

### Local Component State:
```typescript
MissionControl Component State:
  ├── filter: 'all' | 'pending' | 'claimed' | 'completed' | 'failed'
  ├── showCreateModal: boolean
  ├── selectedTask: AgentTask | null
  ├── showChatModal: boolean
  ├── chatAgent: string
  ├── chatMessage: string
  ├── chatMessages: ChatMessage[]
  ├── activeSession: string | null (session key)
  ├── isRecording: boolean
  └── pollingRef: NodeJS.Timeout | null
```

---

## 📦 File Dependencies

### Mock Mode Dependencies:
```
MissionControl.tsx
  ├── depends on → openclaw-mock.ts
  │                 └── depends on → mock-data.ts
  └── depends on → api.ts
                    └── depends on → mock-data.ts
```

### Real Mode Dependencies:
```
MissionControl.tsx
  ├── depends on → openclaw.ts
  │                 └── depends on → OpenClaw Gateway API
  └── depends on → api.ts
                    └── depends on → Supabase Client
                                      └── depends on → Supabase Cloud
```

---

## 🚦 Error Handling

### Mock Mode (Simplified):
```typescript
try {
    const response = await spawnSessionMock(agent, message)
    // ✅ Always succeeds (unless file not found)
} catch (error) {
    // ❌ Rare: Only on programming errors
    console.error(error)
}
```

### Real Mode (Complex):
```typescript
try {
    const response = await spawnSession(agent, message)
    // ✅ Success: Session created
} catch (error) {
    // ❌ Many possible errors:
    // - Network timeout
    // - Gateway offline (Bad Gateway)
    // - Invalid token
    // - Agent unavailable
    // - Rate limiting
    console.error(error)
    showErrorToUser("Connection failed")
}
```

---

## 🔍 Debugging Tips

### Check Which Mode You're In:
```javascript
// In browser console:
console.log('Mock Mode:', import.meta.env.VITE_USE_MOCK_DATA)

// Should show:
// Mock Mode: "true"  → Using mock data ✅
// Mock Mode: undefined or "false" → Using real data 🌐
```

### Verify Mock Functions Are Running:
```typescript
// Add console.log in mock-data.ts:
export function getMockAgentResponse(agentName: string): string {
  console.log('🎭 Mock response for:', agentName)  // You'll see this
  return responses[Math.floor(Math.random() * responses.length)]
}
```

### Verify Real Functions Are Running:
```typescript
// Add console.log in openclaw.ts:
export async function spawnSession(...) {
  console.log('🌐 Real API call to:', GATEWAY_URL)  // You'll see this
  const response = await fetch(...)
}
```

---

## 🎯 When to Use Which Mode

### Use Mock Mode When:
- ✅ Developing UI components
- ✅ Demonstrating features to stakeholders
- ✅ Testing without network access
- ✅ Frontend-only testing
- ✅ Quick iterations on design
- ✅ Learning the codebase

### Use Real Mode When:
- ✅ Testing actual integrations
- ✅ QA/UAT testing
- ✅ Performance testing
- ✅ End-to-end testing
- ✅ Production deployment
- ✅ Real user sessions

---

**Architecture Status**:
- Mock Mode: ✅ Fully Implemented
- Real Mode: ⚠️ Pending (requires database + gateway setup)

**Recommendation**:
Start with Mock Mode for rapid development, switch to Real Mode when backend is ready.
