-- After running 20260512160000_ab_test_configs_and_delivery.sql

SELECT to_regclass('public.client_ab_test_configs') IS NOT NULL AS ab_configs_exists;
SELECT to_regclass('public.client_alert_delivery') IS NOT NULL AS delivery_exists;

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'client_ab_test_configs'
ORDER BY ordinal_position;

SELECT polname FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname IN ('client_ab_test_configs', 'client_alert_delivery');
