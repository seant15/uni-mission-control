import type { FeedbackRow } from '../../types/feedback'
import { MessageSquare, AlertCircle, Clock, CheckCircle2 } from 'lucide-react'

interface Props {
  rows: FeedbackRow[]
}

export default function FeedbackStats({ rows }: Props) {
  const total = rows.length
  const newCount = rows.filter(r => r.status === 'new' || r.status === 'acknowledged').length
  const inProgress = rows.filter(r => r.status === 'in_progress').length

  const thisMonth = new Date()
  thisMonth.setDate(1)
  thisMonth.setHours(0, 0, 0, 0)
  const resolvedThisMonth = rows.filter(
    r => r.status === 'resolved' && new Date(r.created_at) >= thisMonth
  ).length

  const tiles = [
    { label: 'Total',           value: total,            icon: MessageSquare,  color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'New / Unresolved',value: newCount,         icon: AlertCircle,    color: 'text-amber-600',  bg: 'bg-amber-50' },
    { label: 'In Progress',     value: inProgress,       icon: Clock,          color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Resolved (month)',value: resolvedThisMonth,icon: CheckCircle2,   color: 'text-green-600',  bg: 'bg-green-50' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {tiles.map(t => (
        <div key={t.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl ${t.bg} flex items-center justify-center flex-shrink-0`}>
            <t.icon size={20} className={t.color} />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{t.value}</p>
            <p className="text-xs text-gray-500">{t.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
