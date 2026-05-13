# OpenClaw chat URL（VITE_OPENCLAW_CHAT_URL）

## 它是什么

Mission Control 左下角「OpenClaw」按钮会打开一个**全屏内嵌的 iframe**，`src` 就是你在环境变量里填的完整 HTTPS 地址。  
也就是说：**任意可被 iframe 加载的聊天页 URL** 都可以，不限定必须是某一个固定产品名；你们实际部署的 OpenClaw、自建 Chat UI、或带 embed 的网关，只要地址稳定即可。

## 要求（否则 iframe 会白屏或报错）

1. 必须是 **HTTPS**（与站点同源策略、混合内容一致）。  
2. 目标页面响应头需允许被嵌入：  
   - 不能是 `X-Frame-Options: DENY` / `SAMEORIGIN`（若你们域名与聊天页不同域）；  
   - 若用 CSP，需包含 `frame-ancestors` 允许你们 Mission Control 的域名（例如 `https://your-app.vercel.app`）。  
3. 若 OpenClaw 需要登录，要么用**带 token 的 embed 专用 URL**，要么用户先在同一浏览器登录该域。

## 本地开发

在项目根目录 `uni-mission-control` 下复制 `.env.example` 为 `.env.local`，增加一行（示例，请换成你们真实地址）：

```
VITE_OPENCLAW_CHAT_URL=https://chat.yourcompany.com/embed?workspace=uni
```

重启 `npm run dev`（Vite 只在启动时读 env）。

## Vercel / 生产

在 Vercel 项目 → Settings → Environment Variables 中新增同名变量 `VITE_OPENCLAW_CHAT_URL`，对 Production（及 Preview 如需）保存后重新部署。

## 未配置时

未设置或为空字符串时，点击按钮会 toast 提示配置方式，不会崩溃。
