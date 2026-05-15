-- Agency-level tenancy: UNI vs partner/demo containers; clients and users belong to one agency.

CREATE TABLE IF NOT EXISTS public.agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES public.agencies (id) ON DELETE SET NULL;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES public.agencies (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_agency_id ON public.clients (agency_id);
CREATE INDEX IF NOT EXISTS idx_app_users_agency_id ON public.app_users (agency_id);

INSERT INTO public.agencies (id, name, slug)
VALUES
    ('a0000000-0000-4000-8000-000000000001', 'UNI Marketing', 'uni'),
    ('a0000000-0000-4000-8000-000000000002', 'Demo Agency', 'demo')
ON CONFLICT (slug) DO NOTHING;

-- Default: existing clients belong to UNI unless name suggests demo/test sandbox.
UPDATE public.clients
SET agency_id = 'a0000000-0000-4000-8000-000000000001'
WHERE agency_id IS NULL;

UPDATE public.clients
SET agency_id = 'a0000000-0000-4000-8000-000000000002'
WHERE agency_id IS NULL
  AND (
    lower(coalesce(name, '')) LIKE '%demo%'
    OR lower(coalesce(name, '')) LIKE '%sandbox%'
    OR lower(coalesce(name, '')) LIKE '%test account%'
  );

COMMENT ON TABLE public.agencies IS 'Top-level org container (e.g. UNI vs demo partner). Clients and app_users reference agency_id.';
COMMENT ON COLUMN public.clients.agency_id IS 'Owning agency; filters overview and sync scope for multi-tenant admins.';
