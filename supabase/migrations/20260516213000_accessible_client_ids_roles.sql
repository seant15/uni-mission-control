-- Extend RLS helper for new dashboard roles (see AGENT_BRIEF_FRONTEND_DEV.md).
-- Requires existing public.accessible_client_ids() from legacy wave-1 migrations.
-- media_buyer / partner: all clients (UI still hides pages per RBAC).
-- client: same scope as client_user (primary_client_id only).

CREATE OR REPLACE FUNCTION public.accessible_client_ids()
RETURNS SETOF UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_primary_client UUID;
BEGIN
  SELECT role, primary_client_id
  INTO v_role, v_primary_client
  FROM app_users
  WHERE auth_user_id = auth.uid()
    AND is_active = true
  LIMIT 1;

  IF v_role IN ('super_admin', 'media_buyer', 'partner') THEN
    RETURN QUERY SELECT id FROM clients;
  ELSIF v_role = 'team_member' THEN
    RETURN QUERY
      SELECT uca.client_id
      FROM user_client_access uca
      JOIN app_users au ON uca.user_id = au.id
      WHERE au.auth_user_id = auth.uid()
        AND au.is_active = true;
  ELSIF v_role IN ('client_user', 'client') THEN
    IF v_primary_client IS NOT NULL THEN
      RETURN QUERY SELECT v_primary_client;
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.accessible_client_ids() IS
    'RLS helper: client rows visible to current user. super_admin/media_buyer/partner = all clients; team_member = user_client_access; client/client_user = primary_client_id.';
