export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'
export type AlertStatus = 'new' | 'in_progress' | 'resolved' | 'ignored'
export type AlertType =
  | 'performance_drop'
  | 'budget_alert'
  | 'ctr_decline'
  | 'conversion_drop'
  | 'cpc_spike'
  | 'quality_score_drop'
  | 'zero_spend'
  | 'over_pacing'
  | 'under_pacing'
  | 'other'

export interface Alert {
  id: string
  account_name: string
  account_id: string
  client_id?: string
  platform?: 'google_ads' | 'meta_ads' | 'tiktok_ads' | 'all'
  alert_type: AlertType
  severity: AlertSeverity
  message: string
  metric_name?: string        // e.g., "CTR", "ROAS", "CPA", "Cost Pacing"
  metric_value?: number       // actual numeric value
  metric_change?: string      // e.g., "-15%", "+$50"
  threshold?: number          // the threshold that was breached
  triggered_date?: string     // ISO date that triggered the alert
  triggered_hour?: number     // 0-23 for hourly alerts
  detected_at: string         // ISO timestamp
  status: AlertStatus
  notes?: string
  resolved_at?: string
  resolved_by?: string
  dedup_key?: string          // internal deduplication key
  created_at: string
  updated_at: string
}

export interface AlertFilters {
  severity?: AlertSeverity[]
  status?: AlertStatus[]
  account?: string[]
  type?: AlertType[]
  platform?: string[]
  dateRange?: {
    from: string
    to: string
  }
}
