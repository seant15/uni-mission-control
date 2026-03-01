import { useQuery } from '@tanstack/react-query'
import { Activity, Users, Zap, AlertCircle, TrendingUp, Clock, ArrowRight } from 'lucide-react'
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
  const completedToday = tasks?.filter(t => 
    t.status === 'completed' && 
    new Date(t.completed_at || '').toDateString() === new Date().toDateString()
  ).length || 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-500 mt-1">Welcome back, here's what's happening today</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-full">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          System Operational
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Online Agents"
          value={onlineAgents}
          total={6}
          icon={Users}
          trend="+2"
          trendUp={true}
          color="blue"
          subtitle="Agents ready"
        />
        <StatCard
          title="Pending Tasks"
          value={pendingTasks}
          icon={Activity}
          trend="+5"
          trendUp={true}
          color="amber"
          subtitle="Awaiting action"
        />
        <StatCard
          title="Active Tasks"
          value={activeTasks}
          icon={Zap}
          trend="-1"
          trendUp={false}
          color="emerald"
          subtitle="In progress"
        />
        <StatCard
          title="Completed Today"
          value={completedToday}
          icon={TrendingUp}
          trend="+12"
          trendUp={true}
          color="violet"
          subtitle="Tasks done"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <QuickActionCard
              icon={Users}
              title="View Agent Fleet"
              description="Monitor all 6 agents status and health"
              href="/mission-control"
              color="blue"
            />
            <QuickActionCard
              icon={Zap}
              title="Create Task"
              description="Assign new work to any agent"
              href="/mission-control"
              color="amber"
            />
            <QuickActionCard
              icon={TrendingUp}
              title="View Analytics"
              description="Check performance metrics and trends"
              href="/analytics"
              color="emerald"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Activity</h2>
          <div className="space-y-4">
            <ActivityItem
              icon={Clock}
              title="System Check"
              time="2 min ago"
              status="success"
            />
            <ActivityItem
              icon={Activity}
              title="Task Completed"
              time="5 min ago"
              status="success"
            />
            <ActivityItem
              icon={AlertCircle}
              title="Health Alert"
              time="15 min ago"
              status="warning"
            />
          </div>
        </div>
      </div>

      {/* System Status Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">All Systems Operational</h3>
            <p className="text-blue-100 mt-1">
              {onlineAgents} of 6 agents online • {activeTasks} tasks active • {pendingTasks} pending
            </p>
          </div>
          <a 
            href="/mission-control" 
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
          >
            View Details
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: number
  total?: number
  icon: any
  trend: string
  trendUp: boolean
  color: string
  subtitle: string
}

function StatCard({ title, value, total, icon: Icon, trend, trendUp, color, subtitle }: StatCardProps) {
  const colorSchemes: Record<string, { bg: string; icon: string; trend: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', trend: 'text-blue-600' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', trend: 'text-amber-600' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', trend: 'text-emerald-600' },
    violet: { bg: 'bg-violet-50', icon: 'text-violet-600', trend: 'text-violet-600' },
  }
  
  const scheme = colorSchemes[color]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-3xl font-bold text-gray-900">
              {value}
              {total && <span className="text-lg text-gray-400 font-normal">/{total}</span>}
            </p>
            <span className={`text-sm font-medium ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
              {trend}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-xl ${scheme.bg}`}>
          <Icon size={24} className={scheme.icon} />
        </div>
      </div>
    </div>
  )
}

interface QuickActionCardProps {
  icon: any
  title: string
  description: string
  href: string
  color: string
}

function QuickActionCard({ icon: Icon, title, description, href, color }: QuickActionCardProps) {
  const colorSchemes: Record<string, string> = {
    blue: 'hover:border-blue-500 hover:shadow-blue-100',
    amber: 'hover:border-amber-500 hover:shadow-amber-100',
    emerald: 'hover:border-emerald-500 hover:shadow-emerald-100',
  }

  return (
    <a
      href={href}
      className={`block p-5 border border-gray-200 rounded-xl hover:shadow-lg transition-all ${colorSchemes[color]}`}
    >
      <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
        <Icon size={24} className="text-gray-600" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </a>
  )
}

interface ActivityItemProps {
  icon: any
  title: string
  time: string
  status: 'success' | 'warning' | 'error'
}

function ActivityItem({ icon: Icon, title, time, status }: ActivityItemProps) {
  const statusColors = {
    success: 'bg-emerald-100 text-emerald-600',
    warning: 'bg-amber-100 text-amber-600',
    error: 'bg-red-100 text-red-600',
  }

  return (
    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusColors[status]}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1">
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{time}</p>
      </div>
    </div>
  )
}
