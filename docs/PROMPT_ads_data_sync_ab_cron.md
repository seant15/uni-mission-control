# Prompt：给 ads_data_sync 仓库 Agent（A/B 报告脚本 + Cron / 运维）

把下面整段复制给负责 `ads_data_sync`（或同名）仓库的 Agent。背景：Mission Control 侧已在 Supabase 建好配置表与去重表；**本 Agent 的工作重点在 ads_data_sync 仓库**：落地定时任务、环境变量、与现有流水线关系、观测与失败处理。

---

## 背景（事实）

- 前端仓库 `uni-mission-control` 已提供：Alerts 第三 Tab「A/B & delivery」，写入 Supabase 表 `client_ab_test_configs`、`client_alert_delivery`（按 `client_id` 一行投递配置）。
- 去重表 `ab_report_runs` 已可在 Supabase 执行 migration：`uni-mission-control` 仓库内文件 `supabase/migrations/20260513120000_ab_report_runs.sql`（运营方已跑好）。
- 报告与通知脚本已在 **`ads_data_sync` 仓库** 落地路径：`execution/ab_test_reports_and_notify.py`（commit 含该文件；与 `evaluate_rules.py` / `generate_alerts.py` 是否另有本地未提交改动需自行核对，勿覆盖他人工作区）。
- 脚本与 `evaluate_rules.py` 相同方式加载环境：通过 `execution/_dotenv.py` 的 `load_execution_env()`，会尝试 `execution/.env`、`../uni-mission-control/.env` 等候选路径。
- 运行所需环境变量（与现有 execution 脚本一致）：`VITE_SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。
- 可选邮件：`SMTP_HOST`、`SMTP_PORT`（默认 587）、`SMTP_USER`、`SMTP_PASSWORD`、`SMTP_FROM`；未配置则跳过发信并打 log，不视为致命错误。
- Slack：使用 `client_alert_delivery.slack_webhook_url`（每 client 一条配置），无需额外 env。

---

## 当前业务规则（必须遵守，除非产品书面改 spec）

1. **读哪些配置**  
   - 仅处理 `client_ab_test_configs.is_active = true` 的行。

2. **统计窗口**  
   - 固定为 **最近 7 个自然日**（含今天）：`start = today - 6 days`，`end = today`（与脚本内 `timedelta(days=6)` 一致）。

3. **对象名称如何匹配（当前实现）**  
   - 使用 **子串、不区分大小写**：把配置里的 `entity_name` 转小写后，若出现在对应「名称列」的小写字符串中即视为匹配（不是整词相等、不是正则）。  
   - 名称列映射：  
     - Meta + campaign → 表 `meta_ads`，列 `campaign_name`  
     - Meta + ad_set → `meta_ads_ad_sets`，`ad_set_name`  
     - Meta + ad → `meta_ads_ads`，`ad_name`  
     - Google + campaign → `google_ads`，`campaign_name`  
     - Google + ad_set → `google_ads_ad_groups`，`ad_group_name`  
     - Google + ad → `google_ads_ads`，`ad_name`

4. **汇总指标**  
   - 对匹配行在窗口内按日聚合后求和：`spend`、`impressions`、`clicks`、`conversions`、`revenue`（列名与 sync 写入保持一致）。  
   - `matched_rows` 为匹配行数（用于判断「是否匹配到数据」）。

5. **去重（防重复发）**  
   - 表 `ab_report_runs`：`UNIQUE(config_id, period_key)`。  
   - `period_key`：  
     - `daily`：`{config_uuid}:{YYYY-MM-DD}:daily`  
     - `hourly`：`{config_uuid}:{YYYY-MM-DD}T{HH}Z:hourly`（UTC 小时）。  
   - 若同一 `period_key` 已存在记录，默认跳过（除非脚本带 `--force`）。

6. **Cadence 与脚本参数**  
   - `cadence = daily` 与 `hourly` 都存在时，由 **cron 或调用方式** 决定何时跑哪类：脚本提供 `--daily-only`、`--hourly-only`；都不传则两类都会在本次执行中各按规则判断（仍受 `period_key` 去重约束）。  
   - `--dry-run`：只打 log，不写库、不发 Slack/邮件/站内。  
   - `--force`：忽略 `ab_report_runs` 去重（用于补跑或排障，慎用）。

7. **投递顺序（单次 config 处理内）**  
   - 先插入 `ab_report_runs`（成功后再做外部副作用，便于审计）。  
   - 再：`slack_webhook_url`（若非空）POST JSON `{"text": summary}`。  
   - 再：`notify_emails`（逗号/分号/空白分隔）若配置了 SMTP 则发送。  
   - 最后：若 `notify_in_app` 为真（**无 delivery 行时默认 true**），向 `alerts` 插入一条；`alert_type = other`，`dedup_key = ab_report:{config_id}:{period_key}`，避免重复插入。

8. **站内 Alert 与现有字段**  
   - 插入字段需与当前 `alerts` 表及现有 Python 写入习惯兼容（含 `is_read`、`resolved`、`created_at`、`updated_at` 等，以脚本为准）。

---

## 不确定 / 需与运营或基础设施对齐（写进排期与文档，不要猜死）

以下 **Sean / 运维未最终拍板**，请 Agent 在 README 或 runbook 里列出选项，并在合并 cron 前与负责人确认一项默认方案：

1. **Cron 粒度**  
   - `hourly` 配置是否必须 **每小时整点** 跑一次，还是「每 15 分钟跑一次脚本但靠 `period_key` 去重」即可。  
   - `daily` 是否固定 **UTC 某整点**（例如每天 07:15 UTC），还是跟「日结 sync」同一窗口。  
   - 是否与已有 `evaluate_rules.py`（例如 `15 * * * *`）合并为同一 cron 入口、或独立 cron。

2. **与现有 sync 的先后关系**  
   - 是否应保证在 `sync_hourly_performance.py` / `sync_marketing_data.py` 成功之后再跑 A/B 脚本（避免读到空表）。若需要，是否用 `sync_status` 表做门禁（可参考 `evaluate_rules.py` 里的 freshness 逻辑）。

3. **数据量与 Supabase 默认 limit**  
   - 当前脚本对单表 `limit(4000)` 再内存过滤；大客户 7 天行数是否可能超限、是否需要分页或改 RPC/SQL 聚合（请评估后给出建议，必要时开 issue 给前端或改表）。

4. **多账户 / 多平台**  
   - 同一 `client_id` 下 Meta + Google 各一条配置时行为已支持；若未来同一平台多 `ad_account_id` 是否需要拆 config，产品未定义，保持现状即可。

5. **`ads_data_sync` 本地未提交改动**  
   - 若工作区里 `evaluate_rules.py`、`generate_alerts.py` 有本地修改，合并本分支前请先 `git status` 与负责人确认，避免把无关 diff 绑进本次交付。

---

## 建议交给 Agent 的具体任务清单

1. 在 **部署 ads_data_sync 的机器** 上验证：同一套 `.env` 下能 `python execution/ab_test_reports_and_notify.py --dry-run` 无报错，且 log 中 summary 合理。  
2. 与运营确认 **Cron 表达式**（daily / hourly 是否分两条、时区用 UTC 还是业务时区），并把最终 crontab 或 systemd timer 写进 `ads_data_sync` 文档（如 `README` 或 `docs/AB_REPORTS_CRON.md`）。  
3. 若需发邮件：确认 SMTP 供应商与防火墙出站规则；在文档中列出必填 env。  
4. 可选：在 CI 或手动 checklist 中加一条 `python -m py_compile execution/ab_test_reports_and_notify.py`。  
5. 若发现 `alerts` 插入与生产表结构不一致：提出最小迁移或调整 insert 字段列表，并与 `uni-mission-control` 侧对齐 `AlertType` / 筛选器是否需展示 `other`。

---

## 一句话目标

让 `ab_test_reports_and_notify.py` 在**可靠的时间表**上运行，**不重复骚扰**（依赖 `ab_report_runs`），并在失败时**可观测**（log + 可选告警），其余产品规则以上文「当前业务规则」为准。

---

（本文件路径：`uni-mission-control/docs/PROMPT_ads_data_sync_ab_cron.md`，便于与 Mission Control 仓库一起版本管理；复制正文给 ads_data_sync Agent 即可。）
