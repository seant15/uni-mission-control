-- Org-wide toggle for UNI AI Assistant FAB (internal team only; visibility still gated in app by role).
ALTER TABLE dashboard_settings
  ADD COLUMN IF NOT EXISTS assist_ai_chat_fab_enabled boolean DEFAULT true;

COMMENT ON COLUMN dashboard_settings.assist_ai_chat_fab_enabled IS
  'When false, hide UNI AI Assistant widget for internal team (client roles never see it). Stored on default_user row.';
