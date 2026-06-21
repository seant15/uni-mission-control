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

export type AgencyKpiSectionId = 'spend' | 'traffic' | 'shopify' | 'attribution' | 'efficiency' | 'leadgen'

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

/** Purchase journey default (ecom): spend → traffic → Shopify → ads attribution → efficiency. */
export const AGENCY_KPI_DEFAULT_ORDER: AgencyKpiCardId[] = [
  'primary_spend',
  'traffic_impressions',
  'traffic_clicks',
  'traffic_ctr_detail',
  'traffic_cpc',
  'ecom_shopify_orders',
  'ecom_shopify_real',
  'ecom_shopify_returns',
  'ecom_after_return',
  'ecom_ads_purchases',
  'ecom_ads_revenue',
  'primary_efficiency',
  'ecom_mer',
  'ecom_cpa',
  'primary_ctr',
  'primary_conversion',
  'leadgen_total_revenue',
]

/** Hidden by default — duplicate of traffic_ctr_detail for most ecom views. */
export const AGENCY_KPI_DEFAULT_HIDDEN: Partial<Record<AgencyKpiCardId, boolean>> = {
  primary_ctr: true,
}

export const AGENCY_KPI_SECTION_LABELS: Record<AgencyKpiSectionId, string> = {
  spend: 'Spend',
  traffic: 'Traffic',
  shopify: 'Shopify funnel',
  attribution: 'Ads attribution',
  efficiency: 'Efficiency',
  leadgen: 'Lead gen outcomes',
}

export const AGENCY_KPI_CARD_SECTION: Record<AgencyKpiCardId, AgencyKpiSectionId> = {
  primary_spend: 'spend',
  primary_ctr: 'traffic',
  primary_conversion: 'leadgen',
  primary_efficiency: 'efficiency',
  traffic_impressions: 'traffic',
  traffic_clicks: 'traffic',
  traffic_ctr_detail: 'traffic',
  traffic_cpc: 'traffic',
  ecom_shopify_orders: 'shopify',
  ecom_shopify_real: 'shopify',
  ecom_shopify_returns: 'shopify',
  ecom_after_return: 'shopify',
  ecom_ads_purchases: 'attribution',
  ecom_ads_revenue: 'attribution',
  ecom_mer: 'efficiency',
  ecom_cpa: 'efficiency',
  leadgen_total_revenue: 'leadgen',
}

const AGENCY_KPI_SECTION_ORDER: AgencyKpiSectionId[] = [
  'spend',
  'traffic',
  'shopify',
  'attribution',
  'efficiency',
  'leadgen',
]

export function defaultAgencyKpiLayout(): AgencyKpiLayout {
  return {
    order: [...AGENCY_KPI_DEFAULT_ORDER],
    hidden: { ...AGENCY_KPI_DEFAULT_HIDDEN },
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

/** Group visible card ids into journey sections for Overview KPI layout. */
export function groupAgencyKpiIdsBySection(
  visibleIds: AgencyKpiCardId[],
  businessType: 'leadgen' | 'ecommerce',
): { sectionId: AgencyKpiSectionId; label: string; ids: AgencyKpiCardId[] }[] {
  const bySection = new Map<AgencyKpiSectionId, AgencyKpiCardId[]>()
  for (const id of visibleIds) {
    const section = AGENCY_KPI_CARD_SECTION[id]
    if (businessType === 'leadgen' && (section === 'shopify' || section === 'attribution')) continue
    if (!bySection.has(section)) bySection.set(section, [])
    bySection.get(section)!.push(id)
  }
  return AGENCY_KPI_SECTION_ORDER.filter(sid => (bySection.get(sid)?.length ?? 0) > 0).map(sid => ({
    sectionId: sid,
    label: AGENCY_KPI_SECTION_LABELS[sid],
    ids: bySection.get(sid)!,
  }))
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
  const hidden: Partial<Record<AgencyKpiCardId, boolean>> = { ...AGENCY_KPI_DEFAULT_HIDDEN }
  if (o.hidden && typeof o.hidden === 'object') {
    for (const [k, v] of Object.entries(o.hidden)) {
      if (valid.has(k as AgencyKpiCardId) && typeof v === 'boolean') hidden[k as AgencyKpiCardId] = v
    }
  }
  return { order: order as AgencyKpiCardId[], hidden }
}
