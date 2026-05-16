const AD_PLATFORMS = new Set(['meta_ads', 'google_ads'])

/** Paid ads only — excludes Shopify store rows from attribution charts. */
export function isAdsPlatform(platform?: string | null): boolean {
  const p = (platform || '').toLowerCase()
  return AD_PLATFORMS.has(p)
}

export function filterAdsDailyRows<T extends { platform?: string | null }>(rows: T[]): T[] {
  return rows.filter(r => isAdsPlatform(r.platform))
}

export type AdsMetricTotals = {
  cost: number
  revenue: number
  conversions: number
  impressions: number
  clicks: number
}

export function sumAdsMetrics(rows: Array<{
  platform?: string | null
  cost?: number | null
  revenue?: number | null
  conversions?: number | null
  impressions?: number | null
  clicks?: number | null
}>): AdsMetricTotals {
  const ads = filterAdsDailyRows(rows)
  return ads.reduce<AdsMetricTotals>(
    (acc, r) => ({
      cost: acc.cost + (Number(r.cost) || 0),
      revenue: acc.revenue + (Number(r.revenue) || 0),
      conversions: acc.conversions + (Number(r.conversions) || 0),
      impressions: acc.impressions + (Number(r.impressions) || 0),
      clicks: acc.clicks + (Number(r.clicks) || 0),
    }),
    { cost: 0, revenue: 0, conversions: 0, impressions: 0, clicks: 0 },
  )
}
