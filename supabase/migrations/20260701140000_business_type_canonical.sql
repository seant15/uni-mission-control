-- Canonical business_type: ecommerce | leadgen only.
-- Normalize legacy aliases; fix RoboThink; enforce CHECK; RPC normalize on write.

UPDATE public.clients
SET business_type = 'leadgen'
WHERE lower(trim(business_type)) IN (
    'leadgen', 'lead_gen', 'lead_generation', 'lead gen', 'local'
);

UPDATE public.clients
SET business_type = 'ecommerce'
WHERE business_type IS NULL
   OR trim(business_type) = ''
   OR lower(trim(business_type)) NOT IN ('ecommerce', 'leadgen');

-- RoboThink Franchise: lead gen account (target_cpa already set).
UPDATE public.clients
SET business_type = 'leadgen'
WHERE id = 'd6932ea8-87a9-48e5-a09d-9fefaed169a4';

ALTER TABLE public.clients
    DROP CONSTRAINT IF EXISTS clients_business_type_check;

ALTER TABLE public.clients
    ADD CONSTRAINT clients_business_type_check
    CHECK (business_type IN ('ecommerce', 'leadgen'));

COMMENT ON COLUMN public.clients.business_type IS
    'Canonical: ecommerce | leadgen. Mission Control + ads-data-sync normalize legacy aliases on read.';

-- Normalize on create (replace prior create_client_record).
CREATE OR REPLACE FUNCTION public.normalize_business_type(p_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_raw IS NULL OR trim(p_raw) = '' THEN 'ecommerce'
        WHEN lower(replace(trim(p_raw), ' ', '_')) IN (
            'leadgen', 'lead_gen', 'lead_generation', 'local'
        ) THEN 'leadgen'
        ELSE 'ecommerce'
    END;
$$;

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
    v_bt text;
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
    v_bt := public.normalize_business_type(p_business_type);

    INSERT INTO public.clients (name, business_type, agency_id, currency, status)
    VALUES (v_name, v_bt, p_agency_id, COALESCE(NULLIF(trim(p_currency), ''), 'USD'), 'active')
    RETURNING clients.id, clients.name INTO v_id, v_name;

    RETURN QUERY SELECT v_id, v_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_client_business_type(
    p_client_id uuid,
    p_business_type text
)
RETURNS TABLE (id uuid, name text, business_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role text;
    v_bt text;
BEGIN
    IF p_client_id IS NULL THEN
        RAISE EXCEPTION 'client_id is required';
    END IF;

    SELECT au.role INTO v_role
    FROM public.app_users au
    WHERE au.auth_user_id = auth.uid()
      AND au.is_active = true
    LIMIT 1;

    IF v_role IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Only super admins can update client business type';
    END IF;

    v_bt := public.normalize_business_type(p_business_type);

    RETURN QUERY
    UPDATE public.clients c
    SET business_type = v_bt
    WHERE c.id = p_client_id
    RETURNING c.id, c.name, c.business_type;
END;
$$;

REVOKE ALL ON FUNCTION public.update_client_business_type(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_client_business_type(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.update_client_business_type IS
    'Super-admin: set clients.business_type to canonical ecommerce | leadgen.';
