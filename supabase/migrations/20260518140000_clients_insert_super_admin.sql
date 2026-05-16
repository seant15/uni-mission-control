-- Super admins can create clients from Settings → Users & access.

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_insert_super_admin" ON public.clients;
CREATE POLICY "clients_insert_super_admin"
    ON public.clients
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.app_users au
            WHERE au.auth_user_id = auth.uid() AND au.role = 'super_admin' AND au.is_active = true
        )
    );
