# OpenClaw Agent 功能诊断报告

**诊断时间**: 2026-03-08
**状态**: 🔴 **发现关键问题**

---

## 🔍 问题分析

### 问题 1: **数据库表缺失** 🔴 严重

**发现**:
- ❌ 数据库中**不存在** `agent_health` 表
- ❌ 数据库中**不存在** `agent_tasks` 表
- ✅ 只有广告数据相关的表(clients, daily_performance, meta_ads, google_ads等)

**影响**:
- Mission Control 页面无法显示 agent 状态
- Task Queue 无法加载任务
- 所有 agent 管理功能都无法使用

**证据**:
```sql
-- database/migrations/ 中没有创建 agent 相关表的迁移文件
-- 搜索 "CREATE TABLE.*agent" 返回 0 结果
```

**根本原因**:
这个项目从广告数据分析项目开始,**从未创建过 OpenClaw agent 管理所需的数据库表**。

---

### 问题 2: **OpenClaw Gateway 无法访问** 🔴 严重

**发现**:
```bash
$ curl https://open.unippc24.com/api/sessions/list
Bad Gateway
```

**配置的 Gateway**:
```env
VITE_OPENCLAW_GATEWAY_URL=https://open.unippc24.com
VITE_OPENCLAW_GATEWAY_TOKEN=uni-random-token
```

**影响**:
- 无法创建 agent 会话
- 无法发送消息给 agent
- 无法获取 agent 响应
- Chat 功能完全无法使用

**可能原因**:
1. Gateway 服务器未启动
2. URL 配置错误
3. 防火墙/网络问题
4. Token 认证失败

---

### 问题 3: **Mock 数据 vs 真实数据** 🟡 设计问题

**当前实现**:
```typescript
// MissionControl.tsx 使用硬编码的 agent 列表
const AGENTS = [
  { name: 'clover', emoji: '🍀', role: 'Management' },
  { name: 'mary', emoji: '📡', role: 'Communications' },
  { name: 'openclaw', emoji: '🛡️', role: 'Monitoring' },
  { name: 'nexus', emoji: '🔗', role: 'Integrations' },
  { name: 'writer', emoji: '✍️', role: 'Content' },
  { name: 'kimi', emoji: '🧪', role: 'Technology' },
]
```

**问题**:
- Agent 列表是**硬编码**的,不是从数据库或 API 获取
- Agent 状态显示依赖不存在的 `agent_health` 表
- 没有真实的 agent 注册/发现机制

---

### 问题 4: **UI 显示正常但数据为空** 🟡 误导性

**现象**:
- UI 渲染正常,看起来很专业
- Agent 卡片显示,但状态都是错误的
- Task Queue 表格渲染,但没有数据

**根本原因**:
```typescript
// 查询返回 null/empty,但 UI 不显示错误
const { data: healthData } = useQuery({
  queryKey: ['health'],
  queryFn: async () => {
    const { data } = await supabase.from('agent_health').select('*')
    return data as AgentHealth[]  // data = null (表不存在)
  },
})

// healthData = undefined, 导致所有 agent 显示为 offline
```

---

## 💡 解决方案

### 方案 A: **完整实现 OpenClaw 集成** (推荐,但工作量大)

#### 步骤 1: 创建数据库表

```sql
-- database/migrations/20260308_create_agent_tables.sql

-- Agent 健康监控表
CREATE TABLE agent_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  check_type TEXT NOT NULL,
  status TEXT NOT NULL,
  last_success TIMESTAMPTZ,
  consecutive_failures INT DEFAULT 0,
  error_details JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT agent_health_unique UNIQUE(agent_name, check_type)
);

CREATE INDEX idx_agent_health_name ON agent_health(agent_name);
CREATE INDEX idx_agent_health_checked_at ON agent_health(checked_at);

-- Agent 任务队列表
CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  task_type TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('pending', 'claimed', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB,
  error_message TEXT
);

CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_to_agent ON agent_tasks(to_agent);
CREATE INDEX idx_agent_tasks_created_at ON agent_tasks(created_at DESC);

-- Agent 会话表 (用于 chat 历史)
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  session_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_agent_sessions_agent ON agent_sessions(agent_name);
CREATE INDEX idx_agent_sessions_status ON agent_sessions(status);

-- Chat 消息表
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  from_type TEXT NOT NULL CHECK (from_type IN ('user', 'agent')),
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'voice', 'attachment')),
  content TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);
```

#### 步骤 2: 插入初始 Agent 数据

```sql
-- 插入 6 个 agent 的初始健康状态
INSERT INTO agent_health (agent_name, check_type, status, checked_at) VALUES
  ('clover', 'heartbeat', 'healthy', now()),
  ('mary', 'heartbeat', 'healthy', now()),
  ('openclaw', 'heartbeat', 'healthy', now()),
  ('nexus', 'heartbeat', 'healthy', now()),
  ('writer', 'heartbeat', 'healthy', now()),
  ('kimi', 'heartbeat', 'healthy', now())
ON CONFLICT (agent_name, check_type) DO NOTHING;
```

#### 步骤 3: 修复 OpenClaw Gateway

**选项 3A: 本地 Mock Server** (快速测试)
```typescript
// src/lib/openclaw-mock.ts
export async function spawnSession(agentId: string, task: string) {
  // 模拟延迟
  await new Promise(resolve => setTimeout(resolve, 500))

  return {
    sessionKey: `mock-session-${Date.now()}`,
    status: 'running'
  }
}

export async function getSessionStatus(sessionKey: string) {
  await new Promise(resolve => setTimeout(resolve, 300))

  return {
    status: 'running',
    lastMessage: `Received your message. I'm ${sessionKey.includes('clover') ? 'Clover' : 'processing'} this and will get back to you shortly.`
  }
}
```

**选项 3B: 修复真实 Gateway**
1. 检查 `https://open.unippc24.com` 服务器状态
2. 验证 DNS 解析
3. 检查 SSL 证书
4. 确认 API 端点路径
5. 测试 token 认证

#### 步骤 4: 创建 Agent 健康监控脚本

```python
# scripts/agent_health_monitor.py
import schedule
import time
from supabase import create_client
import os

supabase = create_client(
    os.getenv('VITE_SUPABASE_URL'),
    os.getenv('SUPABASE_SERVICE_ROLE_KEY')
)

AGENTS = ['clover', 'mary', 'openclaw', 'nexus', 'writer', 'kimi']

def check_agent_health():
    for agent in AGENTS:
        try:
            # 这里应该调用真实的 agent health check API
            # 暂时模拟为 healthy
            supabase.table('agent_health').upsert({
                'agent_name': agent,
                'check_type': 'heartbeat',
                'status': 'healthy',
                'consecutive_failures': 0,
                'checked_at': 'now()'
            }, on_conflict='agent_name,check_type').execute()

        except Exception as e:
            print(f"Health check failed for {agent}: {e}")

# 每分钟检查一次
schedule.every(1).minutes.do(check_agent_health)

if __name__ == '__main__':
    print("Starting agent health monitor...")
    check_agent_health()  # 立即执行一次

    while True:
        schedule.run_pending()
        time.sleep(1)
```

---

### 方案 B: **使用 Mock 数据进行演示** (快速,但功能受限)

#### 适用场景:
- 只需要展示 UI,不需要真实功能
- 用于 demo/presentation
- 暂时无法访问真实 OpenClaw gateway

#### 实现步骤:

1. **创建 Mock 数据服务**:
```typescript
// src/lib/mock-data.ts
export const mockAgentHealth = [
  { agent_name: 'clover', consecutive_failures: 0, checked_at: new Date().toISOString() },
  { agent_name: 'mary', consecutive_failures: 0, checked_at: new Date().toISOString() },
  { agent_name: 'openclaw', consecutive_failures: 1, checked_at: new Date().toISOString() },
  { agent_name: 'nexus', consecutive_failures: 0, checked_at: new Date().toISOString() },
  { agent_name: 'writer', consecutive_failures: 0, checked_at: new Date().toISOString() },
  { agent_name: 'kimi', consecutive_failures: 0, checked_at: new Date().toISOString() },
]

export const mockTasks = [
  {
    id: '1',
    from_agent: 'user',
    to_agent: 'writer',
    task_type: 'email_draft',
    priority: 'normal',
    status: 'pending',
    created_at: new Date().toISOString(),
    payload: {}
  },
  {
    id: '2',
    from_agent: 'user',
    to_agent: 'openclaw',
    task_type: 'google_ads_report',
    priority: 'high',
    status: 'claimed',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    payload: {}
  }
]
```

2. **修改 MissionControl.tsx 使用 mock 数据**:
```typescript
// 添加开发模式标志
const USE_MOCK_DATA = true  // 或从环境变量读取

const { data: healthData } = useQuery({
  queryKey: ['health'],
  queryFn: async () => {
    if (USE_MOCK_DATA) {
      return mockAgentHealth
    }
    const { data } = await supabase.from('agent_health').select('*')
    return data as AgentHealth[]
  },
})
```

---

### 方案 C: **禁用 OpenClaw 功能,专注于数据分析** (最简单)

#### 适用场景:
- 项目主要目标是广告数据分析
- OpenClaw integration 是次要功能
- 希望快速上线核心功能

#### 实现步骤:

1. **隐藏 Mission Control 页面**:
```typescript
// src/App.tsx
// 注释掉 Mission Control 路由
{/* <Route path="/mission-control" element={<MissionControl />} /> */}
```

2. **从导航栏移除**:
```typescript
// 移除 sidebar 中的 Mission Control 链接
```

3. **专注于完善 Data Analytics**:
- Hourly monitoring (已有完整设计文档)
- 预算提醒
- 异常检测
- 自动化报告

---

## 📊 各方案对比

| 方案 | 工作量 | 功能完整度 | 推荐指数 | 时间估计 |
|------|--------|------------|----------|----------|
| **方案 A: 完整实现** | 🔴 高 | ✅ 100% | ⭐⭐⭐⭐⭐ | 3-5天 |
| **方案 B: Mock 数据** | 🟡 中 | 🟡 50% (仅 UI) | ⭐⭐⭐ | 4-6小时 |
| **方案 C: 禁用功能** | 🟢 低 | ❌ 0% | ⭐⭐ | 1小时 |

---

## 🎯 我的建议

### 短期 (今天):
1. ✅ **方案 B: 使用 Mock 数据**
   - 让 UI 能显示正常状态
   - 展示功能概念
   - 继续开发其他功能

### 中期 (本周):
2. ✅ **方案 A 步骤 1-2: 创建数据库表**
   - 运行迁移脚本
   - 插入初始数据
   - 验证查询工作

### 长期 (下周):
3. ✅ **方案 A 步骤 3-4: 真实集成**
   - 修复或替换 OpenClaw Gateway
   - 实现健康监控
   - 完整测试

---

## 🚀 快速修复(方案 B)

我可以立即帮你实现方案 B,让 Mission Control 显示正常:

1. 创建 mock 数据文件
2. 修改 MissionControl.tsx 使用 mock 数据
3. 添加环境变量开关(生产环境可以切换)

需要我现在实施吗?

---

**诊断完成时间**: 2026-03-08
**严重性**: 🔴 高 - OpenClaw 功能完全无法使用
**建议优先级**: P0 (如果 OpenClaw 是核心功能) 或 P2 (如果数据分析是核心功能)
