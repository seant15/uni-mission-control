import { supabase } from './supabase'
import type { AgentTask, AgentHealth } from '../types'
import type {
  FeedbackRow,
  FeedbackInsert,
  FeedbackUpdate,
  FeedbackFilters,
  AttachmentMeta,
} from '../types/feedback'
import type {
  Alert,
  AlertNote,
  AlertRule,
  AlertColumnDef,
  AlertCounts,
  AlertFilterState,
} from '../types/alerts'
import { mockTasks } from './mock-data'

const USE_MOCK_DATA = (import.meta as any).env.VITE_USE_MOCK_DATA === 'true'

export type HourWindow = 1 | 2 | 6 | 12 | 24 | 48 | 72

/**
 * Interface for daily performance filters
 */
export interface PerformanceFilters {
    clientId?: string
    platform?: string
    adAccountId?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
}

/**
 * Optimized database service
 */
export const db = {
    /**
     * Fetch daily performance with server-side filtering and specific columns
     */
    async getDailyPerformance(filters: PerformanceFilters) {
        let query = supabase
            .from('daily_performance')
            .select('id, client_id, client_name, date, platform, ad_account_id, impressions, clicks, conversions, cost, revenue')

        if (filters.clientId && filters.clientId !== 'all') {
            query = query.eq('client_id', filters.clientId)
        }

        if (filters.platform && filters.platform !== 'all') {
            query = query.eq('platform', filters.platform)
        }

        if (filters.adAccountId) {
            query = query.eq('ad_account_id', filters.adAccountId)
        }

        if (filters.startDate) {
            query = query.gte('date', filters.startDate)
        }

        if (filters.endDate) {
            query = query.lte('date', filters.endDate)
        }

        query = query
            .order('date', { ascending: false })
            .limit(filters.limit || 5000)

        if (filters.offset) {
            query = query.range(filters.offset, filters.offset + (filters.limit || 1000) - 1)
        }

        const { data, error } = await query
        if (error) throw error
        return data
    },

    /**
     * Fetch all clients (lightweight)
     */
    async getClients() {
        const { data, error } = await supabase
            .from('clients')
            .select('id, name, business_type, currency, currency_symbol, meta_ad_account_id, google_ads_customer_id')
            .order('name')
        if (error) throw error
        return data
    },

    /**
     * Fetch lightweight stats for the dashboard
     */
    async getDashboardStats() {
        const [agentsRes, tasksRes] = await Promise.all([
            supabase.from('agent_health').select('agent_name, consecutive_failures'),
            supabase.from('agent_tasks').select('status, to_agent')
        ])

        if (agentsRes.error) throw agentsRes.error
        if (tasksRes.error) throw tasksRes.error

        return {
            agents: agentsRes.data as Pick<AgentHealth, 'agent_name' | 'consecutive_failures'>[],
            tasks: tasksRes.data as Pick<AgentTask, 'status' | 'to_agent'>[]
        }
    },

    /**
     * Fetch tasks for Mission Control with filtering
     */
    async getTasks(status?: string) {
        if (USE_MOCK_DATA) {
            await new Promise(resolve => setTimeout(resolve, 300))
            return mockTasks.filter(task =>
                !status || status === 'all' || task.status === status
            )
        }

        let query = supabase
            .from('agent_tasks')
            .select('*')

        if (status && status !== 'all') {
            query = query.eq('status', status)
        }

        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) throw error
        return data
    },

    /**
     * Fetch Meta ad creatives with client and date filtering
     * Includes creative fields: image_url, thumbnail_url, headline, primary_copy, description, call_to_action_type
     */
    async getMetaCreatives(clientId?: string, startDate?: string, endDate?: string) {
        let query = supabase
            .from('meta_ads_ads')
            .select('id, client_id, date, campaign_id, campaign_name, ad_set_id, ad_set_name, ad_id, ad_name, spend, impressions, clicks, conversions, revenue, image_url, thumbnail_url, video_id, headline, primary_copy, description, call_to_action_type, destination_url, instagram_permalink_url, facebook_post_url')
            .order('spend', { ascending: false })
            .limit(2000)

        if (clientId && clientId !== 'all') {
            query = query.eq('client_id', clientId)
        }
        if (startDate) query = query.gte('date', startDate)
        if (endDate) query = query.lte('date', endDate)

        const { data, error } = await query
        if (error) throw error
        return data
    },

    /**
     * Fetch Google keywords with client and date filtering
     */
    async getGoogleKeywords(clientId?: string, startDate?: string, endDate?: string) {
        let query = supabase
            .from('google_ads_keywords')
            .select('id, client_id, customer_id, date, campaign_id, campaign_name, ad_group_id, ad_group_name, keyword_id, keyword, match_type, status, impressions, clicks, spend, conversions, ctr, cpc')
            .order('spend', { ascending: false })
            .limit(500)

        if (clientId && clientId !== 'all') {
            query = query.eq('client_id', clientId)
        }
        if (startDate) query = query.gte('date', startDate)
        if (endDate) query = query.lte('date', endDate)

        const { data, error } = await query
        if (error) throw error

        return data?.map(item => ({
            ...item,
            spend: item.spend || 0
        }))
    },

    /**
     * Fetch Google search terms with client and date filtering
     */
    async getGoogleSearchTerms(clientId?: string, startDate?: string, endDate?: string) {
        let query = supabase
            .from('google_ads_search_terms')
            // Note: campaign_name and ad_group_name are stored since sync fix; older rows may be null
            .select('id, client_id, customer_id, date, campaign_id, campaign_name, ad_group_id, ad_group_name, search_term, match_type, impressions, clicks, spend, ctr, cpc, conversions, cost_per_conversion')
            .order('spend', { ascending: false })
            .limit(500)

        if (clientId && clientId !== 'all') {
            query = query.eq('client_id', clientId)
        }
        if (startDate) query = query.gte('date', startDate)
        if (endDate) query = query.lte('date', endDate)

        const { data, error } = await query
        if (error) throw error

        return data?.map(item => ({
            ...item,
            spend: item.spend || 0
        }))
    },

    /**
     * Fetch available platforms from database
     */
    async getAvailablePlatforms() {
        const { data, error } = await supabase
            .from('daily_performance')
            .select('platform')

        if (error) throw error

        const platforms = [...new Set(data?.map(item => item.platform).filter(Boolean))]

        return platforms.map(platform => ({
            id: platform,
            label: platform === 'meta_ads' ? 'Meta Ads' :
                   platform === 'google_ads' ? 'Google Ads' :
                   platform === 'tiktok_ads' ? 'TikTok Ads' :
                   platform === 'shopify' ? 'Shopify' : platform
        }))
    },

    /**
     * Fetch available ad accounts filtered by client and/or platform
     * Returns client_id so callers can look up business_type
     */
    async getAdAccounts(filters: { clientId?: string; platform?: string }) {
        let query = supabase
            .from('daily_performance')
            .select('ad_account_id, platform, client_id')

        if (filters.clientId && filters.clientId !== 'all') {
            query = query.eq('client_id', filters.clientId)
        }

        if (filters.platform && filters.platform !== 'all') {
            query = query.eq('platform', filters.platform)
        }

        const { data, error } = await query
        if (error) throw error

        const accountMap = new Map<string, { platform: string; client_id: string }>()
        data?.forEach(item => {
            if (item.ad_account_id && !accountMap.has(item.ad_account_id)) {
                accountMap.set(item.ad_account_id, {
                    platform: item.platform,
                    client_id: item.client_id,
                })
            }
        })

        return Array.from(accountMap.entries()).map(([account, info]) => ({
            id: account,
            label: `${account} | ${info.platform}`,
            client_id: info.client_id,
        }))
    },

    /**
     * Fetch Meta adsets with filtering
     */
    async getMetaAdsets(filters: { clientId?: string; adAccountId?: string; startDate?: string; endDate?: string }) {
        let query = supabase
            .from('meta_ads_ad_sets')
            .select('id, client_id, date, ad_account_id, campaign_id, campaign_name, ad_set_id, ad_set_name, spend, impressions, clicks, conversions, revenue')
            .order('spend', { ascending: false })
            .limit(500)

        if (filters.clientId && filters.clientId !== 'all') {
            query = query.eq('client_id', filters.clientId)
        }

        if (filters.adAccountId) {
            query = query.eq('ad_account_id', filters.adAccountId)
        }

        if (filters.startDate) {
            query = query.gte('date', filters.startDate)
        }

        if (filters.endDate) {
            query = query.lte('date', filters.endDate)
        }

        const { data, error } = await query
        if (error) throw error
        return data
    },

    /**
     * Fetch Meta campaigns with filtering
     */
    async getMetaCampaigns(filters: { clientId?: string; adAccountId?: string; startDate?: string; endDate?: string }) {
        let query = supabase
            .from('meta_ads')
            .select('id, client_id, date, campaign_id, campaign_name, spend, impressions, clicks, conversions, revenue')
            .order('spend', { ascending: false })
            .limit(500)

        if (filters.clientId && filters.clientId !== 'all') {
            query = query.eq('client_id', filters.clientId)
        }
        if (filters.startDate) {
            query = query.gte('date', filters.startDate)
        }
        if (filters.endDate) {
            query = query.lte('date', filters.endDate)
        }

        const { data, error } = await query
        if (error) throw error
        return data
    },

    /**
     * Fetch Google campaigns with filtering
     */
    async getGoogleCampaigns(filters: { clientId?: string; adAccountId?: string; startDate?: string; endDate?: string }) {
        let query = supabase
            .from('google_ads')
            .select('id, client_id, date, campaign_id, campaign_name, spend, impressions, clicks, conversions, revenue')
            .order('spend', { ascending: false })
            .limit(500)

        if (filters.clientId && filters.clientId !== 'all') {
            query = query.eq('client_id', filters.clientId)
        }
        if (filters.startDate) {
            query = query.gte('date', filters.startDate)
        }
        if (filters.endDate) {
            query = query.lte('date', filters.endDate)
        }

        const { data, error } = await query
        if (error) throw error
        return data
    },

    /**
     * Fetch Meta ads with filtering
     */
    async getMetaAds(filters: { clientId?: string; adAccountId?: string; startDate?: string; endDate?: string }) {
        let query = supabase
            .from('meta_ads_ads')
            .select('id, client_id, date, ad_account_id, campaign_name, ad_set_name, ad_name, spend, conversions, revenue')
            .order('date', { ascending: false })
            .limit(500)

        if (filters.clientId && filters.clientId !== 'all') {
            query = query.eq('client_id', filters.clientId)
        }

        if (filters.adAccountId) {
            query = query.eq('ad_account_id', filters.adAccountId)
        }

        if (filters.startDate) {
            query = query.gte('date', filters.startDate)
        }

        if (filters.endDate) {
            query = query.lte('date', filters.endDate)
        }

        const { data, error } = await query
        if (error) throw error
        return data
    },

    /**
     * Alert summary for UNI Overview page
     */
    async getAlertSummary() {
        const { data, error } = await supabase
            .from('alerts')
            .select('id, severity, status, account_name, message, alert_type, created_at')
            .order('created_at', { ascending: false })
            .limit(100)

        if (error) throw error
        return data
    },

    /**
     * Client spend grouped by client for UNI Overview
     */
    async getClientSpendSummary(filters: { startDate?: string; endDate?: string }) {
        let query = supabase
            .from('daily_performance')
            .select('client_id, client_name, cost')

        if (filters.startDate) query = query.gte('date', filters.startDate)
        if (filters.endDate) query = query.lte('date', filters.endDate)

        const { data, error } = await query
        if (error) throw error

        const map = new Map<string, { client_id: string; client_name: string; spend: number }>()
        data?.forEach(row => {
            const existing = map.get(row.client_id)
            if (existing) {
                existing.spend += Number(row.cost) || 0
            } else {
                map.set(row.client_id, {
                    client_id: row.client_id,
                    client_name: row.client_name || row.client_id,
                    spend: Number(row.cost) || 0,
                })
            }
        })
        return Array.from(map.values()).sort((a, b) => b.spend - a.spend)
    },

    /**
     * Hourly performance for Real-time Performance page
     * Returns current window rows and previous window rows for comparison
     */
    async getHourlyPerformance(filters: { windowHours: HourWindow; clientId?: string }) {
        // hourly_performance table uses date (DATE) + hour (INT 0-23), not a timestamp column
        const now = new Date()
        const windowStart = new Date(now.getTime() - filters.windowHours * 60 * 60 * 1000)
        const prevWindowStart = new Date(windowStart.getTime() - filters.windowHours * 60 * 60 * 1000)

        // Build date+hour pairs for current window
        const toDateHour = (d: Date) => ({
            date: d.toISOString().split('T')[0],
            hour: d.getUTCHours(),
        })

        const curWindowStartDH = toDateHour(windowStart)
        const curWindowEndDH = toDateHour(now)
        const prevWindowStartDH = toDateHour(prevWindowStart)
        const prevWindowEndDH = toDateHour(windowStart)

        const cols = 'id, client_id, client_name, ad_account_id, platform, date, hour, impressions, clicks, conversions, cost, revenue'

        // Filter: date >= windowStart.date AND (date > windowStart.date OR hour >= windowStart.hour)
        // Simplified: fetch by date range and filter in JS for hour boundaries
        let curQ = supabase.from('hourly_performance').select(cols)
            .gte('date', curWindowStartDH.date)
            .lte('date', curWindowEndDH.date)
            .order('date', { ascending: false })
            .order('hour', { ascending: false })

        let prevQ = supabase.from('hourly_performance').select(cols)
            .gte('date', prevWindowStartDH.date)
            .lte('date', prevWindowEndDH.date)
            .order('date', { ascending: false })
            .order('hour', { ascending: false })

        if (filters.clientId && filters.clientId !== 'all') {
            curQ = curQ.eq('client_id', filters.clientId)
            prevQ = prevQ.eq('client_id', filters.clientId)
        }

        const [curRes, prevRes] = await Promise.all([curQ, prevQ])
        if (curRes.error) throw curRes.error
        if (prevRes.error) throw prevRes.error

        // Filter rows precisely by date+hour boundaries
        const inWindow = (row: any, startDH: { date: string; hour: number }, endDH: { date: string; hour: number }) => {
            if (row.date < startDH.date || row.date > endDH.date) return false
            if (row.date === startDH.date && row.hour < startDH.hour) return false
            if (row.date === endDH.date && row.hour > endDH.hour) return false
            return true
        }

        const currentRows = (curRes.data || []).filter(r => inWindow(r, curWindowStartDH, curWindowEndDH))
        const previousRows = (prevRes.data || []).filter(r => inWindow(r, prevWindowStartDH, prevWindowEndDH))

        return {
            current: currentRows,
            previous: previousRows,
            windowStart: windowStart.toISOString(),
            windowEnd: now.toISOString(),
            prevWindowStart: prevWindowStart.toISOString(),
            prevWindowEnd: windowStart.toISOString(),
        }
    },

    /**
     * Recent alerts within last N hours for Real-time page
     */
    async getRecentAlerts(hoursBack: number) {
        const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()
        const { data, error } = await supabase
            .from('alerts')
            .select('id, severity, status, account_name, platform, message, alert_type, metric_name, metric_value, metric_change, threshold, triggered_date, triggered_hour, created_at')
            .gte('created_at', cutoff)
            .order('created_at', { ascending: false })

        if (error) throw error
        return data
    },

    /**
     * Today's alerts (triggered_date = today) for Real-time Performance page
     */
    async getTodayAlerts() {
        const today = new Date().toISOString().split('T')[0]
        const { data, error } = await supabase
            .from('alerts')
            .select('id, severity, status, account_name, platform, message, alert_type, metric_name, metric_value, metric_change, threshold, triggered_date, triggered_hour, created_at')
            .eq('triggered_date', today)
            .not('status', 'eq', 'ignored')
            .order('severity', { ascending: true })
            .order('created_at', { ascending: false })

        if (error) throw error
        return data
    },

    /**
     * Get dashboard settings for a user
     */
    async getSettings(userId: string) {
        const { data, error } = await supabase
            .from('dashboard_settings')
            .select('*')
            .eq('user_id', userId)
            .single()

        if (error && error.code !== 'PGRST116') throw error
        return data
    },

    /**
     * Save dashboard settings for a user
     */
    async saveSettings(userId: string, settings: any) {
        const { error } = await supabase
            .from('dashboard_settings')
            .upsert({
                user_id: userId,
                ...settings,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })

        if (error) throw error
        return true
    },

    // ============================================================
    // Feedback System
    // ============================================================

    /**
     * Insert a new feedback row. Returns the new row id.
     */
    async submitFeedback(payload: FeedbackInsert): Promise<{ id: string }> {
        const { data, error } = await supabase
            .from('feedback')
            .insert(payload)
            .select('id')
            .single()
        if (error) throw error
        return data
    },

    /**
     * User-override of AI-assigned category after submission.
     */
    async updateFeedbackCategory(id: string, category: FeedbackRow['category']): Promise<void> {
        const { error } = await supabase
            .from('feedback')
            .update({ category, category_confidence: null })
            .eq('id', id)
        if (error) throw error
    },

    /**
     * Upload a file attachment to Supabase Storage.
     * Path: feedback-attachments/{feedbackId}/{filename}
     * Returns the AttachmentMeta object to be stored in the feedback row.
     */
    async uploadFeedbackAttachment(feedbackId: string, file: File): Promise<AttachmentMeta> {
        const path = `${feedbackId}/${file.name}`
        const { error } = await supabase.storage
            .from('feedback-attachments')
            .upload(path, file, { upsert: false })
        if (error) throw error
        return {
            url: path,
            name: file.name,
            type: file.type,
            size_bytes: file.size,
        }
    },

    /**
     * Delete a file from Supabase Storage.
     * Call this when a user closes the widget without submitting.
     */
    async deleteFeedbackAttachment(path: string): Promise<void> {
        const { error } = await supabase.storage
            .from('feedback-attachments')
            .remove([path])
        if (error) throw error
    },

    /**
     * Generate a signed URL for a stored attachment (TTL 3600s).
     */
    async getFeedbackAttachmentUrl(path: string): Promise<string> {
        const { data, error } = await supabase.storage
            .from('feedback-attachments')
            .createSignedUrl(path, 3600)
        if (error) throw error
        return data.signedUrl
    },

    /**
     * [Admin] Fetch all feedback with optional filters.
     */
    async getFeedback(filters?: FeedbackFilters): Promise<FeedbackRow[]> {
        let query = supabase
            .from('feedback')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500)

        if (filters?.status && filters.status.length > 0) {
            query = query.in('status', filters.status)
        }
        if (filters?.category) {
            query = query.eq('category', filters.category)
        }
        if (filters?.severity) {
            query = query.eq('severity', filters.severity)
        }
        if (filters?.priority) {
            query = query.eq('priority', filters.priority)
        }
        if (filters?.dateFrom) {
            query = query.gte('created_at', filters.dateFrom)
        }
        if (filters?.dateTo) {
            query = query.lte('created_at', filters.dateTo)
        }
        if (filters?.search) {
            query = query.or(
                `message.ilike.%${filters.search}%,display_name.ilike.%${filters.search}%`
            )
        }

        const { data, error } = await query
        if (error) throw error
        return (data ?? []) as FeedbackRow[]
    },

    /**
     * [Admin] Inline update for status, priority, category, handled_by, admin_notes, etc.
     */
    async updateFeedback(id: string, updates: FeedbackUpdate): Promise<void> {
        const { error } = await supabase
            .from('feedback')
            .update(updates)
            .eq('id', id)
        if (error) throw error
    },

    /**
     * [Admin] Hard delete a feedback row (super_admin only — enforced by RLS).
     */
    async deleteFeedback(id: string): Promise<void> {
        const { error } = await supabase
            .from('feedback')
            .delete()
            .eq('id', id)
        if (error) throw error
    },

    /**
     * [Admin] Fetch all super_admin users for the "Owner" dropdown.
     */
    async getAdminUsers(): Promise<{ id: string; display_name: string }[]> {
        const { data, error } = await supabase
            .from('app_users')
            .select('id, display_name')
            .eq('role', 'super_admin')
            .eq('is_active', true)
            .order('display_name')
        if (error) throw error
        return data ?? []
    },

    // ============================================================
    // Alerts System
    // ============================================================

    /**
     * Paginated alerts with full filter support.
     * Returns { data, count } for pagination.
     */
    async getAlerts(
        filters: Partial<AlertFilterState>,
        page = 1,
        pageSize = 25,
    ): Promise<{ data: Alert[]; count: number }> {
        const from = (page - 1) * pageSize
        const to   = from + pageSize - 1

        let query = supabase
            .from('alerts')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to)

        if (filters.severity && filters.severity.length > 0) {
            query = query.in('severity', filters.severity)
        }
        if (filters.status && filters.status.length > 0) {
            query = query.in('status', filters.status)
        }
        if (filters.platform && filters.platform.length > 0) {
            query = query.in('platform', filters.platform)
        }
        if (filters.clientId && filters.clientId.length > 0) {
            query = query.in('client_id', filters.clientId)
        }
        if (filters.search) {
            query = query.or(
                `message.ilike.%${filters.search}%,account_name.ilike.%${filters.search}%`
            )
        }
        if (filters.dateRange?.from) {
            query = query.gte('triggered_date', filters.dateRange.from)
        }
        if (filters.dateRange?.to) {
            query = query.lte('triggered_date', filters.dateRange.to)
        }
        if (filters.assignedToMe) {
            const { data: me } = await supabase.auth.getUser()
            if (me?.user) {
                const { data: appUser } = await supabase
                    .from('app_users')
                    .select('id')
                    .eq('auth_user_id', me.user.id)
                    .single()
                if (appUser) {
                    query = query.eq('assigned_to', appUser.id)
                }
            }
        }

        const { data, error, count } = await query
        if (error) throw error
        return { data: (data ?? []) as Alert[], count: count ?? 0 }
    },

    /**
     * All alerts sharing a group_key, for expanding a stacked card.
     */
    async getAlertsByGroup(groupKey: string): Promise<Alert[]> {
        const { data, error } = await supabase
            .from('alerts')
            .select('*')
            .eq('group_key', groupKey)
            .order('severity', { ascending: true })
            .order('created_at', { ascending: false })
        if (error) throw error
        return (data ?? []) as Alert[]
    },

    /**
     * Summary counts for the stats bar: open, critical, assigned to me, resolved today.
     */
    async getAlertCounts(): Promise<AlertCounts> {
        const today = new Date().toISOString().split('T')[0]

        const [openRes, criticalRes, resolvedTodayRes] = await Promise.all([
            supabase
                .from('alerts')
                .select('*', { count: 'exact', head: true })
                .in('status', ['new', 'in_progress', 'snoozed']),
            supabase
                .from('alerts')
                .select('*', { count: 'exact', head: true })
                .eq('severity', 'critical')
                .in('status', ['new', 'in_progress', 'snoozed']),
            supabase
                .from('alerts')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'resolved')
                .gte('resolved_at', today),
        ])

        // assigned_to_me requires current user ID
        let assignedToMe = 0
        try {
            const { data: me } = await supabase.auth.getUser()
            if (me?.user) {
                const { data: appUser } = await supabase
                    .from('app_users')
                    .select('id')
                    .eq('auth_user_id', me.user.id)
                    .single()
                if (appUser) {
                    const { count } = await supabase
                        .from('alerts')
                        .select('*', { count: 'exact', head: true })
                        .eq('assigned_to', appUser.id)
                        .in('status', ['new', 'in_progress'])
                    assignedToMe = count ?? 0
                }
            }
        } catch (_) { /* non-critical */ }

        return {
            total_open:     openRes.count ?? 0,
            critical:       criticalRes.count ?? 0,
            assigned_to_me: assignedToMe,
            resolved_today: resolvedTodayRes.count ?? 0,
        }
    },

    /**
     * Open alert count for sidebar badge.
     */
    async getOpenAlertCount(): Promise<number> {
        const { count, error } = await supabase
            .from('alerts')
            .select('*', { count: 'exact', head: true })
            .in('status', ['new', 'in_progress'])
        if (error) throw error
        return count ?? 0
    },

    /**
     * Resolve an alert: sets status=resolved, records who resolved it.
     */
    async resolveAlert(id: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('alerts')
            .update({
                status:               'resolved',
                resolved_at:          new Date().toISOString(),
                resolved_by_user_id:  userId,
                updated_at:           new Date().toISOString(),
            })
            .eq('id', id)
        if (error) throw error
    },

    /**
     * Snooze an alert until a specific datetime.
     */
    async snoozeAlert(id: string, snoozedUntil: string): Promise<void> {
        const { error } = await supabase
            .from('alerts')
            .update({
                status:        'snoozed',
                snoozed_until: snoozedUntil,
                updated_at:    new Date().toISOString(),
            })
            .eq('id', id)
        if (error) throw error
    },

    /**
     * Dismiss an alert (manager/admin action).
     */
    async dismissAlert(id: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('alerts')
            .update({
                status:       'dismissed',
                dismissed_at: new Date().toISOString(),
                dismissed_by: userId,
                updated_at:   new Date().toISOString(),
            })
            .eq('id', id)
        if (error) throw error
    },

    /**
     * Assign an alert to a team member.
     */
    async assignAlert(id: string, assignedTo: string): Promise<void> {
        const { error } = await supabase
            .from('alerts')
            .update({
                assigned_to: assignedTo,
                status:      'in_progress',
                updated_at:  new Date().toISOString(),
            })
            .eq('id', id)
        if (error) throw error
    },

    /**
     * Reopen a resolved/dismissed/ignored alert.
     */
    async reopenAlert(id: string): Promise<void> {
        const { error } = await supabase
            .from('alerts')
            .update({
                status:       'new',
                resolved_at:  null,
                dismissed_at: null,
                updated_at:   new Date().toISOString(),
            })
            .eq('id', id)
        if (error) throw error
    },

    // ── Alert Notes ──────────────────────────────────────────────

    /**
     * Get all notes for an alert (chronological), joined with user display names.
     */
    async getAlertNotes(alertId: string): Promise<AlertNote[]> {
        const { data, error } = await supabase
            .from('alert_notes')
            .select('id, alert_id, user_id, content, action_taken, created_at, app_users(display_name)')
            .eq('alert_id', alertId)
            .order('created_at', { ascending: true })
        if (error) throw error
        return (data ?? []).map((row: any) => ({
            ...row,
            user_display_name: row.app_users?.display_name ?? 'Unknown',
            app_users: undefined,
        })) as AlertNote[]
    },

    /**
     * Add a note to an alert.
     */
    async addAlertNote(
        alertId: string,
        userId: string,
        content: string,
        actionTaken?: string,
    ): Promise<void> {
        const { error } = await supabase
            .from('alert_notes')
            .insert({
                alert_id:     alertId,
                user_id:      userId,
                content,
                action_taken: actionTaken ?? null,
            })
        if (error) throw error
    },

    /**
     * Delete own note (RLS enforces ownership).
     */
    async deleteAlertNote(noteId: string): Promise<void> {
        const { error } = await supabase
            .from('alert_notes')
            .delete()
            .eq('id', noteId)
        if (error) throw error
    },

    // ── Alert Rules ──────────────────────────────────────────────

    /**
     * Fetch all alert rules, optionally filtered by client.
     */
    async getAlertRules(clientId?: string): Promise<AlertRule[]> {
        let query = supabase
            .from('alert_rules')
            .select('*')
            .order('display_order', { ascending: true })

        if (clientId && clientId !== 'all') {
            query = query.eq('client_id', clientId)
        }

        const { data, error } = await query
        if (error) throw error
        return (data ?? []) as AlertRule[]
    },

    /**
     * Create a new alert rule.
     */
    async createAlertRule(rule: Omit<AlertRule, 'id' | 'created_at' | 'updated_at'>): Promise<AlertRule> {
        const { data, error } = await supabase
            .from('alert_rules')
            .insert(rule)
            .select()
            .single()
        if (error) throw error
        return data as AlertRule
    },

    /**
     * Update an alert rule (full or partial).
     */
    async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<void> {
        const { error } = await supabase
            .from('alert_rules')
            .update(updates)
            .eq('id', id)
        if (error) throw error
    },

    /**
     * Soft-delete an alert rule (set is_active=false).
     */
    async deleteAlertRule(id: string): Promise<void> {
        const { error } = await supabase
            .from('alert_rules')
            .update({ is_active: false })
            .eq('id', id)
        if (error) throw error
    },

    /**
     * Batch-update display_order for drag-and-drop reordering.
     * orderedIds: array of rule IDs in the desired order.
     */
    async reorderAlertRules(orderedIds: string[]): Promise<void> {
        await Promise.all(
            orderedIds.map((id, index) =>
                supabase
                    .from('alert_rules')
                    .update({ display_order: index })
                    .eq('id', id)
            )
        )
    },

    /**
     * Fetch available campaigns/adsets for the Rule Builder entity selector.
     * Returns distinct entity_id + entity_name pairs for the given client + platform.
     */
    async getRuleEntityOptions(
        clientId: string,
        platform: 'google_ads' | 'meta_ads',
        entityType: 'campaign' | 'ad_set',
    ): Promise<{ entity_id: string; entity_name: string }[]> {
        const table = platform === 'google_ads'
            ? (entityType === 'campaign' ? 'google_ads' : 'google_ads_ad_groups')
            : (entityType === 'campaign' ? 'meta_ads' : 'meta_ads_ad_sets')

        const idCol   = platform === 'google_ads'
            ? (entityType === 'campaign' ? 'campaign_id' : 'ad_group_id')
            : (entityType === 'campaign' ? 'campaign_id' : 'ad_set_id')
        const nameCol = platform === 'google_ads'
            ? (entityType === 'campaign' ? 'campaign_name' : 'ad_group_name')
            : (entityType === 'campaign' ? 'campaign_name' : 'ad_set_name')

        const { data, error } = await supabase
            .from(table)
            .select(`${idCol}, ${nameCol}`)
            .eq('client_id', clientId)
            .order(nameCol, { ascending: true })
            .limit(200)

        if (error) throw error

        // Deduplicate by entity_id
        const seen = new Set<string>()
        return (data ?? [])
            .filter((row: any) => {
                const id = row[idCol]
                if (!id || seen.has(id)) return false
                seen.add(id)
                return true
            })
            .map((row: any) => ({
                entity_id:   row[idCol],
                entity_name: row[nameCol] ?? row[idCol],
            }))
    },

    // ── Column Preferences ────────────────────────────────────────

    /**
     * Fetch saved column preferences for current user.
     * Falls back to DEFAULT_ALERT_COLUMNS if no preferences saved.
     */
    async getAlertColumnPreferences(userId: string): Promise<AlertColumnDef[]> {
        const { data, error } = await supabase
            .from('user_alert_preferences')
            .select('visible_columns')
            .eq('user_id', userId)
            .single()

        if (error && error.code !== 'PGRST116') throw error  // PGRST116 = row not found

        if (!data) return [] // caller should fall back to DEFAULT_ALERT_COLUMNS

        return data.visible_columns as AlertColumnDef[]
    },

    /**
     * Save (upsert) column preferences for current user.
     */
    async saveAlertColumnPreferences(userId: string, columns: AlertColumnDef[]): Promise<void> {
        const { error } = await supabase
            .from('user_alert_preferences')
            .upsert(
                { user_id: userId, visible_columns: columns, updated_at: new Date().toISOString() },
                { onConflict: 'user_id' }
            )
        if (error) throw error
    },

    /**
     * All team members for the "Assign to" picker.
     */
    async getTeamMembers(): Promise<{ id: string; display_name: string }[]> {
        const { data, error } = await supabase
            .from('app_users')
            .select('id, display_name')
            .in('role', ['super_admin', 'team_member'])
            .eq('is_active', true)
            .order('display_name')
        if (error) throw error
        return data ?? []
    },
}
