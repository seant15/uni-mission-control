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
import type { MissionCardRow, MissionColumn } from '../types/mission'
import type { ClientAbTestConfig, ClientAlertDelivery } from '../types/abTestDelivery'
import { mockTasks } from './mock-data'
import { getScopedAgencyId, peekActiveClientIdsCache, storeActiveClientIdsCache } from './agencyScope'
import { hourlyRowUtcMs } from './hourlyBuckets'

const USE_MOCK_DATA = (import.meta as any).env.VITE_USE_MOCK_DATA === 'true'

/** Matches common DB casing for active clients (shared by dropdowns + perf scoping). */
export const ACTIVE_CLIENT_STATUSES = ['active', 'Active', 'ACTIVE'] as const

/** IDs of active clients — cached for list + performance queries (respects agency switcher). */
async function cachedActiveClientIds(): Promise<string[]> {
    const cached = peekActiveClientIdsCache()
    if (cached) return cached

    const agencyId = getScopedAgencyId()
    let q = supabase.from('clients').select('id').in('status', [...ACTIVE_CLIENT_STATUSES])
    if (agencyId) q = q.eq('agency_id', agencyId)

    const { data, error } = await q
    if (error) throw error
    const ids = (data ?? []).map((r: { id: string }) => r.id).filter(Boolean)
    storeActiveClientIdsCache(ids)
    return ids
}

export type HourWindow = 1 | 2 | 6 | 12 | 24 | 30 | 48 | 72

export interface HourlyPerformanceFilters {
    windowHours: HourWindow
    clientId?: string
    /** When set, overrides `clientId` for queries (client-role isolation). */
    scopedClientId?: string
    platform?: string
    adAccountId?: string
}

/** Stable key for merging daily rows with hourly rollups (same grain as daily_performance). */
function dailyPerfRowKey(r: {
    client_id: string
    date: string
    platform: string | null
    ad_account_id?: string | null
}) {
    return `${r.client_id}|${r.date}|${r.platform ?? ''}|${r.ad_account_id ?? ''}`
}

/** Sum hourly rows into daily-shaped rows (fills gaps when daily_performance sync lags hourly sync). */
function rollupHourlyToDailyShape(hourlyRows: any[]): any[] {
    const map = new Map<string, any>()
    for (const r of hourlyRows) {
        const key = dailyPerfRowKey({
            client_id: r.client_id,
            date: r.date,
            platform: r.platform,
            ad_account_id: r.ad_account_id,
        })
        if (!map.has(key)) {
            map.set(key, {
                id: `hourly-rollup:${key}`,
                client_id: r.client_id,
                client_name: r.client_name,
                date: r.date,
                platform: r.platform,
                ad_account_id: r.ad_account_id,
                data_timezone: null as string | null,
                impressions: 0,
                clicks: 0,
                conversions: 0,
                cost: 0,
                revenue: 0,
            })
        }
        const e = map.get(key)!
        e.impressions += Number(r.impressions) || 0
        e.clicks += Number(r.clicks) || 0
        e.conversions += Number(r.conversions) || 0
        e.cost += Number(r.cost) || 0
        e.revenue += Number(r.revenue) || 0
        if (!e.client_name && r.client_name) e.client_name = r.client_name
    }
    return Array.from(map.values())
}

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
    /** When set, `clientId` is forced to this value in all queries using these filters. */
    scopedClientId?: string
    /** Omit Shopify rows merged from shopify_daily_performance (Heated View / paid-ads KPIs). */
    adsOnly?: boolean
}

function applyPerformanceClientScope(filters: PerformanceFilters): PerformanceFilters {
    if (!filters.scopedClientId) return filters
    return { ...filters, clientId: filters.scopedClientId }
}

/** Map Shopify order rollup rows into the same shape as `daily_performance` for unified charts/filters. */
async function fetchShopifyDailyAsPerformanceShape(filters: PerformanceFilters): Promise<any[]> {
    const f = applyPerformanceClientScope(filters)
    let q = supabase
        .from('shopify_daily_performance')
        .select('client_id, client_name, date, total_orders, gross_revenue, net_revenue, refund_amount')

    if (f.clientId && f.clientId !== 'all') {
        q = q.eq('client_id', f.clientId)
    } else {
        const activeIds = await cachedActiveClientIds()
        if (activeIds.length === 0) return []
        q = q.in('client_id', activeIds)
    }
    if (f.startDate) q = q.gte('date', f.startDate)
    if (f.endDate) q = q.lte('date', f.endDate)
    const { data, error } = await q.limit(5000)
    if (error) throw error
    return (data || []).map((row: Record<string, unknown>) => ({
        id: `shopify|${row.client_id}|${row.date}`,
        client_id: row.client_id,
        client_name: row.client_name,
        date: row.date,
        platform: 'shopify',
        ad_account_id: null,
        data_timezone: null as string | null,
        impressions: 0,
        clicks: 0,
        conversions: Number(row.total_orders) || 0,
        cost: 0,
        revenue: Number(row.net_revenue) || 0,
        gross_revenue: Number(row.gross_revenue) || 0,
        refund_amount: Number(row.refund_amount) || 0,
    }))
}

/** Hourly slice used to synthesize missing daily_performance rows (same filters as daily query). */
async function fetchHourlyRowsForDailyRollup(filters: PerformanceFilters): Promise<any[]> {
    let q = supabase
        .from('hourly_performance')
        .select('client_id, client_name, date, platform, ad_account_id, impressions, clicks, conversions, cost, revenue')

    if (filters.clientId && filters.clientId !== 'all') {
        q = q.eq('client_id', filters.clientId)
    } else {
        const activeIds = await cachedActiveClientIds()
        if (activeIds.length === 0) return []
        q = q.in('client_id', activeIds)
    }

    if (filters.platform && filters.platform !== 'all') {
        q = q.eq('platform', filters.platform)
    }

    if (filters.adAccountId) {
        q = q.eq('ad_account_id', filters.adAccountId)
    }

    if (filters.startDate) q = q.gte('date', filters.startDate)
    if (filters.endDate) q = q.lte('date', filters.endDate)

    q = q.limit(25000)
    const { data, error } = await q
    if (error) throw error
    return data || []
}

/**
 * Optimized database service
 */
export const db = {
    /**
     * Fetch daily performance with server-side filtering and specific columns.
     * When daily_performance has gaps but hourly_performance exists (common when only hourly sync runs),
     * missing daily keys are filled by rolling up hourly rows for the same date/account/platform.
     */
    async getDailyPerformance(filters: PerformanceFilters) {
        const f = applyPerformanceClientScope(filters)
        const plat = f.platform && f.platform !== 'all' ? f.platform : null
        const includeShopify =
            !f.adsOnly &&
            !f.adAccountId &&
            (plat === null || plat === 'shopify')

        if (plat === 'shopify') {
            const shopOnly = await fetchShopifyDailyAsPerformanceShape(f)
            shopOnly.sort((a: any, b: any) => {
                const db = (b.date || '').localeCompare(a.date || '')
                if (db !== 0) return db
                return dailyPerfRowKey(b).localeCompare(dailyPerfRowKey(a))
            })
            const limS = f.limit || 5000
            const offS = f.offset || 0
            return shopOnly.slice(offS, offS + limS)
        }

        let query = supabase
            .from('daily_performance')
            .select('id, client_id, client_name, date, platform, ad_account_id, data_timezone, impressions, clicks, conversions, cost, revenue')

        if (f.clientId && f.clientId !== 'all') {
            query = query.eq('client_id', f.clientId)
        } else {
            const activeIds = await cachedActiveClientIds()
            if (activeIds.length === 0) return []
            query = query.in('client_id', activeIds)
        }

        if (plat) {
            query = query.eq('platform', plat)
        }

        if (f.adAccountId) {
            query = query.eq('ad_account_id', f.adAccountId)
        }

        if (f.startDate) {
            query = query.gte('date', f.startDate)
        }

        if (f.endDate) {
            query = query.lte('date', f.endDate)
        }

        query = query.order('date', { ascending: false }).limit(20000)

        const { data, error } = await query
        if (error) throw error
        const dailyRows = data || []

        const hourlyRaw = await fetchHourlyRowsForDailyRollup(f)
        const rolled = rollupHourlyToDailyShape(hourlyRaw)
        const datesWithDailyData = new Set(dailyRows.map((r: { client_id: string; date: string }) => `${r.client_id}|${r.date}`))
        const merged = [...dailyRows]
        for (const r of rolled) {
            const dateKey = `${r.client_id}|${r.date}`
            if (!datesWithDailyData.has(dateKey)) merged.push(r)
        }

        if (includeShopify) {
            const shopRows = await fetchShopifyDailyAsPerformanceShape(f)
            merged.push(...shopRows)
        }

        merged.sort((a: any, b: any) => {
            const db = (b.date || '').localeCompare(a.date || '')
            if (db !== 0) return db
            return dailyPerfRowKey(b).localeCompare(dailyPerfRowKey(a))
        })
        const lim = f.limit || 5000
        const off = f.offset || 0
        return merged.slice(off, off + lim)
    },

    /**
     * Device / age / gender / demographic slices from daily_performance_breakdown.
     */
    async getPerformanceBreakdown(
        filters: PerformanceFilters & { dimension: 'device' | 'age' | 'gender' | 'demographic' | 'country' },
    ) {
        return this.getPerformanceBreakdownSlices({
            ...filters,
            dimensions: [filters.dimension],
        })
    },

    /**
     * One or more breakdown dimensions (e.g. Meta demographic + Google age when platform = all).
     */
    async getPerformanceBreakdownSlices(
        filters: PerformanceFilters & {
            dimensions: Array<'device' | 'age' | 'gender' | 'demographic' | 'country'>
        },
    ) {
        const f = applyPerformanceClientScope(filters)
        const plat = f.platform && f.platform !== 'all' ? f.platform : null
        const dims = [...new Set(filters.dimensions)]
        if (dims.length === 0) return []

        let query = supabase
            .from('daily_performance_breakdown')
            .select(
                'client_id, date, platform, ad_account_id, dimension, dimension_value, cost, revenue, impressions, clicks, conversions',
            )

        if (f.clientId && f.clientId !== 'all') {
            query = query.eq('client_id', f.clientId)
        } else {
            const activeIds = await cachedActiveClientIds()
            if (activeIds.length === 0) return []
            query = query.in('client_id', activeIds)
        }

        if (plat) query = query.eq('platform', plat)
        if (f.adAccountId) query = query.eq('ad_account_id', f.adAccountId)
        if (f.startDate) query = query.gte('date', f.startDate)
        if (f.endDate) query = query.lte('date', f.endDate)
        query = query.in('dimension', dims).order('date', { ascending: false }).limit(25000)

        const { data, error } = await query
        if (error) throw error
        return data || []
    },

    /**
     * On-demand Meta/Google breakdown backfill (Vercel /api when deployed; no-op if route missing).
     */
    async requestPerformanceBreakdownSync(params: {
        startDate: string
        endDate: string
        clientId?: string
    }): Promise<{ ok: boolean; rows?: number; message?: string }> {
        if ((import.meta as any).env.VITE_ENABLE_BREAKDOWN_SYNC !== 'true') {
            return { ok: false, message: 'On-demand sync disabled; use sync_performance_breakdowns.py' }
        }
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
            return { ok: false, message: 'Not signed in' }
        }
        try {
            const res = await fetch('/api/sync-performance-breakdowns', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(params),
            })
            const body = await res.json().catch(() => ({}))
            if (!res.ok) {
                return { ok: false, message: (body as { error?: string }).error || res.statusText }
            }
            return { ok: true, rows: (body as { rows?: number }).rows, message: (body as { message?: string }).message }
        } catch (e) {
            return { ok: false, message: e instanceof Error ? e.message : 'Sync request failed' }
        }
    },

    /**
     * Fetch all clients (lightweight)
     */
    async getClients(opts?: { scopedClientId?: string }) {
        const agencyId = getScopedAgencyId()
        let q = supabase
            .from('clients')
            .select('id, name, business_type, currency, currency_symbol, meta_ad_account_id, google_ads_customer_id, agency_id, status, target_ad_spend_30d_by_platform')
            .in('status', [...ACTIVE_CLIENT_STATUSES])
            .order('name')
        if (opts?.scopedClientId) {
            q = q.eq('id', opts.scopedClientId)
        } else if (agencyId) {
            q = q.eq('agency_id', agencyId)
        }
        const { data, error } = await q
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
    async getMetaCreatives(
        clientId?: string,
        startDate?: string,
        endDate?: string,
        scopedClientId?: string,
        adAccountId?: string,
    ) {
        const cid = scopedClientId ?? clientId
        let query = supabase
            .from('meta_ads_ads')
            .select(
                'id, client_id, date, ad_account_id, campaign_id, campaign_name, ad_set_id, ad_set_name, ad_id, ad_name, spend, impressions, clicks, conversions, revenue, image_url, thumbnail_url, video_id, headline, primary_copy, description, call_to_action_type, destination_url, instagram_permalink_url, facebook_post_url',
            )
            .order('spend', { ascending: false })
            .limit(2000)

        if (cid && cid !== 'all') {
            query = query.eq('client_id', cid)
        } else {
            const activeIds = await cachedActiveClientIds()
            if (activeIds.length === 0) return []
            query = query.in('client_id', activeIds)
        }
        if (adAccountId) {
            query = query.eq('ad_account_id', adAccountId)
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
        } else {
            const activeIds = await cachedActiveClientIds()
            if (activeIds.length === 0) return []
            query = query.in('client_id', activeIds)
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
        } else {
            const activeIds = await cachedActiveClientIds()
            if (activeIds.length === 0) return []
            query = query.in('client_id', activeIds)
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
        const activeIds = await cachedActiveClientIds()
        if (activeIds.length === 0) {
            return []
        }
        const { data: dailyPlat, error: e1 } = await supabase
            .from('daily_performance')
            .select('platform')
            .in('client_id', activeIds)
        if (e1) throw e1
        const { data: hourlyPlat, error: e2 } = await supabase
            .from('hourly_performance')
            .select('platform')
            .in('client_id', activeIds)
            .limit(8000)
        if (e2) throw e2

        const platforms = [
            ...new Set([
                ...(dailyPlat?.map(item => item.platform).filter(Boolean) as string[]),
                ...(hourlyPlat?.map(item => item.platform).filter(Boolean) as string[]),
            ]),
        ]

        const { data: shopClients, error: e3 } = await supabase
            .from('shopify_daily_performance')
            .select('client_id')
            .in('client_id', activeIds)
            .limit(1)
        if (e3) throw e3
        if ((shopClients?.length ?? 0) > 0 && !platforms.includes('shopify')) {
            platforms.push('shopify')
        }

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
    async getAdAccounts(filters: { clientId?: string; platform?: string; scopedClientId?: string }) {
        const clientId = filters.scopedClientId ?? filters.clientId
        const activeIds = await cachedActiveClientIds()
        if (activeIds.length === 0) return []

        let query = supabase
            .from('daily_performance')
            .select('ad_account_id, platform, client_id')

        if (clientId && clientId !== 'all') {
            query = query.eq('client_id', clientId)
        } else {
            query = query.in('client_id', activeIds)
        }

        if (filters.platform && filters.platform !== 'all') {
            query = query.eq('platform', filters.platform)
        }

        const { data, error } = await query
        if (error) throw error

        let hQuery = supabase
            .from('hourly_performance')
            .select('ad_account_id, platform, client_id')
            .limit(8000)

        if (clientId && clientId !== 'all') {
            hQuery = hQuery.eq('client_id', clientId)
        } else {
            hQuery = hQuery.in('client_id', activeIds)
        }

        if (filters.platform && filters.platform !== 'all') {
            hQuery = hQuery.eq('platform', filters.platform)
        }

        const { data: hourlyAccts } = await hQuery

        const accountMap = new Map<string, { platform: string; client_id: string }>()
        const addAcct = (item: { ad_account_id?: string | null; platform?: string | null; client_id?: string | null }) => {
            if (item.ad_account_id && !accountMap.has(item.ad_account_id)) {
                accountMap.set(item.ad_account_id, {
                    platform: item.platform || '',
                    client_id: item.client_id || '',
                })
            }
        }
        data?.forEach(addAcct)
        hourlyAccts?.forEach(addAcct)

        return Array.from(accountMap.entries()).map(([account, info]) => ({
            id: account,
            label: `${account} | ${info.platform}`,
            client_id: info.client_id,
        }))
    },

    /**
     * Fetch Meta adsets with filtering
     */
    async getMetaAdsets(filters: { clientId?: string; adAccountId?: string; startDate?: string; endDate?: string; scopedClientId?: string }) {
        const clientId = filters.scopedClientId ?? filters.clientId
        let query = supabase
            .from('meta_ads_ad_sets')
            .select('id, client_id, date, ad_account_id, campaign_id, campaign_name, ad_set_id, ad_set_name, spend, impressions, clicks, conversions, revenue')
            .order('spend', { ascending: false })
            .limit(500)

        if (clientId && clientId !== 'all') {
            query = query.eq('client_id', clientId)
        } else {
            const activeIds = await cachedActiveClientIds()
            if (activeIds.length === 0) return []
            query = query.in('client_id', activeIds)
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
    async getMetaCampaigns(filters: { clientId?: string; adAccountId?: string; startDate?: string; endDate?: string; scopedClientId?: string }) {
        const clientId = filters.scopedClientId ?? filters.clientId
        let query = supabase
            .from('meta_ads')
            .select(
                'id, client_id, date, campaign_id, campaign_name, spend, impressions, clicks, conversions, revenue, ' +
                'reach, frequency, outbound_clicks, video_p25_watched, video_p50_watched, video_p75_watched, video_p100_watched, video_avg_watch_time'
            )
            .order('spend', { ascending: false })
            .limit(500)

        if (clientId && clientId !== 'all') {
            query = query.eq('client_id', clientId)
        } else {
            const activeIds = await cachedActiveClientIds()
            if (activeIds.length === 0) return []
            query = query.in('client_id', activeIds)
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
     * Fetch Google campaigns with filtering
     */
    async getGoogleCampaigns(filters: { clientId?: string; adAccountId?: string; startDate?: string; endDate?: string; scopedClientId?: string }) {
        const clientId = filters.scopedClientId ?? filters.clientId
        let query = supabase
            .from('google_ads')
            .select('id, client_id, date, campaign_id, campaign_name, spend, impressions, clicks, conversions, revenue')
            .order('spend', { ascending: false })
            .limit(500)

        if (clientId && clientId !== 'all') {
            query = query.eq('client_id', clientId)
        } else {
            const activeIds = await cachedActiveClientIds()
            if (activeIds.length === 0) return []
            query = query.in('client_id', activeIds)
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
        } else {
            const activeIds = await cachedActiveClientIds()
            if (activeIds.length === 0) return []
            query = query.in('client_id', activeIds)
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
            .select('id, severity, status, account_name, message, alert_type, created_at, client_id')
            .order('created_at', { ascending: false })
            .limit(100)

        if (error) throw error
        return data
    },

    /**
     * Client spend grouped by client for UNI Overview
     */
    async getClientSpendSummary(filters: { startDate?: string; endDate?: string }) {
        const activeIds = await cachedActiveClientIds()
        if (activeIds.length === 0) return []

        const merged = await db.getDailyPerformance({
            startDate: filters.startDate,
            endDate: filters.endDate,
            limit: 20000,
        })

        const map = new Map<string, { client_id: string; client_name: string; spend: number }>()
        merged.forEach(row => {
            const existing = map.get(row.client_id)
            const add = Number(row.cost) || 0
            if (existing) {
                existing.spend += add
            } else {
                map.set(row.client_id, {
                    client_id: row.client_id,
                    client_name: row.client_name || row.client_id,
                    spend: add,
                })
            }
        })
        return Array.from(map.values()).sort((a, b) => b.spend - a.spend)
    },

    /**
     * Hourly performance for Real-time Performance page
     * Returns current window rows and previous window rows for comparison
     */
    async getHourlyPerformance(filters: HourlyPerformanceFilters) {
        // hourly_performance table uses date (DATE) + hour (INT 0-23), not a timestamp column
        const now = new Date()
        const windowStart = new Date(now.getTime() - filters.windowHours * 60 * 60 * 1000)
        const prevWindowStart = new Date(windowStart.getTime() - filters.windowHours * 60 * 60 * 1000)

        const effectiveClientId = filters.scopedClientId ?? filters.clientId

        // Build date+hour pairs for current window
        const toDateHour = (d: Date) => ({
            date: d.toISOString().split('T')[0],
            hour: d.getUTCHours(),
        })

        const curWindowStartDH = toDateHour(windowStart)
        const curWindowEndDH = toDateHour(now)
        const prevWindowStartDH = toDateHour(prevWindowStart)
        const prevWindowEndDH = toDateHour(windowStart)

        const cols =
            'id, client_id, client_name, ad_account_id, platform, date, hour, account_local_hour, impressions, clicks, conversions, cost, revenue, account_timezone'

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

        if (effectiveClientId && effectiveClientId !== 'all') {
            curQ = curQ.eq('client_id', effectiveClientId)
            prevQ = prevQ.eq('client_id', effectiveClientId)
        } else {
            const activeIds = await cachedActiveClientIds()
            if (activeIds.length === 0) {
                return {
                    current: [],
                    previous: [],
                    windowStart: windowStart.toISOString(),
                    windowEnd: now.toISOString(),
                    prevWindowStart: prevWindowStart.toISOString(),
                    prevWindowEnd: windowStart.toISOString(),
                }
            }
            curQ = curQ.in('client_id', activeIds)
            prevQ = prevQ.in('client_id', activeIds)
        }

        const pf = filters.platform && filters.platform !== 'all' ? filters.platform : null
        const acct = filters.adAccountId?.trim() ? filters.adAccountId : null
        if (pf) {
            curQ = curQ.eq('platform', pf)
            prevQ = prevQ.eq('platform', pf)
        }
        if (acct) {
            curQ = curQ.eq('ad_account_id', acct)
            prevQ = prevQ.eq('ad_account_id', acct)
        }

        const [curRes, prevRes] = await Promise.all([curQ, prevQ])
        if (curRes.error) throw curRes.error
        if (prevRes.error) throw prevRes.error

        const curStartMs = Date.parse(
            `${curWindowStartDH.date}T${String(curWindowStartDH.hour).padStart(2, '0')}:00:00.000Z`
        )
        const curEndMs = Date.parse(
            `${curWindowEndDH.date}T${String(curWindowEndDH.hour).padStart(2, '0')}:00:00.000Z`
        )
        const prevStartMs = Date.parse(
            `${prevWindowStartDH.date}T${String(prevWindowStartDH.hour).padStart(2, '0')}:00:00.000Z`
        )
        const prevEndMs = Date.parse(
            `${prevWindowEndDH.date}T${String(prevWindowEndDH.hour).padStart(2, '0')}:00:00.000Z`
        )

        const currentRows = (curRes.data || []).filter((r) => {
            const t = hourlyRowUtcMs(r)
            return !Number.isNaN(t) && t >= curStartMs && t <= curEndMs
        })
        const previousRows = (prevRes.data || []).filter((r) => {
            const t = hourlyRowUtcMs(r)
            return !Number.isNaN(t) && t >= prevStartMs && t <= prevEndMs
        })

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
    /** Hourly rows for a calendar date range (Heated View rhythm chart). */
    async getHourlyPerformanceForDateRange(filters: {
        startDate: string
        endDate: string
        clientId?: string
        scopedClientId?: string
        platform?: string
        /** When true and platform unset, only Meta + Google hourly rows (no store channels). */
        adsOnly?: boolean
    }) {
        const effectiveClientId = filters.scopedClientId ?? filters.clientId
        const cols =
            'id, client_id, client_name, ad_account_id, platform, date, hour, account_local_hour, impressions, clicks, conversions, cost, revenue, account_timezone'

        let q = supabase
            .from('hourly_performance')
            .select(cols)
            .gte('date', filters.startDate)
            .lte('date', filters.endDate)
            .order('date', { ascending: true })
            .order('hour', { ascending: true })

        if (effectiveClientId && effectiveClientId !== 'all') {
            q = q.eq('client_id', effectiveClientId)
        } else {
            const activeIds = await cachedActiveClientIds()
            if (activeIds.length === 0) return []
            q = q.in('client_id', activeIds)
        }

        const pf = filters.platform && filters.platform !== 'all' ? filters.platform : null
        if (pf) {
            q = q.eq('platform', pf)
        } else if (filters.adsOnly) {
            q = q.in('platform', ['meta_ads', 'google_ads'])
        }

        const { data, error } = await q.limit(20000)
        if (error) throw error
        return data || []
    },

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

    /** Merge patch into existing row so omitted columns stay intact server-side expectation (client sends full merged row). */
    async mergeDashboardSettings(userId: string, patch: Record<string, unknown>) {
        const existing = await this.getSettings(userId)
        const merged: Record<string, unknown> =
            existing && typeof existing === 'object' && existing !== null
                ? { ...(existing as Record<string, unknown>), ...patch }
                : { ...patch }
        merged.user_id = userId
        delete merged.updated_at
        delete merged.id
        await this.saveSettings(userId, merged as any)
        return true
    },

    /** Persist Agency Overview KPI layout only (auth user id = dashboard_settings.user_id). */
    async saveAgencyKpiCards(userId: string, layout: Record<string, unknown>) {
        const { error } = await supabase
            .from('dashboard_settings')
            .upsert(
                {
                    user_id: userId,
                    agency_kpi_cards: layout,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' },
            )
        if (error) throw error
        return true
    },

    async getShopifyDailyPerformance(filters: PerformanceFilters) {
        return fetchShopifyDailyAsPerformanceShape(applyPerformanceClientScope(filters))
    },

    async getShopifyProductSplitDaily(filters: PerformanceFilters) {
        const f = applyPerformanceClientScope(filters)
        if (!f.clientId || f.clientId === 'all') return []
        let q = supabase
            .from('shopify_daily_performance')
            .select(
                'client_id, date, machine_units, machine_gross, accessory_units, accessory_gross, currency',
            )
            .eq('client_id', f.clientId)
        if (f.startDate) q = q.gte('date', f.startDate)
        if (f.endDate) q = q.lte('date', f.endDate)
        const { data, error } = await q.limit(5000)
        if (error) throw error
        return data ?? []
    },

    async getClientDashboardModules(clientId: string) {
        const { data, error } = await supabase
            .from('client_dashboard_modules')
            .select('id, client_id, module_key, config_json, is_active, sort_order')
            .eq('client_id', clientId)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
        if (error) throw error
        return data ?? []
    },

    async createClientRecord(input: {
        name: string
        business_type?: 'leadgen' | 'ecommerce'
        agency_id?: string | null
        currency?: string
    }) {
        const agencyId = input.agency_id ?? getScopedAgencyId() ?? null
        const { data, error } = await supabase
            .from('clients')
            .insert({
                name: input.name.trim(),
                business_type: input.business_type ?? 'ecommerce',
                agency_id: agencyId,
                currency: input.currency ?? 'USD',
                status: 'active',
            })
            .select('id, name')
            .single()
        if (error) throw error
        return data
    },

    async updateClientAdSpendTargets(
        clientId: string,
        targets: Record<string, number | null>,
    ) {
        const cleaned: Record<string, number> = {}
        for (const [k, v] of Object.entries(targets)) {
            if (v != null && Number.isFinite(v) && v > 0) cleaned[k] = v
        }
        const { data, error } = await supabase
            .from('clients')
            .update({ target_ad_spend_30d_by_platform: cleaned })
            .eq('id', clientId)
            .select('id, target_ad_spend_30d_by_platform')
            .single()
        if (error) throw error
        return data
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
        const safeBase = file.name
            .replace(/[^a-zA-Z0-9._-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 120) || 'attachment'
        const path = `${feedbackId}/${Date.now()}-${safeBase}`
        const { error } = await supabase.storage
            .from('feedback-attachments')
            .upload(path, file, { upsert: false })
        if (error) throw error
        return {
            url: path,
            name: file.name,
            type: file.type || 'application/octet-stream',
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

    /**
     * Permanently remove an alert row (requires DELETE policy on alerts for the caller).
     */
    async deleteAlert(id: string): Promise<void> {
        const { error } = await supabase.from('alerts').delete().eq('id', id)
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
            .in('role', ['super_admin', 'media_buyer', 'team_member'])
            .eq('is_active', true)
            .order('display_name')
        if (error) throw error
        return data ?? []
    },

    async listMissionCards(): Promise<MissionCardRow[]> {
        const { data, error } = await supabase
            .from('mission_cards')
            .select('*')
            .order('updated_at', { ascending: false })
        if (error) throw error
        return (data ?? []) as MissionCardRow[]
    },

    async createMissionCard(input: {
        title: string
        body?: string
        column_status?: MissionColumn
        client_id?: string | null
        platform?: string | null
        priority?: string | null
        source_alert_id?: string | null
        created_by: string
        clickup_task_id?: string | null
        clickup_task_url?: string | null
        synced_from_clickup?: boolean
    }): Promise<MissionCardRow> {
        const { data, error } = await supabase
            .from('mission_cards')
            .insert({
                title: input.title,
                body: input.body ?? '',
                column_status: input.column_status ?? 'new',
                client_id: input.client_id ?? null,
                platform: input.platform ?? null,
                priority: input.priority ?? 'medium',
                source_alert_id: input.source_alert_id ?? null,
                created_by: input.created_by,
                clickup_task_id: input.clickup_task_id ?? null,
                clickup_task_url: input.clickup_task_url ?? null,
                synced_from_clickup: input.synced_from_clickup ?? false,
            })
            .select()
            .single()
        if (error) throw error
        return data as MissionCardRow
    },

    async updateMissionCard(
        id: string,
        patch: Partial<
            Pick<
                MissionCardRow,
                | 'title'
                | 'body'
                | 'column_status'
                | 'client_id'
                | 'platform'
                | 'priority'
                | 'clickup_task_id'
                | 'clickup_task_url'
                | 'archived'
            >
        >
    ): Promise<void> {
        const { error } = await supabase
            .from('mission_cards')
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq('id', id)
        if (error) throw error
    },

    async deleteMissionCard(id: string): Promise<void> {
        const { data: row, error: selErr } = await supabase
            .from('mission_cards')
            .select('synced_from_clickup')
            .eq('id', id)
            .maybeSingle()
        if (selErr) throw selErr
        if (row?.synced_from_clickup) {
            throw new Error('Cannot delete a ClickUp-synced card from the dashboard. Archive it instead.')
        }
        const { error } = await supabase.from('mission_cards').delete().eq('id', id)
        if (error) throw error
    },

    /** Returns existing card id if this alert was already used to create a mission card. */
    async findMissionCardBySourceAlert(alertId: string): Promise<string | null> {
        const { data, error } = await supabase
            .from('mission_cards')
            .select('id')
            .eq('source_alert_id', alertId)
            .maybeSingle()
        if (error) throw error
        return data?.id ?? null
    },

    async listAbTestConfigs(clientId?: string): Promise<ClientAbTestConfig[]> {
        let q = supabase.from('client_ab_test_configs').select('*').order('updated_at', { ascending: false })
        if (clientId && clientId !== 'all') q = q.eq('client_id', clientId)
        const { data, error } = await q
        if (error) throw error
        return (data ?? []) as ClientAbTestConfig[]
    },

    async createAbTestConfig(
        row: Omit<ClientAbTestConfig, 'id' | 'created_at' | 'updated_at'>
    ): Promise<ClientAbTestConfig> {
        const { data, error } = await supabase
            .from('client_ab_test_configs')
            .insert({
                client_id: row.client_id,
                name: row.name,
                platform: row.platform,
                entity_type: row.entity_type,
                entity_name: row.entity_name,
                cadence: row.cadence,
                is_active: row.is_active,
                notes: row.notes ?? '',
                created_by: row.created_by,
            })
            .select()
            .single()
        if (error) throw error
        return data as ClientAbTestConfig
    },

    async updateAbTestConfig(
        id: string,
        patch: Partial<Pick<ClientAbTestConfig, 'name' | 'platform' | 'entity_type' | 'entity_name' | 'cadence' | 'is_active' | 'notes'>>
    ): Promise<void> {
        const { error } = await supabase
            .from('client_ab_test_configs')
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq('id', id)
        if (error) throw error
    },

    async deleteAbTestConfig(id: string): Promise<void> {
        const { error } = await supabase.from('client_ab_test_configs').delete().eq('id', id)
        if (error) throw error
    },

    async getClientAlertDelivery(clientId: string): Promise<ClientAlertDelivery | null> {
        const { data, error } = await supabase
            .from('client_alert_delivery')
            .select('*')
            .eq('client_id', clientId)
            .maybeSingle()
        if (error) throw error
        return data as ClientAlertDelivery | null
    },

    async upsertClientAlertDelivery(
        row: Pick<
            ClientAlertDelivery,
            | 'client_id'
            | 'notify_in_app'
            | 'slack_webhook_url'
            | 'notify_emails'
            | 'slack_channel'
            | 'slack_notify_alert_rules'
        > & { updated_by?: string | null }
    ): Promise<void> {
        const { error } = await supabase.from('client_alert_delivery').upsert(
            {
                client_id: row.client_id,
                notify_in_app: row.notify_in_app,
                slack_webhook_url: row.slack_webhook_url?.trim() || null,
                slack_channel: row.slack_channel?.trim() || null,
                slack_notify_alert_rules: row.slack_notify_alert_rules ?? false,
                notify_emails: row.notify_emails?.trim() || null,
                updated_at: new Date().toISOString(),
                updated_by: row.updated_by ?? null,
            },
            { onConflict: 'client_id' }
        )
        if (error) throw error
    },

    /**
     * Latest row from `job_runs` for the VPS `ab_test_reports` cron (see docs/FRONTEND_DEV_ADAPTER_JOB_RUNS_RLS_2026-05-16.md).
     * Requires migration `20260516210000_job_runs.sql` and SELECT policy for authenticated.
     */
    async getLastAbJobRun(): Promise<{
        finished_at: string | null
        duration_ms: number | null
        exit_code: number | null
        status: string | null
        scope: string | null
        meta: Record<string, unknown> | null
        error_message: string | null
    } | null> {
        const { data, error } = await supabase
            .from('job_runs')
            .select('finished_at, duration_ms, exit_code, status, scope, meta, error_message')
            .eq('job_name', 'ab_test_reports')
            .order('finished_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        if (error) throw error
        return data as {
            finished_at: string | null
            duration_ms: number | null
            exit_code: number | null
            status: string | null
            scope: string | null
            meta: Record<string, unknown> | null
            error_message: string | null
        } | null
    },
}
