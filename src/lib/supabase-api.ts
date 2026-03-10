import { supabase } from './supabase'
import type { Alert, AlertSeverity, AlertStatus } from '../types/alerts'
import type { ClientAccount, TimePeriod } from '../types/clients'
import type { MarketingMetrics } from '../types/marketing'

// ============================================================================
// ALERTS API
// ============================================================================

/**
 * Fetch all alerts with optional filtering
 */
export async function fetchAlerts(options?: {
  severities?: AlertSeverity[]
  statuses?: AlertStatus[]
  accountId?: string
  limit?: number
}): Promise<Alert[]> {
  let query = supabase
    .from('alerts')
    .select('*')
    .order('detected_at', { ascending: false })

  if (options?.severities && options.severities.length > 0) {
    query = query.in('severity', options.severities)
  }

  if (options?.statuses && options.statuses.length > 0) {
    query = query.in('status', options.statuses)
  }

  if (options?.accountId) {
    query = query.eq('account_id', options.accountId)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data as Alert[]
}

/**
 * Update alert status
 */
export async function updateAlertStatus(
  alertId: string,
  status: AlertStatus,
  resolvedAt?: string
): Promise<Alert> {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'resolved' && resolvedAt) {
    updateData.resolved_at = resolvedAt
  }

  const { data, error } = await supabase
    .from('alerts')
    .update(updateData)
    .eq('id', alertId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Alert
}

/**
 * Update alert notes
 */
export async function updateAlertNotes(
  alertId: string,
  notes: string
): Promise<Alert> {
  const { data, error } = await supabase
    .from('alerts')
    .update({
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', alertId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Alert
}

/**
 * Get alert summary statistics
 */
export async function getAlertSummary(): Promise<{
  total: number
  new: number
  in_progress: number
  critical: number
  high: number
}> {
  const { data: alerts, error } = await supabase
    .from('alerts')
    .select('status, severity')

  if (error) throw new Error(error.message)

  const summary = {
    total: alerts.length,
    new: alerts.filter(a => a.status === 'new').length,
    in_progress: alerts.filter(a => a.status === 'in_progress').length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    high: alerts.filter(a => a.severity === 'high').length,
  }

  return summary
}

// ============================================================================
// CLIENTS API
// ============================================================================

/**
 * Fetch all client accounts with metrics for a specific period
 */
export async function fetchClientAccounts(
  period: TimePeriod = '30d'
): Promise<ClientAccount[]> {
  const { data, error } = await supabase
    .from('client_accounts')
    .select(`
      *,
      account_metrics!inner (
        period,
        total_spend,
        total_revenue,
        roas,
        ctr,
        cpc,
        impressions,
        clicks,
        conversions
      )
    `)
    .eq('account_metrics.period', period)

  if (error) throw new Error(error.message)

  // Flatten the data structure
  const accounts = data.map((item: any) => {
    const metrics = item.account_metrics[0] || {}
    return {
      id: item.id,
      account_name: item.account_name,
      platform: item.platform,
      status: item.status,
      health_score: item.health_score,
      active_campaigns: item.active_campaigns,
      total_campaigns: item.total_campaigns,
      created_at: item.created_at,
      last_updated: item.updated_at,
      total_spend: metrics.total_spend || 0,
      total_revenue: metrics.total_revenue || 0,
      roas: metrics.roas || 0,
      ctr: metrics.ctr || 0,
      cpc: metrics.cpc || 0,
      impressions: metrics.impressions || 0,
      clicks: metrics.clicks || 0,
      conversions: metrics.conversions || 0,
    } as ClientAccount
  })

  return accounts
}

/**
 * Fetch a single client account with detailed metrics
 */
export async function fetchClientAccount(
  accountId: string,
  period: TimePeriod = '30d'
): Promise<ClientAccount | null> {
  const { data, error } = await supabase
    .from('client_accounts')
    .select(`
      *,
      account_metrics!inner (
        period,
        total_spend,
        total_revenue,
        roas,
        ctr,
        cpc,
        impressions,
        clicks,
        conversions
      )
    `)
    .eq('id', accountId)
    .eq('account_metrics.period', period)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw new Error(error.message)
  }

  const metrics = data.account_metrics[0] || {}
  return {
    id: data.id,
    account_name: data.account_name,
    platform: data.platform,
    status: data.status,
    health_score: data.health_score,
    active_campaigns: data.active_campaigns,
    total_campaigns: data.total_campaigns,
    created_at: data.created_at,
    last_updated: data.updated_at,
    total_spend: metrics.total_spend || 0,
    total_revenue: metrics.total_revenue || 0,
    roas: metrics.roas || 0,
    ctr: metrics.ctr || 0,
    cpc: metrics.cpc || 0,
    impressions: metrics.impressions || 0,
    clicks: metrics.clicks || 0,
    conversions: metrics.conversions || 0,
  } as ClientAccount
}

/**
 * Get client overview summary statistics
 */
export async function getClientSummary(period: TimePeriod = '30d'): Promise<{
  total_accounts: number
  total_spend: number
  total_revenue: number
  average_roas: number
  total_conversions: number
}> {
  const accounts = await fetchClientAccounts(period)

  const summary = {
    total_accounts: accounts.length,
    total_spend: accounts.reduce((sum, acc) => sum + acc.total_spend, 0),
    total_revenue: accounts.reduce((sum, acc) => sum + acc.total_revenue, 0),
    average_roas: accounts.length > 0
      ? accounts.reduce((sum, acc) => sum + acc.roas, 0) / accounts.length
      : 0,
    total_conversions: accounts.reduce((sum, acc) => sum + acc.conversions, 0),
  }

  return summary
}

// ============================================================================
// MARKETING METRICS API
// ============================================================================

/**
 * Fetch marketing metrics for a specific period
 */
export async function fetchMarketingMetrics(
  period: TimePeriod = '30d'
): Promise<MarketingMetrics | null> {
  const { data, error } = await supabase
    .from('marketing_metrics')
    .select('*')
    .eq('period', period)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw new Error(error.message)
  }

  return data as MarketingMetrics
}

/**
 * Calculate marketing metrics from account data (fallback if no pre-aggregated data)
 */
export async function calculateMarketingMetrics(
  period: TimePeriod = '30d'
): Promise<MarketingMetrics> {
  const accounts = await fetchClientAccounts(period)

  const total_spend = accounts.reduce((sum, acc) => sum + acc.total_spend, 0)
  const total_revenue = accounts.reduce((sum, acc) => sum + acc.total_revenue, 0)
  const total_impressions = accounts.reduce((sum, acc) => sum + acc.impressions, 0)
  const total_clicks = accounts.reduce((sum, acc) => sum + acc.clicks, 0)
  const total_conversions = accounts.reduce((sum, acc) => sum + acc.conversions, 0)

  const roas = total_spend > 0 ? total_revenue / total_spend : 0
  const ctr = total_impressions > 0 ? (total_clicks / total_impressions) * 100 : 0
  const cpc = total_clicks > 0 ? total_spend / total_clicks : 0
  const cpa = total_conversions > 0 ? total_spend / total_conversions : 0
  const conversion_rate = total_clicks > 0 ? (total_conversions / total_clicks) * 100 : 0

  // Group by platform
  const platformGroups = accounts.reduce((groups: any, acc) => {
    const platform = acc.platform
    if (!groups[platform]) {
      groups[platform] = {
        platform,
        spend: 0,
        revenue: 0,
        roas: 0,
      }
    }
    groups[platform].spend += acc.total_spend
    groups[platform].revenue += acc.total_revenue
    return groups
  }, {})

  // Calculate ROAS for each platform
  const platform_breakdown = Object.values(platformGroups).map((group: any) => ({
    ...group,
    roas: group.spend > 0 ? group.revenue / group.spend : 0,
  }))

  return {
    period,
    total_spend,
    spend_change: 0, // Would need historical data
    total_revenue,
    roas,
    roas_change: 0, // Would need historical data
    total_impressions,
    impressions_change: 0,
    total_clicks,
    clicks_change: 0,
    ctr,
    ctr_change: 0,
    total_conversions,
    conversions_change: 0,
    conversion_rate,
    conversion_rate_change: 0,
    cpc,
    cpc_change: 0,
    cpa,
    cpa_change: 0,
    platform_breakdown,
    updated_at: new Date().toISOString(),
  }
}

// ============================================================================
// REALTIME SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to real-time alert updates
 */
export function subscribeToAlerts(
  callback: (alert: Alert) => void,
  options?: { accountId?: string }
) {
  const channel = supabase
    .channel('alerts_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'alerts',
        filter: options?.accountId ? `account_id=eq.${options.accountId}` : undefined,
      },
      (payload) => {
        callback(payload.new as Alert)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to real-time client account updates
 */
export function subscribeToClientAccounts(
  callback: (account: any) => void
) {
  const channel = supabase
    .channel('client_accounts_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'client_accounts',
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
