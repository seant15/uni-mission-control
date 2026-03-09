# 🎯 简化方案: 直接使用 OpenClaw Gateway

**你的观点**: 为什么要创建本地数据库? OpenClaw 应该自己管理所有数据,Mission Control 只是一个 **可视化界面**。

**完全正确!** ✅

---

## 🏗️ 简化后的架构

```
┌─────────────────────────────────────┐
│   Mission Control Dashboard         │
│   (纯前端,无数据库)                  │
│                                     │
│   只需要调用 OpenClaw Gateway API:  │
│   - GET  /agents/list              │
│   - GET  /agents/{id}/status       │
│   - GET  /tasks/list               │
│   - POST /sessions/spawn           │
│   - GET  /sessions/{id}/history    │
│   - POST /sessions/{id}/message    │
└─────────────┬───────────────────────┘
              │
              ▼
    ┌──────────────────────────┐
    │  OpenClaw Gateway         │
    │  (唯一数据源)             │
    │                          │
    │  自己管理:                │
    │  ✅ Agent 注册和状态      │
    │  ✅ 任务队列             │
    │  ✅ 会话历史             │
    │  ✅ Chat 记录            │
    └──────────────────────────┘
```

---

## 📡 OpenClaw Gateway 应该提供的 API

### 1. Agent 管理
```http
GET /api/agents/list
返回:
{
  "agents": [
    {
      "id": "clover",
      "name": "Clover",
      "emoji": "🍀",
      "role": "Management",
      "status": "online",
      "lastSeen": "2026-03-08T12:00:00Z"
    },
    ...
  ]
}
```

### 2. Agent 状态
```http
GET /api/agents/{agentId}/status
返回:
{
  "agentId": "clover",
  "status": "online",
  "health": {
    "consecutiveFailures": 0,
    "lastHealthCheck": "2026-03-08T12:00:00Z"
  },
  "activeTasks": 2,
  "activeSessions": 1
}
```

### 3. 任务队列
```http
GET /api/tasks/list?status=pending
返回:
{
  "tasks": [
    {
      "id": "task-123",
      "fromAgent": "user",
      "toAgent": "writer",
      "type": "email_draft",
      "priority": "normal",
      "status": "pending",
      "createdAt": "2026-03-08T11:00:00Z"
    },
    ...
  ]
}
```

### 4. Chat 会话历史
```http
GET /api/sessions/{sessionKey}/history
返回:
{
  "sessionKey": "session-abc123",
  "agentId": "clover",
  "messages": [
    {
      "id": "msg-1",
      "from": "user",
      "content": "How is the team?",
      "timestamp": "2026-03-08T11:00:00Z"
    },
    {
      "id": "msg-2",
      "from": "agent",
      "content": "Team is performing well!",
      "timestamp": "2026-03-08T11:00:05Z"
    }
  ]
}
```

---

## 💻 简化后的前端代码

### 不需要 Supabase 查询:
```typescript
// ❌ 旧方式 - 查询本地数据库
const { data } = await supabase.from('agent_health').select('*')

// ✅ 新方式 - 直接调用 Gateway
const response = await fetch(`${GATEWAY_URL}/api/agents/list`, {
  headers: { 'Authorization': `Bearer ${TOKEN}` }
})
const { agents } = await response.json()
```

### 不需要创建数据库表:
```typescript
// ❌ 不需要这些表了:
// - agent_health
// - agent_tasks
// - agent_sessions
// - chat_messages

// ✅ 所有数据都从 Gateway 获取
```

### 简化的 MissionControl.tsx:
```typescript
export default function MissionControl() {
  // 直接从 Gateway 获取 agents
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await fetch(`${GATEWAY_URL}/api/agents/list`)
      return res.json()
    }
  })

  // 直接从 Gateway 获取 tasks
  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await fetch(`${GATEWAY_URL}/api/tasks/list`)
      return res.json()
    }
  })

  // Chat 直接使用现有的 spawnSession/sendMessage
  // 历史记录也从 Gateway 获取
}
```

---

## 🔧 需要做的改动

### OpenClaw Gateway 需要提供这些 API:

1. **Agent API**
   - `GET /api/agents/list` - 获取所有 agent
   - `GET /api/agents/{id}/status` - 获取单个 agent 状态

2. **Task API**
   - `GET /api/tasks/list` - 获取任务列表
   - `POST /api/tasks/create` - 创建任务
   - `PUT /api/tasks/{id}/status` - 更新任务状态

3. **Session API** (已有)
   - `POST /api/sessions/spawn` ✅
   - `POST /api/sessions/send` ✅
   - `GET /api/sessions/status` ✅
   - `GET /api/sessions/{id}/history` ⚠️ 需要添加
   - `GET /api/sessions/list` ✅

---

## 🎯 最简方案实现步骤

### Step 1: 确认 Gateway 是否已有这些 API

首先测试 Gateway 有哪些可用的 endpoint:

```bash
# 测试 agents list
curl https://open.unippc24.com/api/agents/list

# 测试 tasks list
curl https://open.unippc24.com/api/tasks/list

# 测试 sessions list
curl https://open.unippc24.com/api/sessions/list
```

### Step 2: 如果 Gateway 可用

创建简化的 API 客户端:

```typescript
// src/lib/openclaw-client.ts
const GATEWAY_URL = import.meta.env.VITE_OPENCLAW_GATEWAY_URL
const TOKEN = import.meta.env.VITE_OPENCLAW_GATEWAY_TOKEN

export async function getAgents() {
  const res = await fetch(`${GATEWAY_URL}/api/agents/list`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  })
  return res.json()
}

export async function getTasks(status?: string) {
  const url = status
    ? `${GATEWAY_URL}/api/tasks/list?status=${status}`
    : `${GATEWAY_URL}/api/tasks/list`
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  })
  return res.json()
}

export async function getChatHistory(sessionKey: string) {
  const res = await fetch(`${GATEWAY_URL}/api/sessions/${sessionKey}/history`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  })
  return res.json()
}
```

### Step 3: 移除所有 Supabase agent 相关查询

只保留 Supabase 用于广告数据分析 (daily_performance, meta_ads, google_ads 等),移除所有 agent 相关的表和查询。

---

## 🤔 关键问题

### Q1: OpenClaw Gateway 当前是否提供这些 API?

**需要检查**:
- https://open.unippc24.com 的实际 API 文档
- 或者问 OpenClaw 的开发者

### Q2: 如果 Gateway 不提供完整的 API?

**方案 A**: 扩展 Gateway,添加这些 endpoint
**方案 B**: 使用现有 API,前端自己维护状态(内存中)
**方案 C**: 临时用 Mock,等 Gateway 完善

---

## ✅ 你说得对的地方

1. **不应该重复存储数据**
   - Agent 状态应该由 OpenClaw 自己管理
   - Mission Control 只是显示界面

2. **应该像 plugin 一样**
   - 即插即用
   - 不需要额外的数据库设置
   - 直接连接 Gateway 就能工作

3. **单一数据源**
   - OpenClaw Gateway 是唯一的真实数据源
   - 避免同步问题
   - 简化架构

---

## 🚀 下一步行动

我建议:

1. **首先测试 Gateway 有哪些可用的 API**
   ```bash
   curl -v https://open.unippc24.com/api/agents/list
   curl -v https://open.unippc24.com/api/tasks/list
   ```

2. **如果 Gateway 能访问**:
   - 我帮你重写前端,直接调用这些 API
   - 移除所有本地数据库的 agent 表
   - 实现纯 Gateway 客户端

3. **如果 Gateway 无法访问**:
   - 检查是否需要修复 Gateway URL
   - 或者提供 Gateway 的 API 文档
   - 我可以帮你设计需要哪些 endpoint

---

**你想先测试一下 Gateway 是否可用吗?** 或者你知道 OpenClaw Gateway 的实际 API 文档在哪里?

如果 Gateway 可用,我立刻帮你重写成 **纯 API 客户端模式**,完全不需要本地数据库! 🎉
