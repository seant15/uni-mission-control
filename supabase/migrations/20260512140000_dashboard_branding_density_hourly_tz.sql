-- Org-wide appearance (read from dashboard_settings.user_id = 'default_user' in app merge logic).
ALTER TABLE dashboard_settings
  ADD COLUMN IF NOT EXISTS app_title text,
  ADD COLUMN IF NOT EXISTS app_subtitle text,
  ADD COLUMN IF NOT EXISTS app_logo_url text,
  ADD COLUMN IF NOT EXISTS ui_density text;

COMMENT ON COLUMN dashboard_settings.app_title IS 'Shell title override; null = use built-in default';
COMMENT ON COLUMN dashboard_settings.app_subtitle IS 'Shell subtitle override';
COMMENT ON COLUMN dashboard_settings.app_logo_url IS 'Public or absolute URL for sidebar logo';
COMMENT ON COLUMN dashboard_settings.ui_density IS 'compact | comfort (validated in app)';

-- Used by Real-time Performance for account-local labels and timezone consensus chips.
ALTER TABLE hourly_performance
  ADD COLUMN IF NOT EXISTS account_timezone text;

COMMENT ON COLUMN hourly_performance.account_timezone IS 'IANA timezone hint for the ad account row (optional; filled by sync when available)';
