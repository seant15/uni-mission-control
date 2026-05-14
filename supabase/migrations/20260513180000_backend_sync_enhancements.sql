-- Backend wave: daily_performance timezone hint, meta_ads reach/video metrics,
-- Shopify daily rollup + client credentials columns, mission_cards ClickUp bridge.

-- 1) daily_performance: helps frontend explain daily vs hourly date semantics
ALTER TABLE public.daily_performance
    ADD COLUMN IF NOT EXISTS data_timezone TEXT;

COMMENT ON COLUMN public.daily_performance.data_timezone IS
    'IANA tz name from clients.timezone at sync time (reporting context; Meta date uses advertiser tz, Google segments.date is account-based).';

-- 2) meta_ads: extra Insights fields (same campaign request as core metrics)
ALTER TABLE public.meta_ads ADD COLUMN IF NOT EXISTS reach INTEGER DEFAULT 0;
ALTER TABLE public.meta_ads ADD COLUMN IF NOT EXISTS frequency NUMERIC(10, 4) DEFAULT 0;
ALTER TABLE public.meta_ads ADD COLUMN IF NOT EXISTS outbound_clicks INTEGER DEFAULT 0;
ALTER TABLE public.meta_ads ADD COLUMN IF NOT EXISTS video_p25_watched INTEGER DEFAULT 0;
ALTER TABLE public.meta_ads ADD COLUMN IF NOT EXISTS video_p50_watched INTEGER DEFAULT 0;
ALTER TABLE public.meta_ads ADD COLUMN IF NOT EXISTS video_p75_watched INTEGER DEFAULT 0;
ALTER TABLE public.meta_ads ADD COLUMN IF NOT EXISTS video_p100_watched INTEGER DEFAULT 0;
ALTER TABLE public.meta_ads ADD COLUMN IF NOT EXISTS video_avg_watch_time INTEGER DEFAULT 0;

COMMENT ON COLUMN public.meta_ads.video_avg_watch_time IS 'Meta video_avg_time_watched_actions (video_view), seconds as integer.';

-- 3) Shopify (optional per client)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS shopify_store_url TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS shopify_access_token TEXT;

CREATE TABLE IF NOT EXISTS public.shopify_daily_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
    client_name TEXT,
    date DATE NOT NULL,
    total_orders INTEGER DEFAULT 0,
    gross_revenue NUMERIC(12, 2) DEFAULT 0,
    net_revenue NUMERIC(12, 2) DEFAULT 0,
    refund_amount NUMERIC(12, 2) DEFAULT 0,
    avg_order_value NUMERIC(10, 2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (client_id, date)
);

CREATE INDEX IF NOT EXISTS idx_shopify_daily_client_date ON public.shopify_daily_performance (client_id, date);

ALTER TABLE public.shopify_daily_performance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shopify_daily_select_auth" ON public.shopify_daily_performance;
CREATE POLICY "shopify_daily_select_auth"
    ON public.shopify_daily_performance FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "shopify_daily_insert_auth" ON public.shopify_daily_performance;
CREATE POLICY "shopify_daily_insert_auth"
    ON public.shopify_daily_performance FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "shopify_daily_update_auth" ON public.shopify_daily_performance;
CREATE POLICY "shopify_daily_update_auth"
    ON public.shopify_daily_performance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "shopify_daily_delete_auth" ON public.shopify_daily_performance;
CREATE POLICY "shopify_daily_delete_auth"
    ON public.shopify_daily_performance FOR DELETE TO authenticated USING (true);

-- 4) mission_cards: ClickUp ↔ Mission Board (n8n webhook fills these)
ALTER TABLE public.mission_cards ADD COLUMN IF NOT EXISTS clickup_task_id TEXT;
ALTER TABLE public.mission_cards ADD COLUMN IF NOT EXISTS clickup_task_url TEXT;
ALTER TABLE public.mission_cards ADD COLUMN IF NOT EXISTS synced_from_clickup BOOLEAN DEFAULT FALSE;
ALTER TABLE public.mission_cards ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS mission_cards_clickup_task_id_idx
    ON public.mission_cards (clickup_task_id)
    WHERE clickup_task_id IS NOT NULL;
