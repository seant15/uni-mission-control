import { useQuery } from '@tanstack/react-query'
import { BarChart, BarChart3, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const AGENTS = [
  { name: 'clover', emoji: '🍀', role: 'Management' },
  { name: 'mary', emoji: '📡', role: 'Communications' },
  { name: 'openclaw', emoji: '🛡️', role: 'Monitoring' },
  { name: 'nexus', emoji: '🔗', role: 'Integrations' },
  { name: 'writer', emoji: '✍️', role: 'Content' },
  { name: 'kimi', emoji: '🧪', role: 'Technology' },
]

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function TaskAnalytics() {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['taskAnalytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_tasks')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
    },
  })

  // Calculate stats
  const stats = {
    total: tasks?.length || 0,
    pending: tasks?.filter(t => t.status === 'pending').length || 0,
    claimed: tasks?.filter(t => t.status === 'claimed').length || 0,
    completed: tasks?.filter(t => t.status === 'completed').length || 0,
    failed: tasks?.filter(t => t.status === 'failed').length || 0,
  }

  // Tasks by agent
  const tasksByAgent = AGENTS.map((agent, index) => ({
    name: agent.name,
    tasks: tasks?.filter(t => t.to_agent === agent.name).length || 0,
    color: COLORS[index],
  })).filter(a => a.tasks > 0)

  // Tasks by status for pie chart
  const statusData = [
    { name: 'Pending', value: stats.pending, color: '#f59e0b' },
    { name: 'Claimed', value: stats.claimed, color: '#3b82f6' },
    { name: 'Completed', value: stats.completed, color: '#10b981' },
    { name: 'Failed', value: stats.failed, color: '#ef4444' },
  ].filter(s => s.value > 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <BarChart3 className="text-blue-600" />
          Task Analytics
        </h1>
        <p className="text-gray-500 mt-1">Performance metrics for agent task queue</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard title="Total Tasks" value={stats.total} icon={BarChart3} color="gray" />
        <StatCard title="Pending" value={stats.pending} icon={Clock} color="amber" />
        <StatCard title="Active" value={stats.claimed} icon={Loader2} color="blue" />
        <StatCard title="Completed" value={stats.completed} icon={CheckCircle} color="emerald" />
        <StatCard title="Failed" value={stats.failed} icon={AlertCircle} color="red" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks by Agent */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tasks by Agent</h3>
          {tasksByAgent.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No task data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ReBarChart data={tasksByAgent}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="tasks" radius={[4, 4, 0, 0]}>
                  {tasksByAgent.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </ReBarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Distribution</h3>
          {statusData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No status data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          
          {/* Legend */}
          <div className="flex justify-center gap-4 mt-4">
            {statusData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-gray-600">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Tasks Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Tasks</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Task</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Agent</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tasks?.slice(0, 10).map(task => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{task.task_type}</p>
                    <p className="text-sm text-gray-500">From: {task.from_agent}</p>
                  </td>
                  <td className="px-6 py-4 capitalize">{task.to_agent}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(task.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-50 text-gray-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    claimed: 'bg-blue-100 text-blue-800',
    completed: 'bg-emerald-100 text-emerald-800',
    failed: 'bg-red-100 text-red-800',
  }

  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${styles[status] || styles.pending}`}>
      {status}
    </span>
  )
}
