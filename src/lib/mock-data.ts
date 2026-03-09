/**
 * Mock data for OpenClaw agent functionality
 * Used when database tables or gateway are unavailable
 */

import type { AgentHealth, AgentTask } from '../types'

// Mock agent health data (simulates database records)
export const mockAgentHealth: AgentHealth[] = [
  {
    id: '1',
    agent_name: 'clover',
    check_type: 'heartbeat',
    status: 'healthy',
    last_success: new Date().toISOString(),
    consecutive_failures: 0,
    error_details: null,
    checked_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    agent_name: 'mary',
    check_type: 'heartbeat',
    status: 'healthy',
    last_success: new Date().toISOString(),
    consecutive_failures: 0,
    error_details: null,
    checked_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: '3',
    agent_name: 'openclaw',
    check_type: 'heartbeat',
    status: 'warning',
    last_success: new Date(Date.now() - 300000).toISOString(), // 5 min ago
    consecutive_failures: 1,
    error_details: { message: 'Slow response time' },
    checked_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: '4',
    agent_name: 'nexus',
    check_type: 'heartbeat',
    status: 'healthy',
    last_success: new Date().toISOString(),
    consecutive_failures: 0,
    error_details: null,
    checked_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: '5',
    agent_name: 'writer',
    check_type: 'heartbeat',
    status: 'healthy',
    last_success: new Date().toISOString(),
    consecutive_failures: 0,
    error_details: null,
    checked_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: '6',
    agent_name: 'kimi',
    check_type: 'heartbeat',
    status: 'healthy',
    last_success: new Date().toISOString(),
    consecutive_failures: 0,
    error_details: null,
    checked_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  }
]

// Mock task queue data
export const mockTasks: AgentTask[] = [
  {
    id: '1',
    from_agent: 'user',
    to_agent: 'writer',
    task_type: 'email_draft',
    priority: 'normal',
    payload: {
      subject: 'Weekly Performance Report',
      recipient: 'team@example.com'
    },
    status: 'pending',
    created_at: new Date().toISOString(),
    claimed_at: null,
    completed_at: null,
    result: null,
    error_message: null
  },
  {
    id: '2',
    from_agent: 'user',
    to_agent: 'openclaw',
    task_type: 'google_ads_report',
    priority: 'high',
    payload: {
      client_id: 'client-123',
      date_range: 'last_7_days'
    },
    status: 'claimed',
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    claimed_at: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
    completed_at: null,
    result: null,
    error_message: null
  },
  {
    id: '3',
    from_agent: 'clover',
    to_agent: 'nexus',
    task_type: 'sync_data',
    priority: 'urgent',
    payload: {
      source: 'meta_ads',
      destination: 'supabase'
    },
    status: 'completed',
    created_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    claimed_at: new Date(Date.now() - 7000000).toISOString(),
    completed_at: new Date(Date.now() - 3600000).toISOString(),
    result: { records_synced: 1543, status: 'success' },
    error_message: null
  },
  {
    id: '4',
    from_agent: 'user',
    to_agent: 'mary',
    task_type: 'send_notification',
    priority: 'low',
    payload: {
      message: 'Daily summary ready',
      channel: 'slack'
    },
    status: 'failed',
    created_at: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
    claimed_at: new Date(Date.now() - 10700000).toISOString(),
    completed_at: new Date(Date.now() - 9000000).toISOString(),
    result: null,
    error_message: 'Slack API rate limit exceeded'
  },
  {
    id: '5',
    from_agent: 'user',
    to_agent: 'kimi',
    task_type: 'analyze_trends',
    priority: 'normal',
    payload: {
      metric: 'ctr',
      period: 'last_30_days'
    },
    status: 'pending',
    created_at: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
    claimed_at: null,
    completed_at: null,
    result: null,
    error_message: null
  }
]

// Mock active sessions
export const mockActiveSessions = [
  {
    sessionKey: 'mock-session-openclaw-001',
    agentId: 'openclaw',
    status: 'running',
    startedAt: new Date(Date.now() - 1800000).toISOString()
  },
  {
    sessionKey: 'mock-session-writer-002',
    agentId: 'writer',
    status: 'running',
    startedAt: new Date(Date.now() - 600000).toISOString()
  }
]

// Mock chat responses for different agents
export const mockAgentResponses: Record<string, string[]> = {
  clover: [
    "I've reviewed the team's performance. Overall, we're on track with our KPIs this week.",
    "Let me delegate this task to the appropriate agent for you.",
    "I'll coordinate with the other agents to ensure this gets done efficiently."
  ],
  mary: [
    "I'll send out the notification right away.",
    "Message received and logged. I'm processing your communication request.",
    "I've updated the team on Slack about this development."
  ],
  openclaw: [
    "Monitoring systems are operational. All metrics within normal parameters.",
    "I detected an anomaly in the Google Ads data. Investigating now.",
    "Security scan complete. No issues found."
  ],
  nexus: [
    "Integration with Meta Ads API is active and syncing every 15 minutes.",
    "I've successfully connected to the new data source.",
    "Data pipeline is flowing smoothly. Latest sync completed 2 minutes ago."
  ],
  writer: [
    "I've drafted the email based on your requirements. Would you like to review it?",
    "Content generation in progress. I'll have the report ready in 5 minutes.",
    "I've updated the documentation with the latest changes."
  ],
  kimi: [
    "Running analysis on the dataset. I've identified 3 interesting patterns.",
    "The ML model is training. Current accuracy: 94.2%",
    "I've optimized the query performance. Response time improved by 40%."
  ]
}

// Function to get a random response for an agent
export function getMockAgentResponse(agentName: string): string {
  const responses = mockAgentResponses[agentName] || [
    `I'm ${agentName}, processing your request...`
  ]
  return responses[Math.floor(Math.random() * responses.length)]
}

// Simulated delay for realistic feel
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
