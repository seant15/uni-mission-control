import { useQuery } from '@tanstack/react-query'
import { Activity, Users, Zap, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const { data: agentHealth } = useQuery({
    queryKey: ['agentHealth'],
    queryFn: async () => {
      const { data } = await supabase.from('agent_health').select('*')
      return data || []
    },
  })

  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('agent_tasks').select('*')
      return data || []
    },
  })

  const onlineAgents = agentHealth?.filter(a => a.consecutive_failures === 0).length || 0
  const pendingTasks = tasks?.filter(t => t.status === 'pending').length || 0
  const activeTasks = tasks?.filter(t => t.status === 'claimed').length || 0

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard Overview</h1>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Online Agents"
          value={onlineAgents}
          total={6}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Pending Tasks"
          value={pendingTasks}
          icon={Activity}
          color="yellow"
        />
        <StatCard
          title="Active Tasks"
          value={activeTasks}
          icon={Zap}
          color="green"
        />
        <StatCard
          title="System Status"
          value="Healthy"
          icon={AlertCircle}
          color="green"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickActionButton
            label="View Agent Fleet"
            description="Monitor all agents"
            onClick={() => window.location.href = '/mission-control'}
          />
          <QuickActionButton
            label="Create Task"
            description="Assign work to agents"
            onClick={() => window.location.href = '/mission-control'}
          />
          <QuickActionButton
            label="View Analytics"
            description="Check performance metrics"
            onClick={() => window.location.href = '/analytics'}
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, total, icon: Icon, color }: any) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {value}
            {total && <span className="text-lg text-gray-400">/{total}</span>}
          </p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  )
}

function QuickActionButton({ label, description, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
    >
      <h3 className="font-semibold text-gray-900">{label}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </button>
  )
}
