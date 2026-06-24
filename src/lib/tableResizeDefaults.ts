/** Default column widths (px) for resizable tables — persisted per table via useResizableColumns. */

export const ALERT_COL_WIDTHS: Record<string, number> = {
  bulk: 40,
  severity: 92,
  account: 220,
  platform: 100,
  type: 128,
  message: 320,
  detected: 108,
  status: 116,
  assigned: 108,
  source: 100,
  rule: 140,
  resolved_at: 120,
  actions: 96,
}

export const OVERVIEW_PLATFORM_COL_WIDTHS: Record<string, number> = {
  platform: 120,
  spend: 100,
  target: 120,
  revenue: 100,
  roas: 88,
  conversions: 100,
  cpa: 88,
  share: 80,
}

export const AGENCY_BY_ACCOUNT_COL_WIDTHS: Record<string, number> = {
  account_name: 148,
  platform: 96,
  total_spend: 96,
  total_revenue: 96,
  roas: 72,
  conversions: 72,
  ctr: 64,
  currency: 56,
}

export const CREATIVE_COL_WIDTHS: Record<string, number> = {
  visual: 72,
  ad_name: 240,
  spend: 96,
  impressions: 104,
  clicks: 88,
  ctr: 72,
  conversions: 96,
  revenue: 96,
  roas: 72,
  cpa: 80,
}

export const HEATED_DAILY_DRILL_COL_WIDTHS: Record<string, number> = {
  date: 112,
  platform: 94,
  spend: 78,
  revenue: 84,
  conv: 64,
}

export const HEATED_META_CAMPAIGN_COL_WIDTHS: Record<string, number> = {
  campaign_name: 200,
  spend: 100,
  clicks: 88,
  ctr: 80,
  reach: 88,
  frequency: 72,
  outbound: 96,
  video25: 96,
  conv: 88,
  cpa: 96,
  roas: 88,
}

export const HEATED_GOOGLE_CAMPAIGN_COL_WIDTHS: Record<string, number> = {
  campaign_name: 200,
  spend: 100,
  clicks: 88,
  ctr: 80,
  conv: 88,
  cpa: 96,
  roas: 88,
}

export const HEATED_KEYWORDS_COL_WIDTHS: Record<string, number> = {
  keyword: 180,
  campaign: 160,
  ad_group: 140,
  match: 88,
  spend: 100,
  clicks: 88,
  ctr: 72,
  conv: 88,
  cpc: 88,
}

export const HEATED_SEARCH_TERMS_COL_WIDTHS: Record<string, number> = {
  search_term: 200,
  campaign: 160,
  match: 88,
  spend: 100,
  impressions: 96,
  clicks: 88,
  ctr: 72,
  cpc: 88,
  conv: 88,
}

export const RT_CLIENT_COMPARE_COL_WIDTHS: Record<string, number> = {
  account: 132,
  platform: 92,
  client: 120,
  spend: 84,
  spendVs: 72,
  conv: 72,
  convVs: 72,
  roas: 72,
  roasVs: 72,
}

export const META_ADSET_COL_WIDTHS: Record<string, number> = {
  expand: 32,
  ad_set: 200,
  campaign: 160,
  spend: 96,
  impressions: 104,
  clicks: 88,
  conv: 88,
  revenue: 96,
  roas: 80,
}

export const CLIENT_SPEND_TARGETS_COL_WIDTHS: Record<string, number> = {
  client: 200,
  meta: 140,
  google: 140,
  actions: 96,
}
