export type MessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  action_type?: string | null
  file_url?: string | null
  created_at: string
  metadata?: Record<string, unknown>
}

export interface Conversation {
  id: string
  user_id: string
  title: string | null
  workflow_type: string | null
  created_at: string
  updated_at: string
  metadata?: Record<string, unknown>
  user_display_name?: string
  user_email?: string
  user_role?: string
}

export type WorkflowType = 'seo_content' | 'seo_content_qa' | 'qa_review' | 'brand_workshop' | 'brand_design'

export interface WorkflowTemplate {
  id: WorkflowType
  label: string
  template: string
}
