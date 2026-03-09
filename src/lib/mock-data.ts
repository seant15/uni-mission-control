import type { AgentHealth, AgentTask } from '../types'

export const mockAgentHealth: AgentHealth[] = [
  { id: '1', agent_name: 'clover', check_type: 'heartbeat', status: 'healthy', last_success: new Date().toISOString(), consecutive_failures: 0, checked_at: new Date().toISOString() },
  { id: '2', agent_name: 'mary', check_type: 'heartbeat', status: 'healthy', last_success: new Date().toISOString(), consecutive_failures: 0, checked_at: new Date().toISOString() },
  { id: '3', agent_name: 'openclaw', check_type: 'heartbeat', status: 'healthy', last_success: new Date().toISOString(), consecutive_failures: 0, checked_at: new Date().toISOString() },
  { id: '4', agent_name: 'nexus', check_type: 'heartbeat', status: 'healthy', last_success: new Date().toISOString(), consecutive_failures: 0, checked_at: new Date().toISOString() },
  { id: '5', agent_name: 'writer', check_type: 'heartbeat', status: 'healthy', last_success: new Date().toISOString(), consecutive_failures: 0, checked_at: new Date().toISOString() },
  { id: '6', agent_name: 'kimi', check_type: 'heartbeat', status: 'healthy', last_success: new Date().toISOString(), consecutive_failures: 0, checked_at: new Date().toISOString() }
]

export const mockAgentTasks: AgentTask[] = [
  { id: '1', from_agent: 'clover', to_agent: 'mary', task_type: 'analyze', priority: 'high', payload: {}, status: 'pending', created_at: new Date().toISOString() },
  { id: '2', from_agent: 'mary', to_agent: 'writer', task_type: 'write', priority: 'normal', payload: {}, status: 'claimed', created_at: new Date().toISOString(), claimed_at: new Date().toISOString() }
]

export const mockTasks = mockAgentTasks
