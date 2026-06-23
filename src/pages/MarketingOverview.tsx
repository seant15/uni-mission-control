import { Fragment, useState, useEffect, useRef, useMemo, useCallback, type ComponentType, type ReactNode } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign, TrendingUp, Target, MousePointer, Eye, MousePointer2, CreditCard,
  AlertTriangle, ArrowUpRight, ArrowDownRight,
  Users, ShoppingCart, ChevronDown, Settings2,
} from 'lucide-react'
import { db } from '../lib/api'
import AccountDateRangePicker from '../components/AccountDateRangePicker'
import { defaultCalendarRangeLastNDays, previousComparableCalendarRange } from '../lib/dashboardDateRange'
import { useAuth } from '../contexts/AuthContext'
import { useOverviewFilters } from '../contexts/OverviewFiltersContext'
import { useDensityStackGap } from '../contexts/UiDensityContext'
import { canAccessAlerts, scopedClientIdFromUser } from '../lib/rbac'
import FilterShell from '../components/FilterShell'
import AgencyClientBreakdown from '../components/AgencyClientBreakdown'
import PlatformBadge from '../components/PlatformBadge'
import AlertSystemGuideLink from '../components/AlertSystemGuideLink'
import {
  adsPurchasesPctOfShopify,
  adsReportedConversionsFromRows,
  adsReportedRevenueFromRows,
  rollupShopifyDaily,
  rollupShopifyOrdersFromShapedRows,
} from '../lib/shopifyMetrics'
import { formatSupabaseError } from '../lib/supabaseErrors'
import ShopifyIcon from '../components/ShopifyIcon'
import AgencyKpiLayoutEditor from '../components/AgencyKpiLayoutEditor'
import ClientInsightsSection from '../components/ClientInsightsSection'
import ReportSectionHeader from '../components/ReportSectionHeader'
import {
  formatSpendTargetUsage,
  platformKeyFromBreakdown,
  rollupCostByPlatform,
  sumAdSpendTargetsForClients,
} from '../lib/adSpendTarget'
import {
  cardAppliesToBusiness,
  defaultAgencyKpiLayout,
  normalizeAgencyKpiLayout,
  type AgencyKpiCardId,
} from '../lib/agencyKpiLayout'

interface Client {
  id: string
  name: string
  business_type?: 'leadgen' | 'ecommerce'
  currency?: string
  currency_symbol?: string
  target_ad_spend_30d_by_platform?: unknown
}

function aggregate(rows: any[]) {
  const spend = rows.reduce((s, r) => s + (Number(r.cost) || 0), 0)
  const revenue = rows.reduce((s, r) => s + (Number(r.revenue) || 0), 0)
  const impressions = rows.reduce((s, r) => s + (Number(r.impressions) || 0), 0)
  const clicks = rows.reduce((s, r) => s + (Number(r.clicks) || 0), 0)
  const conversions = rows.reduce((s, r) => s + (Number(r.conversions) || 0), 0)
  return {
    spend, revenue, impressions, clicks, conversions,
    roas: spend > 0 ? revenue / spend : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpa: conversions > 0 ? spend / conversions : 0,
  }
}

function pctChange(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0
  return ((cur - prev) / prev) * 100
}

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

const KPI_ICON_SHELL: Record<string, string> = {
  blue: 'p-1.5 rounded-md bg-[var(--brand-50)] text-[var(--brand-600)]',
  violet: 'p-1.5 rounded-md bg-violet-50 text-violet-600',
  emerald: 'p-1.5 rounded-md bg-emerald-50 text-emerald-600',
  amber: 'p-1.5 rounded-md bg-amber-50 text-amber-600',
  slate: 'p-1.5 rounded-md bg-slate-50 text-slate-600',
  cyan: 'p-1.5 rounded-md bg-cyan-50 text-cyan-600',
  indigo: 'p-1.5 rounded-md bg-indigo-50 text-indigo-600',
  teal: 'p-1.5 rounded-md bg-teal-50 text-teal-600',
}

function MetricCard({ title, value, change, icon: Icon, tone, invertTrend = false }: {
  title: string
  value: string
  change?: number
  icon: ComponentType<{ size?: number | string; className?: string }>
  tone: keyof typeof KPI_ICON_SHELL
  invertTrend?: boolean
}) {
  const isGood = change === undefined ? true : invertTrend ? change <= 0 : change >= 0
  const absChange = change !== undefined ? Math.abs(change) : undefined
  const shell = KPI_ICON_SHELL[tone] ?? KPI_ICON_SHELL.slate
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 transition-shadow hover:shadow-md hover:border-gray-300/80">
      <div className="flex items-start justify-between mb-1 gap-1">
        <div className={`${shell} shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-medium shrink-0 ${isGood ? 'text-green-600' : 'text-red-600'}`}>
            {isGood ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {fmtPct(absChange!)}
          </div>
        )}
      </div>
      <div className="text-lg sm:text-xl font-bold text-gray-900 leading-tight truncate">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5 leading-snug">{title}</div>
    </div>
  )
}

export default function MarketingOverview({
  embedded = false,
  showAgencyExtras = false,
}: {
  embedded?: boolean
  /** When true (Agency View), adds client rollup, attribution pies, and AI-notes / alerts rail. */
  showAgencyExtras?: boolean
}) {
  const { user, appUser } = useAuth()
  const settingsUserId = user?.id ?? 'default_user'
  const queryClient = useQueryClient()
  const densityStackGap = useDensityStackGap()
  const scopedClientId = useMemo(() => scopedClientIdFromUser(appUser), [appUser])
  const {
    ready: filtersReady,
    filters,
    ui,
    setSelectedClient,
    setSelectedPlatform,
    setSelectedAdAccount,
    setDateRange,
    patchUi,
  } = useOverviewFilters()
  const { selectedClient, selectedPlatform, selectedAdAccount, dateRange } = filters
  const { businessType, businessTypeManual } = ui
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const clientDropdownRef = useRef<HTMLDivElement>(null)
  const [kpiEditorOpen, setKpiEditorOpen] = useState(false)
  const [draftKpiLayout, setDraftKpiLayout] = useState(defaultAgencyKpiLayout)
  const [kpiSaveErr, setKpiSaveErr] = useState<string | null>(null)
  const [kpiSaving, setKpiSaving] = useState(false)

  const previousRange = useMemo(
    () => (dateRange.start && dateRange.end ? previousComparableCalendarRange(dateRange) : { start: '', end: '' }),
    [dateRange.start, dateRange.end]
  )

  useEffect(() => {
    if (scopedClientId) {
      setSelectedClient(scopedClientId)
    }
  }, [scopedClientId, setSelectedClient])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const { data: clientsFromTable } = useQuery({
    queryKey: ['clients_table', scopedClientId ?? 'all'],
    queryFn: () => db.getClients(scopedClientId ? { scopedClientId } : undefined),
    staleTime: 10 * 60 * 1000,
  })

  const { data: platformsFromDB } = useQuery({
    queryKey: ['available_platforms'],
    queryFn: db.getAvailablePlatforms,
    staleTime: 10 * 60 * 1000,
  })

  const { data: adAccountsFromDB } = useQuery({
    queryKey: ['ad_accounts', selectedClient, selectedPlatform, scopedClientId ?? ''],
    queryFn: () => db.getAdAccounts({
      clientId: selectedClient,
      platform: selectedPlatform,
      scopedClientId: scopedClientId || undefined,
    }),
    staleTime: 10 * 60 * 1000,
  })

  const clients: Client[] = clientsFromTable || []
  const availablePlatforms = platformsFromDB || []

  useEffect(() => {
    if (businessTypeManual) return
    let clientId = selectedClient
    if (clientId === 'all' && selectedAdAccount && adAccountsFromDB) {
      const match = adAccountsFromDB.find((a: any) => a.id === selectedAdAccount)
      if (match?.client_id) clientId = match.client_id
    }
    if (clientId && clientId !== 'all') {
      const client = clients.find(c => c.id === clientId)
      if (client?.business_type) {
        patchUi({ businessType: client.business_type })
      }
    }
  }, [selectedClient, selectedAdAccount, clients, adAccountsFromDB, businessTypeManual, patchUi])

  const { data: dailyCurRows, isLoading: loadingDailyCur, error: errDailyCur } = useQuery({
    queryKey: ['mkt_cur', dateRange.start, dateRange.end, selectedClient, selectedPlatform, selectedAdAccount, scopedClientId ?? ''],
    queryFn: () => db.getDailyPerformance({
      clientId: selectedClient,
      platform: selectedPlatform,
      adAccountId: selectedAdAccount || undefined,
      startDate: dateRange.start,
      endDate: dateRange.end,
      scopedClientId: scopedClientId || undefined,
    }),
    enabled: filtersReady && !!dateRange.start && !!dateRange.end,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })

  const { data: dailyPrevRows, isLoading: loadingDailyPrev } = useQuery({
    queryKey: ['mkt_prev', previousRange.start, previousRange.end, selectedClient, selectedPlatform, selectedAdAccount, scopedClientId ?? ''],
    queryFn: () => db.getDailyPerformance({
      clientId: selectedClient,
      platform: selectedPlatform,
      adAccountId: selectedAdAccount || undefined,
      startDate: previousRange.start,
      endDate: previousRange.end,
      scopedClientId: scopedClientId || undefined,
    }),
    enabled: filtersReady && !!previousRange.start && !!previousRange.end,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })

  const curRows = dailyCurRows ?? []
  const prevRows = dailyPrevRows ?? []
  const isLoading = loadingDailyCur || loadingDailyPrev
  const error = errDailyCur

  const cur = curRows ? aggregate(curRows) : null
  const prev = prevRows ? aggregate(prevRows) : null

  const dailyTzFootnote = useMemo(() => {
    const rows = curRows || []
    if (rows.length === 0) return null
    const tzs = [...new Set(rows.map((r: { data_timezone?: string | null }) => r.data_timezone).filter(Boolean) as string[])]
    if (tzs.length === 1) {
      return `Daily totals use reporting timezone ${tzs[0]} on rows from daily sync. Days filled only from hourly rollup use UTC hour buckets and may show no timezone until daily sync arrives.`
    }
    if (tzs.length > 1) {
      return `Daily totals mix reporting timezones (${tzs.slice(0, 4).join(', ')}${tzs.length > 4 ? ', …' : ''}). Hourly gap-fill uses UTC buckets.`
    }
    return 'When daily sync lags, some days are summed from hourly UTC slices; they may lack data_timezone until the daily row lands.'
  }, [curRows])

  const spendChange = cur && prev ? pctChange(cur.spend, prev.spend) : undefined
  const ctrChange = cur && prev ? pctChange(cur.ctr, prev.ctr) : undefined
  const convChange = cur && prev ? pctChange(cur.conversions, prev.conversions) : undefined
  const cpaChange = cur && prev ? pctChange(cur.cpa, prev.cpa) : undefined
  const revChange = cur && prev ? pctChange(cur.revenue, prev.revenue) : undefined

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: selectedClient !== 'all' ? (clients.find(c => c.id === selectedClient)?.currency || 'USD') : 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)

  const fmtMetric = (v: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

  const platformBreakdown = curRows
    ? Object.values(
        curRows.reduce((acc: any, row) => {
          const p = row.platform || 'Unknown'
          if (!acc[p]) acc[p] = { platform: p, spend: 0, revenue: 0, conversions: 0 }
          acc[p].spend += Number(row.cost) || 0
          acc[p].revenue += Number(row.revenue) || 0
          acc[p].conversions += Number(row.conversions) || 0
          return acc
        }, {})
      ).map((p: any) => ({
        ...p,
        roas: p.spend > 0 ? p.revenue / p.spend : 0,
        cpa: p.conversions > 0 ? p.spend / p.conversions : 0,
      })).sort((a: any, b: any) => b.spend - a.spend)
    : []

  const rolling30Range = useMemo(() => defaultCalendarRangeLastNDays(30), [])

  const clientsInScope = useMemo(() => {
    if (selectedClient !== 'all') {
      const one = clients.find(c => c.id === selectedClient)
      return one ? [one] : []
    }
    return clients
  }, [clients, selectedClient])

  const aggregatedSpendTargets = useMemo(
    () => sumAdSpendTargetsForClients(clientsInScope),
    [clientsInScope],
  )

  const hasSpendTargets = (aggregatedSpendTargets.meta_ads ?? 0) > 0 || (aggregatedSpendTargets.google_ads ?? 0) > 0

  const { data: rolling30SpendRows = [] } = useQuery({
    queryKey: ['agency-rolling30-spend', selectedClient, scopedClientId ?? ''],
    queryFn: () =>
      db.getDailyPerformance({
        clientId: selectedClient,
        startDate: rolling30Range.start,
        endDate: rolling30Range.end,
        scopedClientId: scopedClientId || undefined,
        adsOnly: true,
      }),
    enabled: hasSpendTargets,
    staleTime: 5 * 60_000,
  })

  const rolling30SpendByPlatform = useMemo(
    () => rollupCostByPlatform(rolling30SpendRows as Array<{ platform?: string; cost?: number }>),
    [rolling30SpendRows],
  )

  const targetSpendLabelForPlatform = useCallback((platform: string) => {
    const key = platformKeyFromBreakdown(platform)
    if (!key) return null
    const target = aggregatedSpendTargets[key]
    if (!target) return null
    const spent = rolling30SpendByPlatform[key] ?? 0
    return formatSpendTargetUsage(spent, target)
  }, [aggregatedSpendTargets, rolling30SpendByPlatform])

  const periodLabel = `${dateRange.start} → ${dateRange.end}`

  const selectedClientName = selectedClient === 'all'
    ? 'All Clients'
    : clients.find(c => c.id === selectedClient)?.name || 'Unknown'

  const showAgencyRollup = showAgencyExtras && selectedClient === 'all' && !scopedClientId

  const { data: shopifyDailyRows = [] } = useQuery({
    queryKey: ['shopify_daily_kpi', dateRange.start, dateRange.end, selectedClient, scopedClientId ?? ''],
    queryFn: () =>
      db.getShopifyDailyPerformance({
        clientId: selectedClient,
        startDate: dateRange.start,
        endDate: dateRange.end,
        scopedClientId: scopedClientId || undefined,
      }),
    enabled: businessType === 'ecommerce' && !!dateRange.start && !!dateRange.end,
    staleTime: 5 * 60_000,
  })

  const { data: prevShopifyRows = [] } = useQuery({
    queryKey: ['shopify_daily_kpi_prev', previousRange.start, previousRange.end, selectedClient, scopedClientId ?? ''],
    queryFn: () =>
      db.getShopifyDailyPerformance({
        clientId: selectedClient,
        startDate: previousRange.start,
        endDate: previousRange.end,
        scopedClientId: scopedClientId || undefined,
      }),
    enabled: businessType === 'ecommerce' && !!previousRange.start && !!previousRange.end,
    staleTime: 5 * 60_000,
  })

  const shopifySplit = useMemo(() => {
    const shop = rollupShopifyDaily(shopifyDailyRows)
    const ads = adsReportedRevenueFromRows(curRows || [])
    return {
      ...shop,
      adsReported: ads,
      adsPctOfShopify: shop.shopifyReal > 0 ? (ads / shop.shopifyReal) * 100 : null,
      adsPctOfAfterReturn: shop.shopifyAfterReturn > 0 ? (ads / shop.shopifyAfterReturn) * 100 : null,
    }
  }, [shopifyDailyRows, curRows])

  const prevShopifySplit = useMemo(() => {
    const shop = rollupShopifyDaily(prevShopifyRows)
    const ads = adsReportedRevenueFromRows(prevRows || [])
    return {
      ...shop,
      adsReported: ads,
      adsPctOfShopify: shop.shopifyReal > 0 ? (ads / shop.shopifyReal) * 100 : null,
      adsPctOfAfterReturn: shop.shopifyAfterReturn > 0 ? (ads / shop.shopifyAfterReturn) * 100 : null,
    }
  }, [prevShopifyRows, prevRows])

  const shopifyKpiHint = useMemo(() => {
    if (businessType !== 'ecommerce') return null
    if (shopifyDailyRows.length === 0) {
      return 'No Shopify daily rows for this client/range. Run sync_shopify_data.py (7+ day backfill) and confirm clients.shopify_store_url + token.'
    }
    if (shopifySplit.shopifyReturns <= 0 && shopifySplit.shopifyReal > 0) {
      return 'Returns are $0 in shopify_daily_performance for this range. Refunds are attributed by refund date (not order date) — run sync_shopify_data.py --backfill-days 30 on the sync host.'
    }
    return null
  }, [businessType, shopifyDailyRows.length, shopifySplit.shopifyReturns, shopifySplit.shopifyReal])

  const adsRevenue = useMemo(() => adsReportedRevenueFromRows(curRows || []), [curRows])
  const prevAdsRevenue = useMemo(() => adsReportedRevenueFromRows(prevRows || []), [prevRows])
  const adsRevChange = cur && prev ? pctChange(adsRevenue, prevAdsRevenue) : undefined

  const adsPurchases = useMemo(() => adsReportedConversionsFromRows(curRows || []), [curRows])
  const prevAdsPurchases = useMemo(() => adsReportedConversionsFromRows(prevRows || []), [prevRows])
  const adsPurchasesChange = pctChange(adsPurchases, prevAdsPurchases)

  const shopifyOrders = useMemo(() => rollupShopifyOrdersFromShapedRows(shopifyDailyRows), [shopifyDailyRows])
  const prevShopifyOrders = useMemo(() => rollupShopifyOrdersFromShapedRows(prevShopifyRows), [prevShopifyRows])
  const shopifyOrdersChange = pctChange(shopifyOrders, prevShopifyOrders)
  const adsPurchasesPctOfShopifyOrders = adsPurchasesPctOfShopify(adsPurchases, shopifyOrders)

  const adsCpa = adsPurchases > 0 && cur ? cur.spend / adsPurchases : 0
  const prevAdsCpa = prevAdsPurchases > 0 && prev ? prev.spend / prevAdsPurchases : 0
  const adsCpaChange = pctChange(adsCpa, prevAdsCpa)

  const reportedRoas = cur && cur.spend > 0 ? adsRevenue / cur.spend : 0
  const prevReportedRoas = prev && prev.spend > 0 ? prevAdsRevenue / prev.spend : 0
  const reportedRoasChange = cur && prev ? pctChange(reportedRoas, prevReportedRoas) : undefined

  const mer = cur && cur.spend > 0 ? shopifySplit.shopifyAfterReturn / cur.spend : 0
  const prevMer = prev && prev.spend > 0 ? prevShopifySplit.shopifyAfterReturn / prev.spend : 0
  const merChange = cur && prev ? pctChange(mer, prevMer) : undefined

  const fmtRatio = (v: number) => (v > 0 ? `${v.toFixed(2)}x` : '—')

  const { data: kpiRow } = useQuery({
    queryKey: ['dashboard-settings-agency-kpi', settingsUserId],
    queryFn: () => db.getSettings(settingsUserId),
    enabled: Boolean(showAgencyExtras && user?.id),
  })
  const resolvedKpiLayout = useMemo(() => normalizeAgencyKpiLayout(kpiRow?.agency_kpi_cards), [kpiRow])
  const agencyKpiVisibleIds = useMemo(
    () =>
      resolvedKpiLayout.order.filter(
        id => !resolvedKpiLayout.hidden[id] && cardAppliesToBusiness(id, businessType),
      ),
    [resolvedKpiLayout, businessType],
  )

  /** Non-agency Overview: same default journey order, no section labels. */
  const defaultKpiVisibleIds = useMemo(() => {
    const layout = defaultAgencyKpiLayout()
    return layout.order.filter(
      id => !layout.hidden[id] && cardAppliesToBusiness(id, businessType),
    )
  }, [businessType])

  const insightsClientId =
    scopedClientId || (selectedClient !== 'all' ? selectedClient : null)
  const insightsClientRecord = useMemo(
    () => (insightsClientId ? clients.find(c => c.id === insightsClientId) : undefined),
    [insightsClientId, clients],
  )

  useEffect(() => {
    if (kpiEditorOpen) {
      setDraftKpiLayout(resolvedKpiLayout)
      setKpiSaveErr(null)
    }
  }, [kpiEditorOpen, resolvedKpiLayout])

  async function persistAgencyKpiLayout() {
    if (!user?.id) {
      setKpiSaveErr('Sign in required to save layout.')
      return
    }
    setKpiSaving(true)
    setKpiSaveErr(null)
    try {
      await db.saveAgencyKpiCards(user.id, draftKpiLayout as unknown as Record<string, unknown>)
      await queryClient.invalidateQueries({ queryKey: ['dashboard-settings-agency-kpi', user.id] })
      setKpiEditorOpen(false)
    } catch (e: unknown) {
      setKpiSaveErr(formatSupabaseError(e))
    } finally {
      setKpiSaving(false)
    }
  }

  function agencyKpiTile(id: AgencyKpiCardId): ReactNode {
    if (!cur || !prev) return null
    switch (id) {
      case 'primary_spend':
        return (
          <MetricCard title="Total Spend" value={fmtMoney(cur.spend)} change={spendChange} icon={DollarSign} tone="blue" />
        )
      case 'primary_ctr':
        return (
          <MetricCard title="CTR" value={`${cur.ctr.toFixed(2)}%`} change={ctrChange} icon={MousePointer2} tone="violet" />
        )
      case 'primary_conversion':
        return businessType === 'leadgen' ? (
          <MetricCard title="Leads" value={fmtMetric(cur.conversions)} change={convChange} icon={Users} tone="emerald" />
        ) : (
          <MetricCard title="Purchases" value={fmtMetric(cur.conversions)} change={convChange} icon={ShoppingCart} tone="emerald" />
        )
      case 'primary_efficiency':
        return businessType === 'leadgen' ? (
          <MetricCard title="Cost Per Lead (CPL)" value={fmtMoney(cur.cpa)} change={cpaChange} icon={CreditCard} tone="amber" invertTrend />
        ) : (
          <MetricCard
            title="Reported revenue / spend"
            value={fmtRatio(reportedRoas)}
            change={reportedRoasChange}
            icon={TrendingUp}
            tone="amber"
          />
        )
      case 'ecom_mer':
        return (
          <MetricCard
            title="MER — after-return Shopify ÷ spend"
            value={fmtRatio(mer)}
            change={merChange}
            icon={ShoppingCart}
            tone="teal"
          />
        )
      case 'traffic_impressions':
        return (
          <MetricCard title="Impressions" value={fmtMetric(cur.impressions)} change={pctChange(cur.impressions, prev.impressions)} icon={Eye} tone="indigo" />
        )
      case 'traffic_clicks':
        return (
          <MetricCard title="Clicks" value={fmtMetric(cur.clicks)} change={pctChange(cur.clicks, prev.clicks)} icon={MousePointer} tone="cyan" />
        )
      case 'traffic_ctr_detail':
        return (
          <MetricCard title="CTR (detail)" value={`${cur.ctr.toFixed(2)}%`} change={pctChange(cur.ctr, prev.ctr)} icon={Target} tone="teal" />
        )
      case 'traffic_cpc':
        return (
          <MetricCard title="CPC" value={fmtMoney(cur.cpc)} change={pctChange(cur.cpc, prev.cpc)} icon={DollarSign} tone="violet" invertTrend />
        )
      case 'ecom_shopify_real':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="flex items-start justify-between mb-1 gap-1">
              <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 shrink-0">
                <ShopifyIcon className="w-4 h-4" />
              </div>
              {prev && (
                <div className={`text-xs font-medium shrink-0 ${pctChange(shopifySplit.shopifyReal, prevShopifySplit.shopifyReal) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmtPct(pctChange(shopifySplit.shopifyReal, prevShopifySplit.shopifyReal))}
                </div>
              )}
            </div>
            <div className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">{fmtMoney(shopifySplit.shopifyReal)}</div>
            <div className="text-xs text-gray-500 mt-0.5">Shopify gross sales</div>
          </div>
        )
      case 'ecom_shopify_returns':
        return (
          <div>
            <MetricCard
              title="Shopify Returns"
              value={fmtMoney(shopifySplit.shopifyReturns)}
              change={pctChange(shopifySplit.shopifyReturns, prevShopifySplit.shopifyReturns)}
              icon={ArrowDownRight}
              tone="amber"
              invertTrend
            />
            {shopifyKpiHint && (
              <p className="text-[10px] text-amber-800 mt-1 leading-snug px-0.5">{shopifyKpiHint}</p>
            )}
          </div>
        )
      case 'ecom_after_return':
        return (
          <MetricCard
            title="After-return Sales"
            value={fmtMoney(shopifySplit.shopifyAfterReturn)}
            change={pctChange(shopifySplit.shopifyAfterReturn, prevShopifySplit.shopifyAfterReturn)}
            icon={ShoppingCart}
            tone="emerald"
          />
        )
      case 'ecom_ads_revenue':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="flex items-start justify-between mb-1 gap-1">
              <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              {adsRevChange !== undefined && (
                <div className={`text-xs font-medium shrink-0 ${adsRevChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {adsRevChange >= 0 ? '+' : ''}{adsRevChange.toFixed(1)}%
                </div>
              )}
            </div>
            <div className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
              {fmtMoney(adsRevenue)}
              {shopifySplit.adsPctOfAfterReturn != null && shopifySplit.shopifyAfterReturn > 0 && (
                <span className="ml-1.5 text-sm font-semibold text-emerald-700">
                  ({shopifySplit.adsPctOfAfterReturn.toFixed(0)}% of after-return)
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Total Revenue (ads-reported)</div>
          </div>
        )
      case 'ecom_ads_purchases':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="flex items-start justify-between mb-1 gap-1">
              <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 shrink-0">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div className={`text-xs font-medium shrink-0 ${adsPurchasesChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmtPct(adsPurchasesChange)}
              </div>
            </div>
            <div className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
              {fmtMetric(adsPurchases)}
              {adsPurchasesPctOfShopifyOrders != null && shopifyOrders > 0 && (
                <span className="ml-1.5 text-sm font-semibold text-emerald-700">
                  ({adsPurchasesPctOfShopifyOrders.toFixed(0)}% of Shopify orders)
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Purchases (ads-reported)</div>
          </div>
        )
      case 'ecom_shopify_orders':
        return (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="flex items-start justify-between mb-1 gap-1">
              <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 shrink-0">
                <ShopifyIcon className="w-4 h-4" />
              </div>
              <div className={`text-xs font-medium shrink-0 ${shopifyOrdersChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmtPct(shopifyOrdersChange)}
              </div>
            </div>
            <div className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">{fmtMetric(shopifyOrders)}</div>
            <div className="text-xs text-gray-500 mt-0.5">Shopify recorded orders</div>
          </div>
        )
      case 'ecom_cpa':
        return (
          <MetricCard
            title="CPA (ads-reported purchases)"
            value={fmtMoney(adsCpa)}
            change={adsCpaChange}
            icon={CreditCard}
            tone="amber"
            invertTrend
          />
        )
      case 'leadgen_total_revenue':
        return (
          <MetricCard title="Total Revenue (if tracked)" value={fmtMoney(cur.revenue)} change={revChange} icon={TrendingUp} tone="emerald" />
        )
      default:
        return null
    }
  }

  if (!filtersReady) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-400">
        Loading filters…
      </div>
    )
  }

  return (
    <div className={`min-w-0 ${showAgencyExtras ? 'space-y-3' : 'space-y-4'}`}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between lg:gap-3">
          {!embedded && (
            <div className="min-w-0 lg:max-w-xl">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">UNI Overview</h1>
              <p className="text-gray-500 text-sm mt-0.5 leading-snug">
                Cross-platform roll-up{showAgencyExtras ? ' — client leaderboard and platform attribution from synced rows' : ''}. Same date range as Heated View; AI notes live on Heated View.
              </p>
            </div>
          )}
        </div>

        {showAgencyExtras && canAccessAlerts(appUser?.role) && (
          <div className="xl:hidden">
            <AlertSystemGuideLink variant="page" />
          </div>
        )}

        <FilterShell stickyBelowHeader>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full">
          <div className="flex rounded-md border border-gray-200 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => patchUi({ businessType: 'leadgen', businessTypeManual: true })}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1 ${businessType === 'leadgen' ? 'bg-[var(--brand-600)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Users size={13} /> Lead Gen
            </button>
            <button
              type="button"
              onClick={() => patchUi({ businessType: 'ecommerce', businessTypeManual: true })}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1 ${businessType === 'ecommerce' ? 'bg-[var(--brand-600)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <ShoppingCart size={13} /> eCommerce
            </button>
          </div>
          {businessTypeManual && (
            <button type="button" onClick={() => patchUi({ businessTypeManual: false })} className="text-xs text-[var(--brand-600)] underline shrink-0">Auto</button>
          )}
          {scopedClientId ? (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-700 min-w-[140px]">
              <span className="flex-1 text-left truncate">{selectedClientName}</span>
            </div>
          ) : (
            <div className="relative" ref={clientDropdownRef}>
              <button
                type="button"
                onClick={() => setShowClientDropdown(!showClientDropdown)}
                className="flex items-center gap-2 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-900 min-w-[140px]"
              >
                <span className="flex-1 text-left truncate">{selectedClientName}</span>
                <ChevronDown size={14} />
              </button>
              {showClientDropdown && (
                <div className="absolute top-full right-0 mt-1 w-full min-w-[200px] bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-56 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => { setSelectedClient('all'); patchUi({ businessTypeManual: false }); setShowClientDropdown(false) }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-900"
                  >
                    All Clients
                  </button>
                  {clients.map(client => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => { setSelectedClient(client.id); patchUi({ businessTypeManual: false }); setShowClientDropdown(false) }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-900"
                    >
                      <div className="text-sm font-medium">{client.name}</div>
                      {client.business_type && (
                        <div className="text-xs text-gray-500">{client.business_type === 'leadgen' ? 'Lead Gen' : 'eCommerce'}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Platform">
            <button
              type="button"
              onClick={() => { setSelectedPlatform('all'); setSelectedAdAccount('') }}
              className={`px-2 py-1 rounded-md text-xs font-medium border transition ${selectedPlatform === 'all' ? 'bg-[var(--brand-600)] text-white border-transparent' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              All
            </button>
            {availablePlatforms.map((platform: { id: string; label: string }) => (
              <button
                key={platform.id}
                type="button"
                onClick={() => { setSelectedPlatform(platform.id); setSelectedAdAccount('') }}
                className={`px-2 py-1 rounded-md text-xs font-medium border transition ${selectedPlatform === platform.id ? 'bg-[var(--brand-600)] text-white border-transparent' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {platform.label}
              </button>
            ))}
          </div>
          {adAccountsFromDB && adAccountsFromDB.length > 0 && (
            <select
              value={selectedAdAccount}
              onChange={(e) => setSelectedAdAccount(e.target.value)}
              className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-md text-xs min-w-[160px]"
            >
              <option value="">All Accounts</option>
              {adAccountsFromDB.map((account: any) => (
                <option key={account.id} value={account.id}>{account.label}</option>
              ))}
            </select>
          )}
          <AccountDateRangePicker dateRange={dateRange} onChange={setDateRange} className="w-full sm:w-auto" />
          {selectedClient !== 'all' && (
            <span className="px-2 py-0.5 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md text-[11px] font-mono font-semibold">
              {clients.find(c => c.id === selectedClient)?.currency || 'USD'}
            </span>
          )}
          </div>
        </FilterShell>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
          <AlertTriangle size={20} />
          <div>
            <div className="font-medium">Failed to load metrics</div>
            <div className="text-sm">{(error as Error).message}</div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-4 border-[var(--brand-600)] border-t-transparent rounded-full animate-spin" />
          <div className="mt-2 text-gray-500">Loading metrics...</div>
        </div>
      )}

      {cur && (
        <>
          {showAgencyExtras ? (
            <>
              {kpiEditorOpen && user?.id && (
                <AgencyKpiLayoutEditor
                  layout={draftKpiLayout}
                  onChange={setDraftKpiLayout}
                  onClose={() => setKpiEditorOpen(false)}
                  onSave={persistAgencyKpiLayout}
                  saving={kpiSaving}
                  saveError={kpiSaveErr}
                />
              )}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <ReportSectionHeader
                  sectionLabel="Performance"
                  title={`KPI cards — ${periodLabel}`}
                />
                <button
                  type="button"
                  onClick={() => setKpiEditorOpen(true)}
                  className="inline-flex items-center gap-1.5 self-start px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50"
                  title="Customize order and visibility"
                >
                  <Settings2 size={14} />
                  KPI layout
                </button>
              </div>
              <div className={`grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 ${densityStackGap}`}>
                {agencyKpiVisibleIds.map(id => (
                  <Fragment key={id}>{agencyKpiTile(id)}</Fragment>
                ))}
              </div>
              {insightsClientId && insightsClientRecord && (
                <ClientInsightsSection
                  clientId={insightsClientId}
                  clientName={insightsClientRecord.name}
                  currencySymbol={insightsClientRecord.currency_symbol || '$'}
                  dateRange={dateRange}
                />
              )}
            </>
          ) : (
            <div className={`grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 ${densityStackGap}`}>
              {defaultKpiVisibleIds.map(id => (
                <Fragment key={id}>{agencyKpiTile(id)}</Fragment>
              ))}
            </div>
          )}

          {showAgencyRollup && (
            <AgencyClientBreakdown dateRange={dateRange} selectedPlatform={selectedPlatform} section="chart" />
          )}

          {platformBreakdown.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <ReportSectionHeader
                sectionLabel="Spend & revenue"
                title={`Performance by platform — ${periodLabel}`}
              />
              <div className="overflow-x-auto mt-3">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Platform</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Spend</th>
                      {hasSpendTargets && (
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">30d target</th>
                      )}
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">ROAS</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Conversions</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">CPA</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(platformBreakdown as any[]).map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm">
                          <PlatformBadge platform={p.platform} />
                        </td>
                        <td className="px-3 py-2 text-sm text-right">{fmtMoney(p.spend)}</td>
                        {hasSpendTargets && (
                          <td className="px-3 py-2 text-sm text-right text-slate-600">
                            {targetSpendLabelForPlatform(p.platform) ?? '—'}
                          </td>
                        )}
                        <td className="px-3 py-2 text-sm text-right text-green-600 font-medium">{fmtMoney(p.revenue)}</td>
                        <td className="px-3 py-2 text-sm text-right">
                          <span className={`font-semibold ${p.roas >= 2 ? 'text-green-600' : p.roas >= 1 ? 'text-[var(--brand-600)]' : 'text-red-600'}`}>
                            {p.roas.toFixed(2)}x
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-right">{fmtMetric(p.conversions)}</td>
                        <td className="px-3 py-2 text-sm text-right text-gray-600">
                          {p.conversions > 0 ? fmtMoney(p.cpa) : '—'}
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-gray-500">
                          {cur.spend > 0 ? ((p.spend / cur.spend) * 100).toFixed(2) : '0.00'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showAgencyRollup && (
            <AgencyClientBreakdown dateRange={dateRange} selectedPlatform={selectedPlatform} section="table" />
          )}

          {dailyTzFootnote && (
            <p className="text-xs text-gray-500 max-w-4xl leading-relaxed">{dailyTzFootnote}</p>
          )}
        </>
      )}

      {!isLoading && !error && !cur && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No data available for {periodLabel}</p>
        </div>
      )}
    </div>
  )
}

