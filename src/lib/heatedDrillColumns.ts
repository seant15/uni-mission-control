import type { BusinessType } from './businessType'
import { BUSINESS_TYPE_UI_REGISTRY } from './businessType'

export type HeatedDrillTableKind =
  | 'meta_campaign'
  | 'google_campaign'
  | 'google_keyword'
  | 'google_search_term'
  | 'meta_adset'

export type HeatedDrillColumnId =
  | 'campaign_name'
  | 'ad_set_name'
  | 'keyword'
  | 'search_term'
  | 'match_type'
  | 'spend'
  | 'clicks'
  | 'ctr'
  | 'reach'
  | 'frequency'
  | 'outbound'
  | 'video25'
  | 'impressions'
  | 'conversions'
  | 'cpa'
  | 'cpc'
  | 'revenue'
  | 'roas'

export type HeatedDrillColumnDef = {
  id: HeatedDrillColumnId
  label: string
  field: string
  align?: 'left' | 'right'
}

function labels(bt: BusinessType) {
  return BUSINESS_TYPE_UI_REGISTRY.heatedDrill[bt]
}

export function heatedDrillColumns(
  kind: HeatedDrillTableKind,
  businessType: BusinessType,
): HeatedDrillColumnDef[] {
  const L = labels(businessType)
  const conv: HeatedDrillColumnDef = {
    id: 'conversions',
    label: L.conversionLabel,
    field: 'conversions',
  }
  const cpa: HeatedDrillColumnDef = {
    id: 'cpa',
    label: L.cpaLabel,
    field: '_cpa',
  }
  const roas: HeatedDrillColumnDef = {
    id: 'roas',
    label: 'ROAS',
    field: '_roas',
  }
  const revenue: HeatedDrillColumnDef = {
    id: 'revenue',
    label: 'Revenue',
    field: 'revenue',
  }

  switch (kind) {
    case 'meta_campaign':
      return [
        { id: 'campaign_name', label: 'Campaign', field: 'campaign_name', align: 'left' },
        { id: 'spend', label: 'Spend', field: 'spend' },
        { id: 'clicks', label: 'Clicks', field: 'clicks' },
        { id: 'ctr', label: 'CTR', field: '_ctr' },
        { id: 'reach', label: 'Reach', field: 'reach' },
        { id: 'frequency', label: 'Freq', field: 'frequency' },
        { id: 'outbound', label: 'Outbound', field: 'outbound_clicks' },
        { id: 'video25', label: 'Video 25%', field: 'video_p25_watched' },
        conv,
        cpa,
        ...(L.hideRoas ? [] : [roas]),
      ]
    case 'google_campaign':
      return [
        { id: 'campaign_name', label: 'Campaign', field: 'campaign_name', align: 'left' },
        { id: 'spend', label: 'Spend', field: 'spend' },
        { id: 'clicks', label: 'Clicks', field: 'clicks' },
        { id: 'ctr', label: 'CTR', field: '_ctr' },
        conv,
        cpa,
        ...(L.hideRoas ? [] : [roas]),
      ]
    case 'google_keyword':
      return [
        { id: 'keyword', label: 'Keyword', field: 'keyword', align: 'left' },
        { id: 'campaign_name', label: 'Campaign', field: 'campaign_name', align: 'left' },
        { id: 'match_type', label: 'Match', field: 'match_type' },
        { id: 'spend', label: 'Spend', field: 'spend' },
        { id: 'clicks', label: 'Clicks', field: 'clicks' },
        { id: 'ctr', label: 'CTR', field: '_ctr' },
        conv,
        ...(businessType === 'leadgen'
          ? [cpa]
          : [{ id: 'cpc' as const, label: 'CPC', field: '_cpc' }]),
      ]
    case 'google_search_term':
      return [
        { id: 'search_term', label: 'Search Term', field: 'search_term', align: 'left' },
        { id: 'campaign_name', label: 'Campaign', field: 'campaign_name', align: 'left' },
        { id: 'match_type', label: 'Match', field: 'match_type' },
        { id: 'spend', label: 'Spend', field: 'spend' },
        { id: 'impressions', label: 'Impr.', field: 'impressions' },
        { id: 'clicks', label: 'Clicks', field: 'clicks' },
        { id: 'ctr', label: 'CTR', field: '_ctr' },
        conv,
        ...(businessType === 'leadgen'
          ? [cpa]
          : [{ id: 'cpc' as const, label: 'CPC', field: '_cpc' }]),
      ]
    case 'meta_adset':
      return [
        { id: 'ad_set_name', label: 'Ad Set', field: 'ad_set_name', align: 'left' },
        { id: 'campaign_name', label: 'Campaign', field: 'campaign_name', align: 'left' },
        { id: 'spend', label: 'Spend', field: 'spend' },
        { id: 'impressions', label: 'Impressions', field: 'impressions' },
        { id: 'clicks', label: 'Clicks', field: 'clicks' },
        conv,
        cpa,
        ...(L.hideRevenue ? [] : [revenue]),
        ...(L.hideRoas ? [] : [roas]),
      ]
    default:
      return []
  }
}

export function heatedDrillColSpan(cols: HeatedDrillColumnDef[]): number {
  return cols.length
}
