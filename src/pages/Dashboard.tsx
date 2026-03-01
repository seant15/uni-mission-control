import { useQuery } from '@tanstack/react-query'
import { 
  Activity, Users, Zap, Clock, ArrowRight,
  DollarSign, MousePointer, Eye, Target, BarChart3
} from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  // Agent data
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

  // Sample analytics data (would come from your analytics API)
  const analyticsData = {
    impressions: 2450000,
    clicks: 45200,
    conversions: 1840,
    spend: 28500,
    ctr: 1.84,
    cpc: 0.63,
    conversionRate: 4.07,
    roas: 3.2
  }

  const onlineAgents = agentHealth?.filter(a => a.consecutive_failures === 0).length || 0
  const pendingTasks = tasks?.filter(t => t.status === 'pending').length || 0
  const activeTasks = tasks?.filter(t => t.status === 'claimed').length || 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-500 mt-1">Agent fleet status + Marketing analytics</p>
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

      {/* ANALYTICS SECTION */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 size={20} className="text-indigo-600" />
          Marketing Performance (Last 30 Days)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Impressions"
            value={analyticsData.impressions.toLocaleString()}
            icon={Eye}
            color="indigo"
            subtitle="Total reach"
            trend="+12%"
            trendUp={true}
          />
          <StatCard
            title="Clicks"
            value={analyticsData.clicks.toLocaleString()}
            icon={MousePointer}
            color="blue"
            subtitle={`CTR: ${analyticsData.ctr}%`}
            trend="+8%"
            trendUp={true}
          />
          <StatCard
            title="Conversions"
            value={analyticsData.conversions.toLocaleString()}
            icon={Target}
            color="emerald"
            subtitle={`Rate: ${analyticsData.conversionRate}%`}
            trend="+15%"
            trendUp={true}
          />
          <StatCard
            title="Spend"
            value={`$${analyticsData.spend.toLocaleString()}`}
            icon={DollarSign}
            color="rose"
            subtitle={`ROAS: ${analyticsData.roas}x`}
            trend="-3%"
            trendUp={false}
          />
        </div>
      </section>

      {/* DETAILED METRICS TABLE */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Platform Breakdown</h3>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            View All →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Platform</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Spend</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Impressions</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Clicks</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">CTR</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Conversions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <PlatformRow 
                platform="Google Ads"
                icon="🔍"
                spend="$18,420"
                impressions="1,840,000"
                clicks="33,120"
                ctr="1.80%"
                conversions="1,324"
                status="active"
              />
              <PlatformRow 
                platform="Meta Ads"
                icon="👥"
                spend="$8,250"
                impressions="520,000"
                clicks="10,920"
                ctr="2.10%"
                conversions="438"
                status="active"
              />
              <PlatformRow 
                platform="LinkedIn"
                icon="💼"
                spend="$1,830"
                impressions="90,000"
                clicks="1,160"
                ctr="1.29%"
                conversions="78"
                status="warning"
              />
            </tbody>
          </table>
        </div>
      </section>

      {/* QUICK LINKS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">Mission Control</h3>
          <p className="text-blue-100 mb-4">Manage your agent fleet and tasks</p>
          <a 
            href="/mission-control" 
            className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            Open Mission Control
            <ArrowRight size={16} />
          </a>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">Analytics Deep Dive</h3>
          <p className="text-emerald-100 mb-4">View detailed performance metrics</p>
          <a 
            href="/analytics" 
            className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            View Analytics
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
