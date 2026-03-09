# 🤔 为什么 Mission Control 不能直接调用 OpenClaw API?

**你的问题**: 为什么不能一个 app 管理所有,直接调用 API?

**简短答案**: 可以! 但需要解决两个技术问题。

---

## 📊 当前架构问题

### 问题 1: API 端口不可访问 (主要问题)

```
你的浏览器 (运行 Mission Control)
   │
   ├─→ http://localhost:5173 (Mission Control 前端)
   │
   └─→ 尝试调用: http://open.unippc24.com:18789/api/...
                          ↓
                      ❌ Connection Refused
```

**为什么被拒绝?**

从日志中看到:
```
host mounted at http://127.0.0.1:18789
```

这意味着 Gateway API 只监听 `127.0.0.1` (本地回环地址):

```
┌─────────────────────────────────────────┐
│  服务器 (open.unippc24.com)              │
│                                         │
│  ┌───────────────────────────────┐     │
│  │ Gateway API                    │     │
│  │ 监听: 127.0.0.1:18789         │     │ ← 只接受来自本机的连接
│  │ (localhost only)               │     │
│  └───────────────────────────────┘     │
│                                         │
│  ┌───────────────────────────────┐     │
│  │ Nginx (前端)                   │     │
│  │ 监听: 0.0.0.0:9090            │     │ ← 接受任何来源的连接
│  └───────────────────────────────┘     │
└─────────────────────────────────────────┘
         ↑                  ↑
         │                  │
    可以访问            不能访问
```

---

### 问题 2: CORS (跨域资源共享) - 次要问题

即使端口 18789 可以访问,浏览器还会阻止跨域请求:

```
Mission Control (localhost:5173)
   ↓ 请求
OpenClaw API (open.unippc24.com:18789)
   ↓ 响应
❌ CORS Error: 不允许跨域访问
```

浏览器会说:
```
Access to fetch at 'http://open.unippc24.com:18789/api/sessions'
from origin 'http://localhost:5173' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

---

## ✅ 解决方案 (3 种)

### 方案 1: 配置 Gateway 监听公网 IP ⭐ 最彻底

**步骤**:

#### 1.1 修改 Gateway 监听地址

编辑 `/data/.openclaw/openclaw.json`:
```json
{
  "gateway": {
    "mode": "local",
    "host": "0.0.0.0",  // ← 改成监听所有网卡
    "port": 18789
  }
}
```

#### 1.2 添加 CORS 支持

在 Gateway 配置中添加:
```json
{
  "gateway": {
    "mode": "local",
    "host": "0.0.0.0",
    "port": 18789,
    "cors": {
      "enabled": true,
      "origins": [
        "http://localhost:5173",
        "http://localhost:5174",
        "https://your-production-domain.com"
      ]
    }
  }
}
```

#### 1.3 重启 Gateway
```bash
openclaw gateway restart
```

#### 1.4 测试
```bash
curl http://open.unippc24.com:18789/api/sessions
```

如果返回 JSON (而不是 Connection Refused),就成功了!

---

### 方案 2: 使用 Nginx 反向代理 ⭐ 推荐

**原理**: Nginx (端口 9090) 转发 `/api/*` 到 Gateway (端口 18789)

**配置 Nginx**:

```nginx
# /etc/nginx/sites-available/openclaw
server {
    listen 9090;
    server_name open.unippc24.com;

    # 前端文件
    location / {
        root /path/to/openclaw-control/dist;
        try_files $uri $uri/ /index.html;
    }

    # API 代理 ← 添加这个!
    location /api/ {
        proxy_pass http://127.0.0.1:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # CORS 头
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS';
        add_header Access-Control-Allow-Headers 'Content-Type, Authorization';
    }

    # WebSocket 支持
    location /ws/ {
        proxy_pass http://127.0.0.1:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**重启 Nginx**:
```bash
nginx -t  # 测试配置
nginx -s reload  # 重新加载
```

**效果**:
```
Mission Control → http://open.unippc24.com:9090/api/sessions
                     ↓ (Nginx 转发)
                  http://127.0.0.1:18789/api/sessions
                     ↓
                  ✅ 返回 JSON
```

---

### 方案 3: 后端代理 (最安全)

**架构**:
```
Mission Control 前端
   ↓
Mission Control 后端 (新建)
   ↓
OpenClaw Gateway (内部调用)
```

**实现**:

创建一个简单的 Node.js 后端:

```javascript
// server.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const GATEWAY_URL = 'http://127.0.0.1:18789';

// 代理所有 API 请求
app.all('/api/*', async (req, res) => {
  const path = req.path.replace('/api', '');
  const url = `${GATEWAY_URL}${path}`;

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: req.headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('Proxy server running on port 3001');
});
```

**Mission Control 调用**:
```typescript
// 不直接调用 open.unippc24.com:18789
// 而是调用自己的后端
const response = await fetch('http://localhost:3001/api/sessions');
```

---

## 🎯 三种方案对比

| 方案 | 难度 | 安全性 | 推荐度 | 说明 |
|------|------|--------|--------|------|
| **方案 1: 公开 Gateway** | 🟡 中 | ⚠️ 低 | ⭐⭐ | 简单但不安全 |
| **方案 2: Nginx 代理** | 🟢 易 | ✅ 高 | ⭐⭐⭐⭐⭐ | **最推荐** |
| **方案 3: 后端代理** | 🔴 难 | ✅ 高 | ⭐⭐⭐ | 需要额外服务器 |

---

## 🚀 我的推荐: 方案 2 (Nginx 代理)

### 为什么?

1. **简单**: 只需修改 Nginx 配置
2. **安全**: Gateway 仍然只监听 localhost
3. **高效**: Nginx 本身就在运行
4. **灵活**: 可以添加认证、限流等

### 实施步骤:

**步骤 1**: 找到 Nginx 配置文件
```bash
# 通常在:
/etc/nginx/sites-available/openclaw
# 或
/etc/nginx/conf.d/openclaw.conf
```

**步骤 2**: 添加 API 代理配置
```nginx
location /api/ {
    proxy_pass http://127.0.0.1:18789;
    add_header Access-Control-Allow-Origin *;
}
```

**步骤 3**: 重启 Nginx
```bash
nginx -s reload
```

**步骤 4**: 测试
```bash
curl http://open.unippc24.com:9090/api/sessions
```

**步骤 5**: 更新 Mission Control
```env
# .env
VITE_OPENCLAW_GATEWAY_URL=http://open.unippc24.com:9090
VITE_USE_MOCK_DATA=false
```

---

## 📋 完整示例: Nginx 配置

```nginx
server {
    listen 9090;
    server_name open.unippc24.com;

    # 前端静态文件
    root /var/www/openclaw-control;
    index index.html;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理到 Gateway ← 关键配置
    location /api/ {
        proxy_pass http://127.0.0.1:18789/api/;

        # 基本代理头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # CORS 头
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;

        # 处理 OPTIONS 预检请求
        if ($request_method = OPTIONS) {
            return 204;
        }
    }
}
```

---

## ✅ 实施后的效果

### 之前:
```
Mission Control → ❌ 无法访问 API
                  ↓
             Connection Refused
```

### 之后:
```
Mission Control → http://open.unippc24.com:9090/api/sessions
                  ↓ (Nginx 转发)
                  http://127.0.0.1:18789/api/sessions
                  ↓
                  ✅ 返回 JSON 数据
```

### Mission Control 代码:
```typescript
// 直接调用,不需要 Mock!
const response = await fetch('http://open.unippc24.com:9090/api/sessions', {
  headers: {
    'Authorization': 'Bearer uni-random-token'
  }
});

const sessions = await response.json();
console.log(sessions); // ✅ 真实数据!
```

---

## 🎯 总结

### 问题:
- Gateway API 只监听 `127.0.0.1:18789`
- 浏览器无法直接访问内部地址
- CORS 阻止跨域请求

### 解决:
- ✅ **Nginx 反向代理** (最简单、最安全)
- 在端口 9090 上代理 `/api/*` 到 18789
- 一个配置文件,5 分钟搞定

### 效果:
- ✅ Mission Control 可以调用真实 API
- ✅ 一个 app 管理所有功能
- ✅ 不需要打开多个标签页
- ✅ 完全实现你的目标!

---

**你想要我帮你生成完整的 Nginx 配置文件吗?** 🚀
