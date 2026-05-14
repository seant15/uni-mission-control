# Agent Brief — UNI Mission Control Frontend Developer
**生成时间:** 2026-05-13  
**适用 repo:** `uni-mission-control` (branch: `master`)  
**本地路径:** `C:\Users\stan8\022026 OPENCLAW WORKSPACE\uni-mission-control`  
**部署平台:** Vercel  
**负责人背景:** Sean Tan，UNI Marketing Agency 创始人，正在把这个 dashboard 打造成团队日常监控的唯一工作台

---

## 一、项目背景（必读）

UNI Mission Control 是一个 **paid media agency 的内部运营 dashboard**。他们管理多个客户（client）的 Google Ads + Meta Ads 账户。这个系统从 Supabase 读取广告数据，展示给媒体买手（media buyer）、合作伙伴（partner）和客户（client）。

**技术栈：**
- React 18 + TypeScript + Vite
- TailwindCSS
- @tanstack/react-query（所有数据请求）
- react-router-dom
- Supabase JS client（认证 + 数据库）
- sonner（toast 通知）
- 部署在 Vercel

**核心文件结构（忽略 node_modules/dist）：**
```
src/
  App.tsx                        ← 路由 + 侧边栏 + AppShell
  lib/
    api.ts                       ← 所有 DB 查询（db 对象）
    auth.ts                      ← 认证工具
    permissions.ts               ← 用户/权限 CRUD
    supabase.ts                  ← Supabase client 初始化
    settings.ts                  ← Dashboard 设置
    mock-data.ts                 ← mock 数据
  contexts/
    AuthContext.tsx              ← useAuth() hook，提供 session/appUser/role
  pages/
    MarketingOverview.tsx        ← "UNI Overview" 页（跨平台汇总，7/30/90d）
    RealtimePerformance.tsx      ← 实时性能页（hourly 对比窗口）
    ClientsOverview.tsx          ← 客户列表概览
    DataAnalytics.tsx            ← "Account Performance" 详细账户数据
    CreativePerformance.tsx      ← 广告素材 + 缩略图 + 指标
    Alerts.tsx                   ← 告警管理（包含子组件目录 Alerts/）
    MissionBoard.tsx             ← Kanban 任务板
    DashboardSettings.tsx        ← 设置页
    FeedbackAdmin.tsx            ← 反馈管理（super_admin only）
    UserManagement.tsx           ← 用户管理（super_admin only）
    Login.tsx
  types/
    alerts.ts / mission.ts / marketing.ts / permissions.ts / feedback.ts / index.ts
```

**数据库关键表（Supabase）：**
- `clients` — 客户基本信息，含 `meta_ad_account_id`, `google_ads_customer_id`, `business_type`（ecommerce/leadgen）, `currency`, `status`
- `daily_performance` — 每日汇总（client_id, date, platform, ad_account_id, cost, revenue, impressions, clicks, conversions）
- `hourly_performance` — 每小时数据，14天保留（同字段 + hour, account_local_hour, account_timezone, is_real_data）
- `meta_ads` / `meta_ads_ad_sets` / `meta_ads_ads` — Meta 分层数据（含 creative 字段: image_url, thumbnail_url, headline, primary_copy）
- `google_ads` / `google_ads_ad_groups` / `google_ads_ads` / `google_ads_keywords` / `google_ads_search_terms`
- `alerts` — 告警记录（client_id, severity, status, alert_type, message）
- `alert_rules` — 用户创建的规则
- `mission_cards` — Kanban 卡片（column_status: new/in_process/in_review/done/archived/cancelled）
- `app_users` — 用户（role: super_admin/team_member/... + primary_client_id）
- `user_client_access` — 用户 ↔ 客户 access 关系表

**当前 role 系统：** `app_users.role` 现在只有 `super_admin` 和基础 `team_member`，需要扩展（见任务 #4）。

---

## 二、本次改动的背景与动机

Sean 在 2026-05-13 团队会议上演示了这个 dashboard，提出了以下核心问题：

1. **数字不一致** — 同一天，"UNI Overview"、"Realtime Performance"、"Account Performance" 三个页面显示的数字不一样（May 12 显示 28 vs 27 vs 11）。媒体买手不信任数据。
2. **时间筛选器无效** — Real-time Performance 切换时间窗口，结果看起来没变化。
3. **三个 Tab 内容重复** — UNI Overview / Clients Overview / Account Performance 显示同一批数据，只是粒度不同，媒体买手不知道该看哪个。
4. **告警没有实用价值** — 全是"零曝光持续触发"类的噪音，买手不用。
5. **Creative 页面没有图片** — 大部分 ad 显示灰色占位符，无法用来分析素材。
6. **访问控制缺失** — 即将有 partner 和 client 需要访问，但现在没有角色隔离。

**Sean 的最终愿景（本次不用全部实现，但要方向一致）：**
- 媒体买手每天只需要打开这一个平台就能完成所有日常监控
- Alert 触发 → 自动推 Slack 通知
- 最终整合 Shopify 实时销售数据
- 将来接入 AI 预测模型（TimesFM）
- 暂停方向：Social Listener、竞品广告搜索（有独立项目在做）

---

## 三、你需要完成的具体任务

### 🔴 P1 — 数据精度修复（最紧急）

#### 任务 1：修复 daily vs hourly 数字不一致

**文件：** `src/lib/api.ts` → `getDailyPerformance()` 函数

**根因分析：**
`getDailyPerformance()` 里有一段 hourly rollup fallback 逻辑：当 `daily_performance` 表没有某个 date+account 的记录时，从 `hourly_performance` 里加总补充。问题在于：如果 daily 表有**部分**数据（比如只有 Meta 的数据，没有 Google 的），hourly rollup 会补 Google 的进来，但 merge 逻辑没有严格按 `(client_id, date, platform, ad_account_id)` 四元组去重，导致某些情况下 partial double-count。

另外，`MarketingOverview`、`RealtimePerformance`、`DataAnalytics` 三页传给查询的 filter 参数不完全一致（有的传了 adAccountId，有的没传），导致 aggregate 出来的数字不同。

**修复方向：**
```typescript
// 现有逻辑（问题所在）：
const existingKeys = new Set(dailyRows.map((r: any) => dailyPerfRowKey(r)))
const merged = [...dailyRows]
for (const r of rolled) {
    if (!existingKeys.has(dailyPerfRowKey(r))) merged.push(r)
}

// 修复：应该只在该 (client_id, date) 完全没有任何 daily 记录时才补 hourly rollup
// 如果 daily 有该 client+date 的任意一行，就信任 daily，不用 hourly 补
const datesWithDailyData = new Set(dailyRows.map((r: any) => `${r.client_id}|${r.date}`))
for (const r of rolled) {
    const dateKey = `${r.client_id}|${r.date}`
    if (!datesWithDailyData.has(dateKey)) merged.push(r)
}
```

同时：在所有调用 `getDailyPerformance()` 的页面，确保传递相同的 filter 参数集合，保证跨页面可比性。

---

#### 任务 2：修复 Real-time Performance 时间窗口切换无效

**文件：** `src/pages/RealtimePerformance.tsx` + `src/lib/api.ts` → `getHourlyPerformance()`

**问题：** 切换 windowHours（1h/6h/24h 等）时，React Query 的 queryKey 是 `['hourly_performance', windowHours, selectedClient]`，但 `getHourlyPerformance()` 内部计算时间边界时可能使用了缓存的 `now` 时间，导致边界没有更新。

**修复方向：**
- 确认 `getHourlyPerformance()` 内部每次都 `new Date()` 重新算 UTC 边界，不缓存时间。
- queryKey 里加入 `Math.floor(Date.now() / 300000)` (5分钟 slot) 防止过度缓存。
- `staleTime` 从 `5 * 60 * 1000` 改为 `60 * 1000`（1分钟），窗口切换应立刻生效。

---

#### 任务 3：Creative Performance — 修复 broken thumbnail 展示

**文件：** `src/pages/CreativePerformance.tsx` → `CreativeThumb` 组件 + `AdPreviewModal`

**问题：** Meta CDN 签名 URL（含 `fbcdn.net` / `fbsbx.com`）有过期时间，会返回 403。目前整行显示灰色占位符，买手完全无法判断这是什么素材。

**修复方案（前端侧，不动后端）：**

1. 当 `image_url` / `thumbnail_url` 失败（onError）时，**优先 fallback 到可点击的链接**而不是纯灰块：
   - 如果有 `instagram_permalink_url` → 显示 Instagram 图标 + "View on IG" 链接
   - 如果有 `facebook_post_url` → 显示 FB 图标 + "View Post" 链接
   - 都没有才显示灰色占位
2. 在图片右下角加一个小 external link 图标（hover 显示），点击在新 tab 打开原帖
3. **只在整个 client 的广告中 >60% 缩略图失效时**，在页面顶部显示一次 amber banner（"部分广告图片链接已过期，点击链接可查看原帖"），而不是每个 row 都报错
4. 图片加载不要设置 retry，失败了就走 fallback，不要循环请求

---

### 🟡 P2 — 角色权限系统（RBAC）

#### 任务 4：扩展为 4 个角色

**涉及文件：**
- `src/types/permissions.ts` — 更新 AppUser['role'] 类型定义
- `src/contexts/AuthContext.tsx` — 暴露 role 便于组件判断
- `src/App.tsx` — 路由层权限守卫
- `src/lib/permissions.ts` — 已有完整权限 CRUD，不需要大改

**新角色定义：**

| 角色 | 说明 | DB 中的值 |
|------|------|-----------|
| super_admin | Sean，全部权限 | `super_admin` |
| media_buyer | 团队媒体买手，除 admin 外全看 | `media_buyer` |
| partner | 合作伙伴，只看 Overview + Alerts（只读） | `partner` |
| client | 客户，只看自己的 Overview 数据 | `client` |

**每个角色能看的页面：**

| 页面 | super_admin | media_buyer | partner | client |
|------|:-----------:|:-----------:|:-------:|:------:|
| Overview (UNI Overview) | ✅ | ✅ | ✅ 只读 | ✅ 仅自己 |
| Real-time Performance | ✅ | ✅ | ✅ 只读 | ✅ 仅自己 |
| Account Performance | ✅ | ✅ | ✅ 只读 | ✅ 仅自己 |
| Creative Performance | ✅ | ✅ | ❌ | ❌ |
| Alerts — 查看 | ✅ | ✅ | ✅ 只读 | ❌ |
| Alerts — 创建/编辑规则 | ✅ | ✅ | ❌ | ❌ |
| Mission Board | ✅ | ✅ | ❌ | ❌ |
| Clients Overview | ✅ | ✅ | ❌ | ❌ |
| Settings | ✅ | 仅自己 profile | ❌ | ❌ |
| User Management | ✅ | ❌ | ❌ | ❌ |
| Feedback Admin | ✅ | ❌ | ❌ | ❌ |

**实现要点：**

1. **路由层守卫** — 在 App.tsx 用 `<RoleGuard allowedRoles={[...]}>`包裹路由，未授权 → redirect 到 `/` 或 404
2. **Client 数据隔离（重要）** — 当 `role === 'client'` 时：
   - 读 `appUser.primary_client_id` 
   - 所有 `getDailyPerformance` / `getHourlyPerformance` 等查询强制传 `clientId: appUser.primary_client_id`
   - 隐藏 client 选择下拉，不允许切换到其他 client
   - 这个必须在 `api.ts` 层强制，不能只靠 UI 隐藏
3. **Partner 只读** — 在 Alerts 页里，当 role 是 `partner` 时隐藏"Create Rule"按钮、"Resolve"/"Assign" 等操作按钮。页面可访问但不可操作。
4. **侧边栏动态渲染** — `App.tsx` 中的 NavLink 列表根据当前 role 过滤，不允许通过 URL 直接访问无权限页面

**Supabase RLS（请告知后端 dev 同步配置）：**
- `client` role 的用户，`daily_performance` / `hourly_performance` / `meta_ads` 等表的 SELECT 必须有 RLS policy：`client_id = auth.jwt()->'app_metadata'->>'client_id'`
- 前端 RBAC 是 UX 层，Supabase RLS 是安全层，两者都要

---

### 🟡 P2 — 导航结构优化

#### 任务 5：合并三个重叠 Tab 为一个 Overview + 子 Tab

**目标：** 减少"UNI Overview"、"Clients Overview"、"Account Performance" 三个页面的重复感。不是删掉功能，而是用一个页面 + 内部 sub-tab 的形式整合。

**方案：**
1. 创建 `src/pages/OverviewPage.tsx` 作为容器，内部有 3 个 sub-tab：
   - **"All Clients"** — 现在 MarketingOverview 的内容（跨客户汇总 KPI + platform breakdown）
   - **"By Client"** — 现在 ClientsOverview 的内容（客户列表 + 每个客户的 KPI 卡片）
   - **"By Account"** — 现在 DataAnalytics 的内容（账户级别明细表格）
2. 路由 `/` → `OverviewPage`，原来三个路由保留 redirect 到对应 sub-tab（不破坏书签）
3. 侧边栏只保留一个 "📊 Overview" 入口，删掉 "Clients Overview" 和 "Account Performance" 的独立入口
4. URL 方案：`/?tab=all-clients` / `/?tab=by-client` / `/?tab=by-account`

---

### 🟣 P3 — 新功能

#### 任务 6：ClickUp 任务在 Mission Board 展示

**背景：** 后端会搭建 ClickUp Webhook，当 ClickUp 里创建/更新任务时自动同步到 `mission_cards` 表。前端只需要展示。

**Supabase migration（需要后端 dev 先执行）：**
```sql
ALTER TABLE mission_cards 
  ADD COLUMN clickup_task_id TEXT,
  ADD COLUMN clickup_task_url TEXT,
  ADD COLUMN archived BOOLEAN DEFAULT FALSE,
  ADD COLUMN synced_from_clickup BOOLEAN DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS mission_cards_clickup_task_id_idx ON mission_cards(clickup_task_id) WHERE clickup_task_id IS NOT NULL;
```

**前端改动：**
- 卡片 `synced_from_clickup = true` 时，显示一个小的 ClickUp 紫色徽章 + "⚡ ClickUp"
- 点击徽章 → 新 tab 打开 `clickup_task_url`
- `synced_from_clickup = true` 的卡片不允许在 dashboard 里删除，只能 Archive（避免和 ClickUp 数据冲突）
- 卡片编辑 modal 里加一个 "Link ClickUp Task" 输入框（粘贴 ClickUp task URL），前端从 URL 解析 task ID，保存 `clickup_task_id` + `clickup_task_url`

**文件：** `src/pages/MissionBoard.tsx` + `src/types/mission.ts`

---

#### 任务 7：Alert Rule Builder 加 min_spend 门槛 + Slack 通知开关

**文件：** `src/pages/Alerts/RuleBuilderModal.tsx`

**改动 1 — min_spend_threshold：**
- 在规则表单里加一个 "Minimum daily spend ($)" 输入框，默认值 `5`
- 存到 `alert_rules` 表的 `conditions` JSON 字段里：`{ ..., "min_spend_threshold": 5 }`
- UI 提示文案：「只有当账户当天花费超过此金额时，规则才会触发」

**改动 2 — Slack 通知配置：**
- 加一个 "Notify via Slack" toggle（默认 off）
- 打开后显示：Slack Webhook URL、可选 Channel 名称、以及（若 migration 已上）`slack_notify_alert_rules` 等开关；数据写入 `client_alert_delivery`（**一行 per `client_id`**，列以 `uni-mission-control/supabase/migrations/` 为准，不要假设存在未迁移的 `delivery_type`）。
- 前端不需要调用 Slack API，只存配置；`generate_alerts.py` 会读 `slack_webhook_url` 等由后端发 Slack。
---

## 四、不要做的事（范围外）

- ❌ Social Listener 功能（有独立项目）
- ❌ 竞品广告搜索（有独立项目）
- ❌ Shopify 数据前端展示（等后端接完数据再做 UI）
- ❌ AI 预测模型 UI（Phase 3）
- ❌ 大规模重设计（保持现有视觉风格）

---

## 五、开发注意事项

1. **React Query staleTime** — 性能数据 `staleTime: 5 * 60 * 1000`，告警数据 `staleTime: 2 * 60 * 1000`，不要改成 0（会频繁请求 Supabase）
2. **Supabase 查询 active clients** — 所有性能数据查询都要加 `.in('client_id', activeClientIds)`，或者 filter `status IN ('active', 'Active', 'ACTIVE')`，不要查全部 client
3. **TypeScript strict** — 项目有 strict TS，不要用 `any` 除非必要
4. **tailwind classes** — 只用 Tailwind utility classes，不要写内联 style 除非动态值
5. **Supabase RLS** — 前端用的是 anon key，Supabase RLS 必须正确配置才能保证安全。client role 的数据隔离**必须在 RLS 层实现**，前端过滤只是 UX

---

## 六、相关文档

- 前端适配（job_runs + RLS 角色）：`uni-mission-control/docs/FRONTEND_DEV_ADAPTER_JOB_RUNS_RLS_2026-05-16.md`
- 后端一页纸契约（四条：归属 / 去重与副作用顺序 / 时间语义 / 可观测性）：`ads_data_sync/docs/BACKEND_TEAM_CONTRACTS.md`
- 后端 agent brief：`AGENT_BRIEF_BACKEND_DEV.md`（workspace 根目录）
- **Ads Data 部署与脚本真相（给前后端对齐用）：** `ads_data_sync/docs/AGENT_HANDOFF.md`
- **后端合并需求 / 验证命令：** `ads_data_sync/docs/BACKEND_CONSOLIDATED_REQUIREMENTS.md`
- **A/B 报告 cron：** `ads_data_sync/docs/AB_REPORTS_CRON.md`
- VPS / cron 迁移说明：`HANDOFF_VPS_MIGRATION.md`（workspace 根目录）
- 已提交的 Supabase SQL（需与线上项目 `jcghdthijgjttmpthagj` 对齐执行）：`uni-mission-control/supabase/migrations/`
- 项目阶段日志：`ads_data_sync/docs/PROJECT_STAGE_AND_SESSION_LOG.md`
- 剩余任务（波次 3）：`uni-mission-control/REMAINING_TASKS.md`
- 完整数据库 schema（若本机有该文件）：`C:\Users\stan8\OPENCLAW_LOCAL_032026\complete-schema.sql`

---

## 七、与后端 / Ads Data 同步（前端需要知道的硬事实）

1. **`client_alert_delivery` 表结构**以 Supabase migration 为准：`client_id` 主键一行、`slack_webhook_url`、`notify_emails`、`notify_in_app`；另有 `slack_channel`、`slack_notify_alert_rules`（见 `uni-mission-control/supabase/migrations/20260515100000_mission_clickup_alert_delivery.sql`）。**没有** `delivery_type` 列时，不要按旧文档写 `delivery_type: 'slack'`。
2. **`alerts` / `alert_type`**：后端 `generate_alerts.py` 会写入 v2 类型（如 `roas_above_target`、`metrics_anomaly` 等）。前端类型已扩在 `uni-mission-control/src/types/alerts.ts`；若 UI 有 exhaustive switch，需覆盖这些枚举或走默认展示。
3. **`daily_performance.data_timezone`**：新列表示该行日结数据的时区上下文（来自 `clients.timezone`）。对比「日汇总 vs 小时 UTC」时可在 tooltip 或图例中说明，减少「同一天数字不一致」的投诉（根因也可能是筛选器不一致，需与后端语义一起看）。
4. **`meta_ads` 扩展指标**：`reach`、`frequency`、`outbound_clicks`、视频分段等由同步写入；Overview / 导出若要用需在 `api.ts` 增加 select。
5. **创意图 URL**：长期应用 Supabase Storage 公链（`ad-creatives` bucket）；短期仍可能有 Meta CDN。UI 已避免 `no-referrer` 的见 `CreativePerformance.tsx`。
6. **部署与数据流**：定时任务在 **VPS + n8n SSH**，不在 Vercel；前端只连 Supabase。改告警/同步逻辑 = 改 `ads_data_sync/execution` 并部署，不是改 Next/Vercel 配置。
7. **契约与复利**：后端执行层与 Mission Control 的分工、A/B 与未来 TimesFM 的「先写 run 再副作用」、以及可选 `job_runs` 可观测性，见 `ads_data_sync/docs/BACKEND_TEAM_CONTRACTS.md`。前端实现 RBAC 时须与契约 A 中的 RLS 要求一起落地（JWT `app_metadata` 等由后端与 Supabase 约定）。
