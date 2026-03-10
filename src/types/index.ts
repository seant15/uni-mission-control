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

export interface Agent {
  id: string
  name: string
  emoji: string
  role: string
  status: 'online' | 'offline' | 'warning' | 'error'
  lastCheck: string
  consecutiveFailures: number
  activeTasks: number
}

export interface SyncProgress {
  id: string
  integration_id: string
  status: 'idle' | 'syncing' | 'success' | 'error'
  progress: number
  current_step: string
  records_synced: number
  estimated_total: number
  error?: string
  started_at: string
  updated_at: string
}

// Analytics types
export interface DailyPerformance {
  id: string
  client_id: string
  client_name?: string
  date: string
  platform: string
  impressions: number
  clicks: number
  conversions: number
  cost: number
  revenue: number
}

export interface Client {
  id: string
  name: string
  industry?: string
}

export interface Platform {
  id: string
  label: string
}

export interface PerformanceMetrics {
  cost: number
  impressions: number
  clicks: number
  conversions: number
  revenue: number
  roas: string
  cpa: string
  ctr: string
  cpc: string
}

export interface ChartDataPoint {
  date: string
  cost: number
  revenue: number
  roas: number
}

// OpenClaw types
export interface ChatMessage {
  id: string
  agent: string
  from: 'user' | 'agent'
  message: string
  type: 'text' | 'voice' | 'attachment'
  timestamp: string
  attachmentUrl?: string
}

export interface AgentSessionStatus {
  sessionKey: string
  status: 'running' | 'completed' | 'failed'
  lastMessage?: string
  error?: string
}

export interface AgentInfo {
  name: string
  emoji: string
  role: string
  status: 'online' | 'offline' | 'warning' | 'error'
  activeTasksCount: number
  hasLiveSession: boolean
  failures: number
  lastCheck: string | null
}

// Re-export new types
export * from './alerts'
export * from './clients'
export * from './marketing'
