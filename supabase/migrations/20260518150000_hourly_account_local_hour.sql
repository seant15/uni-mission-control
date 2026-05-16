-- Denormalized local clock hour (filled by sync_hourly_performance.py v2).

ALTER TABLE public.hourly_performance
    ADD COLUMN IF NOT EXISTS account_local_hour smallint;

COMMENT ON COLUMN public.hourly_performance.account_local_hour IS
    'Clock hour 0-23 in account_timezone for this UTC (date, hour) bucket; used for rhythm charts.';
