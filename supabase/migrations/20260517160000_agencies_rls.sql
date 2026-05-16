-- Allow authenticated users to read agency list (super-admin switcher).

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agencies_select_authenticated" ON public.agencies;
CREATE POLICY "agencies_select_authenticated"
    ON public.agencies FOR SELECT TO authenticated
    USING (true);
