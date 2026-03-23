// ── Core enums ────────────────────────────────────────────────────────────────

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

export type AlertStatus = 'new' | 'in_progress' | 'resolved' | 'ignored' | 'snoozed' | 'dismissed'

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
  | 'creative_fatigue'
  | 'spend_spike'
  | 'spend_dead_zone'
  | 'ctr_cliff'
  | 'impression_collapse'
  | 'conversion_velocity_drop'
  | 'zero_impressions_sustained'
  | 'other'

export type AlertTemplateType =
  | 'spend_spike'
  | 'spend_dead_zone'
  | 'ctr_cliff'
  | 'impression_collapse'
  | 'conversion_velocity_drop'
  | 'zero_impressions_sustained'
  | 'zero_spend'
  | 'budget_pacing'
  | 'ctr_anomaly'
  | 'zero_conversions'
  | 'custom'

export type AlertSource = 'auto' | 'rule'

// ── Core alert record ─────────────────────────────────────────────────────────

export interface Alert {
  id: string
  // Account
  account_name: string
  account_id: string
  client_id?: string
  platform?: 'google_ads' | 'meta_ads' | 'tiktok_ads' | 'all'
  // Classification
  alert_type: AlertType
  severity: AlertSeverity
  message: string
  // Metrics
  metric_name?: string
  metric_value?: number
  metric_change?: string
  threshold?: number
  // Timing
  triggered_date?: string
  triggered_hour?: number
  detected_at: string
  // Workflow
  status: AlertStatus
  notes?: string
  resolved_at?: string
  resolved_by?: string
  resolved_by_user_id?: string
  assigned_to?: string           // UUID → app_users.id
  snoozed_until?: string         // ISO timestamp
  dismissed_at?: string
  dismissed_by?: string
  // Rule linkage
  source?: AlertSource
  rule_id?: string
  // Grouping
  group_key?: string
  dedup_key?: string
  // Timestamps
  created_at: string
  updated_at: string
}

// ── Alert note (threaded comments) ───────────────────────────────────────────

export interface AlertNote {
  id: string
  alert_id: string
  user_id: string
  content: string
  action_taken?: string           // e.g. 'resolved', 'snoozed', 'assigned'
  created_at: string
  // Joined from app_users
  user_display_name?: string
}

// ── Alert rule ────────────────────────────────────────────────────────────────

export interface AlertRule {
  id: string
  client_id?: string
  created_by?: string
  name: string
  template_type: AlertTemplateType
  platform?: 'google_ads' | 'meta_ads' | 'all'
  entity_type?: 'account' | 'campaign' | 'ad_set' | 'ad'
  entity_id?: string
  entity_name?: string
  conditions: Record<string, unknown>
  severity: AlertSeverity
  date_range_start?: string
  date_range_end?: string
  is_active: boolean
  display_order: number
  group_key_template?: string
  created_at: string
  updated_at: string
}

// ── Column preference ─────────────────────────────────────────────────────────

export interface AlertColumnDef {
  key: string
  label: string
  visible: boolean
  pinned?: boolean               // pinned columns cannot be hidden (e.g. 'actions')
}

export const DEFAULT_ALERT_COLUMNS: AlertColumnDef[] = [
  { key: 'severity',    label: 'Severity',    visible: true },
  { key: 'account',     label: 'Account',     visible: true },
  { key: 'platform',    label: 'Platform',    visible: true },
  { key: 'type',        label: 'Type',        visible: true },
  { key: 'message',     label: 'Description', visible: true },
  { key: 'detected',    label: 'Detected',    visible: true },
  { key: 'status',      label: 'Status',      visible: true },
  { key: 'assigned',    label: 'Assigned To', visible: true },
  { key: 'source',      label: 'Source',      visible: false },
  { key: 'rule',        label: 'Rule',        visible: false },
  { key: 'resolved_at', label: 'Resolved At', visible: false },
  { key: 'actions',     label: 'Actions',     visible: true,  pinned: true },
]

// ── Alert group (UI model for stacked cards) ──────────────────────────────────

export interface AlertGroup {
  group_key: string             // null/empty group_key alerts get their own group keyed by id
  representative: Alert         // highest-severity alert in the group
  all_alerts: Alert[]
  count: number
}

// ── Filter state ──────────────────────────────────────────────────────────────

export interface AlertFilterState {
  severity: AlertSeverity[]
  status: AlertStatus[]
  platform: string[]
  clientId: string[]
  search: string
  dateRange: { from: string; to: string } | null
  assignedToMe: boolean
}

export const DEFAULT_ALERT_FILTERS: AlertFilterState = {
  severity:     [],
  status:       [],
  platform:     [],
  clientId:     [],
  search:       '',
  dateRange:    null,
  assignedToMe: false,
}

// ── Summary stats ─────────────────────────────────────────────────────────────

export interface AlertCounts {
  total_open: number
  critical: number
  assigned_to_me: number
  resolved_today: number
}

// ── Legacy — kept for backward compat with existing consumers ─────────────────

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
