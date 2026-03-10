# 数据源映射 - Mission Control 页面

## ✅ 修正后的表格映射关系

根据 `SUPABASE_SCHEMA_REFERENCE.md`，以下是正确的数据源映射：

---

## 📊 1. Marketing Overview (`/`)

### 数据源
- **主表**: `daily_performance` (实时聚合)
- **方法**: 从 `daily_performance` 表实时计算所有指标

### 查询逻辑
```typescript
// 1. 根据时间段获取数据
const dateRange = getDateRange(period) // 7d, 30d, 90d
const { data } = await supabase
  .from('daily_performance')
  .select('*')
  .gte('date', dateRange.start)
  .lte('date', dateRange.end)

// 2. 实时聚合计算
- total_spend = SUM(cost)
- total_revenue = SUM(revenue)
- total_impressions = SUM(impressions)
- total_clicks = SUM(clicks)
- total_conversions = SUM(conversions)

// 3. 计算派生指标
- ROAS = total_revenue / total_spend
- CTR = (total_clicks / total_impressions) * 100
- CPC = total_spend / total_clicks
- CPA = total_spend / total_conversions
- Conversion Rate = (total_conversions / total_clicks) * 100

// 4. 按平台分组
- 按 platform 字段分组统计
- 每个平台计算独立的 spend, revenue, ROAS
```

### 显示的指标
- **主要指标**: Total Spend, Total Revenue, ROAS, Conversions
- **次要指标**: Impressions, Clicks, CTR, CPC
- **成本指标**: Conversion Rate, CPA
- **平台分解表**: 每个平台的 Spend, Revenue, ROAS, 占比

### 字段映射
| Marketing Overview | daily_performance | 计算方式 |
|-------------------|-------------------|----------|
| Total Spend | `cost` | SUM(cost) |
| Total Revenue | `revenue` | SUM(revenue) |
| Impressions | `impressions` | SUM(impressions) |
| Clicks | `clicks` | SUM(clicks) |
| Conversions | `conversions` | SUM(conversions) |
| ROAS | - | revenue / cost |
| CTR | - | (clicks / impressions) * 100 |
| CPC | - | cost / clicks |
| CPA | - | cost / conversions |
| Platform | `platform` | GROUP BY platform |

---

## 🚨 2. Alerts (`/alerts`)

### 数据源
- **主表**: `public.alerts`
- **方法**: 直接查询，无需聚合

### 查询逻辑
```typescript
const { data } = await supabase
  .from('alerts')
  .select('*')
  .in('severity', selectedSeverity)  // 可选过滤
  .in('status', selectedStatus)      // 可选过滤
  .order('detected_at', { ascending: false })
```

### 功能
- 按 severity 过滤 (low, medium, high, critical)
- 按 status 过滤 (new, in_progress, resolved, ignored)
- 添加 notes
- 更新 status
- 显示 summary cards (总数, new, in_progress, critical, high)

### 字段使用
| 字段 | 用途 |
|------|------|
| `id` | 主键 |
| `account_name` | 显示账户名称 |
| `alert_type` | 警报类型 |
| `severity` | 严重程度 (过滤、排序、颜色) |
| `message` | 警报描述 |
| `metric_name` | 受影响的指标 |
| `metric_change` | 变化量 |
| `detected_at` | 检测时间 (排序) |
| `status` | 状态 (过滤、更新) |
| `notes` | 用户备注 (可编辑) |
| `resolved_at` | 解决时间 |

---

## 👥 3. Clients Overview (`/clients-overview`)

### 数据源
- **主表**: `clients` (客户主表)
- **辅表**: `daily_performance` (性能数据)
- **方法**: JOIN 后聚合计算

### 查询逻辑
```typescript
// 1. 获取所有客户
const { data: clients } = await supabase
  .from('clients')
  .select('*')
  .order('name')

// 2. 获取性能数据
const dateRange = getDateRange(period) // 7d, 30d, 90d, 1yr
const { data: performanceData } = await supabase
  .from('daily_performance')
  .select('*')
  .gte('date', dateRange.start)
  .lte('date', dateRange.end)

// 3. 按客户聚合
clients.map(client => {
  const clientData = performanceData.filter(row => row.client_id === client.id)

  return {
    id: client.id,
    account_name: client.name,
    platform: determinePrimaryPlatform(clientData), // 支出最多的平台
    total_spend: SUM(clientData.cost),
    total_revenue: SUM(clientData.revenue),
    roas: total_revenue / total_spend,
    ctr: (SUM(clicks) / SUM(impressions)) * 100,
    cpc: total_spend / SUM(clicks),
    impressions: SUM(clientData.impressions),
    clicks: SUM(clientData.clicks),
    conversions: SUM(clientData.conversions),
    status: client.status,
    ...
  }
})
```

### 显示内容
- **Summary Cards**: 总账户数, 总支出, 总收入, 平均 ROAS, 总转化
- **图表**:
  - Bar Chart: Top 10 账户 by ROAS
  - Pie Chart: 按平台的支出分布
- **表格**: 所有账户的详细指标 (可排序)

### 字段映射
| Clients Overview | clients | daily_performance | 计算方式 |
|------------------|---------|-------------------|----------|
| Account Name | `name` | - | 直接使用 |
| Platform | - | `platform` | 支出最多的平台 |
| Total Spend | - | `cost` | SUM(cost) WHERE client_id = ... |
| Total Revenue | - | `revenue` | SUM(revenue) |
| ROAS | - | - | revenue / cost |
| CTR | - | `clicks`, `impressions` | (clicks / impressions) * 100 |
| CPC | - | `cost`, `clicks` | cost / clicks |
| Impressions | - | `impressions` | SUM(impressions) |
| Clicks | - | `clicks` | SUM(clicks) |
| Conversions | - | `conversions` | SUM(conversions) |
| Status | `status` | - | 直接使用 |

### 平台映射
`daily_performance.platform` → 显示名称：
- `meta_ads` → `"Meta Ads"`
- `google_ads` → `"Google Ads"`
- `tiktok_ads` → `"TikTok Ads"`
- `linkedin_ads` → `"LinkedIn Ads"`
- `twitter_ads` → `"Twitter Ads"`

---

## 📈 4. Data Analytics (`/data-analytics`)

### 数据源
- **主表**: `daily_performance`
- **辅表**:
  - `clients` (客户列表)
  - `meta_ads_ads` (Meta 广告详情)
  - `google_ads_keywords` (Google 关键词详情)

### 查询逻辑
参考 `SUPABASE_SCHEMA_REFERENCE.md` 中的 DataAnalytics 部分。

---

## 🎯 关键变更总结

### ❌ 删除的假设
- ~~`marketing_metrics` 表~~ → 改用 `daily_performance` 实时聚合
- ~~`client_accounts` 表~~ → 改用 `clients` + `daily_performance` 聚合
- ~~`account_metrics` 表~~ → 不存在

### ✅ 实际使用的表
1. **`daily_performance`** - 所有性能数据的来源
   - MarketingOverview: 聚合所有数据
   - ClientsOverview: 按 client_id 分组聚合
   - DataAnalytics: 直接查询

2. **`clients`** - 客户主表
   - ClientsOverview: 提供客户名称和基本信息
   - DataAnalytics: 客户选择下拉菜单

3. **`alerts`** - 警报数据
   - Alerts 页面: 直接查询和更新

### 🔄 实时聚合 vs 预聚合

**之前的错误假设**: 使用预聚合表 (`marketing_metrics`, `client_accounts`)

**现在的正确做法**:
- **MarketingOverview**: 从 `daily_performance` 实时计算
- **ClientsOverview**: 从 `clients` JOIN `daily_performance` 实时计算

**优点**:
- ✅ 数据永远是最新的
- ✅ 不需要维护聚合表
- ✅ 灵活的时间段选择

**考虑**:
- ⚠️ 如果 `daily_performance` 数据量很大 (10K+ rows)，可能需要优化
- ⚠️ 可以考虑添加索引: `(client_id, date)`, `(platform, date)`

---

## 📊 数据流图

```
┌─────────────────────┐
│  daily_performance  │ ← 原始每日数据
│  (meta_ads,         │
│   google_ads, etc)  │
└──────────┬──────────┘
           │
           ├─────────────────────────┐
           │                         │
           ▼                         ▼
┌──────────────────┐      ┌──────────────────┐
│ MarketingOverview│      │ ClientsOverview  │
│  (实时聚合全部)   │      │ (按client_id聚合) │
└──────────────────┘      └──────────────────┘
                                   ▲
                                   │
                          ┌────────┴────────┐
                          │    clients      │
                          │   (客户主表)     │
                          └─────────────────┘

           ┌────────────────┐
           │    alerts      │ ← 独立警报数据
           └────────────────┘
                    ▼
           ┌────────────────┐
           │  Alerts 页面   │
           └────────────────┘
```

---

## 🚀 性能优化建议

### 1. 索引 (如果查询慢)
```sql
-- daily_performance 表
CREATE INDEX idx_daily_perf_client_date ON daily_performance(client_id, date);
CREATE INDEX idx_daily_perf_platform_date ON daily_performance(platform, date);
CREATE INDEX idx_daily_perf_date ON daily_performance(date);

-- alerts 表
CREATE INDEX idx_alerts_severity_status ON alerts(severity, status);
CREATE INDEX idx_alerts_detected_at ON alerts(detected_at DESC);
```

### 2. 查询优化
- 使用 date range 过滤减少扫描行数
- 只 SELECT 需要的字段 (避免 `SELECT *`)
- 考虑在前端缓存客户列表 (很少变化)

### 3. 未来考虑
如果 `daily_performance` 增长到 100K+ rows:
- 考虑创建 materialized view 预聚合
- 或者创建定时任务更新 `marketing_metrics` 表
- 按日期分区 `daily_performance` 表

---

**最后更新**: 2026-03-10
**状态**: ✅ 已实现并测试通过
