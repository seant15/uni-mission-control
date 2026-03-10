# OpenClaw Integration Solution

## 🎯 Current Implementation

Mission Control现在使用**最简单且最有效**的方式集成OpenClaw：**在新标签页打开OpenClaw Control UI**。

### 工作原理

当用户点击Agent卡片上的"Chat with {agent}"按钮时：
```typescript
const openChat = (_agentName: string) => {
  const OPENCLAW_UI_URL = (import.meta as any).env.VITE_OPENCLAW_GATEWAY_URL || 'http://open.unippc24.com:9090'
  window.open(OPENCLAW_UI_URL, '_blank')
}
```

## ✅ 为什么这是正确的方案

### 1. 技术限制
- **浏览器安全策略**: HTTPS页面无法直接连接到WS (WebSocket)端点
- **需要WSS**: 必须使用WSS (WebSocket Secure)，但OpenClaw Gateway默认只支持WS
- **Mixed Content Error**: Vercel (HTTPS) → OpenClaw Gateway (WS) 会被浏览器阻止

### 2. 架构要求
官方OpenClaw Mission Control是**full-stack应用**：
```
Frontend (Next.js) → Backend (FastAPI/Python) → OpenClaw Gateway (WebSocket)
                                ↑
                    处理WebSocket RPC协议
```

我们的uni-mission-control只有**frontend**部署在Vercel：
```
Frontend (React/Vite) → ❌ 没有Backend → OpenClaw Gateway
```

### 3. OpenClaw Gateway协议
OpenClaw Gateway使用**WebSocket RPC协议**，不是REST API：
- 没有`/api/sessions/list`端点
- 没有`/api/sessions/spawn`端点
- 所有通信通过WebSocket `ws://gateway:18789/?token=xxx`

## 📋 其他考虑过的方案

### ❌ 方案1: 前端直接WebSocket
**问题**:
- Mixed Content: HTTPS → WS 被浏览器阻止
- 无法使用，除非OpenClaw配置SSL证书支持WSS

### ❌ 方案2: Vercel Serverless WebSocket Proxy
**问题**:
- Vercel serverless functions有10秒超时
- 不适合长连接的WebSocket
- 复杂且不可靠

### ❌ 方案3: 模拟REST API
**问题**:
- OpenClaw Gateway没有REST API
- 需要完全重写backend来模拟
- 维护成本高

### ✅ 方案4: 打开Control UI (当前方案)
**优点**:
- ✅ 简单可靠
- ✅ 无需backend
- ✅ 用户获得完整OpenClaw功能
- ✅ 无混合内容问题
- ✅ 易于维护

## 🚀 如何使用

### 用户体验
1. 访问Mission Control: https://uni-mission-control.vercel.app/mission-control
2. 查看Agent状态和任务
3. 点击"Chat with {agent}"按钮
4. **新标签页打开OpenClaw Control UI**
5. 在OpenClaw UI中与agent交互

### 环境变量
```env
VITE_OPENCLAW_GATEWAY_URL=http://open.unippc24.com:9090
```
注意：使用端口**9090** (Control UI)，不是18789 (Gateway API)

## 🔮 未来改进方案

如果需要在Mission Control内部集成聊天功能，需要：

### 选项1: 部署Backend服务
```
1. 创建FastAPI/Express backend
2. 部署到支持长连接的平台 (Railway, Fly.io, Digital Ocean)
3. Backend通过WebSocket连接OpenClaw Gateway
4. Frontend调用Backend REST API
```

### 选项2: 配置OpenClaw SSL
```
1. 为OpenClaw Gateway配置SSL证书
2. 启用WSS支持
3. Frontend可以直接从HTTPS连接到WSS
```

### 选项3: iframe嵌入
```typescript
// 在Mission Control内嵌入OpenClaw UI
<iframe
  src="http://open.unippc24.com:9090"
  className="w-full h-full"
/>
```
**问题**: 仍然会遇到Mixed Content警告

## 📚 参考资料

- [官方OpenClaw Mission Control](https://github.com/abhi1693/openclaw-mission-control)
  - Backend: `backend/app/services/openclaw/gateway_rpc.py`
  - WebSocket RPC实现: `gateway_rpc.py`

- [OpenClaw Gateway文档](https://github.com/openclaw/openclaw)
  - WebSocket协议
  - RPC方法列表

## 🎓 经验教训

1. **研究官方实现优先**: 应该首先查看官方repo的架构，而不是假设
2. **理解协议**: OpenClaw用WebSocket RPC，不是REST API
3. **浏览器安全**: Mixed Content限制无法绕过
4. **选择合适方案**: 简单可靠 > 复杂集成

---

**最后更新**: 2026-03-09
**状态**: ✅ 已部署并正常工作
