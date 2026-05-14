"""
update_baselines.py
-------------------
Nightly job: calculates rolling averages for every client/provider/metric
and upserts them into account_daily_baselines.

Metrics computed:
  - spend       (daily cost)
  - revenue     (daily conversion value)
  - impressions
  - clicks
  - conversions
  - roas        (revenue / spend)
  - cpa         (spend / conversions)
  - ctr         (clicks / impressions)
  - cvr         (conversions / clicks)

Meta CTR/clicks baseline excludes data before 2026-03-01 per attribution change.

Run via:
  python scripts/intelligence/update_baselines.py

Or triggered from evaluate_rules.py's --full-pipeline flag.
"""

import os
import sys
import logging
from datetime import date, timedelta
from typing import Optional
from statistics import mean, stdev
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env from project root
load_dotenv(Path(__file__).parent.parent.parent / ".env")

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Missing SUPABASE_URL / SUPABASE_SERVICE_KEY in .env", file=sys.stderr)
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

# Meta attribution change date — CTR/clicks now = link-clicks only (not all clicks)
META_CUTOFF = date(2026, 3, 1)
META_CUTOFF_METRICS = {"ctr", "clicks"}

# How many days of history to pull for baseline calculation
BASELINE_HISTORY_DAYS = 35  # 29d window + 6 buffer days

# Provider aliases → canonical key used in daily_performance
GOOGLE_ALIASES = {"google_ads", "google-ads", "google"}
META_ALIASES   = {"meta_ads", "facebook", "facebook-ads", "meta"}


def _is_meta(provider: str) -> bool:
    return provider.lower() in META_ALIASES


def _safe_divide(num: float, den: float) -> Optional[float]:
    if not den or den == 0:
        return None
    return num / den


def _compute_metrics(rows: list) -> list:
    """Derive per-row metrics from raw daily_performance records."""
    out = []
    for r in rows:
        cost        = float(r.get("cost") or 0)
        revenue     = float(r.get("revenue") or 0)
        impressions = int(r.get("impressions") or 0)
        clicks      = int(r.get("clicks") or 0)
        conversions = float(r.get("conversions") or 0)
        out.append({
            "date":        r["date"],
            "spend":       cost,
            "revenue":     revenue,
            "impressions": impressions,
            "clicks":      clicks,
            "conversions": conversions,
            "roas":        _safe_divide(revenue, cost),
            "cpa":         _safe_divide(cost, conversions),
            "ctr":         _safe_divide(clicks, impressions),
            "cvr":         _safe_divide(conversions, clicks),
        })
    return out


def _rolling_stats(values: list, window: int) -> dict:
    """Compute avg and stddev for the last `window` non-None values."""
    clean = [v for v in values[-window:] if v is not None]
    if not clean:
        return {"avg": None, "stddev": None, "data_points": 0}
    avg = mean(clean)
    std = stdev(clean) if len(clean) > 1 else 0.0
    return {"avg": avg, "stddev": std, "data_points": len(clean)}


def run_update_baselines() -> dict:
    """
    Main entry point.
    Fetches all clients, computes rolling baselines, upserts into
    account_daily_baselines. Returns a summary dict.
    """
    today         = date.today()
    history_start = today - timedelta(days=BASELINE_HISTORY_DAYS)

    logger.info(f"[update_baselines] Starting — history_start={history_start}, today={today}")

    clients = (supabase.table("clients").select("id, name").execute()).data or []
    logger.info(f"[update_baselines] {len(clients)} clients found")

    total_upserted = 0
    skipped        = 0

    for client in clients:
        client_id   = client["id"]
        client_name = client.get("name", client_id)

        integrations = (
            supabase.table("integrations")
            .select("provider")
            .eq("client_id", client_id)
            .execute()
        ).data or []

        providers = list({i["provider"] for i in integrations})
        if not providers:
            skipped += 1
            continue

        for provider in providers:
            rows = (
                supabase.table("daily_performance")
                .select("date, cost, revenue, impressions, clicks, conversions")
                .eq("client_id", client_id)
                .eq("provider", provider)
                .gte("date", history_start.isoformat())
                .lte("date", today.isoformat())
                .order("date", desc=False)
                .execute()
            ).data or []

            if len(rows) < 3:
                logger.debug(f"[update_baselines] {client_name}/{provider}: {len(rows)} rows — skipping")
                skipped += 1
                continue

            computed = _compute_metrics(rows)
            is_meta  = _is_meta(provider)

            metrics_to_store = [
                "spend", "revenue", "impressions", "clicks", "conversions",
                "roas", "cpa", "ctr", "cvr",
            ]

            for metric in metrics_to_store:
                cutoff_date = None
                if is_meta and metric in META_CUTOFF_METRICS:
                    cutoff_date = META_CUTOFF
                    values = [
                        r[metric] for r in computed
                        if date.fromisoformat(r["date"]) >= META_CUTOFF
                    ]
                else:
                    values = [r[metric] for r in computed]

                s7  = _rolling_stats(values, 7)
                s14 = _rolling_stats(values, 14)
                s29 = _rolling_stats(values, 29)

                if s14["data_points"] == 0:
                    continue

                row = {
                    "client_id":            client_id,
                    "provider":             provider,
                    "metric_name":          metric,
                    "avg_7d":               s7["avg"],
                    "avg_14d":              s14["avg"],
                    "avg_29d":              s29["avg"],
                    "stddev_14d":           s14["stddev"],
                    "data_points_14d":      s14["data_points"],
                    "baseline_cutoff_date": cutoff_date.isoformat() if cutoff_date else None,
                    "last_updated":         "now()",
                    "entity_type":          "account",
                    "entity_id":            None,
                }

                try:
                    supabase.table("account_daily_baselines").upsert(
                        row,
                        on_conflict="client_id,provider,metric_name,entity_type"
                    ).execute()
                    total_upserted += 1
                except Exception as e:
                    logger.error(f"[update_baselines] Upsert failed {client_name}/{provider}/{metric}: {e}")

            logger.info(f"[update_baselines] {client_name}/{provider}: {len(metrics_to_store)} metrics done")

    summary = {
        "status":                 "completed",
        "date":                   today.isoformat(),
        "clients_processed":      len(clients) - skipped,
        "clients_skipped":        skipped,
        "baseline_rows_upserted": total_upserted,
    }
    logger.info(f"[update_baselines] Done — {summary}")
    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    result = run_update_baselines()
    print(result)
    sys.exit(0 if result["status"] == "completed" else 1)
