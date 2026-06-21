-- Personal UI theme/accent/density + client one-off dashboard modules + Shopify machine/accessory split.

ALTER TABLE public.dashboard_settings
  ADD COLUMN IF NOT EXISTS ui_theme text,
  ADD COLUMN IF NOT EXISTS ui_accent text,
  ADD COLUMN IF NOT EXISTS personal_ui_density text;

COMMENT ON COLUMN public.dashboard_settings.ui_theme IS 'light | dark | system — personal row only';
COMMENT ON COLUMN public.dashboard_settings.ui_accent IS 'orange | blue | uni — personal accent; synced to browser';
COMMENT ON COLUMN public.dashboard_settings.personal_ui_density IS 'compact | comfort — overrides org ui_density when set';

ALTER TABLE public.shopify_daily_performance
  ADD COLUMN IF NOT EXISTS machine_units integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS machine_gross numeric(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accessory_units integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accessory_gross numeric(12, 2) DEFAULT 0;

COMMENT ON COLUMN public.shopify_daily_performance.machine_units IS 'Line items whose title contains spark or spring (Kul machines)';
COMMENT ON COLUMN public.shopify_daily_performance.machine_gross IS 'Gross line revenue for machine SKUs';

CREATE TABLE IF NOT EXISTS public.client_dashboard_modules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
    module_key text NOT NULL,
    config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (client_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_client_dashboard_modules_client
  ON public.client_dashboard_modules (client_id, is_active);

ALTER TABLE public.client_dashboard_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_dashboard_modules_select_auth" ON public.client_dashboard_modules;
CREATE POLICY "client_dashboard_modules_select_auth"
  ON public.client_dashboard_modules FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "client_dashboard_modules_write_auth" ON public.client_dashboard_modules;
CREATE POLICY "client_dashboard_modules_write_auth"
  ON public.client_dashboard_modules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed Kul product split when a client name matches Kul (adjust in Supabase if needed).
INSERT INTO public.client_dashboard_modules (client_id, module_key, config_json, sort_order)
SELECT c.id, 'kul_product_split', '{"title":"Spark & Spring vs accessories","machine_markers":["spark","spring"]}'::jsonb, 10
FROM public.clients c
WHERE c.name ILIKE '%kul%'
ON CONFLICT (client_id, module_key) DO NOTHING;
