import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, User, Inbox } from 'lucide-react'
import { db } from '../../lib/api'
import type { AlertCounts } from '../../types/alerts'

export default function AlertSummaryBar() {
  const { data: counts } = useQuery<AlertCounts>({
    queryKey: ['alert-counts'],
    queryFn:  db.getAlertCounts.bind(db),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const stats = [
    {
      label: 'Total Open',
      value: counts?.total_open ?? '—',
      icon:  Inbox,
      color: 'text-slate-700',
      bg:    'bg-white',
    },
    {
      label: 'Critical',
      value: counts?.critical ?? '—',
      icon:  AlertTriangle,
      color: 'text-red-700',
      bg:    'bg-red-50',
    },
    {
      label: 'Assigned to Me',
      value: counts?.assigned_to_me ?? '—',
      icon:  User,
      color: 'text-blue-700',
      bg:    'bg-blue-50',
    },
    {
      label: 'Resolved Today',
      value: counts?.resolved_today ?? '—',
      icon:  CheckCircle,
      color: 'text-green-700',
      bg:    'bg-green-50',
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map(stat => (
        <div key={stat.label} className={`${stat.bg} rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3`}>
          <stat.icon size={22} className={stat.color} />
          <div>
            <div className="text-xs text-gray-500 font-medium">{stat.label}</div>
            <div className={`text-2xl font-bold mt-0.5 ${stat.color}`}>{stat.value}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
