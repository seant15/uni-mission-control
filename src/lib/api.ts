import { supabase } from './supabase'
import type { AgentTask, AgentHealth } from '../types'
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
            .select('id, name, business_type')
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
     */
    async getMetaCreatives(clientId?: string, startDate?: string, endDate?: string) {
        let query = supabase
            .from('meta_ads_ads')
            .select('id, client_id, date, campaign_id, campaign_name, ad_set_id, ad_set_name, ad_id, ad_name, spend, impressions, clicks, conversions, revenue')
            .order('spend', { ascending: false })
            .limit(50)

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
            .select('id, client_id, customer_id, date, campaign_id, campaign_name, ad_group_id, ad_group_name, keyword_id, keyword, match_type, status, impressions, clicks, cost_micros, conversions, ctr, cpc')
            .order('cost_micros', { ascending: false })
            .limit(50)

        if (clientId && clientId !== 'all') {
            query = query.eq('client_id', clientId)
        }
        if (startDate) query = query.gte('date', startDate)
        if (endDate) query = query.lte('date', endDate)

        const { data, error } = await query
        if (error) throw error

        return data?.map(item => ({
            ...item,
            spend: item.cost_micros ? item.cost_micros / 1000000 : 0
        }))
    },

    /**
     * Fetch Google search terms with client and date filtering
     */
    async getGoogleSearchTerms(clientId?: string, startDate?: string, endDate?: string) {
        let query = supabase
            .from('google_ads_search_terms')
            .select('id, client_id, customer_id, date, campaign_id, campaign_name, ad_group_id, ad_group_name, search_term, match_type, impressions, clicks, cost_micros, conversions')
            .order('cost_micros', { ascending: false })
            .limit(100)

        if (clientId && clientId !== 'all') {
            query = query.eq('client_id', clientId)
        }
        if (startDate) query = query.gte('date', startDate)
        if (endDate) query = query.lte('date', endDate)

        const { data, error } = await query
        if (error) throw error

        return data?.map(item => ({
            ...item,
            spend: item.cost_micros ? item.cost_micros / 1000000 : 0
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
            .from('meta_ads_adsets')
            .select('id, client_id, date, ad_account_id, campaign_name, ad_set_name, spend, conversions, revenue')
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
        const now = new Date()
        const windowStart = new Date(now.getTime() - filters.windowHours * 60 * 60 * 1000)
        const prevWindowStart = new Date(windowStart.getTime() - filters.windowHours * 60 * 60 * 1000)

        const cols = 'id, client_id, client_name, ad_account_id, platform, hour_timestamp, impressions, clicks, conversions, cost, revenue'

        let curQ = supabase.from('hourly_performance').select(cols)
            .gte('hour_timestamp', windowStart.toISOString())
            .lte('hour_timestamp', now.toISOString())
            .order('hour_timestamp', { ascending: false })

        let prevQ = supabase.from('hourly_performance').select(cols)
            .gte('hour_timestamp', prevWindowStart.toISOString())
            .lt('hour_timestamp', windowStart.toISOString())
            .order('hour_timestamp', { ascending: false })

        if (filters.clientId && filters.clientId !== 'all') {
            curQ = curQ.eq('client_id', filters.clientId)
            prevQ = prevQ.eq('client_id', filters.clientId)
        }

        const [curRes, prevRes] = await Promise.all([curQ, prevQ])
        if (curRes.error) throw curRes.error
        if (prevRes.error) throw prevRes.error

        return {
            current: curRes.data || [],
            previous: prevRes.data || [],
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
            .select('id, severity, status, account_name, message, alert_type, created_at')
            .gte('created_at', cutoff)
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
            })

        if (error) throw error
        return true
    }
}
