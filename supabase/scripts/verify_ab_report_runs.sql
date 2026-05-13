SELECT to_regclass('public.ab_report_runs') IS NOT NULL AS ab_report_runs_exists;

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ab_report_runs'
ORDER BY ordinal_position;

SELECT polname FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname = 'ab_report_runs';
