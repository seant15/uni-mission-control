import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle, AlertCircle, Clock, Plus, Loader2, RotateCcw,
  MessageSquare, Eye, Trash2, Send, Paperclip, Mic, X
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { db } from '../lib/api'
import { spawnSession, sendMessage, getSessionStatus, listSessions, uploadFile } from '../lib/openclaw'
import { spawnSessionMock, sendMessageMock, getSessionStatusMock, listSessionsMock, uploadFileMock } from '../lib/openclaw-mock'
import { mockAgentHealth } from '../lib/mock-data'
import type { AgentTask, AgentHealth } from '../types'

// Use real OpenClaw API when VITE_USE_MOCK_DATA is not 'true'
const USE_MOCK_DATA = (import.meta as any).env.VITE_USE_MOCK_DATA === 'true'

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

interface ChatMessage {
  id: string
  agent: string
  from: 'user' | 'agent'
  message: string
  type: 'text' | 'voice' | 'attachment'
  timestamp: string
  attachmentUrl?: string
}

export default function MissionControl() {
  const [filter, setFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null)
  const [showChatModal, setShowChatModal] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [chatAgent, _setChatAgent] = useState<string>('')
  const [chatMessage, setChatMessage] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // Fetch data
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', filter],
    queryFn: () => db.getTasks(filter),
  })

  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        // Return mock data when flag is enabled
        await new Promise(resolve => setTimeout(resolve, 200))
        return mockAgentHealth
      }
      const { data } = await supabase.from('agent_health').select('*')
      return data as AgentHealth[]
    },
  })

  const { data: activeSessions } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: USE_MOCK_DATA ? listSessionsMock : listSessions,
    refetchInterval: 10000,
  })

  // Real-time subscriptions
  useEffect(() => {
    const tasksChannel = supabase
      .channel('tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_tasks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
      })
      .subscribe()

    const healthChannel = supabase
      .channel('agent_health')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_health' }, () => {
        queryClient.invalidateQueries({ queryKey: ['health'] })
      })
      .subscribe()

    return () => {
      tasksChannel.unsubscribe()
      healthChannel.unsubscribe()
    }
  }, [queryClient])

  // Mutations
  const createTask = useMutation({
    mutationFn: async (task: Partial<AgentTask>) => {
      const { data, error } = await supabase.from('agent_tasks').insert(task).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setShowCreateModal(false)
    },
  })

  const claimTask = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('agent_tasks').update({ status: 'claimed', claimed_at: new Date().toISOString() }).eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const completeTask = useMutation({
    mutationFn: async ({ id, result, error }: { id: string; result?: any; error?: string }) => {
      await supabase.from('agent_tasks').update({
        status: error ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        result,
        error_message: error,
      }).eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const resetTask = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('agent_tasks').update({
        status: 'pending',
        claimed_at: null,
        completed_at: null,
        error_message: null,
      }).eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('agent_tasks').delete().eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const getAgentStatus = (name: string) => {
    const health = healthData?.find(h => h.agent_name === name)
    if (!health) return { status: 'offline', failures: 0, lastCheck: null }
    return {
      status: health.consecutive_failures > 2 ? 'error' :
        health.consecutive_failures > 0 ? 'warning' : 'online',
      failures: health.consecutive_failures,
      lastCheck: health.checked_at,
    }
  }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    createTask.mutate({
      from_agent: 'user',
      to_agent: fd.get('to_agent') as string,
      task_type: fd.get('task_type') as string,
      priority: fd.get('priority') as 'low' | 'normal' | 'high' | 'urgent',
      payload: JSON.parse((fd.get('payload') as string) || '{}'),
      status: 'pending',
    })
  }

  const openChat = (_agentName: string) => {
    // Open OpenClaw Control UI in new tab
    const OPENCLAW_UI_URL = (import.meta as any).env.VITE_OPENCLAW_GATEWAY_URL || 'http://open.unippc24.com:9090'
    window.open(OPENCLAW_UI_URL, '_blank')
  }

  const [activeSession, setActiveSession] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const sendChatMessage = async () => {
    if (!chatMessage.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      agent: chatAgent,
      from: 'user',
      message: chatMessage,
      type: 'text',
      timestamp: new Date().toISOString()
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatMessage('')

    try {
      if (!activeSession) {
        // Spawn a new session (use mock if flag is enabled)
        const session = USE_MOCK_DATA
          ? await spawnSessionMock(chatAgent, chatMessage)
          : await spawnSession(chatAgent, chatMessage)
        setActiveSession(session.sessionKey)
        startPolling(session.sessionKey)
      } else {
        // Send message to existing session (use mock if flag is enabled)
        if (USE_MOCK_DATA) {
          await sendMessageMock(activeSession, chatMessage)
        } else {
          await sendMessage(activeSession, chatMessage)
        }
      }
    } catch (error) {
      console.error('Failed to communicate with agent:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        agent: chatAgent,
        from: 'agent',
        message: 'Sorry, I could not process your request. Please try again.',
        type: 'text',
        timestamp: new Date().toISOString()
      }
      setChatMessages(prev => [...prev, errorMessage])
    }
  }

  const startPolling = (sessionKey: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current)

    let consecutiveErrors = 0
    const maxErrors = 3

    pollingRef.current = setInterval(async () => {
      try {
        const status = USE_MOCK_DATA
          ? await getSessionStatusMock(sessionKey)
          : await getSessionStatus(sessionKey)
        consecutiveErrors = 0 // Reset error count on success

        if (status.lastMessage) {
          const agentResponse: ChatMessage = {
            id: Date.now().toString(),
            agent: chatAgent,
            from: 'agent',
            message: status.lastMessage,
            type: 'text',
            timestamp: new Date().toISOString()
          }
          setChatMessages(prev => {
            // Avoid duplicate messages if polling returns the same lastMessage
            const last = prev[prev.length - 1]
            if (last && last.from === 'agent' && last.message === status.lastMessage) return prev
            return [...prev, agentResponse]
          })

          // Clean up session state when completed or failed
          if (status.status === 'completed' || status.status === 'failed') {
            setActiveSession(null)
            stopPolling()
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
        consecutiveErrors++

        // Stop polling after consecutive errors
        if (consecutiveErrors >= maxErrors) {
          const errorMsg: ChatMessage = {
            id: Date.now().toString(),
            agent: chatAgent,
            from: 'agent',
            message: '⚠️ Connection lost. Please try again.',
            type: 'text',
            timestamp: new Date().toISOString()
          }
          setChatMessages(prev => [...prev, errorMsg])
          setActiveSession(null)
          stopPolling()
        }
      }
    }, 2000)
  }

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  useEffect(() => {
    return () => stopPolling()
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeSession) return

    try {
      const fileUrl = USE_MOCK_DATA
        ? await uploadFileMock(activeSession, file)
        : await uploadFile(activeSession, file)

      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        agent: chatAgent,
        from: 'user',
        message: `📎 Attached: ${file.name}`,
        type: 'attachment',
        timestamp: new Date().toISOString(),
        attachmentUrl: fileUrl
      }

      setChatMessages(prev => [...prev, newMessage])
    } catch (error) {
      console.error('File upload failed:', error)
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        agent: chatAgent,
        from: 'agent',
        message: '❌ Failed to upload file. Please try again.',
        type: 'text',
        timestamp: new Date().toISOString()
      }
      setChatMessages(prev => [...prev, errorMsg])
    }
  }

  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false)

      // TODO: Implement actual voice recording
      // For now, show a placeholder message
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        agent: chatAgent,
        from: 'user',
        message: '🎤 Voice message (0:15)',
        type: 'voice',
        timestamp: new Date().toISOString()
      }
      setChatMessages(prev => [...prev, newMessage])

      // In production, you would:
      // 1. Stop the MediaRecorder
      // 2. Get the audio blob
      // 3. Upload it via uploadFile()
      // 4. Send the audio URL to the agent
    } else {
      // Start recording
      try {
        // Check if browser supports media recording
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Voice recording not supported in this browser')
        }

        // Request microphone permission
        await navigator.mediaDevices.getUserMedia({ audio: true })
        setIsRecording(true)

        // TODO: Initialize MediaRecorder here
      } catch (error) {
        console.error('Failed to start recording:', error)
        const errorMsg: ChatMessage = {
          id: Date.now().toString(),
          agent: chatAgent,
          from: 'agent',
          message: '❌ Microphone access denied or not available.',
          type: 'text',
          timestamp: new Date().toISOString()
        }
        setChatMessages(prev => [...prev, errorMsg])
      }
    }
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
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{agent.emoji}</span>
                    <div>
                      <h3 className="font-semibold capitalize">{agent.name}</h3>
                      <p className="text-xs text-gray-500">{agent.role}</p>
                    </div>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${status.status === 'online' ? 'bg-green-500' : status.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="capitalize text-gray-700">{status.status}</span>
                    {activeSessions?.some(s => s.agentId === agent.name) && (
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-bold uppercase animate-pulse">
                        Live Session
                      </span>
                    )}
                  </div>
                  {activeCount > 0 && (
                    <div className="text-sm text-blue-600">{activeCount} active task{activeCount > 1 ? 's' : ''}</div>
                  )}
                </div>
                {/* Chat button - uses real OpenClaw API or mock based on USE_MOCK_DATA */}
                <button
                  onClick={() => openChat(agent.name)}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <MessageSquare size={16} />
                  Chat with {agent.name}
                </button>
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
            <select value={filter} onChange={e => setFilter(e.target.value)} className="border rounded-md px-3 py-1.5">
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              <Plus size={16} />
              New Task
            </button>
          </div>
        </div>

        {tasksLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">To</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Priority</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks?.map(task => (
                  <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4"><StatusBadge status={task.status} /></td>
                    <td className="py-3 px-4 text-sm">{task.task_type}</td>
                    <td className="py-3 px-4 text-sm capitalize">{task.to_agent}</td>
                    <td className="py-3 px-4"><span className={`text-sm capitalize ${getPriorityColor(task.priority)}`}>{task.priority}</span></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {task.status === 'pending' && (
                          <button onClick={() => claimTask.mutate(task.id)} className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md">Claim</button>
                        )}
                        {task.status === 'claimed' && (
                          <>
                            <button onClick={() => completeTask.mutate({ id: task.id, result: {} })} className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-md">Complete</button>
                            <button onClick={() => completeTask.mutate({ id: task.id, error: 'Failed' })} className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-md">Fail</button>
                          </>
                        )}
                        {(task.status === 'failed' || task.status === 'completed') && (
                          <button onClick={() => resetTask.mutate(task.id)} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md flex items-center gap-1">
                            <RotateCcw size={12} />
                            Reset
                          </button>
                        )}
                        <button onClick={() => setSelectedTask(task)} className="text-xs px-3 py-1.5 border rounded-md flex items-center gap-1">
                          <Eye size={12} />
                          View
                        </button>
                        <button onClick={() => deleteTask.mutate(task.id)} className="text-xs px-3 py-1.5 bg-red-50 text-red-700 rounded-md flex items-center gap-1">
                          <Trash2 size={12} />
                          Delete
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
                <option value="">Select agent...</option>
                {AGENTS.map(agent => <option key={agent.name} value={agent.name}>{agent.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Task Type</label>
              <input name="task_type" placeholder="e.g., google_ads_report" required className="w-full border rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select name="priority" required className="w-full border rounded-md px-3 py-2">
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payload (JSON)</label>
              <textarea name="payload" placeholder='{"key": "value"}' rows={4} className="w-full border rounded-md px-3 py-2 font-mono text-sm" />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-gray-600">Cancel</button>
              <button type="submit" disabled={createTask.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-md">{createTask.isPending ? 'Creating...' : 'Create Task'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <Modal onClose={() => setSelectedTask(null)} title="Task Details">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">ID:</span><span className="font-mono">{selectedTask.id}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status:</span><StatusBadge status={selectedTask.status} /></div>
            <div className="flex justify-between"><span className="text-gray-500">From:</span><span>{selectedTask.from_agent}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">To:</span><span className="capitalize">{selectedTask.to_agent}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Type:</span><span>{selectedTask.task_type}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Priority:</span><span className={`capitalize ${getPriorityColor(selectedTask.priority)}`}>{selectedTask.priority}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Created:</span><span>{new Date(selectedTask.created_at).toLocaleString()}</span></div>
            {selectedTask.claimed_at && <div className="flex justify-between"><span className="text-gray-500">Claimed:</span><span>{new Date(selectedTask.claimed_at).toLocaleString()}</span></div>}
            {selectedTask.completed_at && <div className="flex justify-between"><span className="text-gray-500">Completed:</span><span>{new Date(selectedTask.completed_at).toLocaleString()}</span></div>}
            <div className="pt-4 border-t">
              <span className="text-gray-500 block mb-2">Payload:</span>
              <pre className="bg-gray-100 p-3 rounded-md overflow-x-auto text-xs">{JSON.stringify(selectedTask.payload, null, 2)}</pre>
            </div>
            {selectedTask.result && (
              <div className="pt-4 border-t">
                <span className="text-gray-500 block mb-2">Result:</span>
                <pre className="bg-green-50 p-3 rounded-md overflow-x-auto text-xs">{JSON.stringify(selectedTask.result, null, 2)}</pre>
              </div>
            )}
            {selectedTask.error_message && (
              <div className="pt-4 border-t">
                <span className="text-gray-500 block mb-2">Error:</span>
                <pre className="bg-red-50 p-3 rounded-md overflow-x-auto text-xs text-red-600">{selectedTask.error_message}</pre>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Chat Modal */}
      {showChatModal && chatAgent && (
        <Modal onClose={() => setShowChatModal(false)} title={`Chat with ${chatAgent}`}>
          <div className="space-y-4">
            {/* Chat Messages */}
            <div className="bg-gray-50 rounded-lg p-4 h-80 overflow-y-auto space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-400 py-8">Start a conversation with {chatAgent}</div>
              ) : (
                chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.from === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200'
                      }`}>
                      <p>{msg.message}</p>
                      <span className={`text-xs ${msg.from === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Area */}
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="*/*"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="Attach file"
              >
                <Paperclip size={20} />
              </button>

              <button
                onClick={toggleRecording}
                className={`p-2 rounded-lg ${isRecording ? 'bg-red-100 text-red-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                title={isRecording ? 'Stop recording' : 'Record voice'}
              >
                <Mic size={20} />
              </button>

              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                placeholder="Type your message..."
                className="flex-1 border rounded-lg px-4 py-2"
              />

              <button
                onClick={sendChatMessage}
                disabled={!chatMessage.trim()}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Send size={20} />
              </button>
            </div>

            {isRecording && (
              <div className="text-center text-red-600 text-sm animate-pulse">
                🔴 Recording... Click mic to stop
              </div>
            )}

            <div className="text-xs text-gray-500 text-center">
              Supports: Text, Voice Messages, File Attachments
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
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
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}