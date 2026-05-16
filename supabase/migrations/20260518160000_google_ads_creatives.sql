-- Google Ads creative performance (populated by ads_data_sync execution/sync_google_creatives.py).

CREATE TABLE IF NOT EXISTS public.google_ads_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
    client_name TEXT,
    date DATE NOT NULL,
    ad_account_id TEXT NOT NULL DEFAULT '',
    campaign_id TEXT NOT NULL DEFAULT '',
    ad_group_id TEXT NOT NULL DEFAULT '',
    ad_id TEXT NOT NULL,
    ad_name TEXT,
    ad_type TEXT,
    headline TEXT,
    description TEXT,
    final_url TEXT,
    image_url TEXT,
    youtube_video_id TEXT,
    impressions BIGINT NOT NULL DEFAULT 0,
    clicks BIGINT NOT NULL DEFAULT 0,
    conversions NUMERIC NOT NULL DEFAULT 0,
    cost NUMERIC NOT NULL DEFAULT 0,
    revenue NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_google_ads_ads_grain
    ON public.google_ads_ads (client_id, date, ad_account_id, ad_id);

CREATE INDEX IF NOT EXISTS idx_google_ads_ads_client_date
    ON public.google_ads_ads (client_id, date DESC);

COMMENT ON TABLE public.google_ads_ads IS
    'Daily Google ad-level metrics + creative fields; synced by ads_data_sync/execution/sync_google_creatives.py';

ALTER TABLE public.google_ads_ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_ads_ads_select_auth" ON public.google_ads_ads;
CREATE POLICY "google_ads_ads_select_auth"
    ON public.google_ads_ads FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "google_ads_ads_write_service" ON public.google_ads_ads;
CREATE POLICY "google_ads_ads_write_service"
    ON public.google_ads_ads FOR ALL TO service_role USING (true) WITH CHECK (true);
