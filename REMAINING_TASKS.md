# 剩余任务清单（与代码对齐）

创建时间: 2026-03-10  
产品方向确认时间: 2026-05-12  
本轮更新: 2026-05-12 — Mission 卡片可编辑；波次 3 自动化脚本 + `ab_report_runs` 表

状态: 前端与 `ads_data_sync` 脚本已更新；需在 Supabase 执行新 migration 后跑 Python。

---

## 本轮交付（Review）

Mission Board

- 每张卡片有「Edit」按钮：可改 Title、Notes、Column；新建卡时可一并选 Column。  
- 列下拉旁保留快速改列；与弹窗保存一致。

波次 3 自动化（剩余部分）

- SQL: `supabase/migrations/20260513120000_ab_report_runs.sql` — 表 `ab_report_runs`（按 `config_id` + `period_key` 去重）。  
- 自检: `supabase/scripts/verify_ab_report_runs.sql`。  
- Python（独立仓库 `ads_data_sync`）: `execution/ab_test_reports_and_notify.py`  
  - 读 `client_ab_test_configs`、`client_alert_delivery`；按最近 7 天在 `meta_ads` / `meta_ads_ad_sets` / `meta_ads_ads` / `google_*` 表中按**对象名称子串**汇总 spend/impr/clicks/conv/rev。  
  - 写入 `ab_report_runs`；可选 Slack webhook；可选 SMTP 邮件；`notify_in_app` 为真时插入 `alerts`（`alert_type: other`，dedup 键 `ab_report:{config_id}:{period_key}`）。  
  - 参数: `--dry-run`、`--force`、`--daily-only`、`--hourly-only`。

---

## 需要你来确认 / 提供（我这边无法替你填的）

1. Supabase: 在 SQL Editor 执行 `20260513120000_ab_report_runs.sql`（在已有 wave3 表的前提下）。  
2. 定时任务: 在跑脚本的服务器上配置 cron（示例见脚本头部注释）；`hourly` 与 `daily` 是否分两个 cron 由你决定（可用 `--hourly-only` / `--daily-only` 避免同一时刻两类都跑两次）。  
3. 邮件: 若要用 SMTP，在运行 `ab_test_reports_and_notify.py` 的环境设置 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM`（未设置则只打 log，不报错中断）。  
4. 对象名称匹配: 当前为**子串不区分大小写**（`entity_name` 包含于 `campaign_name` 等）。若你要「全词匹配」或「正则」，需要你再拍板我才能改脚本。  
5. `ads_data_sync` 仓库: 本次会单独 commit + push 新脚本；你本地若还有对 `evaluate_rules.py` / `generate_alerts.py` 的未提交修改，请自行处理合并，我不会动那两文件的 diff。

---

## 数据不变量

Alert 删除或归档: `mission_cards` 仍无外键到 `alerts`；卡片独立。

---

## 已移出范围

顶部铃铛改版、全局搜索。

---

## 未完成（后续产品）

- Breakdown sync + UI；Shopify 盈利；TimesFM。  
- A/B 脚本侧: 更细的维度对比、与真实「实验组/对照组」双桶逻辑（当前为单对象 7 天汇总快照）。

---

参考: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)、[docs/OPENCLAW_CHAT_URL.md](docs/OPENCLAW_CHAT_URL.md)
