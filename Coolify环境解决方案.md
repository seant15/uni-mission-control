# 🐳 Coolify 环境下的 OpenClaw 集成方案

**限制**: 不能修改 OpenClaw 原有代码和配置
**环境**: Coolify 部署的 OpenClaw Git Repo

---

## 🚫 不可行的方案

以下方案在 Coolify 环境下**不能使用**:

❌ 修改 Nginx 配置 (Coolify 管理)
❌ 修改 Gateway 监听地址 (容器内部配置)
❌ 直接修改 OpenClaw 源代码

---

## ✅ 可行方案

### 方案 A: 独立的代理服务 ⭐⭐⭐⭐⭐ 最推荐

**思路**: 在 Coolify 中部署一个**独立的代理服务**

#### 架构:
```
Mission Control (localhost:5173)
    ↓
代理服务 (Coolify 部署, 端口 3001)
    ↓
OpenClaw Gateway (内部 18789)
```

#### 实现步骤:

##### 1. 创建代理服务项目

创建新目录:
```bash
mkdir openclaw-proxy
cd openclaw-proxy
```

创建 `package.json`:
```json
{
  "name": "openclaw-proxy",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "node-fetch": "^3.3.2"
  }
}
```

创建 `server.js`:
```javascript
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

// OpenClaw Gateway 内部地址
// 如果在同一个 Docker 网络,使用容器名
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://openclaw:18789';

// 启用 CORS
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.ALLOWED_ORIGIN
  ].filter(Boolean),
  credentials: true
}));

app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', gateway: GATEWAY_URL });
});

// 代理所有 /api 请求
app.all('/api/*', async (req, res) => {
  const apiPath = req.path; // /api/sessions
  const targetUrl = `${GATEWAY_URL}${apiPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;

  console.log(`Proxying: ${req.method} ${apiPath} -> ${targetUrl}`);

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers,
        host: undefined, // 移除 host header
      },
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type');

    // 复制响应头
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      error: 'Proxy failed',
      message: error.message,
      target: targetUrl
    });
  }
});

// WebSocket 代理 (可选)
app.get('/ws/*', (req, res) => {
  res.status(501).json({
    error: 'WebSocket proxy not implemented',
    message: 'Use direct connection for WebSocket'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 OpenClaw Proxy running on port ${PORT}`);
  console.log(`📡 Proxying to: ${GATEWAY_URL}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
```

创建 `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY server.js ./

EXPOSE 3001

CMD ["npm", "start"]
```

创建 `.gitignore`:
```
node_modules/
.env
```

##### 2. 推送到 Git

```bash
git init
git add .
git commit -m "OpenClaw API proxy service"
git remote add origin <your-git-url>
git push -u origin main
```

##### 3. 在 Coolify 中部署

1. 在 Coolify 中添加新服务
2. 选择 Git 仓库
3. 设置环境变量:
   ```
   OPENCLAW_GATEWAY_URL=http://openclaw:18789
   ALLOWED_ORIGIN=https://your-mission-control-domain.com
   PORT=3001
   ```
4. 部署

##### 4. 配置 Docker 网络

在 Coolify 中,确保代理服务和 OpenClaw 在**同一个 Docker 网络**:

```yaml
# docker-compose.yml (Coolify 自动生成)
services:
  openclaw-proxy:
    image: your-proxy-image
    networks:
      - openclaw-network
    environment:
      - OPENCLAW_GATEWAY_URL=http://openclaw:18789

  openclaw:
    # OpenClaw 容器
    networks:
      - openclaw-network

networks:
  openclaw-network:
    external: true
```

##### 5. 测试代理

```bash
# 测试健康检查
curl https://your-proxy.coolify.app/health

# 测试 API 代理
curl https://your-proxy.coolify.app/api/sessions
```

##### 6. 更新 Mission Control

```env
# .env
VITE_OPENCLAW_GATEWAY_URL=https://your-proxy.coolify.app
VITE_USE_MOCK_DATA=false
```

---

### 方案 B: Cloudflare Workers 代理 ⭐⭐⭐⭐

**思路**: 使用 Cloudflare Workers 作为边缘代理

#### 优势:
- ✅ 完全独立,不需要修改 OpenClaw
- ✅ 全球 CDN 加速
- ✅ 免费额度充足

#### 实现:

创建 `worker.js`:
```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 只代理 /api 路径
    if (!url.pathname.startsWith('/api')) {
      return new Response('Not Found', { status: 404 });
    }

    // 目标 OpenClaw Gateway
    const targetUrl = `http://open.unippc24.com:18789${url.pathname}${url.search}`;

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' ? await request.text() : undefined
      });

      // 添加 CORS 头
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

      return newResponse;
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
```

部署到 Cloudflare Workers,然后:
```env
VITE_OPENCLAW_GATEWAY_URL=https://your-worker.workers.dev
```

---

### 方案 C: Tailscale + 客户端配置 ⭐⭐⭐

**思路**: 使用 Tailscale VPN 访问内部网络

#### 步骤:

1. **在服务器上配置 Tailscale**
   ```bash
   # 安装 Tailscale
   curl -fsSL https://tailscale.com/install.sh | sh

   # 启动并获取内网 IP
   tailscale up
   tailscale ip -4  # 例如: 100.x.y.z
   ```

2. **暴露 Gateway 到 Tailscale 网络**

   编辑 OpenClaw 配置:
   ```json
   {
     "gateway": {
       "host": "100.x.y.z",  // Tailscale IP
       "port": 18789
     }
   }
   ```

3. **客户端安装 Tailscale**

   开发者电脑安装 Tailscale 客户端

4. **Mission Control 配置**
   ```env
   VITE_OPENCLAW_GATEWAY_URL=http://100.x.y.z:18789
   VITE_USE_MOCK_DATA=false
   ```

#### 限制:
- ⚠️ 用户必须安装 Tailscale
- ⚠️ 只适合团队内部使用

---

### 方案 D: Mission Control 后端 API ⭐⭐⭐

**思路**: Mission Control 部署时包含后端服务

#### 架构:
```
Mission Control 前端 (Vite)
     ↓
Mission Control 后端 (Express)
     ↓
OpenClaw Gateway (内部调用)
```

#### 实现:

在 Mission Control 项目中添加后端:

```
uni-mission-control/
├── src/           # 前端
├── server/        # 后端 (新建)
│   └── index.js
├── package.json
└── Dockerfile
```

`server/index.js`:
```javascript
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API 代理
app.all('/api/*', async (req, res) => {
  const gateway = process.env.OPENCLAW_GATEWAY_URL || 'http://openclaw:18789';
  const targetUrl = `${gateway}${req.path}`;

  try {
    const response = await fetch(targetUrl, {
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

// 前端静态文件
app.use(express.static(path.join(__dirname, '../dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

`Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install

# 构建前端
COPY . .
RUN npm run build

# 启动后端
EXPOSE 3000
CMD ["node", "server/index.js"]
```

---

## 📊 方案对比

| 方案 | 难度 | 独立性 | 推荐度 | 说明 |
|------|------|--------|--------|------|
| **A: 独立代理** | 🟡 中 | ✅ 完全独立 | ⭐⭐⭐⭐⭐ | **最推荐** |
| **B: Cloudflare** | 🟢 易 | ✅ 完全独立 | ⭐⭐⭐⭐ | 简单但有限制 |
| **C: Tailscale** | 🟡 中 | ⚠️ 需要VPN | ⭐⭐⭐ | 团队内部用 |
| **D: 后端集成** | 🔴 难 | ⚠️ 需要重构 | ⭐⭐ | 工作量大 |

---

## 🎯 我的推荐: 方案 A (独立代理服务)

### 为什么?

1. **✅ 完全独立**: 不修改 OpenClaw
2. **✅ Coolify 友好**: 直接部署
3. **✅ 灵活**: 可以添加认证、缓存等
4. **✅ 简单**: 只需一个 Node.js 服务

### 立即实施:

**我可以帮你**:
1. ✅ 创建完整的代理服务代码
2. ✅ 生成 Dockerfile 和配置
3. ✅ 提供 Coolify 部署步骤
4. ✅ 更新 Mission Control 配置

---

**你想让我立即创建这个代理服务吗?** 🚀

我可以在你的项目中生成所有需要的文件!
