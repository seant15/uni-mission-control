export interface MarketingMetrics {
  period: string              // e.g., "Last 7 days", "Last 30 days"

  // Spend metrics
  total_spend: number
  spend_change: number        // percentage change from previous period

  // ROAS metrics
  total_revenue: number
  roas: number
  roas_change: number         // percentage change

  // Engagement metrics
  total_impressions: number
  impressions_change: number

  total_clicks: number
  clicks_change: number

  ctr: number                 // Click-through rate (%)
  ctr_change: number

  // Conversion metrics
  total_conversions: number
  conversions_change: number

  conversion_rate: number     // percentage
  conversion_rate_change: number

  // Cost metrics
  cpc: number                 // Cost per click
  cpc_change: number

  cpa: number                 // Cost per acquisition
  cpa_change: number

  // Platform breakdown
  platform_breakdown: {
    platform: string
    spend: number
    revenue: number
    roas: number
  }[]

  updated_at: string          // ISO timestamp
}
