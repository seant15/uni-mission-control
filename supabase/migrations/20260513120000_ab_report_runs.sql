-- Dedup log for A/B report job (wave 3 automation). Service role / Python writes; optional dashboard read later.

CREATE TABLE IF NOT EXISTS public.ab_report_runs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id    UUID NOT NULL REFERENCES public.client_ab_test_configs (id) ON DELETE CASCADE,
    period_key   TEXT NOT NULL,
    summary      TEXT NOT NULL DEFAULT '',
    metrics      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ab_report_config_period UNIQUE (config_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_ab_report_runs_config ON public.ab_report_runs (config_id, created_at DESC);

ALTER TABLE public.ab_report_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ab_report_runs_select_auth" ON public.ab_report_runs;
CREATE POLICY "ab_report_runs_select_auth"
    ON public.ab_report_runs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ab_report_runs_insert_auth" ON public.ab_report_runs;
CREATE POLICY "ab_report_runs_insert_auth"
    ON public.ab_report_runs FOR INSERT TO authenticated WITH CHECK (true);
