import { useQuery } from '@tanstack/react-query'
import { db } from '../lib/api'
import { parseKulProductSplitConfig, type ClientDashboardModule } from '../lib/clientDashboardModules'
import { rollupShopifyProductSplit } from '../lib/shopifyProductSplit'
import type { CalendarDateRange } from '../lib/dashboardDateRange'
import { Package, Sparkles } from 'lucide-react'
import ReportSectionHeader from './ReportSectionHeader'
import { useDensityStackGap } from '../contexts/UiDensityContext'

function fmtMoney(v: number, sym = '$') {
  if (!Number.isFinite(v)) return '—'
  return `${sym}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function KulProductSplitPanel({
  clientName,
  title,
  rollup,
  currencySymbol,
}: {
  clientName: string
  title: string
  rollup: ReturnType<typeof rollupShopifyProductSplit>
  currencySymbol: string
}) {
  const gap = useDensityStackGap()
  const totalGross = rollup.machineGross + rollup.accessoryGross
  const machinePct = totalGross > 0 ? (rollup.machineGross / totalGross) * 100 : 0
  return (
    <div className="uni-card overflow-hidden">
      <div className="uni-card-header">
        <ReportSectionHeader sectionLabel="Client insights" title={`${title} — ${clientName}`} />
      </div>
      <div className={`uni-card-body grid grid-cols-2 lg:grid-cols-4 ${gap}`}>
        <div className="rounded-lg border border-[var(--uni-border)] p-3 bg-[var(--uni-surface)]">
          <div className="flex items-center gap-2 text-xs text-[var(--uni-text-muted)] mb-1">
            <Sparkles size={14} className="text-[var(--brand-600)]" />
            Machines (Spark / Spring)
          </div>
          <div className="text-xl font-bold text-[var(--uni-text)]">{fmtMoney(rollup.machineGross, currencySymbol)}</div>
          <div className="text-xs text-[var(--uni-text-muted)] mt-0.5">{rollup.machineUnits.toLocaleString()} units</div>
        </div>
        <div className="rounded-lg border border-[var(--uni-border)] p-3 bg-[var(--uni-surface)]">
          <div className="flex items-center gap-2 text-xs text-[var(--uni-text-muted)] mb-1">
            <Package size={14} />
            Accessories (CO₂, filters, etc.)
          </div>
          <div className="text-xl font-bold text-[var(--uni-text)]">{fmtMoney(rollup.accessoryGross, currencySymbol)}</div>
          <div className="text-xs text-[var(--uni-text-muted)] mt-0.5">{rollup.accessoryUnits.toLocaleString()} units</div>
        </div>
        <div className="rounded-lg border border-[var(--uni-border)] p-3 bg-[var(--uni-surface)] col-span-2">
          <div className="text-xs text-[var(--uni-text-muted)] mb-2">Mix (gross line revenue)</div>
          <div className="h-2 rounded-full bg-[var(--uni-border)] overflow-hidden flex">
            <div className="h-full bg-[var(--brand-600)]" style={{ width: `${machinePct}%` }} />
            <div className="h-full bg-slate-400 flex-1" />
          </div>
          <div className="flex justify-between text-xs text-[var(--uni-text-muted)] mt-1.5">
            <span>Machines {machinePct.toFixed(0)}%</span>
            <span>Accessories {(100 - machinePct).toFixed(0)}%</span>
          </div>
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

  if (!active.length) return null

  const rollup = rollupShopifyProductSplit(splitRows as Array<Record<string, unknown>>)

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
              currencySymbol={currencySymbol}
            />
          )
        }
        return null
      })}
    </div>
  )
}
