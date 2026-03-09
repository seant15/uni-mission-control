import { supabase } from './supabase'
import type { AgentTask, AgentHealth } from '../types'
import { mockTasks } from './mock-data'

const USE_MOCK_DATA = (import.meta as any).env.VITE_USE_MOCK_DATA === 'true'

/**
 * Interface for daily performance filters
 */
export interface PerformanceFilters {
    clientId?: string
    platform?: string
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
            .select('id, client_id, client_name, date, platform, impressions, clicks, conversions, cost, revenue')

        if (filters.clientId && filters.clientId !== 'all') {
            query = query.eq('client_id', filters.clientId)
        }

        if (filters.platform && filters.platform !== 'all') {
            query = query.eq('platform', filters.platform)
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
            .select('id, name')
            .order('name')
        if (error) throw error
        return data
    },

    /**
   * Fetch lightweight stats for the dashboard
   */
    async getDashboardStats() {
        // We can run these in parallel
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
        // Use mock data if flag is enabled
        if (USE_MOCK_DATA) {
            await new Promise(resolve => setTimeout(resolve, 300)) // Simulate delay
            return mockTasks.filter(task =>
                !status || status === 'all' || task.status === status
            )
        }

        let query = supabase
            .from('agent_tasks')
            .select('*') // For now select * as it's a small table but could be optimized

        if (status && status !== 'all') {
            query = query.eq('status', status)
        }

        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) throw error
        return data
    },

    /**
     * Fetch Meta ad creatives with client filtering
     */
    async getMetaCreatives(clientId?: string) {
        let query = supabase
            .from('meta_ads_ads')
            .select('id, client_id, date, campaign_id, campaign_name, ad_set_id, ad_set_name, ad_id, ad_name, spend, impressions, clicks, conversions, revenue')
            .order('spend', { ascending: false })
            .limit(50)

        if (clientId && clientId !== 'all') {
            query = query.eq('client_id', clientId)
        }

        const { data, error } = await query
        if (error) throw error
        return data
    },

    /**
     * Fetch Google keywords with client filtering
     */
    async getGoogleKeywords(clientId?: string) {
        let query = supabase
            .from('google_ads_keywords')
            .select('id, client_id, customer_id, date, campaign_id, campaign_name, ad_group_id, ad_group_name, keyword_id, keyword, match_type, status, impressions, clicks, cost_micros, conversions, ctr, cpc')
            .order('cost_micros', { ascending: false })
            .limit(50)

        if (clientId && clientId !== 'all') {
            query = query.eq('client_id', clientId)
        }

        const { data, error } = await query
        if (error) throw error

        // Convert cost_micros to dollars
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

        // Get unique platforms
        const platforms = [...new Set(data?.map(item => item.platform).filter(Boolean))]

        return platforms.map(platform => ({
            id: platform,
            label: platform === 'meta_ads' ? 'Meta Ads' :
                   platform === 'google_ads' ? 'Google Ads' :
                   platform === 'tiktok_ads' ? 'TikTok Ads' :
                   platform === 'shopify' ? 'Shopify' : platform
        }))
    }
}
