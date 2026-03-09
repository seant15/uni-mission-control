# 🔐 Vercel 环境变量配置指南

## 📋 需要设置的环境变量

### Frontend Variables (VITE_* prefix)

这些变量会在构建时注入到前端代码中。

| 变量名 | 值 | 用途 |
|--------|-----|------|
| `VITE_USE_MOCK_DATA` | `false` | 禁用模拟数据，使用真实 API |
| `VITE_USE_PROXY` | `true` | 使用 Vercel proxy 避免 HTTPS/HTTP 混合内容错误 |
| `VITE_OPENCLAW_GATEWAY_URL` | `http://open.unippc24.com:18789` | OpenClaw API Gateway 地址 (仅在 `VITE_USE_PROXY=false` 时使用) |
| `VITE_OPENCLAW_GATEWAY_TOKEN` | `uni-random-token` | OpenClaw API 认证令牌 |
| `VITE_SUPABASE_URL` | `https://jcghdthijgjttmpthagj.supabase.co` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | `你的 Supabase anon key` | Supabase 公开 API 密钥 |

### Backend Variables (Serverless Functions)

这些变量在 Vercel serverless functions 中使用 (`api/openclaw.js`)。

| 变量名 | 值 | 用途 |
|--------|-----|------|
| `OPENCLAW_GATEWAY_URL` | `http://open.unippc24.com:18789` | OpenClaw Gateway URL (后端 proxy 使用) |
| `OPENCLAW_GATEWAY_TOKEN` | `uni-random-token` | API 认证令牌 (后端 proxy 使用) |

---

## 🔧 设置步骤

### 1. 登录 Vercel

访问: https://vercel.com/dashboard

### 2. 选择项目

点击 **uni-mission-control** 项目

### 3. 进入设置

顶部菜单 → **Settings**

### 4. 配置环境变量

左侧菜单 → **Environment Variables**

### 5. 添加每个变量

对于上面列出的每个变量:

1. **Key**: 变量名 (例如: `VITE_USE_MOCK_DATA`)
2. **Value**: 对应的值 (例如: `false`)
3. **Environments**: 勾选 **所有三个环境**:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

4. 点击 **Save**

---

## ⚠️ 重要注意事项

### 1. 字符串类型

所有环境变量的值都是**字符串**:
- ✅ 正确: `VITE_USE_MOCK_DATA=false` (字符串 "false")
- ❌ 错误: 在 UI 中选择 boolean 类型

### 2. 端口号

**必须包含端口号**:
- ✅ 正确: `http://open.unippc24.com:18789`
- ❌ 错误: `http://open.unippc24.com` (缺少端口)
- ❌ 错误: `https://open.unippc24.com:18789` (应该是 http 不是 https)

### 3. 前缀要求

- **Frontend 变量**: 必须以 `VITE_` 开头
- **Backend 变量**: 不需要前缀

### 4. 环境选择

**每个变量都要勾选三个环境**，否则:
- 只勾 Production → Preview 部署会失败
- 只勾 Preview → Production 部署会失败

---

## 🔄 重新部署

设置或修改环境变量后，**必须重新部署**才能生效。

### 方法 1: 自动提示

保存环境变量后，Vercel 会显示提示:
```
Environment Variables updated. Would you like to redeploy?
```
点击 **Redeploy** 按钮。

### 方法 2: 手动触发

1. 顶部菜单 → **Deployments**
2. 找到最新的部署
3. 点击 **...** (三个点) → **Redeploy**
4. 确认 **Redeploy**

---

## ✅ 验证环境变量

### 检查 1: Vercel Dashboard

1. **Settings → Environment Variables**
2. 确认所有变量都显示
3. 确认每个变量都有 **Production, Preview, Development** 标签

### 检查 2: 部署日志

1. **Deployments** → 点击最新部署
2. 查看 **Build Logs**
3. 搜索环境变量名称，确认它们被加载

### 检查 3: 浏览器 Console

部署完成后:

1. 访问: https://uni-mission-control.vercel.app/mission-control
2. 按 **F12** → **Console** 标签
3. 运行:
   ```javascript
   console.log('Environment Check:')
   console.log('USE_MOCK_DATA:', import.meta.env.VITE_USE_MOCK_DATA)
   console.log('GATEWAY_URL:', import.meta.env.VITE_OPENCLAW_GATEWAY_URL)
   console.log('GATEWAY_TOKEN:', import.meta.env.VITE_OPENCLAW_GATEWAY_TOKEN)
   console.log('USE_PROXY:', import.meta.env.VITE_USE_PROXY)
   ```

**期望输出**:
```
Environment Check:
USE_MOCK_DATA: false
GATEWAY_URL: http://open.unippc24.com:18789
GATEWAY_TOKEN: uni-random-token
USE_PROXY: true
```

如果显示 `undefined` → 环境变量未正确设置

---

## 🧪 测试 Proxy

### 测试 1: 访问 API Proxy

```bash
curl https://uni-mission-control.vercel.app/api/openclaw?path=/api/sessions/list \
  -H "Authorization: Bearer uni-random-token"
```

**期望**: 返回 JSON 格式的会话列表

### 测试 2: 浏览器 Network 面板

1. 访问 Mission Control
2. 按 **F12** → **Network** 标签
3. 点击任何 Agent 的 "Chat with {agent}" 按钮
4. 观察网络请求

**期望看到**:
- 请求 URL: `https://uni-mission-control.vercel.app/api/openclaw?path=...`
- 请求方法: `POST`
- 响应状态: `200 OK`
- 响应内容: JSON 数据

**不应该看到**:
- ❌ Mixed Content Error
- ❌ CORS Error
- ❌ 500 Internal Server Error
- ❌ HTML 响应 (应该是 JSON)

---

## 🐛 故障排查

### 问题 1: 环境变量显示 `undefined`

**原因**:
- 环境变量未设置
- 环境变量名称拼写错误
- 缺少 `VITE_` 前缀
- 未重新部署

**解决**:
1. 重新检查 Vercel Dashboard 中的变量名称
2. 确认 **Production** 环境已勾选
3. 手动触发 **Redeploy**

### 问题 2: API Proxy 返回 HTML

**原因**: `vercel.json` 路由配置错误

**检查**:
```bash
cat vercel.json
```

**应该是**:
```json
{
  "rewrites": [
    { "source": "/((?!api).*)", "destination": "/index.html" }
  ]
}
```

**不应该是**:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }  // ❌ 错误!会捕获 /api/*
  ]
}
```

### 问题 3: CORS Error

**原因**: OpenClaw Gateway 未配置 CORS headers

**解决**:
- 这个已经在 `api/openclaw.js` proxy 中处理
- Proxy 添加了 `Access-Control-Allow-Origin: *`

### 问题 4: 500 Error from Proxy

**查看详细错误**:
```javascript
// 在浏览器 Console 运行
fetch('https://uni-mission-control.vercel.app/api/openclaw?path=/api/sessions/list')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

**可能的原因**:
- OpenClaw Gateway 未运行
- Gateway 绑定到 127.0.0.1 (loopback only)
- 网络连接问题
- 认证令牌错误

---

## 📝 完整配置清单

复制粘贴到 Vercel Environment Variables:

```plaintext
# Frontend (必须有 VITE_ 前缀)
VITE_USE_MOCK_DATA=false
VITE_USE_PROXY=true
VITE_OPENCLAW_GATEWAY_URL=http://open.unippc24.com:18789
VITE_OPENCLAW_GATEWAY_TOKEN=uni-random-token
VITE_SUPABASE_URL=https://jcghdthijgjttmpthagj.supabase.co
VITE_SUPABASE_ANON_KEY=<你的 Supabase anon key>

# Backend (无前缀)
OPENCLAW_GATEWAY_URL=http://open.unippc24.com:18789
OPENCLAW_GATEWAY_TOKEN=uni-random-token
```

---

## 🎯 验证成功的标志

完成设置后，你应该看到:

1. ✅ **Mission Control Agent 卡片**:
   - 按钮显示: "Chat with {agent}" (不是 "Chat (Mock)")
   - 按钮颜色: 深蓝色 (不是浅蓝色)

2. ✅ **点击按钮后**:
   - Chat 模态框在 Mission Control 内打开
   - 不会跳转到外部页面

3. ✅ **发送消息后**:
   - 浏览器 Console 无错误
   - Network 面板显示成功的 POST 请求
   - Agent 响应显示在聊天框中

4. ✅ **无 Mock 数据痕迹**:
   - 不显示预设消息
   - 不显示 "(Mock)" 标签

---

**准备好了吗?** 设置完环境变量后告诉我，我们继续下一步! 🚀
