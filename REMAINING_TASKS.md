# 剩余任务清单（与代码对齐）

创建时间: 2026-03-10  
产品方向确认时间: 2026-05-12  
本轮代码完成时间: 2026-05-12（供你 Review / 合并）

状态: 波次 1–3 已合入本仓库；你已配置 OpenClaw URL 并跑过 SQL 自检（截图由你方留存）。

---

## 本轮 Review 清单（给 Sean）

环境与配置

- OpenClaw: 已设置 `VITE_OPENCLAW_CHAT_URL`（本地或 Vercel）。说明见 `docs/OPENCLAW_CHAT_URL.md`。  
- Supabase: 你已执行 `20260512140000_mission_cards.sql`；若尚未执行波次 3，请跑 `20260512160000_ab_test_configs_and_delivery.sql`。  
- SQL 自检: 你已对 verify 脚本结果截图核对；仓库内脚本路径如下（可复跑）  
  - `supabase/scripts/verify_mission_cards.sql`  
  - `supabase/scripts/verify_wave3_ab_delivery.sql`（在跑完 wave3 migration 后）

代码交付范围（本轮）

- 波次 1: `MarketingOverview.tsx` 与 Account Performance 筛选与 `getDailyPerformance` 口径对齐；`getAlertSummary` 含 `client_id`。  
- 波次 2: `/mission`（`MissionBoard.tsx`）、Alert 面板「Mission card」、`mission_cards` migration、左下 OpenClaw FAB（`OpenClawChatWidget.tsx`）、保留 Feedback、`App.tsx` 路由与 Toaster。  
- 波次 3: Alerts 第三 Tab「A/B & delivery」（`AbTestDeliveryTab.tsx`）、`client_ab_test_configs` + `client_alert_delivery` migration、对应 `api.ts` CRUD。  
- 类型: `src/types/mission.ts`、`src/types/abTestDelivery.ts`。  
- 文档: `docs/OPENCLAW_CHAT_URL.md`；`.env.example` 注释更新。

构建

- 本轮合并前已跑通: `npm run build`（以你合并时本地再跑一次为准）。

数据不变量

- Alert 删除或归档: 已生成的 `mission_cards` 行不变；`source_alert_id` 无外键指向 `alerts`。

---

## 已移出范围

顶部通知铃铛改版、全局顶栏搜索：不做。

---

## 未完成（后续波次 / 非前端）

- Python（或 Edge）: 读 `client_ab_test_configs`、`client_alert_delivery`，按 cadence 出 AB 报告并投递 Slack/邮件。  
- Breakdown sync + UI；Shopify 盈利字段；TimesFM。

---

参考: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)、[DATA_SOURCE_MAPPING.md](DATA_SOURCE_MAPPING.md)
