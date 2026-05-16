const AD_PLATFORMS = new Set(['meta_ads', 'google_ads'])

/** Paid ads only — excludes Shopify store rows from attribution charts. */
export function isAdsPlatform(platform?: string | null): boolean {
  const p = (platform || '').toLowerCase()
  return AD_PLATFORMS.has(p)
}

export function filterAdsDailyRows<T extends { platform?: string | null }>(rows: T[]): T[] {
  return rows.filter(r => isAdsPlatform(r.platform))
}
