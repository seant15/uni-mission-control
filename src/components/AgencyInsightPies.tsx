import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

type DailyRow = {
  platform?: string | null
  cost?: number | null
  revenue?: number | null
  conversions?: number | null
}

const CHART_COLORS = [
  'var(--uni-chart-1)',
  'var(--uni-chart-2)',
  'var(--uni-chart-3)',
  'var(--uni-chart-4)',
  'var(--uni-chart-5)',
  'var(--uni-chart-6)',
]

function labelPlatform(raw: string) {
  const key = raw.toLowerCase()
  const labels: Record<string, string> = {
    meta_ads: 'Meta Ads',
    google_ads: 'Google Ads',
    shopify: 'Shopify',
    tiktok_ads: 'TikTok Ads',
  }
  if (labels[key]) return labels[key]
  const s = raw.replace(/_/g, ' ')
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Unknown'
}

function aggregatePlatformSlices(rows: DailyRow[]) {
  const map = new Map<string, { key: string; spend: number; revenue: number }>()
  for (const r of rows) {
    const key = (r.platform || 'unknown').toLowerCase()
    if (!map.has(key)) map.set(key, { key, spend: 0, revenue: 0 })
    const e = map.get(key)!
    e.spend += Number(r.cost) || 0
    e.revenue += Number(r.revenue) || 0
  }
  const spendTotal = [...map.values()].reduce((s, x) => s + x.spend, 0)
  const revTotal = [...map.values()].reduce((s, x) => s + x.revenue, 0)
  const toSpendPct = (spend: number) =>
    spendTotal > 0 ? Math.round((spend / spendTotal) * 1000) / 10 : spend > 0 ? 100 : 0
  const toRevPct = (rev: number) =>
    revTotal > 0 ? Math.round((rev / revTotal) * 1000) / 10 : rev > 0 ? 100 : 0

  const spendSlices = [...map.values()]
    .map(x => ({ name: labelPlatform(x.key), value: toSpendPct(x.spend) }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value)

  const revSlices = [...map.values()]
    .map(x => ({ name: labelPlatform(x.key), value: toRevPct(x.revenue) }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value)

  return { spendSlices, revSlices, spendTotal, revTotal }
}

type Props = {
  /** Filtered daily rows from db.getDailyPerformance (ads + Shopify merge + hourly fill). */
  dailyRows?: DailyRow[]
}

export default function AgencyInsightPies({ dailyRows = [] }: Props) {
  const platformAgg = useMemo(() => aggregatePlatformSlices(dailyRows), [dailyRows])
  const hasRows = dailyRows.length > 0
  const hasSpend = platformAgg.spendTotal > 0
  const hasRevenue = platformAgg.revTotal > 0

  const spendSlices = useMemo(() => {
    if (!hasRows) return [{ name: 'No data', value: 100 }]
    const s = platformAgg.spendSlices
    return s.length > 0 ? s : [{ name: 'No ad spend', value: 100 }]
  }, [hasRows, platformAgg.spendSlices])

  const revSlices = useMemo(() => {
    if (!hasRows) return [{ name: 'No data', value: 100 }]
    const s = platformAgg.revSlices
    return s.length > 0 ? s : [{ name: 'No revenue', value: 100 }]
  }, [hasRows, platformAgg.revSlices])

  return (
    <div className="uni-card">
      <div className="uni-card-header flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="uni-section-label mb-2">Attribution</p>
          <h3 className="uni-card-title">Spend &amp; revenue by platform</h3>
        </div>
        <span className="uni-badge-live">Warehouse · live</span>
      </div>
      <div className="uni-card-body space-y-3">
        <p className="uni-panel-muted">
          Shares from synced daily_performance plus Shopify store revenue (hourly gap-fill when daily lags).
          Device, age, and demographic splits are not in the warehouse yet.
        </p>
        {!hasRows && (
          <p className="uni-callout-warn">
            No rows in the selected date range. Run marketing sync and{' '}
            <code className="font-mono text-[10px]">sync_shopify_data.py --backfill-days 7</code> to populate.
          </p>
        )}
        {hasRows && !hasSpend && hasRevenue && (
          <p className="uni-callout-warn">
            Spend share is empty but revenue exists (e.g. Shopify-only). Revenue pie reflects store orders.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="min-h-[200px]">
            <p className="uni-table-head mb-2 text-center">Spend share</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={spendSlices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={72}
                  paddingAngle={2}
                >
                  {spendSlices.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v}%`, 'Share']} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="min-h-[200px]">
            <p className="uni-table-head mb-2 text-center">Revenue share</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={revSlices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={72}
                  paddingAngle={2}
                >
                  {revSlices.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v}%`, 'Share']} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 pt-1 border-t border-[var(--uni-border)]">
          <span className="uni-pill uni-pill-active cursor-default">Platforms</span>
          {(['Devices', 'Age bands', 'Demographics'] as const).map(label => (
            <span key={label} className="uni-pill opacity-50 cursor-not-allowed" title="Not synced to warehouse yet">
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
