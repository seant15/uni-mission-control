# 🔧 OpenClaw Gateway 配置指南

**问题**: Gateway remote mode 配置缺失
**解决方案**: 设置 `gateway.remote.url`

---

## 📋 当前问题

### 错误信息:
```
Health check failed: Error: gateway remote mode misconfigured: gateway.remote.url missing
Config: /data/.openclaw/openclaw.json
Fix: set gateway.remote.url, or set gateway.mode=local.
```

### 说明:
- 你把 Gateway 模式改成了 `remote`
- 但没有设置 `gateway.remote.url`
- OpenClaw 不知道应该连接到哪个远程 URL

---

## 🔧 解决方案选项

### 选项 A: 设置 Remote URL (如果你需要 remote 模式)

编辑配置文件:
```bash
# 配置文件位置 (根据日志):
/data/.openclaw/openclaw.json
```

添加配置:
```json
{
  "gateway": {
    "mode": "remote",
    "remote": {
      "url": "http://open.unippc24.com:9090"
    }
  }
}
```

或者如果你想要公开 API:
```json
{
  "gateway": {
    "mode": "remote",
    "remote": {
      "url": "http://open.unippc24.com:18789"
    }
  }
}
```

---

### 选项 B: 改回 Local 模式 (推荐,如果不确定)

编辑配置文件:
```json
{
  "gateway": {
    "mode": "local"
  }
}
```

或运行命令:
```bash
openclaw doctor --fix
```

---

## 📝 完整配置示例

### 最小配置 (Local 模式):
```json
{
  "gateway": {
    "mode": "local",
    "port": 18789
  }
}
```

### 完整配置 (Remote 模式):
```json
{
  "gateway": {
    "mode": "remote",
    "port": 18789,
    "remote": {
      "url": "http://open.unippc24.com:9090",
      "apiKey": "your-api-key-here"
    }
  }
}
```

---

## 🚀 配置后的步骤

### 1. 编辑配置文件
```bash
# 如果你能访问服务器:
nano /data/.openclaw/openclaw.json

# 或
vi /data/.openclaw/openclaw.json
```

### 2. 重启 OpenClaw Gateway
```bash
# 重启服务
openclaw gateway restart

# 或完全重启容器
docker restart openclaw  # 如果使用 Docker
```

### 3. 验证配置
```bash
openclaw doctor
```

---

## 🎯 我的建议

### 如果你不确定需要什么:

**改回 Local 模式** (最简单):

1. 编辑 `/data/.openclaw/openclaw.json`:
   ```json
   {
     "gateway": {
       "mode": "local"
     }
   }
   ```

2. 重启 Gateway

3. 一切应该正常工作

### Local vs Remote 的区别:

**Local 模式**:
- Gateway API 只在 `127.0.0.1:18789` 监听
- 只能本地访问
- ✅ 更安全
- ❌ 外部无法访问

**Remote 模式**:
- Gateway 可以连接到远程服务
- 需要配置 `remote.url`
- ⚠️ 需要正确配置才能工作

---

## 🔍 从日志中发现的其他信息

### Gateway 正在运行:
```
[entrypoint] starting openclaw gateway on port 18789...
host mounted at http://127.0.0.1:18789/__openclaw__/canvas/
```

### Nginx 前端:
```
[entrypoint] starting nginx on port 9090...
[entrypoint] no AUTH_PASSWORD set, nginx will not require authentication
```

### 加载的插件:
```
Registered plugin command: /pair (plugin: device-pair)
Registered plugin command: /phone (plugin: phone-control)
Registered plugin command: /voice (plugin: talk-voice)
```

---

## 💡 针对 Mission Control 的影响

### 当前状态:
无论你选择 local 还是 remote 模式:
- ✅ OpenClaw Control (9090) 仍然可以访问
- ✅ Mission Control 的外部链接仍然有效
- ❌ API (18789) 仍然无法从外部直接访问 (除非你配置端口转发)

### 建议:
1. **改回 local 模式** (避免配置复杂性)
2. **保持 Mission Control 使用外部链接**
3. **不要尝试直接调用 API** (因为它在内部网络)

---

## 🛠️ 快速修复命令

```bash
# 方法 1: 自动修复
openclaw doctor --fix

# 方法 2: 手动编辑配置,改回 local
echo '{"gateway": {"mode": "local"}}' > /data/.openclaw/openclaw.json

# 重启 gateway
openclaw gateway restart
```

---

## ❓ 需要更多帮助?

### 检查当前配置:
```bash
cat /data/.openclaw/openclaw.json
```

### 查看文档:
根据日志中的提示,OpenClaw 有文档:
```
https://docs.openclaw.ai/gateway/tailscale
https://docs.openclaw.ai/web/control-ui
```

---

**建议**: 运行 `openclaw doctor --fix` 让它自动修复配置问题! 🚀
