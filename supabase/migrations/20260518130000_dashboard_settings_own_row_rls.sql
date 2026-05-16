-- Allow each signed-in user to read/upsert their dashboard_settings row (user_id = auth.users.id).

ALTER TABLE public.dashboard_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dashboard_settings_select_auth" ON public.dashboard_settings;
CREATE POLICY "dashboard_settings_select_auth"
    ON public.dashboard_settings
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "dashboard_settings_upsert_own" ON public.dashboard_settings;
CREATE POLICY "dashboard_settings_upsert_own"
    ON public.dashboard_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()::text
        OR (
            user_id = 'default_user'
            AND EXISTS (
                SELECT 1 FROM public.app_users au
                WHERE au.auth_user_id = auth.uid() AND au.role = 'super_admin' AND au.is_active = true
            )
        )
    );

DROP POLICY IF EXISTS "dashboard_settings_update_own" ON public.dashboard_settings;
CREATE POLICY "dashboard_settings_update_own"
    ON public.dashboard_settings
    FOR UPDATE
    TO authenticated
    USING (
        user_id = auth.uid()::text
        OR (
            user_id = 'default_user'
            AND EXISTS (
                SELECT 1 FROM public.app_users au
                WHERE au.auth_user_id = auth.uid() AND au.role = 'super_admin' AND au.is_active = true
            )
        )
    )
    WITH CHECK (
        user_id = auth.uid()::text
        OR user_id = 'default_user'
    );
