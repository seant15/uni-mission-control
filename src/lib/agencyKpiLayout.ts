/** KPI card identifiers for Agency View (MarketingOverview showAgencyExtras). */

export type AgencyKpiCardId =
  | 'primary_spend'
  | 'primary_ctr'
  | 'primary_conversion'
  | 'primary_efficiency'
  | 'traffic_impressions'
  | 'traffic_clicks'
  | 'traffic_ctr_detail'
  | 'traffic_cpc'
  | 'ecom_shopify_real'
  | 'ecom_shopify_returns'
  | 'ecom_after_return'
  | 'ecom_ads_revenue'
  | 'ecom_ads_purchases'
  | 'ecom_shopify_orders'
  | 'ecom_mer'
  | 'ecom_cpa'
  | 'leadgen_total_revenue'

export type AgencyKpiLayout = {
  order: AgencyKpiCardId[]
  hidden: Partial<Record<AgencyKpiCardId, boolean>>
}

export const AGENCY_KPI_CARD_LABELS: Record<AgencyKpiCardId, string> = {
  primary_spend: 'Total spend',
  primary_ctr: 'CTR',
  primary_conversion: 'Conversions (leads or purchases)',
  primary_efficiency: 'Reported revenue / spend (ecom) or CPL',
  traffic_impressions: 'Impressions',
  traffic_clicks: 'Clicks',
  traffic_ctr_detail: 'CTR (detail)',
  traffic_cpc: 'CPC',
  ecom_shopify_real: 'Shopify real sales',
  ecom_shopify_returns: 'Shopify returns',
  ecom_after_return: 'After-return sales',
  ecom_ads_revenue: 'Total revenue (ads-reported)',
  ecom_ads_purchases: 'Purchases (ads-reported)',
  ecom_shopify_orders: 'Shopify recorded orders',
  ecom_mer: 'MER (after-return Shopify ÷ spend)',
  ecom_cpa: 'CPA',
  leadgen_total_revenue: 'Total revenue (lead gen)',
}

export const AGENCY_KPI_DEFAULT_ORDER: AgencyKpiCardId[] = [
  'primary_spend',
  'primary_ctr',
  'primary_conversion',
  'primary_efficiency',
  'traffic_impressions',
  'traffic_clicks',
  'traffic_ctr_detail',
  'traffic_cpc',
  'leadgen_total_revenue',
  'ecom_shopify_real',
  'ecom_shopify_returns',
  'ecom_after_return',
  'ecom_mer',
  'ecom_ads_revenue',
  'ecom_ads_purchases',
  'ecom_shopify_orders',
  'ecom_cpa',
]

export function defaultAgencyKpiLayout(): AgencyKpiLayout {
  return {
    order: [...AGENCY_KPI_DEFAULT_ORDER],
    hidden: {},
  }
}

export function cardAppliesToBusiness(id: AgencyKpiCardId, businessType: 'leadgen' | 'ecommerce'): boolean {
  const ecomOnly: AgencyKpiCardId[] = [
    'ecom_shopify_real',
    'ecom_shopify_returns',
    'ecom_after_return',
    'ecom_ads_revenue',
    'ecom_ads_purchases',
    'ecom_shopify_orders',
    'ecom_mer',
    'ecom_cpa',
  ]
  if (id === 'primary_conversion') return businessType === 'leadgen'
  if (id === 'leadgen_total_revenue') return businessType === 'leadgen'
  if (ecomOnly.includes(id)) return businessType === 'ecommerce'
  return true
}

/** Merge saved layout with defaults (handles new card ids added in app versions). */
export function normalizeAgencyKpiLayout(raw: unknown): AgencyKpiLayout {
  const base = defaultAgencyKpiLayout()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as { order?: unknown; hidden?: unknown }
  let order = Array.isArray(o.order) ? (o.order as string[]) : []
  const valid = new Set<AgencyKpiCardId>(AGENCY_KPI_DEFAULT_ORDER)
  order = order.filter((x): x is AgencyKpiCardId => typeof x === 'string' && valid.has(x as AgencyKpiCardId))
  for (const id of AGENCY_KPI_DEFAULT_ORDER) {
    if (!order.includes(id)) order.push(id)
  }
  const hidden: Partial<Record<AgencyKpiCardId, boolean>> = {}
  if (o.hidden && typeof o.hidden === 'object') {
    for (const [k, v] of Object.entries(o.hidden)) {
      if (valid.has(k as AgencyKpiCardId) && typeof v === 'boolean') hidden[k as AgencyKpiCardId] = v
    }
  }
  return { order: order as AgencyKpiCardId[], hidden }
}
