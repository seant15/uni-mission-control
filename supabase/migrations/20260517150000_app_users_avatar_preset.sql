ALTER TABLE public.app_users
    ADD COLUMN IF NOT EXISTS avatar_preset TEXT;

COMMENT ON COLUMN public.app_users.avatar_preset IS
    'Preset avatar id (preset-01 … preset-10). Maps to /public/avatars/{id}.png';
