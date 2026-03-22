export type FeedbackCategory =
  | 'bug_report'
  | 'feature_request'
  | 'ui_ux'
  | 'data_accuracy'
  | 'performance'
  | 'general'

export type FeedbackStatus =
  | 'new'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'wont_fix'
  | 'duplicate'

export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical'
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical'

export interface AttachmentMeta {
  url: string        // Supabase Storage path (not a signed URL — sign at read time)
  name: string       // Original filename
  type: string       // MIME type
  size_bytes: number
}

export interface FeedbackRow {
  id: string
  user_id: string
  auth_user_id: string
  display_name: string
  email: string
  role: string
  page_url: string
  page_title: string
  message: string
  category: FeedbackCategory
  category_confidence: number | null
  severity: FeedbackSeverity | null
  status: FeedbackStatus
  priority: FeedbackPriority
  attachments: AttachmentMeta[]
  attachment_count: number
  admin_notes: string | null
  handled_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface FeedbackInsert {
  user_id: string
  auth_user_id: string
  display_name: string
  email: string
  role: string
  page_url: string
  page_title: string
  message: string
  severity?: FeedbackSeverity
  attachments?: AttachmentMeta[]
  attachment_count?: number
}

export interface FeedbackUpdate {
  category?: FeedbackCategory
  status?: FeedbackStatus
  priority?: FeedbackPriority
  severity?: FeedbackSeverity
  admin_notes?: string
  handled_by?: string | null
}

export interface FeedbackFilters {
  status?: FeedbackStatus[]
  category?: FeedbackCategory
  severity?: FeedbackSeverity
  priority?: FeedbackPriority
  search?: string
  dateFrom?: string
  dateTo?: string
}

// UI helpers
export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug_report: 'Bug Report',
  feature_request: 'Feature Request',
  ui_ux: 'UI / UX',
  data_accuracy: 'Data Accuracy',
  performance: 'Performance',
  general: 'General',
}

export const CATEGORY_COLORS: Record<FeedbackCategory, string> = {
  bug_report:      'bg-red-100 text-red-700',
  feature_request: 'bg-purple-100 text-purple-700',
  ui_ux:           'bg-blue-100 text-blue-700',
  data_accuracy:   'bg-orange-100 text-orange-700',
  performance:     'bg-yellow-100 text-yellow-700',
  general:         'bg-gray-100 text-gray-600',
}

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new:          'New',
  acknowledged: 'Acknowledged',
  in_progress:  'In Progress',
  resolved:     'Resolved',
  wont_fix:     'Won\'t Fix',
  duplicate:    'Duplicate',
}

export const STATUS_COLORS: Record<FeedbackStatus, string> = {
  new:          'bg-sky-100 text-sky-700',
  acknowledged: 'bg-indigo-100 text-indigo-700',
  in_progress:  'bg-amber-100 text-amber-700',
  resolved:     'bg-green-100 text-green-700',
  wont_fix:     'bg-gray-100 text-gray-500',
  duplicate:    'bg-rose-100 text-rose-600',
}

export const SEVERITY_COLORS: Record<FeedbackSeverity, string> = {
  low:      'bg-gray-100 text-gray-600',
  medium:   'bg-yellow-100 text-yellow-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

export const PRIORITY_COLORS: Record<FeedbackPriority, string> = {
  low:      'bg-gray-100 text-gray-600',
  medium:   'bg-blue-100 text-blue-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}
