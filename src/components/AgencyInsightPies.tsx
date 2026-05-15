import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

type Dim = 'platforms' | 'devices' | 'ages' | 'demographics'

const DIM_LABELS: Record<Dim, string> = {
  platforms: 'Platforms',
  devices: 'Devices',
  ages: 'Age bands',
  demographics: 'Demographics',
}

type DailyRow = {
  platform?: string | null
  cost?: number | null
  revenue?: number | null
  conversions?: number | null
}

function labelPlatform(raw: string) {
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
    .map(x => ({ name: `${labelPlatform(x.key)} · rev`, value: toRevPct(x.revenue) }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value)

  return { spendSlices, revSlices, spendTotal, revTotal }
}

function mockSlices(dim: Dim): { name: string; value: number }[] {
  switch (dim) {
    case 'devices':
      return [
        { name: 'Mobile', value: 68 },
        { name: 'Desktop', value: 27 },
        { name: 'Tablet', value: 5 },
      ]
    case 'ages':
      return [
        { name: '18–24', value: 22 },
        { name: '25–34', value: 35 },
        { name: '35–44', value: 28 },
        { name: '45+', value: 15 },
      ]
    case 'demographics':
      return [
        { name: 'Segment A', value: 40 },
        { name: 'Segment B', value: 33 },
        { name: 'Segment C', value: 27 },
      ]
    default:
      return [{ name: 'Other', value: 100 }]
  }
}

const COL_A = ['#ea580c', '#fb923c', '#fdba74', '#fed7aa', '#c2410c', '#15803d', '#0ea5e9']
const COL_B = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#0369a1', '#0284c7', '#16a34a', '#a855f7']

type Props = {
  /** Current filtered daily rows (same grain as overview charts). When set, Platforms uses real spend/revenue share. */
  dailyRows?: DailyRow[]
}

export default function AgencyInsightPies({ dailyRows = [] }: Props) {
  const [dim, setDim] = useState<Dim>('platforms')

  const platformAgg = useMemo(() => aggregatePlatformSlices(dailyRows), [dailyRows])

  const left = useMemo(() => {
    if (dim === 'platforms') {
      if (dailyRows.length > 0) {
        const s = platformAgg.spendSlices
        return s.length > 0 ? s : [{ name: 'No spend', value: 100 }]
      }
      return [{ name: 'No rows in range', value: 100 }]
    }
    return mockSlices(dim)
  }, [dim, dailyRows.length, platformAgg.spendSlices])

  const right = useMemo(() => {
    if (dim === 'platforms') {
      if (dailyRows.length > 0) {
        const s = platformAgg.revSlices
        return s.length > 0 ? s : [{ name: 'No revenue', value: 100 }]
      }
      return [{ name: 'No rows in range', value: 100 }]
    }
    const base = mockSlices(dim)
    return base.map((r, i) => ({
      name: `${r.name} · rev`,
      value: Math.max(1, Math.round(r.value * (0.7 + (i % 3) * 0.1))),
    }))
  }, [dim, dailyRows.length, platformAgg.revSlices])

  const platformsLive = dim === 'platforms' && dailyRows.length > 0

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Spend &amp; revenue attribution</h3>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(DIM_LABELS) as Dim[]).map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDim(d)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium border transition ${
                dim === d
                  ? 'border-[var(--brand-600)] bg-[var(--brand-50)] text-[var(--brand-700)]'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {DIM_LABELS[d]}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-slate-500 leading-snug">
        {platformsLive
          ? 'Platforms: spend and revenue share from synced daily rows (ads + Shopify store revenue where present).'
          : 'Platforms uses live data when the overview has rows; other dimensions are illustrative until warehouse breakdowns exist.'}
      </p>
      {!platformsLive && dim !== 'platforms' && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
          Preview only — not connected to your warehouse yet.
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="min-h-[200px]">
          <p className="text-xs font-medium text-slate-600 mb-1 text-center">Spend share{platformsLive ? '' : ' (sample)'}</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={left} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                {left.map((_, i) => (
                  <Cell key={i} fill={COL_A[i % COL_A.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v}%`, 'Share']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="min-h-[200px]">
          <p className="text-xs font-medium text-slate-600 mb-1 text-center">
            Revenue share{platformsLive ? '' : ' (sample)'}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={right} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={72} paddingAngle={2}>
                {right.map((_, i) => (
                  <Cell key={i} fill={COL_B[i % COL_B.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v}%`, 'Share']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
