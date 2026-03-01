import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

const mockData = [
  { name: 'Mon', tasks: 12, completions: 10 },
  { name: 'Tue', tasks: 19, completions: 15 },
  { name: 'Wed', tasks: 15, completions: 14 },
  { name: 'Thu', tasks: 25, completions: 20 },
  { name: 'Fri', tasks: 22, completions: 18 },
  { name: 'Sat', tasks: 8, completions: 8 },
  { name: 'Sun', tasks: 10, completions: 9 },
]

const agentPerformance = [
  { agent: 'Clover', tasks: 45, success: 98 },
  { agent: 'Mary', tasks: 62, success: 95 },
  { agent: 'OpenClaw', tasks: 128, success: 99 },
  { agent: 'Nexus', tasks: 34, success: 92 },
  { agent: 'Writer', tasks: 56, success: 96 },
  { agent: 'Kimi', tasks: 23, success: 94 },
]

export default function Analytics() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Analytics</h1>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Task Volume (Last 7 Days)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={mockData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="tasks" fill="#3b82f6" name="Created" />
              <Bar dataKey="completions" fill="#10b981" name="Completed" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Success Rate by Agent</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={agentPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="agent" />
              <YAxis domain={[80, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="success" stroke="#8b5cf6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Total Tasks" value="234" change="+12%" positive />
        <StatCard title="Completion Rate" value="94%" change="+3%" positive />
        <StatCard title="Avg Response Time" value="2.3s" change="-0.5s" positive />
        <StatCard title="Active Sessions" value="8" change="+2" positive />
      </div>
    </div>
  )
}

function StatCard({ title, value, change, positive }: { title: string; value: string; change: string; positive: boolean }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <p className={`text-sm mt-2 ${positive ? 'text-green-600' : 'text-red-600'}`}>
        {positive ? '↑' : '↓'} {change} from last week
      </p>
    </div>
  )
}
