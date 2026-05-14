-- ClickUp sync fields on mission_cards + rule Slack extras on client_alert_delivery.

ALTER TABLE public.mission_cards
  ADD COLUMN IF NOT EXISTS clickup_task_id TEXT,
  ADD COLUMN IF NOT EXISTS clickup_task_url TEXT,
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS synced_from_clickup BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS mission_cards_clickup_task_id_idx
  ON public.mission_cards (clickup_task_id)
  WHERE clickup_task_id IS NOT NULL;

ALTER TABLE public.client_alert_delivery
  ADD COLUMN IF NOT EXISTS slack_channel TEXT,
  ADD COLUMN IF NOT EXISTS slack_notify_alert_rules BOOLEAN NOT NULL DEFAULT false;
