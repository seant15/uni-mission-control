-- Run in Supabase SQL Editor after applying 20260512140000_mission_cards.sql
-- Expect: each check returns OK / non-empty where noted.

-- 1) Table exists
SELECT to_regclass('public.mission_cards') IS NOT NULL AS mission_cards_exists;

-- 2) Expected columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'mission_cards'
ORDER BY ordinal_position;

-- 3) RLS enabled
SELECT relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'mission_cards';

-- 4) Policies (at least 4 for authenticated CRUD)
SELECT polname, polcmd
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'mission_cards';

-- 5) Optional: FK to clients (nullable client_id is OK)
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.mission_cards'::regclass;
