-- Server-side merge of daily_performance + hourly gap-fill + optional Shopify rows.
-- Replaces browser fetch of 20k+ daily + 25k+ hourly rows with one filtered RPC.

CREATE OR REPLACE FUNCTION public.get_merged_daily_performance(
  p_client_ids uuid[],
  p_platform text DEFAULT NULL,
  p_ad_account_id text DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_include_shopify boolean DEFAULT false,
  p_result_limit integer DEFAULT 5000,
  p_result_offset integer DEFAULT 0
)
RETURNS TABLE (
  id text,
  client_id uuid,
  client_name text,
  date date,
  platform text,
  ad_account_id text,
  data_timezone text,
  impressions bigint,
  clicks bigint,
  conversions numeric,
  cost numeric,
  revenue numeric,
  gross_revenue numeric,
  refund_amount numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH daily AS (
    SELECT
      d.id::text AS id,
      d.client_id,
      d.client_name,
      d.date,
      d.platform,
      d.ad_account_id,
      d.data_timezone,
      COALESCE(d.impressions, 0)::bigint AS impressions,
      COALESCE(d.clicks, 0)::bigint AS clicks,
      COALESCE(d.conversions, 0) AS conversions,
      COALESCE(d.cost, 0) AS cost,
      COALESCE(d.revenue, 0) AS revenue,
      NULL::numeric AS gross_revenue,
      NULL::numeric AS refund_amount
    FROM public.daily_performance d
    WHERE d.client_id = ANY (p_client_ids)
      AND (p_platform IS NULL OR d.platform = p_platform)
      AND (p_ad_account_id IS NULL OR d.ad_account_id = p_ad_account_id)
      AND (p_start_date IS NULL OR d.date >= p_start_date)
      AND (p_end_date IS NULL OR d.date <= p_end_date)
  ),
  daily_client_dates AS (
    SELECT DISTINCT daily.client_id, daily.date FROM daily
  ),
  hourly_gap AS (
    SELECT
      (
        'hourly-rollup:'
        || h.client_id::text
        || '|'
        || h.date::text
        || '|'
        || COALESCE(h.platform, '')
        || '|'
        || COALESCE(h.ad_account_id, '')
      ) AS id,
      h.client_id,
      MAX(h.client_name) AS client_name,
      h.date,
      h.platform,
      h.ad_account_id,
      NULL::text AS data_timezone,
      SUM(COALESCE(h.impressions, 0))::bigint AS impressions,
      SUM(COALESCE(h.clicks, 0))::bigint AS clicks,
      SUM(COALESCE(h.conversions, 0)) AS conversions,
      SUM(COALESCE(h.cost, 0)) AS cost,
      SUM(COALESCE(h.revenue, 0)) AS revenue,
      NULL::numeric AS gross_revenue,
      NULL::numeric AS refund_amount
    FROM public.hourly_performance h
    WHERE h.client_id = ANY (p_client_ids)
      AND (p_platform IS NULL OR h.platform = p_platform)
      AND (p_ad_account_id IS NULL OR h.ad_account_id = p_ad_account_id)
      AND (p_start_date IS NULL OR h.date >= p_start_date)
      AND (p_end_date IS NULL OR h.date <= p_end_date)
      AND NOT EXISTS (
        SELECT 1
        FROM daily_client_dates dcd
        WHERE dcd.client_id = h.client_id
          AND dcd.date = h.date
      )
    GROUP BY h.client_id, h.date, h.platform, h.ad_account_id
  ),
  shopify AS (
    SELECT
      ('shopify|' || s.client_id::text || '|' || s.date::text) AS id,
      s.client_id,
      s.client_name,
      s.date,
      'shopify'::text AS platform,
      NULL::text AS ad_account_id,
      NULL::text AS data_timezone,
      0::bigint AS impressions,
      0::bigint AS clicks,
      COALESCE(s.total_orders, 0) AS conversions,
      0::numeric AS cost,
      COALESCE(s.net_revenue, 0) AS revenue,
      COALESCE(s.gross_revenue, 0) AS gross_revenue,
      COALESCE(s.refund_amount, 0) AS refund_amount
    FROM public.shopify_daily_performance s
    WHERE p_include_shopify
      AND s.client_id = ANY (p_client_ids)
      AND (p_start_date IS NULL OR s.date >= p_start_date)
      AND (p_end_date IS NULL OR s.date <= p_end_date)
  ),
  merged AS (
    SELECT * FROM daily
    UNION ALL
    SELECT * FROM hourly_gap
    UNION ALL
    SELECT * FROM shopify
  )
  SELECT *
  FROM merged
  ORDER BY date DESC, client_id, platform NULLS LAST, ad_account_id NULLS LAST
  LIMIT GREATEST(p_result_limit, 0)
  OFFSET GREATEST(p_result_offset, 0);
$$;

COMMENT ON FUNCTION public.get_merged_daily_performance IS
  'Returns daily_performance rows plus hourly rollups for client+date gaps and optional Shopify shaped rows.';

GRANT EXECUTE ON FUNCTION public.get_merged_daily_performance TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_merged_daily_performance TO service_role;

CREATE INDEX IF NOT EXISTS idx_daily_perf_client_date
  ON public.daily_performance (client_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_hourly_perf_client_date
  ON public.hourly_performance (client_id, date DESC);
