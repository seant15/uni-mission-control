-- Mission board cards (wave 2). Run in Supabase SQL Editor if migrations CLI is not used.
-- source_alert_id has NO foreign key to alerts: deleting/archiving an alert does not change existing cards.

CREATE TABLE IF NOT EXISTS public.mission_cards (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title             TEXT NOT NULL,
    body              TEXT NOT NULL DEFAULT '',
    column_status     TEXT NOT NULL DEFAULT 'new'
        CHECK (column_status IN ('new', 'in_process', 'in_review', 'done', 'archived', 'cancelled')),
    client_id         UUID REFERENCES public.clients (id) ON DELETE SET NULL,
    source_alert_id   UUID,
    created_by        UUID REFERENCES public.app_users (id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_cards_column ON public.mission_cards (column_status);
CREATE INDEX IF NOT EXISTS idx_mission_cards_client ON public.mission_cards (client_id);
CREATE INDEX IF NOT EXISTS idx_mission_cards_source_alert ON public.mission_cards (source_alert_id);

ALTER TABLE public.mission_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mission_cards_select_authenticated"
    ON public.mission_cards FOR SELECT TO authenticated USING (true);

CREATE POLICY "mission_cards_insert_authenticated"
    ON public.mission_cards FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "mission_cards_update_authenticated"
    ON public.mission_cards FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "mission_cards_delete_authenticated"
    ON public.mission_cards FOR DELETE TO authenticated USING (true);
