# 🚀 Vercel 部署检查清单

## ✅ 已完成

### 1. 代码推送到 GitHub
- ✅ Git commit 已创建: `873a8d0`
- ✅ 已推送到 `origin/master`
- ✅ GitHub 仓库: `seant15/uni-mission-control`

### 2. 代码重构完成
- ✅ 删除所有 OpenClaw agent 相关内容
- ✅ 创建新页面: MarketingOverview, Alerts, ClientsOverview
- ✅ 修正数据源映射（使用实际的 Supabase 表）
- ✅ 构建成功（2298 modules, 2.59s）
- ✅ 无 TypeScript 错误
- ✅ 修复 DataAnalytics.tsx TypeScript 编译错误
  - metaAdsets 和 metaAds 变量已正确声明且使用
  - Vercel 构建错误已解决

### 3. 数据源映射正确
- ✅ MarketingOverview → `daily_performance` (实时聚合)
- ✅ ClientsOverview → `clients` + `daily_performance` (JOIN + 聚合)
- ✅ Alerts → `public.alerts` (直接查询)
- ✅ DataAnalytics → `daily_performance`, `clients`, `meta_ads_ads`, `google_ads_keywords`

---

## 🔄 Vercel 自动部署

### Vercel 会自动执行以下步骤：

1. **检测 GitHub Push**
   - Vercel 监听 `master` 分支的推送
   - 在几秒钟内触发新部署

2. **构建项目**
   ```bash
   npm install
   npm run build
   ```

3. **部署到生产环境**
   - 自动部署到: `https://uni-mission-control.vercel.app`
   - 生成唯一的部署 URL

### 如何查看部署状态

访问 Vercel Dashboard:
1. 登录 https://vercel.com/dashboard
2. 选择 `uni-mission-control` 项目
3. 查看 "Deployments" 标签
4. 最新的部署应该显示为 "Building" 或 "Ready"

---

## ⚙️ 环境变量配置

### 必需的环境变量（Vercel Dashboard 设置）

访问: https://vercel.com/dashboard → uni-mission-control → Settings → Environment Variables

添加以下变量：

| 变量名 | 值 | 环境 |
|--------|-----|------|
| `VITE_SUPABASE_URL` | `https://jcghdthijgjttmpthagj.supabase.co` | ✅ Production<br>✅ Preview<br>✅ Development |
| `VITE_SUPABASE_ANON_KEY` | `你的 Supabase Anon Key` | ✅ Production<br>✅ Preview<br>✅ Development |

**重要**:
- 每个环境变量必须勾选**所有三个环境**
- 添加或修改环境变量后，需要**重新部署**才能生效

### 如何重新部署

如果添加了新的环境变量：

**方法 1: 通过 Vercel Dashboard**
1. Deployments → 找到最新部署
2. 点击 `...` (三个点) → Redeploy
3. 确认 Redeploy

**方法 2: 重新 Push 代码**
```bash
git commit --allow-empty -m "Trigger redeploy"
git push origin master
```

---

## 🧪 部署后测试

### 1. 检查部署 URL
访问: https://uni-mission-control.vercel.app

### 2. 测试新页面

#### Marketing Overview (/)
- [ ] 页面加载正常
- [ ] 时间段选择器工作 (7d/30d/90d)
- [ ] 显示指标卡片 (Spend, Revenue, ROAS, Conversions)
- [ ] 显示平台分解表

**期望**:
- 如果没有 Supabase 数据 → 显示 "No data available"
- 如果有数据 → 显示聚合的指标

#### Alerts (/alerts)
- [ ] 页面加载正常
- [ ] Severity 过滤工作 (low/medium/high/critical)
- [ ] Status 过滤工作 (new/in_progress/resolved/ignored)
- [ ] 可以添加 notes
- [ ] 可以更新 status

**期望**:
- 如果没有 alerts 数据 → 显示空状态
- 如果有数据 → 显示警报列表和 summary cards

#### Clients Overview (/clients-overview)
- [ ] 页面加载正常
- [ ] 时间段选择器工作 (7d/30d/90d/1yr)
- [ ] 显示 summary cards
- [ ] 显示 Bar Chart (Top 10 by ROAS)
- [ ] 显示 Pie Chart (Spend by platform)
- [ ] 表格可以排序

**期望**:
- 如果没有客户数据 → 显示 "No data available"
- 如果有数据 → 显示客户列表和图表

#### Data Analytics (/data-analytics)
- [ ] 页面加载正常
- [ ] 客户下拉菜单工作
- [ ] 平台选择器工作
- [ ] 日期范围选择器工作
- [ ] 图表显示正确

### 3. 检查浏览器 Console

打开浏览器开发者工具 (F12) → Console 标签

**检查**:
- [ ] 无红色错误
- [ ] Supabase 连接状态
- [ ] API 请求成功

**如果看到 "Invalid API key" 错误**:
→ 需要在 Vercel 配置 Supabase 环境变量

### 4. 检查 Network 面板

F12 → Network 标签

**检查**:
- [ ] Supabase API 请求返回 200 OK
- [ ] 响应是 JSON 格式（不是 HTML）
- [ ] 无 CORS 错误

---

## 🐛 常见问题排查

### 问题 1: 页面显示 404
**原因**: Vercel 路由配置问题

**解决**:
检查 `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/((?!api).*)", "destination": "/index.html" }
  ]
}
```

### 问题 2: 环境变量显示 undefined
**原因**: 环境变量未正确设置

**解决**:
1. 检查 Vercel Dashboard → Environment Variables
2. 确认所有三个环境都勾选了
3. Redeploy 项目

### 问题 3: Supabase 连接失败
**原因**: Invalid API key 或 URL 错误

**解决**:
1. 验证 `VITE_SUPABASE_URL` 是否正确
2. 验证 `VITE_SUPABASE_ANON_KEY` 是否正确
3. 检查 Supabase 项目是否激活

### 问题 4: 数据不显示
**原因**: Supabase 表为空或 RLS 策略阻止

**解决**:
1. 检查 Supabase 表是否有数据
2. 检查 RLS (Row Level Security) 策略
3. 验证表名是否正确（区分大小写）

---

## 📊 数据库准备（如果还没有数据）

### 创建测试数据

如果 Supabase 表是空的，可以插入测试数据：

#### 1. Clients 表
```sql
INSERT INTO clients (id, name, status, business_type) VALUES
('client-1', 'PROD', 'active', 'ecommerce'),
('client-2', 'Sip Lab', 'active', 'leadgen'),
('client-3', 'Demo Client', 'active', 'ecommerce');
```

#### 2. Daily Performance 表
```sql
INSERT INTO daily_performance (client_id, client_name, date, platform, impressions, clicks, conversions, cost, revenue) VALUES
('client-1', 'PROD', '2026-03-01', 'meta_ads', 50000, 1200, 45, 850.50, 4500.00),
('client-1', 'PROD', '2026-03-02', 'google_ads', 30000, 800, 30, 650.00, 3200.00),
('client-2', 'Sip Lab', '2026-03-01', 'meta_ads', 25000, 600, 20, 400.00, 2000.00);
```

#### 3. Alerts 表
```sql
INSERT INTO alerts (account_name, account_id, alert_type, severity, message, status, detected_at) VALUES
('PROD - Meta', 'act_123456', 'ctr_decline', 'high', 'CTR dropped by 25% in last 7 days', 'new', NOW()),
('Sip Lab - Google', 'customer_789', 'budget_alert', 'medium', 'Budget 80% depleted', 'new', NOW());
```

---

## ✅ 部署成功标志

部署成功后，你应该看到：

1. ✅ Vercel Dashboard 显示 "Ready" 状态
2. ✅ 访问 https://uni-mission-control.vercel.app 显示新的 UI
3. ✅ 侧边栏显示:
   - Marketing Overview
   - Alerts
   - Clients Overview
   - Data Analytics
4. ✅ 没有 "Mission Control" 和 "Task Analytics" 标签
5. ✅ 副标题显示 "Marketing Performance Hub"
6. ✅ 所有页面可以正常访问

---

## 📝 下一步

1. **配置 Supabase 环境变量**（如果还没配置）
2. **添加测试数据**（如果表是空的）
3. **测试所有页面**
4. **验证功能正常**

---

**部署时间**: 2026-03-10
**Commit**: `873a8d0`
**状态**: ✅ 代码已推送，等待 Vercel 自动部署

🎉 **Vercel 应该会在几分钟内自动完成部署！**
