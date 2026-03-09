# 🔧 Vercel 部署修复步骤

## 问题诊断

1. ❌ Chat显示preset message - 硬编码问题
2. ❌ Tasks不是实时 - Supabase表问题
3. ❌ API调用可能失败 - 环境变量问题

---

## ✅ 解决方案

### 步骤 1: 检查 Vercel 环境变量

访问: https://vercel.com/dashboard → 你的项目 → Settings → Environment Variables

**必需的变量**(全部环境: Production, Preview, Development):

```
VITE_SUPABASE_URL=https://jcghdthijgjttmpthagj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ2hkdGhpamdqdHRtcHRoYWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNTAyNjksImV4cCI6MjA4MDcyNjI2OX0.ZR3MAGLIIerWmKUv0PlYns4M7K1o00kqK0ayeqpCPeE

VITE_OPENCLAW_GATEWAY_URL=http://open.unippc24.com:9090
VITE_OPENCLAW_GATEWAY_TOKEN=uni-random-token
VITE_USE_MOCK_DATA=false
```

⚠️ **重要**: 确保 `VITE_OPENCLAW_GATEWAY_URL` 包含端口号 `:9090`!

---

### 步骤 2: 修复代码问题

需要修改 `src/pages/MissionControl.tsx`:

**问题 1 - 移除预设消息**(第173-178行):

```typescript
// 之前:
const openChat = (agentName: string) => {
  setChatAgent(agentName)
  // Load mock chat history
  setChatMessages([
    { id: '1', agent: agentName, from: 'agent', message: `Hello! I'm ${agentName}. How can I help you today?`, type: 'text', timestamp: new Date().toISOString() }
  ])
  setShowChatModal(true)
}

// 改成:
const openChat = (agentName: string) => {
  setChatAgent(agentName)
  setChatMessages([]) // 清空消息,不加载预设
  setShowChatModal(true)
}
```

---

### 步骤 3: 测试 OpenClaw API

在浏览器console中测试:

```javascript
// 打开 https://uni-mission-control.vercel.app/mission-control
// 按 F12 → Console 标签
// 粘贴并运行:

fetch('http://open.unippc24.com:9090/api/sessions/list', {
  headers: {
    'Authorization': 'Bearer uni-random-token'
  }
})
.then(r => r.json())
.then(data => console.log('✅ API工作正常:', data))
.catch(err => console.error('❌ API失败:', err))
```

**预期结果**:
- ✅ 成功: 返回sessions列表
- ❌ 失败: CORS错误或网络错误

---

### 步骤 4: Supabase 表检查

访问: https://supabase.com → 你的项目 → Table Editor

检查这些表是否存在且有数据:
- `agent_tasks` - 任务列表
- `agent_health` - Agent健康状态

**如果表为空**:
- Tasks 会显示"No tasks found"
- Agent健康状态会显示默认值

---

### 步骤 5: 重新部署

完成修改后:

1. **提交代码**:
```bash
git add src/pages/MissionControl.tsx
git commit -m "Fix: Remove preset chat messages"
git push
```

2. **或者在 Vercel 手动Redeploy**:
   - Deployments → 最新部署 → ... → Redeploy

---

## 🧪 验证步骤

部署完成后:

1. ✅ **访问**: https://uni-mission-control.vercel.app/mission-control

2. ✅ **检查按钮**:
   - 应该显示: **"Open in OpenClaw Control →"** (深蓝色)
   - 不应该显示: "Chat (Mock)" (浅蓝色)

3. ✅ **测试Chat**:
   - 点击任何agent的"Open in OpenClaw Control"
   - 应该跳转到: `http://open.unippc24.com:9090`

4. ✅ **检查Console**:
   - F12 → Console
   - 不应该有CORS错误
   - 应该看到API调用到 `http://open.unippc24.com:9090/api/*`

---

## 📊 当前架构理解

```
Mission Control (Vercel)
    ↓
    ├─ Supabase (Analytics数据)
    │   └─ agent_tasks, agent_health表
    │
    └─ OpenClaw Gateway API
        └─ http://open.unippc24.com:9090/api/*
            ├─ /sessions/list
            ├─ /sessions/spawn
            ├─ /sessions/send
            └─ /sessions/status
```

**注意**:
- **Tasks** 数据来自 **Supabase** (不是OpenClaw)
- **Chat** 功能来自 **OpenClaw Gateway API**
- 两者是**独立**的数据源!

---

## 🐛 常见问题

### Q1: Tasks 仍然不是实时的

**原因**: Supabase的`agent_tasks`表可能为空

**解决**:
1. 在Supabase中手动添加测试数据
2. 或者使用 `sync_marketing_data.py` 同步数据

### Q2: Chat点击后没反应

**原因**:
- `VITE_USE_MOCK_DATA=true` (应该是 `false`)
- 或者 `VITE_OPENCLAW_GATEWAY_URL` 设置错误

**解决**: 检查Vercel环境变量

### Q3: CORS错误

**原因**: OpenClaw Gateway可能没有配置CORS

**临时解决**: 使用browser extension禁用CORS检查(仅开发用)

**永久解决**: 需要在OpenClaw的Nginx配置中添加CORS headers

---

有问题随时问我! 🚀
