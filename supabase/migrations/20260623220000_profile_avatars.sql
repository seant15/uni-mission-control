-- Profile avatars: custom upload path + self-service preset/avatar updates.

ALTER TABLE public.app_users
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.app_users.avatar_url IS
    'Storage path in profile-avatars bucket (e.g. {auth_user_id}/avatar.webp). Takes display priority over avatar_preset.';

COMMENT ON COLUMN public.app_users.avatar_preset IS
    'Preset avatar id (preset-01 … preset-10). Gradient fallback when no avatar_url.';

-- Guard self-updates: users may change profile fields but not privilege columns.
CREATE OR REPLACE FUNCTION public.app_users_guard_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.auth_user_id IS NOT NULL AND OLD.auth_user_id = auth.uid() THEN
        NEW.role := OLD.role;
        NEW.is_active := OLD.is_active;
        NEW.email := OLD.email;
        NEW.auth_user_id := OLD.auth_user_id;
        NEW.agency_id := OLD.agency_id;
        NEW.primary_client_id := OLD.primary_client_id;
        NEW.notes := OLD.notes;
        NEW.invite_sent_at := OLD.invite_sent_at;
        NEW.invite_accepted_at := OLD.invite_accepted_at;
        NEW.created_at := OLD.created_at;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_users_guard_self_update ON public.app_users;
CREATE TRIGGER app_users_guard_self_update
    BEFORE UPDATE ON public.app_users
    FOR EACH ROW
    EXECUTE FUNCTION public.app_users_guard_self_update();

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_users_select_authenticated" ON public.app_users;
CREATE POLICY "app_users_select_authenticated"
    ON public.app_users
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "app_users_update_own_profile" ON public.app_users;
CREATE POLICY "app_users_update_own_profile"
    ON public.app_users
    FOR UPDATE
    TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "app_users_update_super_admin" ON public.app_users;
CREATE POLICY "app_users_update_super_admin"
    ON public.app_users
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

DROP POLICY IF EXISTS "app_users_insert_super_admin" ON public.app_users;
CREATE POLICY "app_users_insert_super_admin"
    ON public.app_users
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

-- Public bucket for profile avatars (path: {auth_user_id}/avatar.webp).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-avatars',
    'profile-avatars',
    true,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "profile_avatars_select" ON storage.objects;
CREATE POLICY "profile_avatars_select"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'profile-avatars');

DROP POLICY IF EXISTS "profile_avatars_insert_own" ON storage.objects;
CREATE POLICY "profile_avatars_insert_own"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'profile-avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "profile_avatars_update_own" ON storage.objects;
CREATE POLICY "profile_avatars_update_own"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'profile-avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'profile-avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "profile_avatars_delete_own" ON storage.objects;
CREATE POLICY "profile_avatars_delete_own"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'profile-avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
