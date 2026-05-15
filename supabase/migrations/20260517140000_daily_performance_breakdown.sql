-- Warehouse slices for Overview attribution pies (device, age, gender, demographic).

CREATE TABLE IF NOT EXISTS public.daily_performance_breakdown (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
    date DATE NOT NULL,
    platform TEXT NOT NULL,
    ad_account_id TEXT NOT NULL DEFAULT '',
    dimension TEXT NOT NULL,
    dimension_value TEXT NOT NULL,
    cost NUMERIC NOT NULL DEFAULT 0,
    revenue NUMERIC NOT NULL DEFAULT 0,
    impressions BIGINT NOT NULL DEFAULT 0,
    clicks BIGINT NOT NULL DEFAULT 0,
    conversions NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT daily_performance_breakdown_dimension_chk
        CHECK (dimension IN ('device', 'age', 'gender', 'demographic'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_perf_breakdown_grain
    ON public.daily_performance_breakdown (
        client_id, date, platform, ad_account_id, dimension, dimension_value
    );

CREATE INDEX IF NOT EXISTS idx_daily_perf_breakdown_lookup
    ON public.daily_performance_breakdown (client_id, date, platform, dimension);

COMMENT ON TABLE public.daily_performance_breakdown IS
    'Meta/Google insight breakdowns (device_platform, age, gender, age+gender) synced by ads_data_sync/execution/sync_performance_breakdowns.py';

ALTER TABLE public.daily_performance_breakdown ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_perf_breakdown_select_auth" ON public.daily_performance_breakdown;
CREATE POLICY "daily_perf_breakdown_select_auth"
    ON public.daily_performance_breakdown FOR SELECT TO authenticated USING (true);
