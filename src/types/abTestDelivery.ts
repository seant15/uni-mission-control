export type AbTestPlatform = 'meta_ads' | 'google_ads'
export type AbTestEntityType = 'campaign' | 'ad_set' | 'ad'
export type AbTestCadence = 'daily' | 'hourly'

export interface ClientAbTestConfig {
  id: string
  client_id: string
  name: string
  platform: AbTestPlatform
  entity_type: AbTestEntityType
  entity_name: string
  cadence: AbTestCadence
  is_active: boolean
  notes: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ClientAlertDelivery {
  client_id: string
  notify_in_app: boolean
  slack_webhook_url: string | null
  notify_emails: string | null
  updated_at: string
  updated_by: string | null
}
