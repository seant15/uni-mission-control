export type MissionColumn =
  | 'new'
  | 'in_process'
  | 'in_review'
  | 'done'
  | 'archived'
  | 'cancelled'

export interface MissionCardRow {
  id: string
  title: string
  body: string
  column_status: MissionColumn
  client_id: string | null
  /** Reference only; no FK to alerts — deleting an alert row does not modify this card. */
  source_alert_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export const MISSION_COLUMNS: { id: MissionColumn; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'in_process', label: 'In-process' },
  { id: 'in_review', label: 'In-review' },
  { id: 'done', label: 'Done' },
  { id: 'archived', label: 'Archived' },
  { id: 'cancelled', label: 'Cancelled' },
]
