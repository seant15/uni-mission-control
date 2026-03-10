export type AdPlatform = 'Google Ads' | 'Meta Ads' | 'TikTok Ads' | 'LinkedIn Ads' | 'Twitter Ads' | 'Other'
export type AccountStatus = 'active' | 'paused' | 'warning' | 'error'
export type TimePeriod = '7d' | '30d' | '90d' | '1yr'

export interface ClientAccount {
  id: string
  account_name: string
  account_id: string          // External account ID from ad platform
  platform: AdPlatform

  // Current metrics
  total_spend: number
  total_revenue: number
  roas: number                // Return on Ad Spend
  ctr: number                 // Click-through rate (%)
  cpc: number                 // Cost per click
  impressions: number
  clicks: number
  conversions: number

  // Campaign stats
  active_campaigns: number
  total_campaigns: number
  paused_campaigns: number

  // Account status
  status: AccountStatus
  health_score?: number       // 0-100

  // Timestamps
  last_updated: string        // ISO timestamp
  created_at: string          // ISO timestamp
}

export interface AccountMetric {
  id: string
  account_id: string
  date: string                // ISO date YYYY-MM-DD

  spend: number
  revenue: number
  roas: number
  ctr: number
  cpc: number
  impressions: number
  clicks: number
  conversions: number

  created_at: string
}

export interface ClientsOverviewSummary {
  total_accounts: number
  active_accounts: number
  total_spend: number
  total_revenue: number
  average_roas: number
  total_conversions: number
  period: TimePeriod
}
