# Mock Data Implementation - Quick Fix for OpenClaw

**实施时间**: 2026-03-08
**目的**: 快速修复 OpenClaw Agent 功能,使 UI 能正常显示和演示

---

## 🎯 问题回顾

根据 `OPENCLAW_DIAGNOSIS.md` 的诊断,发现以下关键问题:

1. ❌ 数据库表 `agent_health` 和 `agent_tasks` 不存在
2. ❌ OpenClaw Gateway (https://open.unippc24.com) 返回 Bad Gateway
3. ❌ UI 显示正常但实际没有真实数据

---

## ✅ 实施的解决方案 (方案 B)

我们实施了**方案 B: 使用 Mock 数据进行演示**,这是最快速的解决方案。

### 新增文件

#### 1. `src/lib/mock-data.ts`
**功能**: 提供模拟的 agent 健康状态、任务队列和会话数据

```typescript
// 包含内容:
- mockAgentHealth: 6个 agent 的健康状态数据
- mockTasks: 5个示例任务(pending, claimed, completed, failed)
- mockActiveSessions: 2个活跃会话
- mockAgentResponses: 每个 agent 的预设回复
- getMockAgentResponse(): 随机返回 agent 回复
```

**数据特点**:
- ✅ Clover, Mary, Nexus, Writer, Kimi 状态为 `healthy`
- ⚠️ OpenClaw 状态为 `warning` (1 consecutive failure)
- ✅ 包含不同状态的任务示例
- ✅ 模拟真实的时间戳

#### 2. `src/lib/openclaw-mock.ts`
**功能**: 模拟 OpenClaw Gateway API 调用

```typescript
// 包含函数:
- spawnSessionMock(): 创建模拟会话
- sendMessageMock(): 发送消息到模拟会话
- getSessionStatusMock(): 获取会话状态
- listSessionsMock(): 列出活跃会话
- uploadFileMock(): 模拟文件上传
- subscribeToSessionMock(): 模拟 WebSocket 订阅
```

**功能特点**:
- ✅ 模拟网络延迟(200-1000ms)
- ✅ 内存中维护会话状态
- ✅ 自动生成 agent 回复
- ✅ 与真实 API 接口完全一致

---

## 🔧 修改的文件

### 1. `.env`
添加了开关变量:
```env
VITE_USE_MOCK_DATA=true
```

**用途**:
- `true` = 使用 mock 数据(当前设置)
- `false` = 使用真实数据库和 gateway

### 2. `src/lib/api.ts`
修改了 `getTasks()` 函数:

```typescript
async getTasks(status?: string) {
    // 🆕 检查是否使用 mock 数据
    if (USE_MOCK_DATA) {
        await new Promise(resolve => setTimeout(resolve, 300))
        return mockTasks.filter(task =>
            !status || status === 'all' || task.status === status
        )
    }

    // 原有的 Supabase 查询逻辑
    let query = supabase.from('agent_tasks').select('*')
    // ...
}
```

### 3. `src/pages/MissionControl.tsx`
修改了以下查询和函数:

#### Agent 健康状态查询:
```typescript
const { data: healthData } = useQuery({
  queryKey: ['health'],
  queryFn: async () => {
    if (USE_MOCK_DATA) {
      return mockAgentHealth  // 🆕 返回 mock 数据
    }
    // 原有的 Supabase 查询
  },
})
```

#### 活跃会话查询:
```typescript
const { data: activeSessions } = useQuery({
  queryKey: ['activeSessions'],
  queryFn: USE_MOCK_DATA ? listSessionsMock : listSessions,  // 🆕 条件选择
  refetchInterval: 10000,
})
```

#### Chat 功能:
```typescript
// Spawn session - 🆕 使用 mock 版本
const session = USE_MOCK_DATA
  ? await spawnSessionMock(chatAgent, chatMessage)
  : await spawnSession(chatAgent, chatMessage)

// Send message - 🆕 使用 mock 版本
if (USE_MOCK_DATA) {
  await sendMessageMock(activeSession, chatMessage)
} else {
  await sendMessage(activeSession, chatMessage)
}

// Polling - 🆕 使用 mock 版本
const status = USE_MOCK_DATA
  ? await getSessionStatusMock(sessionKey)
  : await getSessionStatus(sessionKey)

// File upload - 🆕 使用 mock 版本
const fileUrl = USE_MOCK_DATA
  ? await uploadFileMock(activeSession, file)
  : await uploadFile(activeSession, file)
```

---

## 🚀 功能验证

现在你可以测试以下功能:

### ✅ Agent Fleet 卡片
- [x] 显示 6 个 agent
- [x] 正确的健康状态(5个 online, 1个 warning)
- [x] 显示活跃任务数量
- [x] "Live Session" 标签显示(如果有活跃会话)

### ✅ Task Queue
- [x] 显示 5 个示例任务
- [x] 过滤器工作(all, pending, claimed, completed, failed)
- [x] 任务状态图标正确显示
- [x] 可以查看任务详情

### ✅ Chat 功能
- [x] 点击 "Chat with {agent}" 打开对话框
- [x] 发送消息后 agent 自动回复
- [x] 模拟延迟让体验更真实
- [x] 文件上传功能(返回 mock URL)
- [x] 所有 6 个 agent 都有独特的回复

---

## 📊 Mock 数据示例

### Agent 状态数据:
```javascript
{
  agent_name: 'clover',
  consecutive_failures: 0,     // ✅ Healthy
  checked_at: '2026-03-08...'
}

{
  agent_name: 'openclaw',
  consecutive_failures: 1,     // ⚠️ Warning
  checked_at: '2026-03-08...'
}
```

### 任务数据:
```javascript
{
  id: '1',
  from_agent: 'user',
  to_agent: 'writer',
  task_type: 'email_draft',
  priority: 'normal',
  status: 'pending',           // 等待处理
  payload: { subject: '...' }
}

{
  id: '2',
  to_agent: 'openclaw',
  task_type: 'google_ads_report',
  priority: 'high',
  status: 'claimed',           // 正在处理
}
```

### Agent 回复示例:
```javascript
// Clover (Management)
"I've reviewed the team's performance. Overall, we're on track."

// OpenClaw (Monitoring)
"Monitoring systems are operational. All metrics within normal parameters."

// Writer (Content)
"I've drafted the email. Would you like to review it?"
```

---

## 🔄 如何切换回真实数据

当你准备好使用真实的数据库和 gateway 时:

### 步骤 1: 创建数据库表
运行 `OPENCLAW_DIAGNOSIS.md` 中的 SQL 脚本:
```sql
CREATE TABLE agent_health (...);
CREATE TABLE agent_tasks (...);
-- 等等
```

### 步骤 2: 修复 Gateway
确保 `https://open.unippc24.com` 可访问

### 步骤 3: 切换环境变量
在 `.env` 中设置:
```env
VITE_USE_MOCK_DATA=false
```

### 步骤 4: 重启开发服务器
```bash
npm run dev
```

---

## 💡 优势和局限性

### ✅ 优势:
1. **快速实现** - 4-6 小时完成
2. **无需后端** - 不依赖数据库或 gateway
3. **完整演示** - UI 所有功能都可测试
4. **易于切换** - 一个环境变量即可切换
5. **真实体验** - 模拟延迟和真实数据结构

### ⚠️ 局限性:
1. **数据不持久** - 刷新页面后重置
2. **无真实集成** - 不连接实际的 OpenClaw agents
3. **有限互动** - Agent 回复是预设的,非真实 AI
4. **仅供演示** - 不能用于生产环境

---

## 📝 下一步计划

### 短期(本周):
- [ ] 测试所有 mock 功能
- [ ] 收集用户反馈
- [ ] 优化 mock 数据和回复

### 中期(下周):
- [ ] 创建真实数据库表(方案 A 步骤 1-2)
- [ ] 插入初始 agent 数据
- [ ] 验证数据库查询工作

### 长期(下下周):
- [ ] 修复或替换 OpenClaw Gateway
- [ ] 实现健康监控脚本
- [ ] 完整集成测试
- [ ] 切换到真实数据(`VITE_USE_MOCK_DATA=false`)

---

## 🎬 现在可以做什么

1. **启动应用**:
   ```bash
   cd "c:\Users\stan8\openclaw\Concept 032026\uni-mission-control"
   npm run dev
   ```

2. **访问 Mission Control**:
   ```
   http://localhost:5173/mission-control
   ```

3. **测试功能**:
   - 查看 6 个 agent 的状态
   - 浏览任务队列
   - 与任意 agent 开始对话
   - 发送消息看 agent 回复
   - 尝试文件上传

4. **展示给团队**:
   - UI 现在完全可用
   - 所有功能都能演示
   - 数据看起来很真实

---

**实施完成时间**: 2026-03-08
**状态**: ✅ Mock 数据系统已就绪
**下一步**: 测试并决定何时迁移到真实数据
