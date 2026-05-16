-- Per-user KPI card order/hidden state for Agency View (Marketing Overview agency mode).
ALTER TABLE public.dashboard_settings
    ADD COLUMN IF NOT EXISTS agency_kpi_cards JSONB;

COMMENT ON COLUMN public.dashboard_settings.agency_kpi_cards IS 'Agency Overview KPI layout: { "order": string[], "hidden": Record<string,boolean> }';
