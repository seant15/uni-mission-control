# 快速参考 - UNI Mission Control

## 🎯 页面概览

| 页面 | 路由 | 数据源 | 主要功能 |
|------|------|--------|----------|
| **Marketing Overview** | `/` | `daily_performance` (实时聚合) | 总体营销指标，按时间段显示 |
| **Alerts** | `/alerts` | `alerts` | 性能警报管理，过滤和状态更新 |
| **Clients Overview** | `/clients-overview` | `clients` + `daily_performance` | 客户账户对比，图表和表格 |
| **Data Analytics** | `/data-analytics` | `daily_performance`, `clients`, etc. | 详细分析工具 |
| **Settings** | `/settings` | - | 应用设置 |

---

## 📊 数据表快速查询

### 1. Marketing Overview 数据获取

```typescript
// 获取指定时间段的所有性能数据
const { data } = await supabase
  .from('daily_performance')
  .select('*')
  .gte('date', startDate)
  .lte('date', endDate)

// 聚合计算
const total_spend = data.reduce((sum, row) => sum + Number(row.cost), 0)
const total_revenue = data.reduce((sum, row) => sum + Number(row.revenue), 0)
const roas = total_spend > 0 ? total_revenue / total_spend : 0
```

### 2. Alerts 数据获取

```typescript
// 获取所有警报，支持过滤
const { data } = await supabase
  .from('alerts')
  .select('*')
  .in('severity', ['high', 'critical'])  // 可选
  .in('status', ['new'])                 // 可选
  .order('detected_at', { ascending: false })
```

### 3. Clients Overview 数据获取

```typescript
// Step 1: 获取所有客户
const { data: clients } = await supabase
  .from('clients')
  .select('*')

// Step 2: 获取性能数据
const { data: performance } = await supabase
  .from('daily_performance')
  .select('*')
  .gte('date', startDate)
  .lte('date', endDate)

// Step 3: 按客户聚合
const clientMetrics = clients.map(client => {
  const clientData = performance.filter(row => row.client_id === client.id)
  return {
    account_name: client.name,
    total_spend: sum(clientData.cost),
    total_revenue: sum(clientData.revenue),
    roas: total_revenue / total_spend,
    // ...
  }
})
```

---

## 🔑 关键字段映射

### daily_performance → UI 指标

| DB 字段 | UI 显示 | 计算方式 |
|---------|---------|----------|
| `cost` | Total Spend | SUM(cost) |
| `revenue` | Total Revenue | SUM(revenue) |
| `impressions` | Impressions | SUM(impressions) |
| `clicks` | Clicks | SUM(clicks) |
| `conversions` | Conversions | SUM(conversions) |
| - | ROAS | revenue / cost |
| - | CTR | (clicks / impressions) * 100 |
| - | CPC | cost / clicks |
| - | CPA | cost / conversions |
| `platform` | Platform | GROUP BY platform |

### alerts → UI 显示

| DB 字段 | UI 显示 | 说明 |
|---------|---------|------|
| `severity` | Badge Color | critical=红, high=橙, medium=黄, low=蓝 |
| `status` | Status Badge | new, in_progress, resolved, ignored |
| `message` | Alert Message | 警报描述 |
| `metric_change` | Change | 变化量 (如 "-25%") |
| `notes` | Notes | 用户备注 (可编辑) |
| `detected_at` | Time | 检测时间 |

---

## 🎨 UI 颜色规则

### ROAS 颜色
- 🟢 绿色: ROAS ≥ 2.0x (优秀)
- 🔵 蓝色: ROAS ≥ 1.0x (盈利)
- 🔴 红色: ROAS < 1.0x (亏损)

### Alert Severity 颜色
- 🔴 Critical: `bg-red-600 text-white`
- 🟠 High: `bg-orange-600 text-white`
- 🟡 Medium: `bg-yellow-500 text-gray-900`
- 🔵 Low: `bg-blue-600 text-white`

### Alert Status 颜色
- 🔵 New: `bg-blue-100 text-blue-800`
- 🟡 In Progress: `bg-yellow-100 text-yellow-800`
- 🟢 Resolved: `bg-green-100 text-green-800`
- ⚪ Ignored: `bg-gray-100 text-gray-800`

---

## ⚙️ 环境变量

### 必需的环境变量

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 本地开发

```bash
# .env.local
VITE_SUPABASE_URL=https://jcghdthijgjttmpthagj.supabase.co
VITE_SUPABASE_ANON_KEY=your-key
```

### Vercel 部署

在 Vercel Dashboard → Settings → Environment Variables 添加:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

记得勾选所有三个环境: Production, Preview, Development

---

## 🚀 常用命令

```bash
# 开发
npm run dev

# 构建
npm run build

# 预览构建
npm run preview

# 类型检查
npm run type-check

# 部署到 Vercel
vercel --prod
```

---

## 🐛 常见问题

### Q: 数据不显示?
A: 检查:
1. Supabase 环境变量是否正确
2. Supabase 表是否有数据
3. 浏览器 Console 是否有错误
4. 日期范围是否正确

### Q: "Invalid API key" 错误?
A:
1. 检查 `.env.local` 文件
2. 重启开发服务器 (`npm run dev`)
3. Vercel 部署需要在 Dashboard 设置环境变量

### Q: 图表不显示?
A:
1. 检查是否有足够的数据 (至少 1 条)
2. 检查数据格式是否正确
3. 检查 Recharts 是否正确安装

### Q: 时间段切换没反应?
A:
1. 检查 date 字段格式 (应该是 YYYY-MM-DD)
2. 检查日期范围计算逻辑
3. 清除浏览器缓存

---

## 📚 相关文档

- [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md) - 完整重构总结
- [DATA_SOURCE_MAPPING.md](DATA_SOURCE_MAPPING.md) - 详细数据源映射
- [SUPABASE_SCHEMA_REFERENCE.md](../tmp/SUPABASE_SCHEMA_REFERENCE.md) - 数据库结构参考
- [VERCEL_ENV_SETUP.md](VERCEL_ENV_SETUP.md) - Vercel 部署指南

---

**最后更新**: 2026-03-10
