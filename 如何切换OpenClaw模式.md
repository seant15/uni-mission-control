# 🔄 如何切换 OpenClaw 模式

**更新时间**: 2026-03-08

---

## 🎯 两种模式

### 模式 A: Mock 数据 (开发/演示)
```env
VITE_USE_MOCK_DATA=true
```

**功能**:
- ✅ Agent 卡片显示模拟状态
- ✅ 点击"Chat (Mock)" 打开模拟对话
- ✅ 可以测试 UI 和交互
- ✅ 不需要网络连接

**适用于**:
- 🎨 UI 开发
- 📊 演示展示
- 🧪 功能测试
- 💻 离线开发

---

### 模式 B: OpenClaw Control (生产)
```env
VITE_USE_MOCK_DATA=false
```

**功能**:
- ✅ Agent 卡片仍显示模拟状态 (因为 API 不可访问)
- ✅ 点击"Open in OpenClaw Control →" 打开真实的 OpenClaw 界面
- ✅ 在新标签页与真实 agents 对话
- ✅ 访问完整的 OpenClaw 功能

**适用于**:
- 🚀 生产环境
- 👥 实际使用
- 💬 真实 Agent 对话
- 📝 实际任务管理

---

## 🔧 如何切换

### 步骤 1: 编辑 .env 文件

打开:
```
c:\Users\stan8\openclaw\Concept 032026\uni-mission-control\.env
```

### 步骤 2: 修改 VITE_USE_MOCK_DATA

**切换到 Mock 模式**:
```env
VITE_USE_MOCK_DATA=true
```

**切换到 OpenClaw Control 模式**:
```env
VITE_USE_MOCK_DATA=false
```

### 步骤 3: 重启开发服务器

```bash
# 停止当前服务器 (Ctrl+C)
# 然后重新启动:
npm run dev
```

### 步骤 4: 刷新浏览器

```
http://localhost:5173/mission-control
```

---

## 📸 UI 变化对比

### Mock 模式 (VITE_USE_MOCK_DATA=true)

```
┌─────────────────────────┐
│  🍀 Clover              │
│  Management             │
│  ● Online               │
│                         │
│  [Chat (Mock)]          │ ← 蓝色按钮,打开模拟对话
└─────────────────────────┘
```

**点击后**: 在 Mission Control 中打开模拟聊天窗口

---

### OpenClaw Control 模式 (VITE_USE_MOCK_DATA=false)

```
┌─────────────────────────┐
│  🍀 Clover              │
│  Management             │
│  ● Offline (Mock)       │
│                         │
│  [Open in OpenClaw →]   │ ← 深蓝色按钮,链接到外部
└─────────────────────────┘
```

**点击后**: 在新标签页打开 http://open.unippc24.com:9090

---

## 🎨 按钮样式

### Mock 按钮
- 颜色: 浅蓝色 (`bg-blue-50 text-blue-700`)
- 文字: "Chat (Mock)"
- 行为: 在当前页面打开对话框

### OpenClaw 按钮
- 颜色: 深蓝色 (`bg-blue-600 text-white`)
- 文字: "Open in OpenClaw Control →"
- 行为: 新标签页打开外部链接

---

## ⚠️ 重要说明

### Gateway Mode 设置

你在 OpenClaw Control 中设置的 `local` → `remote` 模式:
- ✅ 影响 OpenClaw Control 本身如何连接 agents
- ❌ **不影响** Mission Control 是否能访问 API

**原因**:
- API 端口 (18789) 在内部网络,外部无法访问
- 无论设置什么模式,Mission Control 都无法直接调用 API
- 只能通过链接打开 OpenClaw Control

### 为什么不能直接集成?

**技术限制**:
```
Mission Control (浏览器)
    ↓ 尝试访问
http://open.unippc24.com:18789
    ↓
❌ Connection Refused
```

**原因**:
1. 端口 18789 只监听内部网络
2. 需要 Tailscale VPN 才能访问
3. 浏览器无法直接访问内部网络

**解决方案**:
- ✅ 用外部链接到 OpenClaw Control (已实现)
- ⚠️ 或配置反向代理 (复杂)
- ⚠️ 或使用 Tailscale (需要额外配置)

---

## 🚀 推荐配置

### 开发环境
```env
# 用 Mock 数据快速开发
VITE_USE_MOCK_DATA=true
VITE_OPENCLAW_GATEWAY_URL=http://open.unippc24.com:9090
```

### 生产环境
```env
# 链接到真实的 OpenClaw Control
VITE_USE_MOCK_DATA=false
VITE_OPENCLAW_GATEWAY_URL=http://open.unippc24.com:9090
```

---

## 📋 快速检查清单

当你不确定当前是什么模式时:

### 检查 1: 查看 .env 文件
```bash
cat .env | grep VITE_USE_MOCK_DATA
```

### 检查 2: 查看按钮文字
- 显示 "Chat (Mock)" → Mock 模式
- 显示 "Open in OpenClaw Control →" → OpenClaw 模式

### 检查 3: 点击按钮
- 在当前页面打开对话 → Mock 模式
- 打开新标签页 → OpenClaw 模式

---

## 🎯 最佳实践

### 什么时候用 Mock 模式?
- ✅ 开发新功能
- ✅ 测试 UI 布局
- ✅ 演示给团队看
- ✅ 离线工作

### 什么时候用 OpenClaw 模式?
- ✅ 生产环境部署
- ✅ 实际使用 agents
- ✅ 需要真实数据
- ✅ 客户演示

---

## 💡 未来改进

### 可能的增强:
1. **环境自动检测**
   ```typescript
   const isProduction = window.location.hostname !== 'localhost'
   const useMock = !isProduction
   ```

2. **UI 切换开关**
   ```typescript
   <button onClick={() => toggleMode()}>
     {useMock ? '切换到真实模式' : '切换到 Mock 模式'}
   </button>
   ```

3. **API 可用性检测**
   ```typescript
   // 自动检测 API 是否可访问
   // 如果不可访问,自动切换到链接模式
   ```

---

**当前实现**: ✅ 完成
**测试状态**: ✅ 两种模式都可用
**建议**: 开发用 Mock,生产用 OpenClaw Control 链接
