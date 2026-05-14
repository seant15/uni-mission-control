-- Allow dashboard RBAC roles from AGENT_BRIEF_FRONTEND_DEV (media_buyer, partner, client).
-- Legacy check only listed super_admin, team_member, client_user.

ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS app_users_role_check;

ALTER TABLE public.app_users ADD CONSTRAINT app_users_role_check CHECK (
    role IN (
        'super_admin',
        'media_buyer',
        'team_member',
        'partner',
        'client',
        'client_user'
    )
);

COMMENT ON CONSTRAINT app_users_role_check ON public.app_users IS
    'Expanded 2026-05: media_buyer, partner, client. RLS uses accessible_client_ids(); see migration 20260516213000.';
