import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Activity, CheckCircle, AlertCircle, Clock, Plus, Filter, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { AgentTask, AgentHealth } from '../types'

const AGENTS = [
  { name: 'clover', emoji: '🍀', role: 'Management' },
  { name: 'mary', emoji: '📡', role: 'Communications' },
  { name: 'openclaw', emoji: '🛡️', role: 'Monitoring' },
  { name: 'nexus', emoji: '🔗', role: 'Integrations' },
  { name: 'writer', emoji: '✍️', role: 'Content' },
  { name: 'kimi', emoji: '🧪', role: 'Technology' },
]

const PRIORITIES = ['low', 'normal', 'high', 'urgent']
const STATUSES = ['all', 'pending', 'claimed', 'completed', 'failed']

export default function MissionControl() {
  const [filter, setFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null)
  const queryClient = useQueryClient()

  // Fetch data
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', filter],
    queryFn: async () => {
      let query = supabase.from('agent_tasks').select('*')
      if (filter !== 'all') query = query.eq('status', filter)
      const { data } = await query.order('created_at', { ascending: false })
      return data as AgentTask[]
    },
  })

  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data } = await supabase.from('agent_health').select('*')
      return data as AgentHealth[]
    },
  })

  // Real-time subscriptions
  useEffect(() => {
    const sub = supabase
      .channel('tasks')
      .on('postgres_changes', { event: '*', table: 'agent_tasks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
      })
      .subscribe()
    return () => sub.unsubscribe()
  }, [queryClient])

  // Mutations
  const createTask = useMutation({
    mutationFn: async (task: Partial<AgentTask>) => {
      const { data } = await supabase.from('agent_tasks').insert(task).select().single()
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setShowCreateModal(false)
    },
  })

  const claimTask = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from('agent_tasks')
        .update({ status: 'claimed', claimed_at: new Date().toISOString() })
        .eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const completeTask = useMutation({
    mutationFn: async ({ id, result, error }: { id: string; result?: any; error?: string }) => {
      await supabase
        .from('agent_tasks')
        .update({
          status: error ? 'failed' : 'completed',
          completed_at: new Date().toISOString(),
          result,
          error_message: error,
        })
        .eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const getAgentStatus = (name: string) => {
    const health = healthData?.find(h => h.agent_name === name)
    if (!health) return { status: 'offline', failures: 0 }
    return {
      status: health.consecutive_failures > 2 ? 'error' :
              health.consecutive_failures > 0 ? 'warning' : 'online',
      failures: health.consecutive_failures,
    }
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    createTask.mutate({
      from_agent: 'user',
      to_agent: fd.get('to_agent') as string,
      task_type: fd.get('task_type') as string,
      priority: fd.get('priority') as string,
      payload: JSON.parse((fd.get('payload') as string) || '{}'),
      status: 'pending',
    })
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Mission Control</h1>

      {/* Agent Fleet */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Agent Fleet</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENTS.map(agent => {
            const status = getAgentStatus(agent.name)
            const activeCount = tasks?.filter(t => t.to_agent === agent.name && t.status === 'claimed').length || 0
            
            return (
              <div key={agent.name} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{agent.emoji}</span>
                    <div>
                      <h3 className="font-semibold capitalize">{agent.name}</h3>
                      <p className="text-xs text-gray-500">{agent.role}</p>
                    </div>
                  </div>
                  <StatusDot status={status.status} />
                </div>
                <div className="mt-3 text-sm">
                  <p className="capitalize text-gray-600">{status.status}</p>
                  {activeCount > 0 && <p className="text-blue-600">{activeCount} active tasks</p>}
                  {status.failures > 0 && <p className="text-red-600">{status.failures} failures</p>}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Task Queue */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Task Queue</h2>
          <div className="flex items-center gap-3">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="border rounded-md px-3 py-1.5"
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Plus size={16} />
              New Task
            </button>
          </div>
        </div>

        {tasksLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">To</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Priority</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tasks?.map(task => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-4 py-3 text-sm">{task.task_type}</td>
                    <td className="px-4 py-3 text-sm capitalize">{task.to_agent}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm capitalize ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {task.status === 'pending' && (
                          <button
                            onClick={() => claimTask.mutate(task.id)}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded"
                          >
                            Claim
                          </button>
                        )}
                        {task.status === 'claimed' && (
                          <>
                            <button
                              onClick={() => completeTask.mutate({ id: task.id, result: {} })}
                              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => completeTask.mutate({ id: task.id, error: 'Failed' })}
                              className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded"
                            >
                              Fail
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSelectedTask(task)}
                          className="text-xs px-2 py-1 border rounded"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Create Task Modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)} title="Create New Task">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Assign To</label>
              <select name="to_agent" required className="w-full border rounded-md px-3 py-2">
                <option value="">Select...</option>
                {AGENTS.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Task Type</label>
              <input name="task_type" required className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select name="priority" required className="w-full border rounded-md px-3 py-2">
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payload (JSON)</label>
              <textarea name="payload" rows={3} className="w-full border rounded-md px-3 py-2 font-mono text-sm" />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">
                Create
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <Modal onClose={() => setSelectedTask(null)} title="Task Details">
          <div className="space-y-3 text-sm">
            <p><span className="text-gray-500">ID:</span> {selectedTask.id}</p>
            <p><span className="text-gray-500">Status:</span> <StatusBadge status={selectedTask.status} /></p>
            <p><span className="text-gray-500">From:</span> {selectedTask.from_agent}</p>
            <p><span className="text-gray-500">To:</span> {selectedTask.to_agent}</p>
            <p><span className="text-gray-500">Type:</span> {selectedTask.task_type}</p>
            <div>
              <span className="text-gray-500">Payload:</span>
              <pre className="mt-1 bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                {JSON.stringify(selectedTask.payload, null, 2)}
              </pre>
            </div>
            {selectedTask.result && (
              <div>
                <span className="text-gray-500">Result:</span>
                <pre className="mt-1 bg-green-50 p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify(selectedTask.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// Helper components
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    offline: 'bg-gray-400',
  }
  return <div className={`w-3 h-3 rounded-full ${colors[status] || colors.offline}`} />
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    claimed: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }
  const icons: Record<string, any> = {
    pending: Clock,
    claimed: Loader2,
    completed: CheckCircle,
    failed: AlertCircle,
  }
  const Icon = icons[status] || Clock
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs capitalize ${styles[status]}`}>
      <Icon size={12} className={status === 'claimed' ? 'animate-spin' : ''} />
      {status}
    </span>
  )
}

function getPriorityColor(priority: string) {
  const colors: Record<string, string> = {
    urgent: 'text-red-600 font-bold',
    high: 'text-orange-600 font-semibold',
    normal: 'text-blue-600',
    low: 'text-gray-500',
  }
  return colors[priority] || colors.low
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
