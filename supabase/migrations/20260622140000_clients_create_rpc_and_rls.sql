-- Fix "new row violates row-level security policy" when super_admin adds a client.
-- Root cause: clients had RLS enabled (legacy) but no INSERT policy until 20260518140000 —
-- that migration may not be applied on all environments.
-- This migration: scoped SELECT + super_admin INSERT/UPDATE + SECURITY DEFINER RPC fallback.

-- ── SELECT: replace permissive legacy policy with accessible_client_ids() ──
DROP POLICY IF EXISTS "Allow all read" ON public.clients;
DROP POLICY IF EXISTS "clients_select_scoped" ON public.clients;
CREATE POLICY "clients_select_scoped"
    ON public.clients
    FOR SELECT
    TO authenticated
    USING (id IN (SELECT public.accessible_client_ids()));

-- ── INSERT / UPDATE: super_admin only (Settings → Add client) ──
DROP POLICY IF EXISTS "clients_insert_super_admin" ON public.clients;
CREATE POLICY "clients_insert_super_admin"
    ON public.clients
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.app_users au
            WHERE au.auth_user_id = auth.uid()
              AND au.role = 'super_admin'
              AND au.is_active = true
        )
    );

DROP POLICY IF EXISTS "clients_update_super_admin" ON public.clients;
CREATE POLICY "clients_update_super_admin"
    ON public.clients
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.app_users au
            WHERE au.auth_user_id = auth.uid()
              AND au.role = 'super_admin'
              AND au.is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.app_users au
            WHERE au.auth_user_id = auth.uid()
              AND au.role = 'super_admin'
              AND au.is_active = true
        )
    );

-- ── RPC: reliable create path (bypasses RLS, enforces super_admin inside) ──
CREATE OR REPLACE FUNCTION public.create_client_record(
    p_name text,
    p_business_type text DEFAULT 'ecommerce',
    p_agency_id uuid DEFAULT NULL,
    p_currency text DEFAULT 'USD'
)
RETURNS TABLE (id uuid, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role text;
    v_id uuid;
    v_name text;
BEGIN
    IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
        RAISE EXCEPTION 'Client name is required';
    END IF;

    SELECT au.role INTO v_role
    FROM public.app_users au
    WHERE au.auth_user_id = auth.uid()
      AND au.is_active = true
    LIMIT 1;

    IF v_role IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Only super admins can create clients';
    END IF;

    v_name := trim(p_name);

    INSERT INTO public.clients (name, business_type, agency_id, currency, status)
    VALUES (
        v_name,
        COALESCE(NULLIF(trim(p_business_type), ''), 'ecommerce'),
        p_agency_id,
        COALESCE(NULLIF(trim(p_currency), ''), 'USD'),
        'active'
    )
    RETURNING clients.id, clients.name INTO v_id, v_name;

    RETURN QUERY SELECT v_id, v_name;
END;
$$;

REVOKE ALL ON FUNCTION public.create_client_record(text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_client_record(text, text, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.create_client_record IS
    'Super-admin client onboarding from Mission Control Settings. SECURITY DEFINER; checks app_users.role.';
