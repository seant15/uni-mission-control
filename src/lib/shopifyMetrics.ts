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

/** Roll up rows from `shopify_daily_performance` (or shaped rows with gross/net/refund). */
export function rollupShopifyDaily(rows: Row[]): Omit<ShopifyRollup, 'adsReported' | 'adsPctOfShopify' | 'adsPctOfAfterReturn'> {
  let shopifyReal = 0
  let shopifyReturns = 0
  let shopifyAfterReturn = 0

  for (const r of rows) {
    const net = Number(r.revenue) || 0
    const gross = Number(r.gross_revenue) || 0
    let refund = Number(r.refund_amount) || 0
    if (refund <= 0 && gross > net) refund = gross - net
    shopifyReal += gross > 0 ? gross : net + refund
    shopifyReturns += refund
    shopifyAfterReturn += net > 0 ? net : Math.max(0, (gross || net) - refund)
  }

  return { shopifyReal, shopifyReturns, shopifyAfterReturn }
}

export function splitShopifyAndAdsRevenue(rows: Row[]): ShopifyRollup {
  let shopifyReal = 0
  let shopifyReturns = 0
  let shopifyAfterReturn = 0
  let adsReported = 0

  for (const r of rows) {
    const p = (r.platform || '').toLowerCase()
    if (p === 'shopify' || (!p && (r.gross_revenue != null || r.refund_amount != null))) {
      const net = Number(r.revenue) || 0
      let refund = Number(r.refund_amount) || 0
      const gross = Number(r.gross_revenue) || 0
      if (refund <= 0 && gross > net) refund = gross - net
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

type ConversionRow = Row & { conversions?: number | null }

/** Purchases / conversions reported by Meta + Google (excludes Shopify order rows). */
export function adsReportedConversionsFromRows(rows: ConversionRow[]): number {
  let ads = 0
  for (const r of rows) {
    const p = (r.platform || '').toLowerCase()
    if (p === 'meta_ads' || p === 'google_ads') {
      ads += Number(r.conversions) || 0
    }
  }
  return ads
}

/** Shopify order count from `getShopifyDailyPerformance` rows (`conversions` holds `total_orders`). */
export function rollupShopifyOrdersFromShapedRows(rows: { conversions?: number | null }[]): number {
  return rows.reduce((s, r) => s + (Number(r.conversions) || 0), 0)
}

export function adsPurchasesPctOfShopify(adsPurchases: number, shopifyOrders: number): number | null {
  return shopifyOrders > 0 ? (adsPurchases / shopifyOrders) * 100 : null
}
