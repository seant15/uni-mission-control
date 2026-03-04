import { supabase } from './supabase'
import type { AgentTask, AgentHealth } from '../types'

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
            .select('id, client_id, client_name, date, platform, impressions, clicks, conversions, spend, cost, conversion_value, revenue')

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

        query = query.order('date', { ascending: false })
            .limit(filters.limit || 1000)

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
     * Fetch Meta creatives with client filtering
     */
    async getMetaCreatives(clientId?: string) {
        let query = supabase.from('meta_creatives').select('*').limit(50)
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
        let query = supabase.from('google_keywords').select('*').limit(50)
        if (clientId && clientId !== 'all') {
            query = query.eq('client_id', clientId)
        }
        const { data, error } = await query
        if (error) throw error
        return data
    }
}
