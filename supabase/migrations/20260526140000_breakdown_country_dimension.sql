-- Add country slice to daily_performance_breakdown (user location; Meta + Google sync).

ALTER TABLE public.daily_performance_breakdown
    DROP CONSTRAINT IF EXISTS daily_performance_breakdown_dimension_chk;

ALTER TABLE public.daily_performance_breakdown
    ADD CONSTRAINT daily_performance_breakdown_dimension_chk
    CHECK (dimension IN ('device', 'age', 'gender', 'demographic', 'country'));

COMMENT ON TABLE public.daily_performance_breakdown IS
    'Meta/Google insight breakdowns: device, age, gender, demographic, country (user location). Sync: ads_data_sync/execution/sync_performance_breakdowns.py';
