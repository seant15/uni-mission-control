# 🔧 OpenClaw Gateway 外部访问配置指南

## 🎯 问题诊断

### 当前状况
```
OpenClaw Gateway: 127.0.0.1:18789 (仅本地访问)
Vercel Proxy:     尝试从外部连接 → ❌ 失败
```

### 根本原因
OpenClaw Gateway 绑定到 **loopback** (127.0.0.1)，只接受来自同一台机器的连接。Vercel的serverless function在不同的服务器上，无法连接。

---

## 🛠️ 解决方案

### 方案 1: 使用环境变量覆盖配置 (推荐)

OpenClaw 可能支持通过环境变量覆盖配置文件设置。

**步骤**:

1. **在 Coolify 中设置环境变量**:
   - 登录 Coolify Dashboard
   - 找到 OpenClaw 应用
   - 进入 **Environment Variables** 设置
   - 添加以下变量:
     ```
     OPENCLAW_GATEWAY_BIND=0.0.0.0
     OPENCLAW_GATEWAY_PORT=18789
     ```
   - 或者尝试这些可能的变量名:
     ```
     GATEWAY_BIND=0.0.0.0
     GATEWAY_HOST=0.0.0.0
     OPENCLAW_BIND=0.0.0.0
     ```

2. **重启 OpenClaw 容器**:
   - 在 Coolify Dashboard 点击 **Restart** 按钮
   - 或者在 SSH 中运行:
     ```bash
     docker ps | grep openclaw
     docker restart <container_id>
     ```

3. **验证**:
   ```bash
   # 检查 Gateway 是否绑定到 0.0.0.0
   openclaw gateway status

   # 应该显示:
   # Gateway: bind=all (0.0.0.0), port=18789
   ```

---

### 方案 2: 直接编辑配置文件

如果环境变量不起作用，手动编辑配置文件。

**步骤**:

1. **SSH 进入 OpenClaw 容器**:
   ```bash
   # 查找容器ID
   docker ps | grep openclaw

   # 进入容器
   docker exec -it <container_id> /bin/bash
   ```

2. **查找配置文件位置**:
   ```bash
   # 可能的位置:
   ls -la ~/.openclaw/openclaw.json
   ls -la /app/.openclaw/openclaw.json
   ls -la /root/.openclaw/openclaw.json

   # 或者搜索:
   find / -name "openclaw.json" 2>/dev/null
   ```

3. **编辑配置文件**:
   ```bash
   # 使用 vi 或 nano 编辑
   vi ~/.openclaw/openclaw.json

   # 或者直接用 sed 替换
   sed -i 's/"bind": "loopback"/"bind": "all"/g' ~/.openclaw/openclaw.json
   # 或者
   sed -i 's/"bind": "127.0.0.1"/"bind": "0.0.0.0"/g' ~/.openclaw/openclaw.json
   ```

4. **查看配置文件内容**:
   ```bash
   cat ~/.openclaw/openclaw.json
   ```

   应该看到类似:
   ```json
   {
     "gateway": {
       "bind": "all",  // 或 "0.0.0.0"
       "port": 18789
     }
   }
   ```

5. **重启 Gateway** (在容器内):
   ```bash
   # 方法1: 使用 CLI
   openclaw gateway restart

   # 方法2: 如果上面不行，手动杀掉进程
   ps aux | grep gateway
   kill -9 <pid>

   # 方法3: 重启整个容器 (退出后在宿主机运行)
   exit
   docker restart <container_id>
   ```

6. **验证**:
   ```bash
   openclaw gateway status
   ```

---

### 方案 3: 使用 Docker 端口映射 (如果配置文件无法修改)

如果 OpenClaw 配置无法更改，可以用 Docker 的端口转发。

**步骤**:

1. **在 Coolify 中配置端口映射**:
   - 进入 OpenClaw 应用设置
   - 找到 **Port Mappings** 或 **Network** 设置
   - 添加端口映射: `18789:18789` (容器端口 → 主机端口)

2. **确保防火墙开放端口**:
   ```bash
   # 在服务器上检查防火墙
   sudo ufw status

   # 如果需要，开放端口
   sudo ufw allow 18789/tcp
   ```

3. **测试外部访问**:
   ```bash
   # 从你的本地机器测试
   curl http://open.unippc24.com:18789/
   ```

---

### 方案 4: 使用 SSH 隧道 (临时测试方案)

**仅用于调试**，不适合生产环境。

```bash
# 在你的本地机器运行
ssh -L 18789:127.0.0.1:18789 user@open.unippc24.com

# 然后在 Vercel 环境变量中使用:
OPENCLAW_GATEWAY_URL=http://localhost:18789
```

---

## 🧪 验证步骤

配置完成后，按顺序验证:

### 1. 检查 Gateway 绑定状态
```bash
openclaw gateway status
```
期望输出:
```
Gateway: bind=all (0.0.0.0), port=18789
Status: Running
```

### 2. 从服务器本地测试
```bash
curl http://localhost:18789/
curl http://127.0.0.1:18789/
```

### 3. 从外部测试
```bash
# 在你的本地电脑运行
curl http://open.unippc24.com:18789/
```

### 4. 测试 API 端点
```bash
# 列出会话
curl -H "Authorization: Bearer uni-random-token" \
     http://open.unippc24.com:18789/api/sessions/list

# 创建会话
curl -X POST http://open.unippc24.com:18789/api/sessions/spawn \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer uni-random-token" \
     -d '{
       "agentId": "test-agent",
       "task": "Hello world",
       "mode": "run"
     }'
```

### 5. 测试 Vercel Proxy
```bash
# 访问诊断页面
curl https://uni-mission-control.vercel.app/api/openclaw?path=/api/sessions/list
```

---

## 📋 更新 Vercel 环境变量

一旦 Gateway 可以外部访问，更新 Vercel 环境变量:

1. **登录 Vercel Dashboard**
2. **进入 uni-mission-control 项目**
3. **Settings → Environment Variables**
4. **更新或添加**:
   ```
   OPENCLAW_GATEWAY_URL=http://open.unippc24.com:18789
   OPENCLAW_GATEWAY_TOKEN=uni-random-token
   ```

   **注意**: 使用 **18789** 端口 (API Gateway)，不是 9090 (前端UI)

5. **Redeploy**:
   - Deployments → 最新部署 → **...** → **Redeploy**

---

## 🎯 最终验证

部署完成后，测试 Mission Control:

1. **访问**: https://uni-mission-control.vercel.app/mission-control
2. **点击任何 Agent 的 "Chat with {agent}" 按钮**
3. **Chat 模态框应该打开**
4. **发送消息测试**
5. **检查浏览器 Console**:
   - 按 **F12** → **Console**
   - 应该看到成功的 API 调用，没有 CORS 或 Mixed Content 错误

---

## ❓ 故障排查

### 问题: `openclaw config set gateway.bind` 仍然失败

**原因**: OpenClaw 可能只接受特定的值。

**解决**: 尝试这些值:
```bash
openclaw config set gateway.bind all
openclaw config set gateway.bind "all"
openclaw config set gateway.bind remote
openclaw config set gateway.bind external
```

查看帮助:
```bash
openclaw help config
openclaw config --help
```

### 问题: `systemctl` 不可用

**原因**: Docker 容器内通常没有 systemd。

**解决**: 重启整个容器而不是服务:
```bash
docker restart <container_id>
```

### 问题: 配置文件找不到

**原因**: 可能在不同的目录。

**解决**:
```bash
# 搜索所有 JSON 配置文件
find / -name "*.json" -type f 2>/dev/null | grep -i openclaw

# 或者查看 OpenClaw 的环境变量
env | grep -i openclaw
env | grep -i config
```

### 问题: Gateway 重启后仍然绑定到 127.0.0.1

**原因**: 配置未生效或被覆盖。

**解决**:
1. 检查是否有多个配置文件
2. 检查 Docker 容器的启动命令是否硬编码了绑定地址
3. 在 Coolify 中查看容器的启动命令

---

## 📞 需要帮助?

如果以上方法都不行，提供以下信息:

1. **OpenClaw 版本**:
   ```bash
   openclaw --version
   ```

2. **容器启动命令**:
   ```bash
   docker inspect <container_id> | grep -A 20 "Cmd"
   ```

3. **配置文件内容**:
   ```bash
   cat ~/.openclaw/openclaw.json
   ```

4. **环境变量**:
   ```bash
   env | grep -i openclaw
   ```

5. **Gateway 日志**:
   ```bash
   openclaw gateway logs
   # 或
   docker logs <container_id> | tail -100
   ```

---

**下一步**: 选择一个方案并执行，然后运行验证步骤。完成后告诉我结果! 🚀
