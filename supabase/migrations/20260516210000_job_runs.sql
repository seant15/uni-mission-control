-- Job-level observability (Contract D). Service-role Python writers; dashboard reads via anon+authenticated RLS.

CREATE TABLE IF NOT EXISTS public.job_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name        TEXT NOT NULL,
    scope           TEXT,
    status          TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
    finished_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms     INTEGER,
    exit_code       INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT,
    meta            JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.job_runs IS
    'One row per batch job invocation (completed or failed). Writers: ads_data_sync Python with service role. Readers: Mission Control for last-run UI. Purge rows older than 90d in ops cron if volume matters.';

CREATE INDEX IF NOT EXISTS idx_job_runs_name_finished
    ON public.job_runs (job_name, finished_at DESC);

ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_runs_select_auth" ON public.job_runs;
CREATE POLICY "job_runs_select_auth"
    ON public.job_runs FOR SELECT TO authenticated USING (true);

-- Writes: service_role only (Python on VPS). No INSERT/UPDATE policy for authenticated.