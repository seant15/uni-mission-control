/** Split daily rows into Shopify store truth vs ad-platform reported revenue. */

export type ShopifyRollup = {
  shopifyReal: number
  shopifyReturns: number
  shopifyAfterReturn: number
  adsReported: number
  adsPctOfShopify: number | null
  adsPctOfAfterReturn: number | null
}

type Row = {
  platform?: string | null
  revenue?: number | null
  refund_amount?: number | null
  gross_revenue?: number | null
}

export function splitShopifyAndAdsRevenue(rows: Row[]): ShopifyRollup {
  let shopifyReal = 0
  let shopifyReturns = 0
  let shopifyAfterReturn = 0
  let adsReported = 0

  for (const r of rows) {
    const p = (r.platform || '').toLowerCase()
    if (p === 'shopify') {
      const net = Number(r.revenue) || 0
      const refund = Number(r.refund_amount) || 0
      const gross = Number(r.gross_revenue) || 0
      shopifyReal += gross > 0 ? gross : net + refund
      shopifyReturns += refund
      shopifyAfterReturn += net > 0 ? net : Math.max(0, (gross || net) - refund)
    } else if (p === 'meta_ads' || p === 'google_ads') {
      adsReported += Number(r.revenue) || 0
    }
  }

  const adsPctOfShopify = shopifyReal > 0 ? (adsReported / shopifyReal) * 100 : null
  const adsPctOfAfterReturn = shopifyAfterReturn > 0 ? (adsReported / shopifyAfterReturn) * 100 : null

  return {
    shopifyReal,
    shopifyReturns,
    shopifyAfterReturn,
    adsReported,
    adsPctOfShopify,
    adsPctOfAfterReturn,
  }
}

/** Ads-only revenue from mixed daily rows (excludes Shopify). */
export function adsReportedRevenueFromRows(rows: Row[]): number {
  return splitShopifyAndAdsRevenue(rows).adsReported
}
