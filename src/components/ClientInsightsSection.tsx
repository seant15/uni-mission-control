import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, Package, Sparkles, type LucideIcon } from 'lucide-react'
import { db } from '../lib/api'
import { parseKulProductSplitConfig, type ClientDashboardModule } from '../lib/clientDashboardModules'
import { rollupShopifyProductSplit, productLineGross, type ShopifyProductSplitRollup } from '../lib/shopifyProductSplit'
import type { CalendarDateRange } from '../lib/dashboardDateRange'
import { previousComparableCalendarRange } from '../lib/dashboardDateRange'
import ReportSectionHeader from './ReportSectionHeader'
import { useDensityStackGap } from '../contexts/UiDensityContext'

function pctChange(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0
  return ((cur - prev) / prev) * 100
}

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

/** Signed % + arrow direction (down arrow must pair with −%, not +%). */
function MetricChangeBadge({
  change,
  invertTrend = false,
}: {
  change: number
  invertTrend?: boolean
}) {
  const isGood = invertTrend ? change <= 0 : change >= 0
  const isUp = change > 0
  const isDown = change < 0
  return (
    <div className={`flex items-center gap-0.5 text-xs font-medium shrink-0 ${isGood ? 'text-green-600' : 'text-red-600'}`}>
      {isUp ? <ArrowUpRight size={12} /> : isDown ? <ArrowDownRight size={12} /> : null}
      {fmtPct(change)}
    </div>
  )
}

function fmtMoney(v: number, sym = '$') {
  if (!Number.isFinite(v)) return '—'
  return `${sym}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

const TONE_SHELL: Record<string, string> = {
  brand: 'p-1.5 rounded-md bg-[var(--brand-50)] text-[var(--brand-600)]',
  slate: 'p-1.5 rounded-md bg-slate-50 text-slate-600',
  violet: 'p-1.5 rounded-md bg-violet-50 text-violet-600',
  cyan: 'p-1.5 rounded-md bg-cyan-50 text-cyan-600',
}

function SplitMetricCard({
  title,
  value,
  shareLabel,
  change,
  icon: Icon,
  tone,
  invertTrend = false,
}: {
  title: string
  value: string
  shareLabel: string
  change?: number
  icon: LucideIcon
  tone: keyof typeof TONE_SHELL
  invertTrend?: boolean
}) {
  const shell = TONE_SHELL[tone] ?? TONE_SHELL.slate
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 transition-shadow hover:shadow-md hover:border-gray-300/80">
      <div className="flex items-start justify-between mb-1 gap-1">
        <div className={`${shell} shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        {change !== undefined && (
          <MetricChangeBadge change={change} invertTrend={invertTrend} />
        )}
      </div>
      <div className="text-lg sm:text-xl font-bold text-gray-900 leading-tight truncate">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5 leading-snug">{title}</div>
      <div className="text-[11px] text-gray-400 mt-0.5">{shareLabel}</div>
    </div>
  )
}

function MixBar({ label, machinePct }: { label: string; machinePct: number }) {
  const accessoryPct = 100 - machinePct
  return (
    <div className="rounded-lg border border-[var(--uni-border)] p-3 bg-[var(--uni-surface)]">
      <div className="text-xs text-[var(--uni-text-muted)] mb-2">{label}</div>
      <div className="h-2 rounded-full bg-[var(--uni-border)] overflow-hidden flex">
        <div className="h-full bg-[var(--brand-600)] transition-all" style={{ width: `${machinePct}%` }} />
        <div className="h-full bg-slate-400 flex-1" />
      </div>
      <div className="flex justify-between text-xs text-[var(--uni-text-muted)] mt-1.5">
        <span>Machines {machinePct.toFixed(1)}%</span>
        <span>Accessories {accessoryPct.toFixed(1)}%</span>
      </div>
    </div>
  )
}

function ReconciliationStrip({
  rollup,
  currencySymbol,
}: {
  rollup: ShopifyProductSplitRollup
  currencySymbol: string
}) {
  const productLines = productLineGross(rollup)
  const shopifyOrderGross = rollup.orderGross
  const taxShippingGap = Math.max(0, shopifyOrderGross - productLines)
  const subtotalRef = rollup.productSubtotal > 0 ? rollup.productSubtotal : productLines
  const splitVsSubtotalGap =
    rollup.productSubtotal > 0 ? Math.max(0, rollup.productSubtotal - productLines) : 0

  const needsBackfill =
    rollup.daysWithOrders > 0 &&
    rollup.daysWithProductSplit < rollup.daysWithOrders &&
    productLines < shopifyOrderGross * 0.85

  const splitPctOfShopify =
    shopifyOrderGross > 0 ? (productLines / shopifyOrderGross) * 100 : null

  return (
    <div className="rounded-lg border border-[var(--uni-border)] bg-[color-mix(in_srgb,var(--uni-border)_18%,var(--uni-surface))] px-3 py-2.5 space-y-2">
      <p className="text-[11px] text-[var(--uni-text-muted)] leading-snug">
        Machine + accessory = product line items only. Shopify gross (top KPI) = order total incl. tax &amp; shipping.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-[var(--uni-text-muted)]">Shopify gross (orders)</span>
          <div className="font-semibold text-[var(--uni-text)] tabular-nums">
            {fmtMoney(shopifyOrderGross, currencySymbol)}
          </div>
          <span className="text-[10px] text-[var(--uni-text-dim)]">Same as Performance KPI</span>
        </div>
        <div>
          <span className="text-[var(--uni-text-muted)]">Product lines (machines + accessories)</span>
          <div className="font-semibold text-[var(--uni-text)] tabular-nums">
            {fmtMoney(productLines, currencySymbol)}
            {splitPctOfShopify != null && (
              <span className="ml-1 font-normal text-[var(--uni-text-muted)]">
                ({splitPctOfShopify.toFixed(0)}% of order gross)
              </span>
            )}
          </div>
        </div>
        <div>
          <span className="text-[var(--uni-text-muted)]">Tax, shipping &amp; other</span>
          <div className="font-semibold text-[var(--uni-text)] tabular-nums">
            {fmtMoney(taxShippingGap, currencySymbol)}
          </div>
        </div>
      </div>
      {needsBackfill && (
        <p className="uni-callout-warn text-[11px]">
          Product split only covers {rollup.daysWithProductSplit} of {rollup.daysWithOrders} day(s) with Shopify
          orders in this range. Re-run{' '}
          <code className="text-[10px]">sync_shopify_data.py --client kul --backfill-days 30</code> on the sync host
          to backfill machine/accessory columns.
        </p>
      )}
      {!needsBackfill && splitVsSubtotalGap > shopifyOrderGross * 0.05 && rollup.productSubtotal > 0 && (
        <p className="text-[11px] text-[var(--uni-text-muted)]">
          Line-item split is {fmtMoney(splitVsSubtotalGap, currencySymbol)} below Shopify product subtotal (
          {fmtMoney(subtotalRef, currencySymbol)}) — check for bundles or custom line items.
        </p>
      )}
    </div>
  )
}

function KulProductSplitPanel({
  clientName,
  title,
  rollup,
  prevRollup,
  currencySymbol,
}: {
  clientName: string
  title: string
  rollup: ShopifyProductSplitRollup
  prevRollup: ShopifyProductSplitRollup
  currencySymbol: string
}) {
  const gap = useDensityStackGap()
  const productLines = productLineGross(rollup)
  const totalUnits = rollup.machineUnits + rollup.accessoryUnits
  const machineRevPct = productLines > 0 ? (rollup.machineGross / productLines) * 100 : 0
  const accessoryRevPct = productLines > 0 ? (rollup.accessoryGross / productLines) * 100 : 0
  const machineUnitPct = totalUnits > 0 ? (rollup.machineUnits / totalUnits) * 100 : 0
  const accessoryUnitPct = totalUnits > 0 ? (rollup.accessoryUnits / totalUnits) * 100 : 0

  return (
    <div className="uni-card overflow-hidden">
      <div className="uni-card-header">
        <ReportSectionHeader
          sectionLabel="Client insights"
          title={`${title} — ${clientName}`}
        />
        <p className="text-[11px] text-[var(--uni-text-muted)] mt-1 px-4 pb-2">
          Spark / Spring = machines; all other line items = accessories. Mix % is of product lines only (not Shopify order gross).
        </p>
      </div>
      <div className={`uni-card-body space-y-3`}>
        <ReconciliationStrip rollup={rollup} currencySymbol={currencySymbol} />
        <div className={`grid grid-cols-2 lg:grid-cols-4 ${gap}`}>
          <SplitMetricCard
            title="Machine sales (gross)"
            value={fmtMoney(rollup.machineGross, currencySymbol)}
            shareLabel={`${machineRevPct.toFixed(1)}% of product lines`}
            change={pctChange(rollup.machineGross, prevRollup.machineGross)}
            icon={Sparkles}
            tone="brand"
          />
          <SplitMetricCard
            title="Accessory sales (gross)"
            value={fmtMoney(rollup.accessoryGross, currencySymbol)}
            shareLabel={`${accessoryRevPct.toFixed(1)}% of product lines`}
            change={pctChange(rollup.accessoryGross, prevRollup.accessoryGross)}
            icon={Package}
            tone="slate"
          />
          <SplitMetricCard
            title="Machine units sold"
            value={rollup.machineUnits.toLocaleString()}
            shareLabel={`${machineUnitPct.toFixed(1)}% of units`}
            change={pctChange(rollup.machineUnits, prevRollup.machineUnits)}
            icon={Sparkles}
            tone="violet"
          />
          <SplitMetricCard
            title="Accessory units sold"
            value={rollup.accessoryUnits.toLocaleString()}
            shareLabel={`${accessoryUnitPct.toFixed(1)}% of units`}
            change={pctChange(rollup.accessoryUnits, prevRollup.accessoryUnits)}
            icon={Package}
            tone="cyan"
          />
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-2 ${gap}`}>
          <MixBar label="Sales mix" machinePct={machineRevPct} />
          <MixBar label="Unit mix" machinePct={machineUnitPct} />
        </div>
      </div>
    </div>
  )
}

export default function ClientInsightsSection({
  clientId,
  clientName,
  currencySymbol = '$',
  dateRange,
}: {
  clientId: string
  clientName: string
  currencySymbol?: string
  dateRange: CalendarDateRange
}) {
  const previousRange = useMemo(
    () => (dateRange.start && dateRange.end ? previousComparableCalendarRange(dateRange) : { start: '', end: '' }),
    [dateRange.start, dateRange.end],
  )

  const { data: modules = [] } = useQuery({
    queryKey: ['client-dashboard-modules', clientId],
    queryFn: () => db.getClientDashboardModules(clientId),
    enabled: !!clientId,
    staleTime: 5 * 60_000,
  })

  const active = (modules as ClientDashboardModule[]).filter(m => m.is_active)
  const hasKul = active.some(m => m.module_key === 'kul_product_split')

  const { data: splitRows = [] } = useQuery({
    queryKey: ['shopify-product-split', clientId, dateRange.start, dateRange.end],
    queryFn: () =>
      db.getShopifyProductSplitDaily({
        clientId,
        startDate: dateRange.start,
        endDate: dateRange.end,
      }),
    enabled: hasKul && !!dateRange.start && !!dateRange.end,
    staleTime: 5 * 60_000,
  })

  const { data: prevSplitRows = [] } = useQuery({
    queryKey: ['shopify-product-split-prev', clientId, previousRange.start, previousRange.end],
    queryFn: () =>
      db.getShopifyProductSplitDaily({
        clientId,
        startDate: previousRange.start,
        endDate: previousRange.end,
      }),
    enabled: hasKul && !!previousRange.start && !!previousRange.end,
    staleTime: 5 * 60_000,
  })

  if (!active.length) return null

  const rollup = rollupShopifyProductSplit(splitRows as Array<Record<string, unknown>>)
  const prevRollup = rollupShopifyProductSplit(prevSplitRows as Array<Record<string, unknown>>)

  return (
    <div className="space-y-3">
      {active.map(mod => {
        if (mod.module_key === 'kul_product_split') {
          const cfg = parseKulProductSplitConfig(mod.config_json)
          return (
            <KulProductSplitPanel
              key={mod.id}
              clientName={clientName}
              title={cfg.title ?? 'Machine vs accessories'}
              rollup={rollup}
              prevRollup={prevRollup}
              currencySymbol={currencySymbol}
            />
          )
        }
        return null
      })}
    </div>
  )
}
