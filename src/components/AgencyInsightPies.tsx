import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

type Dim = 'platforms' | 'devices' | 'ages' | 'demographics'

const DIM_LABELS: Record<Dim, string> = {
  platforms: 'Platforms (placeholder)',
  devices: 'Devices (placeholder)',
  ages: 'Age bands (placeholder)',
  demographics: 'Demographics (placeholder)',
}

/** Placeholder slices — replace with API-driven breakdowns when data pipelines exist. */
function mockSlices(dim: Dim): { name: string; value: number }[] {
  switch (dim) {
    case 'platforms':
      return [
        { name: 'Meta', value: 52 },
        { name: 'Google', value: 38 },
        { name: 'TikTok', value: 10 },
      ]
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

const COL_A = ['#ea580c', '#fb923c', '#fdba74', '#fed7aa', '#c2410c']
const COL_B = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#0369a1', '#0284c7']

export default function AgencyInsightPies() {
  const [dim, setDim] = useState<Dim>('platforms')
  const left = useMemo(() => mockSlices(dim), [dim])
  const right = useMemo(() => {
    const base = mockSlices(dim)
    return base.map((r, i) => ({
      name: `${r.name} · rev`,
      value: Math.max(1, Math.round(r.value * (0.7 + (i % 3) * 0.1))),
    }))
  }, [dim])

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
              {DIM_LABELS[d].replace(' (placeholder)', '')}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-slate-500 leading-snug">
        Modular chart slots — dimensions switch UI only; wire to warehouse / Ads breakdown APIs later.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="min-h-[200px]">
          <p className="text-xs font-medium text-slate-600 mb-1 text-center">Spend share</p>
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
          <p className="text-xs font-medium text-slate-600 mb-1 text-center">Revenue share (mock)</p>
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
