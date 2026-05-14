-- =============================================================================
-- UNI Alert Intelligence System — Supabase Schema
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. account_daily_baselines
--    Pre-calculated rolling averages per client / provider / metric.
--    Populated nightly by scripts/intelligence/update_baselines.py
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS account_daily_baselines (
    id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id             UUID         NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    provider              TEXT         NOT NULL,
    metric_name           TEXT         NOT NULL,
    entity_type           TEXT         NOT NULL DEFAULT 'account',
    entity_id             UUID,
    avg_7d                NUMERIC,
    avg_14d               NUMERIC,
    avg_29d               NUMERIC,
    stddev_14d            NUMERIC,
    data_points_14d       INTEGER      DEFAULT 0,
    baseline_cutoff_date  DATE,
    last_updated          TIMESTAMPTZ  DEFAULT now()
);

-- Unique constraint used for upsert (on_conflict target)
CREATE UNIQUE INDEX IF NOT EXISTS uq_baselines_client_provider_metric_entity
    ON account_daily_baselines (client_id, provider, metric_name, entity_type);

-- Index for fast lookup during alert evaluation
CREATE INDEX IF NOT EXISTS idx_baselines_lookup
    ON account_daily_baselines (client_id, provider, metric_name);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. alerts — add columns required by the intelligence system
--    (Run only if the alerts table already exists from the frontend schema)
-- ─────────────────────────────────────────────────────────────────────────────

-- These columns may already exist; the IF NOT EXISTS guards prevent errors.

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_type    TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS severity      TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS platform      TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS metric_name   TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS metric_value  NUMERIC;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS threshold     NUMERIC;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS source        TEXT    DEFAULT 'auto';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS status        TEXT    DEFAULT 'new';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS message       TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS dedup_key     TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS group_key     TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS account_name  TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS account_id    TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS client_id     UUID    REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS detected_at   TIMESTAMPTZ DEFAULT now();
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS details       JSONB   DEFAULT '{}'::jsonb;

-- Index for deduplication check
CREATE INDEX IF NOT EXISTS idx_alerts_dedup
    ON alerts (client_id, alert_type, created_at);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_alerts_client_status
    ON alerts (client_id, status, created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Enable Row Level Security (optional — recommended for production)
-- ─────────────────────────────────────────────────────────────────────────────

-- ALTER TABLE account_daily_baselines ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Authenticated users can read baselines"
--     ON account_daily_baselines FOR SELECT
--     USING (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. Verify with:
--   SELECT COUNT(*) FROM account_daily_baselines;
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'alerts';
-- ─────────────────────────────────────────────────────────────────────────────
