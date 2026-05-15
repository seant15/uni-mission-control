-- Org-wide toggles for bottom-right assist widgets (OpenClaw + Feedback FABs).
-- Read from dashboard_settings.user_id = 'default_user' (merged in app getDashboardSettings).
ALTER TABLE dashboard_settings
  ADD COLUMN IF NOT EXISTS assist_openclaw_fab_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS assist_feedback_fab_enabled boolean DEFAULT true;

COMMENT ON COLUMN dashboard_settings.assist_openclaw_fab_enabled IS 'When false, hide OpenClaw chat FAB for all users (org trial / incident kill-switch)';
COMMENT ON COLUMN dashboard_settings.assist_feedback_fab_enabled IS 'When false, hide floating Feedback widget for all users';
