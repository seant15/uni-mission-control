/** When Heated View may show MER (Shopify after-return ÷ paid ads spend). */

export type HeatedMerClient = {
  meta_ad_account_id?: string | null
  google_ads_customer_id?: string | null
}

export function clientConfiguredAdPlatforms(client: HeatedMerClient | undefined): ('meta_ads' | 'google_ads')[] {
  if (!client) return []
  const platforms: ('meta_ads' | 'google_ads')[] = []
  if ((client.meta_ad_account_id || '').trim()) platforms.push('meta_ads')
  if ((client.google_ads_customer_id || '').trim()) platforms.push('google_ads')
  return platforms
}

/**
 * MER needs blended paid spend vs Shopify store revenue.
 * - Hide when page filters to one platform but the client runs both Meta and Google.
 * - Show for platform=All, or when the client only has one ads platform (even if filtered to it).
 */
export function shouldShowHeatedMer(opts: {
  embedded: boolean
  businessType: 'leadgen' | 'ecommerce'
  selectedPlatform: string
  selectedClient: string
  client: HeatedMerClient | undefined
}): boolean {
  if (!opts.embedded || opts.businessType !== 'ecommerce') return false

  const platformFilter = opts.selectedPlatform === 'all' ? 'all' : opts.selectedPlatform

  if (opts.selectedClient === 'all') {
    return platformFilter === 'all'
  }

  const configured = clientConfiguredAdPlatforms(opts.client)

  if (platformFilter === 'all') {
    return configured.length > 0
  }

  if (configured.length >= 2) return false

  return configured.length === 1 && configured[0] === platformFilter
}

/** Net sales for one shaped Shopify daily row (`getShopifyDailyPerformance`). */
export function shopifyAfterReturnForShapedRow(row: {
  revenue?: number | null
  gross_revenue?: number | null
  refund_amount?: number | null
}): number {
  const net = Number(row.revenue) || 0
  const gross = Number(row.gross_revenue) || 0
  let refund = Number(row.refund_amount) || 0
  if (refund <= 0 && gross > net) refund = gross - net
  return net > 0 ? net : Math.max(0, (gross || net) - refund)
}
