-- Per-client rolling 30d ad spend targets by platform (Heated View pacing).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS target_ad_spend_30d_by_platform jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.clients.target_ad_spend_30d_by_platform IS
  'Rolling 30d spend targets by platform key, e.g. {"meta_ads":10000,"google_ads":35000}';

UPDATE public.clients
SET target_ad_spend_30d_by_platform = '{"meta_ads":10000,"google_ads":35000}'::jsonb
WHERE name ILIKE '%kul%'
  AND (target_ad_spend_30d_by_platform IS NULL OR target_ad_spend_30d_by_platform = '{}'::jsonb);
