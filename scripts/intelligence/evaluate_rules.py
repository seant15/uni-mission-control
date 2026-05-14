"""
evaluate_rules.py  —  UNI Alert Intelligence System (Layer 2+)
--------------------------------------------------------------
这个脚本是对 VPS 现有 Layer 0/1 警报系统的补充，不是替代。
VPS 已经处理：zero_spend, under_pacing, over_pacing, conversion_drop(当日), ctr_decline

本脚本新增：
  Layer 2  — ROAS 下降 (3日 vs 14日基准)
  Layer 2  — CPA 飙升 (3日 vs 14日基准)
  Layer 2  — 持续零转化 48h (带基准验证)
  Layer 2  — 着陆页失效 (CTR 健康但 CVR 崩塌)
  Layer X  — 跨平台关联 (双平台同时 ROAS 下降)
  降噪     — 跨日抑制：同一 alert_type+client 在 N 天内不重复触发

使用方法:
  python scripts/intelligence/evaluate_rules.py

完整流水线 (更新基准 + 评估):
  python scripts/intelligence/evaluate_rules.py --full-pipeline
"""

import os
import sys
import logging
import uuid
import argparse
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(Path(__file__).parent.parent.parent / ".env")

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: 缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
logger = logging.getLogger(__name__)

# ── 阈值配置 ──────────────────────────────────────────────────────────────────

ROAS_DROP_THRESHOLD      = 0.70   # 3日均值 ROAS < 14日基准的 70%
CPA_SPIKE_THRESHOLD      = 1.40   # 3日均值 CPA  > 14日基准的 140%
LANDING_PAGE_CTR_FLOOR   = 0.85   # CTR 仍 ≥ 基准 85%（流量正常）
LANDING_PAGE_CVR_DROP    = 0.60   # CVR  < 基准 60%（落地页失效）
CROSS_ROAS_DROP          = 0.70   # 双平台同时 ROAS < 基准 70%
MIN_DATA_DAYS            = 7      # 基准数据不足 7 天时不触发 Layer 2

# 跨日去重：同一 alert_type+client_id 多少天内不重复触发
DEDUP_DAYS = {
    "roas_drop":           3,   # ROAS 下降 — 3天一次
    "cpa_spike":           3,   # CPA 飙升 — 3天一次
    "no_conversion_48h":   2,   # 零转化 — 2天一次
    "landing_page_failure":2,   # 着陆页 — 2天一次
    "cross_platform":      3,   # 跨平台 — 3天一次
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_baseline(client_id: str, platform: str, ad_account_id: str) -> Optional[dict]:
    """从 account_daily_baselines 取该账户的基准数据。"""
    res = (
        supabase.table("account_daily_baselines")
        .select("avg_daily_cost,avg_daily_impressions,avg_daily_clicks,avg_daily_conversions,avg_daily_revenue,avg_ctr,avg_cpa,avg_roas,std_daily_cost,std_daily_conversions,days_of_data")
        .eq("client_id", client_id)
        .eq("platform", platform)
        .eq("ad_account_id", ad_account_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


def _get_recent_performance(client_id: str, platform: str, ad_account_id: str, days: int) -> list:
    """取最近 N 天的 daily_performance 数据。"""
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    res = (
        supabase.table("daily_performance")
        .select("date,cost,revenue,impressions,clicks,conversions")
        .eq("client_id", client_id)
        .eq("platform", platform)
        .eq("ad_account_id", ad_account_id)
        .gte("date", cutoff)
        .order("date", desc=False)
        .execute()
    )
    return res.data or []


def _already_fired(client_id: str, alert_key: str) -> bool:
    """检查同一 alert_key 在 DEDUP_DAYS 内是否已触发过。"""
    days = DEDUP_DAYS.get(alert_key, 1)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    dedup_prefix = f"{client_id}:{alert_key}"
    res = (
        supabase.table("alerts")
        .select("id")
        .like("dedup_key", f"{dedup_prefix}%")
        .gte("created_at", cutoff)
        .limit(1)
        .execute()
    )
    return bool(res.data)


def _fire(
    *,
    client_id: str,
    account_name: str,
    account_id: str,
    alert_key: str,           # 用于去重逻辑
    alert_type: str,          # 前端 AlertType 枚举值
    severity: str,            # critical | high | warning | low
    message: str,
    platform: str,
    metric_name: str = "",
    metric_value: Optional[float] = None,
    threshold: Optional[float] = None,
    details: Optional[dict] = None,
) -> bool:
    if _already_fired(client_id, alert_key):
        logger.debug(f"[dedup] {alert_key} {client_id} 已在去重窗口内触发，跳过")
        return False

    now_str   = datetime.now(timezone.utc).isoformat()
    dedup_key = f"{client_id}:{alert_key}:{date.today().isoformat()}"
    group_key = f"{client_id}:{platform}:{date.today().isoformat()}"

    row = {
        "id":             str(uuid.uuid4()),
        "client_id":      client_id,
        "account_name":   account_name,
        "account_id":     account_id,
        "alert_type":     alert_type,
        "severity":       severity,
        "message":        message,
        "platform":       platform,
        "metric_name":    metric_name,
        "metric_value":   metric_value,
        "threshold":      threshold,
        "source":         "auto",
        "status":         "new",
        "dedup_key":      dedup_key,
        "group_key":      group_key,
        "created_at":     now_str,
        "updated_at":     now_str,
        "triggered_date": date.today().isoformat(),
        "is_read":        False,
        "resolved":       False,
        "metadata":       details or {},   # 'details' 字段在DB里叫 metadata
    }

    try:
        supabase.table("alerts").insert(row).execute()
        logger.info(f"🔔 [{severity.upper()}] {alert_key} — {account_name} / {platform}")
        return True
    except Exception as e:
        logger.error(f"[fire] 插入失败 {alert_key}/{client_id}: {e}")
        return False


# ── Layer 2 — ROAS 下降 ───────────────────────────────────────────────────────

def check_roas_drop(client_id: str, platform: str, ad_account_id: str,
                    account_name: str, baseline: dict) -> None:
    avg_roas_baseline = float(baseline.get("avg_roas") or 0)
    days_of_data      = int(baseline.get("days_of_data") or 0)

    if avg_roas_baseline == 0 or days_of_data < MIN_DATA_DAYS:
        return

    # 用 48h 前的数据（规避转化延迟）
    rows = _get_recent_performance(client_id, platform, ad_account_id, days=6)
    rows = [r for r in rows if r["date"] <= (date.today() - timedelta(days=2)).isoformat()]
    if len(rows) < 2:
        return

    recent_roas = []
    for r in rows[-3:]:
        cost    = float(r.get("cost") or 0)
        revenue = float(r.get("revenue") or 0)
        if cost > 0:
            recent_roas.append(revenue / cost)

    if not recent_roas:
        return

    current_avg = sum(recent_roas) / len(recent_roas)
    if current_avg < avg_roas_baseline * ROAS_DROP_THRESHOLD:
        drop_pct = (1 - current_avg / avg_roas_baseline) * 100
        _fire(
            client_id=client_id,
            account_name=account_name,
            account_id=ad_account_id,
            alert_key="roas_drop",
            alert_type="performance_drop",
            severity="high",
            message=(
                f"{account_name} ({platform.replace('_',' ').title()}) ROAS 下降 {drop_pct:.0f}%："
                f"近3日均值 {current_avg:.2f}x vs 历史基准 {avg_roas_baseline:.2f}x。"
                f"建议排查：素材疲劳、竞价策略、受众质量。"
            ),
            platform=platform,
            metric_name="roas",
            metric_value=round(current_avg, 3),
            threshold=round(avg_roas_baseline * ROAS_DROP_THRESHOLD, 3),
            details={"baseline_roas": avg_roas_baseline, "current_roas": current_avg, "drop_pct": round(drop_pct, 1)},
        )


# ── Layer 2 — CPA 飙升 ───────────────────────────────────────────────────────

def check_cpa_spike(client_id: str, platform: str, ad_account_id: str,
                    account_name: str, baseline: dict) -> None:
    avg_cpa_baseline = float(baseline.get("avg_cpa") or 0)
    days_of_data     = int(baseline.get("days_of_data") or 0)

    if avg_cpa_baseline == 0 or days_of_data < MIN_DATA_DAYS:
        return

    rows = _get_recent_performance(client_id, platform, ad_account_id, days=6)
    rows = [r for r in rows if r["date"] <= (date.today() - timedelta(days=2)).isoformat()]
    if len(rows) < 2:
        return

    recent_cpa = []
    for r in rows[-3:]:
        cost        = float(r.get("cost") or 0)
        conversions = float(r.get("conversions") or 0)
        if conversions > 0:
            recent_cpa.append(cost / conversions)

    if not recent_cpa:
        return

    current_avg = sum(recent_cpa) / len(recent_cpa)
    if current_avg > avg_cpa_baseline * CPA_SPIKE_THRESHOLD:
        spike_pct = ((current_avg / avg_cpa_baseline) - 1) * 100
        _fire(
            client_id=client_id,
            account_name=account_name,
            account_id=ad_account_id,
            alert_key="cpa_spike",
            alert_type="conversion_drop",
            severity="high",
            message=(
                f"{account_name} ({platform.replace('_',' ').title()}) CPA 飙升 {spike_pct:.0f}%："
                f"近3日 ${current_avg:.2f} vs 历史基准 ${avg_cpa_baseline:.2f}。"
                f"建议排查：竞价策略、受众饱和、落地页转化率。"
            ),
            platform=platform,
            metric_name="cpa",
            metric_value=round(current_avg, 2),
            threshold=round(avg_cpa_baseline * CPA_SPIKE_THRESHOLD, 2),
            details={"baseline_cpa": avg_cpa_baseline, "current_cpa": current_avg, "spike_pct": round(spike_pct, 1)},
        )


# ── Layer 2 — 持续 48h 零转化 ────────────────────────────────────────────────

def check_no_conversion_48h(client_id: str, platform: str, ad_account_id: str,
                             account_name: str, baseline: dict) -> None:
    avg_conv_baseline = float(baseline.get("avg_daily_conversions") or 0)
    days_of_data      = int(baseline.get("days_of_data") or 0)

    # 账户本来就少转化的不报（日均 < 0.3 次）
    if avg_conv_baseline < 0.3 or days_of_data < MIN_DATA_DAYS:
        return

    rows = _get_recent_performance(client_id, platform, ad_account_id, days=4)
    rows_48h = [r for r in rows if r["date"] <= (date.today() - timedelta(days=2)).isoformat()]
    if len(rows_48h) < 2:
        return

    total_conv  = sum(float(r.get("conversions") or 0) for r in rows_48h)
    total_spend = sum(float(r.get("cost") or 0) for r in rows_48h)

    if total_conv == 0 and total_spend > 0:
        _fire(
            client_id=client_id,
            account_name=account_name,
            account_id=ad_account_id,
            alert_key="no_conversion_48h",
            alert_type="conversion_drop",
            severity="critical",
            message=(
                f"{account_name} ({platform.replace('_',' ').title()}) 持续 48h 零转化，"
                f"期间花费 ${total_spend:.2f}，日均基准 {avg_conv_baseline:.1f} 次转化。"
                f"优先排查：Pixel 追踪、感谢页、落地页漏斗。"
            ),
            platform=platform,
            metric_name="conversions",
            metric_value=0,
            details={"spend_48h": total_spend, "baseline_daily_conv": avg_conv_baseline},
        )


# ── Layer 2 — 着陆页失效（CTR 正常但 CVR 崩） ────────────────────────────────

def check_landing_page_failure(client_id: str, platform: str, ad_account_id: str,
                                account_name: str, baseline: dict) -> None:
    avg_ctr_baseline = float(baseline.get("avg_ctr") or 0)
    days_of_data     = int(baseline.get("days_of_data") or 0)

    # 需要有足够的基准数据
    if avg_ctr_baseline == 0 or days_of_data < MIN_DATA_DAYS:
        return

    # 推算 CVR 基准（转化/点击）
    avg_conv  = float(baseline.get("avg_daily_conversions") or 0)
    avg_click = float(baseline.get("avg_daily_clicks") or 1)
    avg_cvr_baseline = avg_conv / avg_click if avg_click > 0 else 0

    if avg_cvr_baseline == 0:
        return

    rows = _get_recent_performance(client_id, platform, ad_account_id, days=6)
    rows = [r for r in rows if r["date"] <= (date.today() - timedelta(days=2)).isoformat()]
    if len(rows) < 2:
        return

    recent_ctrs, recent_cvrs = [], []
    for r in rows[-3:]:
        imp   = int(r.get("impressions") or 0)
        clk   = int(r.get("clicks") or 0)
        conv  = float(r.get("conversions") or 0)
        if imp > 0:
            recent_ctrs.append(clk / imp)
        if clk > 0:
            recent_cvrs.append(conv / clk)

    if not recent_ctrs or not recent_cvrs:
        return

    current_ctr = sum(recent_ctrs) / len(recent_ctrs)
    current_cvr = sum(recent_cvrs) / len(recent_cvrs)

    # CTR 还健康（≥ 基准 85%）但 CVR 崩了（< 基准 60%）= 落地页问题
    if (current_ctr >= avg_ctr_baseline * LANDING_PAGE_CTR_FLOOR and
            current_cvr < avg_cvr_baseline * LANDING_PAGE_CVR_DROP):
        cvr_drop_pct = (1 - current_cvr / avg_cvr_baseline) * 100
        _fire(
            client_id=client_id,
            account_name=account_name,
            account_id=ad_account_id,
            alert_key="landing_page_failure",
            alert_type="ctr_cliff",
            severity="critical",
            message=(
                f"{account_name} ({platform.replace('_',' ').title()}) 疑似落地页失效："
                f"CTR 正常 ({current_ctr:.2%} vs 基准 {avg_ctr_baseline:.2%})，"
                f"但 CVR 下降 {cvr_drop_pct:.0f}% ({current_cvr:.2%} vs 基准 {avg_cvr_baseline:.2%})。"
                f"流量在到达，但页面没有在转化。排查：加载速度、表单、Offer。"
            ),
            platform=platform,
            metric_name="cvr",
            metric_value=round(current_cvr, 4),
            threshold=round(avg_cvr_baseline * LANDING_PAGE_CVR_DROP, 4),
            details={
                "ctr_current": round(current_ctr, 4), "ctr_baseline": round(avg_ctr_baseline, 4),
                "cvr_current": round(current_cvr, 4), "cvr_baseline": round(avg_cvr_baseline, 4),
                "cvr_drop_pct": round(cvr_drop_pct, 1),
            },
        )


# ── Layer X — 跨平台关联 ─────────────────────────────────────────────────────

def check_cross_platform(client_id: str, account_name: str, accounts: list) -> None:
    """如果同一客户的 Google + Meta 同时 ROAS 下降，说明是外部原因（网站/市场）。"""
    if len(accounts) < 2:
        return

    dropped_platforms = []
    for acc in accounts:
        baseline = _get_baseline(client_id, acc["platform"], acc["ad_account_id"])
        if not baseline:
            continue
        avg_roas = float(baseline.get("avg_roas") or 0)
        if avg_roas == 0 or int(baseline.get("days_of_data") or 0) < MIN_DATA_DAYS:
            continue

        rows = _get_recent_performance(client_id, acc["platform"], acc["ad_account_id"], days=6)
        rows = [r for r in rows if r["date"] <= (date.today() - timedelta(days=2)).isoformat()]
        if len(rows) < 2:
            continue

        recent_roas = []
        for r in rows[-3:]:
            cost    = float(r.get("cost") or 0)
            revenue = float(r.get("revenue") or 0)
            if cost > 0:
                recent_roas.append(revenue / cost)

        if recent_roas:
            current = sum(recent_roas) / len(recent_roas)
            if current < avg_roas * CROSS_ROAS_DROP:
                dropped_platforms.append(acc["platform"])

    if len(dropped_platforms) >= 2:
        if _already_fired(client_id, "cross_platform"):
            return
        platforms_str = " 和 ".join(p.replace("_", " ").title() for p in dropped_platforms)
        _fire(
            client_id=client_id,
            account_name=account_name,
            account_id=client_id,
            alert_key="cross_platform",
            alert_type="performance_drop",
            severity="critical",
            message=(
                f"{account_name} 在 {platforms_str} 同时出现 ROAS 下降（>30%）。"
                f"跨平台同时下降通常是外部原因：网站宕机、Pixel 失效、市场季节性、竞争格局变化。"
                f"优先检查 Analytics 流量和 Pixel 健康状态。"
            ),
            platform="all",
            metric_name="roas",
            details={"dropped_platforms": dropped_platforms},
        )


# ── 主流程 ────────────────────────────────────────────────────────────────────

def run_evaluate_rules() -> dict:
    today = date.today()
    logger.info(f"[evaluate_rules] 开始 — {today}")

    # 拉取所有有基准数据的账户
    baselines_all = (
        supabase.table("account_daily_baselines")
        .select("client_id, platform, ad_account_id, days_of_data, avg_roas, avg_cpa, avg_daily_conversions, avg_daily_clicks, avg_ctr, avg_daily_cost")
        .execute()
    ).data or []

    # 拉取客户名称
    clients_raw = (supabase.table("clients").select("id, name").execute()).data or []
    client_names = {c["id"]: c.get("name", c["id"]) for c in clients_raw}

    # 按 client_id 分组
    from collections import defaultdict
    by_client = defaultdict(list)
    for b in baselines_all:
        by_client[b["client_id"]].append(b)

    fired_total = 0
    skipped     = 0

    for client_id, accounts in by_client.items():
        account_name = client_names.get(client_id, client_id)

        for acc in accounts:
            platform     = acc["platform"]
            ad_account_id = acc["ad_account_id"]
            baseline     = _get_baseline(client_id, platform, ad_account_id)
            if not baseline:
                skipped += 1
                continue

            before = fired_total
            check_roas_drop(client_id, platform, ad_account_id, account_name, baseline)
            check_cpa_spike(client_id, platform, ad_account_id, account_name, baseline)
            check_no_conversion_48h(client_id, platform, ad_account_id, account_name, baseline)
            check_landing_page_failure(client_id, platform, ad_account_id, account_name, baseline)
            fired_total += 1  # 用于计数（实际 fire 在函数内统计）

        # 跨平台检查（有多个平台的客户）
        if len(accounts) >= 2:
            check_cross_platform(client_id, account_name, accounts)

        logger.info(f"[evaluate_rules] {account_name} 完成")

    summary = {
        "status":           "completed",
        "date":             today.isoformat(),
        "accounts_checked": len(baselines_all) - skipped,
        "accounts_skipped": skipped,
    }
    logger.info(f"[evaluate_rules] 完成 — {summary}")
    return summary


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    parser = argparse.ArgumentParser(description="UNI Alert Intelligence — evaluate_rules (Layer 2+)")
    parser.add_argument("--full-pipeline", action="store_true",
                        help="先跑 update_baselines，再跑 evaluate_rules")
    args = parser.parse_args()

    if args.full_pipeline:
        from update_baselines import run_update_baselines
        print("[pipeline] Step 1: 更新基准数据...")
        bl_result = run_update_baselines()
        print(f"[pipeline] 基准更新: {bl_result}")

    print("[pipeline] Step 2: 评估 Layer 2+ 警报规则...")
    result = run_evaluate_rules()
    print(f"[pipeline] 结果: {result}")
    sys.exit(0 if result["status"] == "completed" else 1)
