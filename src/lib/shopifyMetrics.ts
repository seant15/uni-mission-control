/** Split daily rows into Shopify store truth vs ad-platform reported revenue. */

export function splitShopifyAndAdsRevenue(rows: Array<{ platform?: string | null; revenue?: number | null }>) {
  let shopifyReal = 0
  let adsReported = 0
  for (const r of rows) {
    const rev = Number(r.revenue) || 0
    const p = (r.platform || '').toLowerCase()
    if (p === 'shopify') shopifyReal += rev
    else if (p === 'meta_ads' || p === 'google_ads') adsReported += rev
  }
  const adsPctOfShopify = shopifyReal > 0 ? (adsReported / shopifyReal) * 100 : null
  return { shopifyReal, adsReported, adsPctOfShopify }
}
