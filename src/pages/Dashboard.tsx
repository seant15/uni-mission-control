import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Activity, Users, Zap, Clock, ArrowRight,
  BarChart3, AlertCircle, Rocket, Database
} from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [error, setError] = useState<string | null>(null)

  // Agent data with error handling
  const { data: agentHealth, error: healthError } = useQuery({
    queryKey: ['agentHealth'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('agent_health').select('*')
        if (error) {
          setError(`Agent health error: ${error.message}`)
          return []
        }
        return data || []
      } catch (err: any) {
        setError(`Agent health exception: ${err.message}`)
        return []
      }
    },
  })

  const { data: tasks, error: tasksError } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('agent_tasks').select('*')
        if (error) {
          setError(`Tasks error: ${error.message}`)
          return []
        }
        return data || []
      } catch (err: any) {
        setError(`Tasks exception: ${err.message}`)
        return []
      }
    },
  })

  const onlineAgents = agentHealth?.filter(a => a.consecutive_failures === 0).length || 0
  const pendingTasks = tasks?.filter(t => t.status === 'pending').length || 0
  const activeTasks = tasks?.filter(t => t.status === 'claimed').length || 0

  return (
    <div className="space-y-8">
      {/* Error Notification */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-red-600" size={20} />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-500 mt-1">Agent fleet management dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Systems Operational
          </span>
        </div>
      </div>

      {/* AGENT FLEET SECTION */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users size={20} className="text-blue-600" />
          Agent Fleet Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Online Agents"
            value={onlineAgents}
            total={6}
            icon={Users}
            color="blue"
            subtitle="Ready for tasks"
          />
          <StatCard
            title="Pending Tasks"
            value={pendingTasks}
            icon={Clock}
            color="amber"
            subtitle="Awaiting assignment"
          />
          <StatCard
            title="Active Tasks"
            value={activeTasks}
            icon={Zap}
            color="emerald"
            subtitle="In progress"
          />
          <StatCard
            title="System Health"
            value="98%"
            icon={Activity}
            color="violet"
            subtitle="Uptime last 24h"
          />
        </div>
      </section>

      {/* AGENT STATUS CARDS */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {['clover', 'mary', 'openclaw', 'nexus', 'writer', 'kimi'].map((agentName) => {
            const health = agentHealth?.find(h => h.agent_name === agentName)
            const agentTasks = tasks?.filter(t => t.to_agent === agentName)
            const activeCount = agentTasks?.filter(t => t.status === 'claimed').length || 0
            const emojiMap: Record<string, string> = {
              clover: '🍀', mary: '📡', openclaw: '🛡️',
              nexus: '🔗', writer: '✍️', kimi: '🧪'
            }
            
            return (
              <div key={agentName} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{emojiMap[agentName]}</span>
                  <div>
                    <h3 className="font-semibold capitalize">{agentName}</h3>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${health?.consecutive_failures === 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-xs text-gray-500">
                        {health?.consecutive_failures === 0 ? 'Online' : 'Issues'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  <p>Active tasks: {activeCount}</p>
                  <p>Total tasks: {agentTasks?.length || 0}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* QUICK LINKS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Rocket size={20} />
            Mission Control
          </h3>
          <p className="text-blue-100 mb-4">Manage agent fleet and task queue</p>
          <a 
            href="/mission-control" 
            className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            Open Mission Control
            <ArrowRight size={16} />
          </a>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-6 text-white">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Database size={20} />
            Data Analytics
          </h3>
          <p className="text-emerald-100 mb-4">Marketing performance metrics</p>
          <a 
            href="/data-analytics" 
            className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            View Data Analytics
            <ArrowRight size={16} />
          </a>
        </div>

        <div className="bg-gradient-to-br from-violet-600 to-purple-600 rounded-2xl p-6 text-white">
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <BarChart3 size={20} />
            Task Analytics
          </h3>
          <p className="text-violet-100 mb-4">Task performance and metrics</p>
          <a 
            href="/task-analytics" 
            className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            View Task Analytics
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </div>
  )
}

// Components
interface StatCardProps {
  title: string
  value: string | number
  total?: number
  icon: any
  color: string
  subtitle: string
  trend?: string
  trendUp?: boolean
}

function StatCard({ title, value, total, icon: Icon, color, subtitle, trend, trendUp }: StatCardProps) {
  const colorSchemes: Record<string, { bg: string; icon: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
    violet: { bg: 'bg-violet-50', icon: 'text-violet-600' },
    indigo: { bg: 'bg-indigo-50', icon: 'text-indigo-600' },
    rose: { bg: 'bg-rose-50', icon: 'text-rose-600' },
  }
  
  const scheme = colorSchemes[color]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold text-gray-900">
              {value}
              {total && <span className="text-lg text-gray-400 font-normal">/{total}</span>}
            </p>
            {trend && (
              <span className={`text-sm font-medium ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
                {trend}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
        </div>
        <div className={`p-3 rounded-xl ${scheme.bg}`}>
          <Icon size={22} className={scheme.icon} />
        </div>
      </div>
    </div>
  )
}

interface PlatformRowProps {
  platform: string
  icon: string
  spend: string
  impressions: string
  clicks: string
  ctr: string
  conversions: string
  status: 'active' | 'warning' | 'error'
}

function PlatformRow({ platform, icon, spend, impressions, clicks, ctr, conversions, status }: PlatformRowProps) {
  const statusColors = {
    active: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <span className="font-medium text-gray-900">{platform}</span>
          <span className={`text-xs px-2 py-1 rounded-full ${statusColors[status]}`}>
            {status}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 text-right font-medium text-gray-900">{spend}</td>
      <td className="px-6 py-4 text-right text-gray-600">{impressions}</td>
      <td className="px-6 py-4 text-right text-gray-600">{clicks}</td>
      <td className="px-6 py-4 text-right">
        <span className="text-emerald-600 font-medium">{ctr}</span>
      </td>
      <td className="px-6 py-4 text-right">
        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-sm font-medium">
          {conversions}
        </span>
      </td>
    </tr>
  )
}
