export interface AgentTask {
  id: string
  from_agent: string
  to_agent: string
  task_type: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  payload: any
  status: 'pending' | 'claimed' | 'completed' | 'failed'
  created_at: string
  claimed_at?: string
  completed_at?: string
  result?: any
  error_message?: string
}

export interface AgentHealth {
  id: string
  agent_name: string
  check_type: string
  status: string
  last_success?: string
  consecutive_failures: number
  error_details?: any
  checked_at: string
}

// Re-export domain types
export * from './alerts'
export * from './clients'
export * from './marketing'
