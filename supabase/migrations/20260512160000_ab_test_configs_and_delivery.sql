-- Wave 3: A/B test monitoring presets + per-client alert delivery (Slack / email).
-- Evaluators (hourly/daily reports, Slack, email sends) are expected to be implemented
-- in Python or Edge Functions reading these tables; the dashboard stores configuration only.

CREATE TABLE IF NOT EXISTS public.client_ab_test_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    platform        TEXT NOT NULL CHECK (platform IN ('meta_ads', 'google_ads')),
    entity_type     TEXT NOT NULL CHECK (entity_type IN ('campaign', 'ad_set', 'ad')),
    entity_name     TEXT NOT NULL,
    cadence         TEXT NOT NULL DEFAULT 'daily' CHECK (cadence IN ('daily', 'hourly')),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    notes           TEXT DEFAULT '',
    created_by      UUID REFERENCES public.app_users (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ab_configs_client ON public.client_ab_test_configs (client_id);
CREATE INDEX IF NOT EXISTS idx_ab_configs_active ON public.client_ab_test_configs (client_id, is_active);

CREATE TABLE IF NOT EXISTS public.client_alert_delivery (
    client_id           UUID PRIMARY KEY REFERENCES public.clients (id) ON DELETE CASCADE,
    notify_in_app       BOOLEAN NOT NULL DEFAULT true,
    slack_webhook_url   TEXT,
    notify_emails       TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by          UUID REFERENCES public.app_users (id) ON DELETE SET NULL
);

ALTER TABLE public.client_ab_test_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_alert_delivery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ab_configs_select_auth" ON public.client_ab_test_configs;
CREATE POLICY "ab_configs_select_auth"
    ON public.client_ab_test_configs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ab_configs_insert_auth" ON public.client_ab_test_configs;
CREATE POLICY "ab_configs_insert_auth"
    ON public.client_ab_test_configs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ab_configs_update_auth" ON public.client_ab_test_configs;
CREATE POLICY "ab_configs_update_auth"
    ON public.client_ab_test_configs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ab_configs_delete_auth" ON public.client_ab_test_configs;
CREATE POLICY "ab_configs_delete_auth"
    ON public.client_ab_test_configs FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "delivery_select_auth" ON public.client_alert_delivery;
CREATE POLICY "delivery_select_auth"
    ON public.client_alert_delivery FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "delivery_insert_auth" ON public.client_alert_delivery;
CREATE POLICY "delivery_insert_auth"
    ON public.client_alert_delivery FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delivery_update_auth" ON public.client_alert_delivery;
CREATE POLICY "delivery_update_auth"
    ON public.client_alert_delivery FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delivery_delete_auth" ON public.client_alert_delivery;
CREATE POLICY "delivery_delete_auth"
    ON public.client_alert_delivery FOR DELETE TO authenticated USING (true);
