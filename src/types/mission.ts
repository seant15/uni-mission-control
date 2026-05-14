export type MissionColumn =
  | 'new'
  | 'in_process'
  | 'in_review'
  | 'done'
  | 'archived'
  | 'cancelled'

export type MissionCardPriority = 'low' | 'medium' | 'high' | 'critical'

export interface MissionCardRow {
  id: string
  title: string
  body: string
  column_status: MissionColumn
  client_id: string | null
  platform?: string | null
  priority?: MissionCardPriority | string
  /** Reference only; no FK to alerts — deleting an alert row does not modify this card. */
  source_alert_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  clickup_task_id?: string | null
  clickup_task_url?: string | null
  archived?: boolean
  synced_from_clickup?: boolean
}

export const MISSION_COLUMNS: { id: MissionColumn; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'in_process', label: 'In-process' },
  { id: 'in_review', label: 'In-review' },
  { id: 'done', label: 'Done' },
  { id: 'archived', label: 'Archived' },
  { id: 'cancelled', label: 'Cancelled' },
]
