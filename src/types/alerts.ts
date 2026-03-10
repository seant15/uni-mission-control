export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'
export type AlertStatus = 'new' | 'in_progress' | 'resolved' | 'ignored'
export type AlertType =
  | 'performance_drop'
  | 'budget_alert'
  | 'ctr_decline'
  | 'conversion_drop'
  | 'cpc_spike'
  | 'quality_score_drop'
  | 'other'

export interface Alert {
  id: string
  account_name: string
  account_id: string
  alert_type: AlertType
  severity: AlertSeverity
  message: string
  metric_name?: string        // e.g., "CTR", "ROAS", "CPC"
  metric_change?: string      // e.g., "-15%", "+$50"
  detected_at: string         // ISO timestamp
  status: AlertStatus
  notes?: string
  resolved_at?: string        // ISO timestamp
  resolved_by?: string
  created_at: string          // ISO timestamp
  updated_at: string          // ISO timestamp
}

export interface AlertFilters {
  severity?: AlertSeverity[]
  status?: AlertStatus[]
  account?: string[]
  type?: AlertType[]
  dateRange?: {
    from: string
    to: string
  }
}
