// ============================================================
// User & Permission Types
// Mirrors the DB schema in 20260312_user_permission_system.sql
// ============================================================

export type AppRole = 'super_admin' | 'team_member' | 'client_user'
export type AccessLevel = 'viewer' | 'editor'

export interface AppUser {
  id: string
  email: string
  display_name: string
  role: AppRole
  is_active: boolean
  auth_user_id: string | null
  primary_client_id: string | null   // only for client_user
  notes: string | null
  invite_sent_at: string | null
  invite_accepted_at: string | null
  created_at: string
  updated_at: string
}

export interface UserClientAccess {
  id: string
  user_id: string
  client_id: string
  access_level: AccessLevel

  // Data granularity toggles
  can_see_daily_summary: boolean
  can_see_campaign_detail: boolean
  can_see_ad_detail: boolean
  can_see_keywords: boolean
  can_see_search_terms: boolean
  can_see_hourly: boolean
  can_see_alerts: boolean

  granted_by: string | null
  granted_at: string
}

// Composite type used in the Admin UI: user + their client grants
export interface AppUserWithAccess extends AppUser {
  client_access: UserClientAccess[]
}

// Per-user permission snapshot used throughout the app
export interface UserPermissions {
  role: AppRole
  accessibleClientIds: string[]       // which client UUIDs this user can see
  granularAccess: Record<string, ClientGranularAccess>  // keyed by client_id
}

export interface ClientGranularAccess {
  can_see_daily_summary: boolean
  can_see_campaign_detail: boolean
  can_see_ad_detail: boolean
  can_see_keywords: boolean
  can_see_search_terms: boolean
  can_see_hourly: boolean
  can_see_alerts: boolean
}

// Default access presets
export const FULL_ACCESS: ClientGranularAccess = {
  can_see_daily_summary: true,
  can_see_campaign_detail: true,
  can_see_ad_detail: true,
  can_see_keywords: true,
  can_see_search_terms: true,
  can_see_hourly: true,
  can_see_alerts: true,
}

export const STANDARD_ACCESS: ClientGranularAccess = {
  can_see_daily_summary: true,
  can_see_campaign_detail: true,
  can_see_ad_detail: false,
  can_see_keywords: false,
  can_see_search_terms: false,
  can_see_hourly: true,
  can_see_alerts: true,
}

export const MINIMAL_ACCESS: ClientGranularAccess = {
  can_see_daily_summary: true,
  can_see_campaign_detail: false,
  can_see_ad_detail: false,
  can_see_keywords: false,
  can_see_search_terms: false,
  can_see_hourly: false,
  can_see_alerts: false,
}

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  team_member: 'Team Member',
  client_user: 'Client',
}

export const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  team_member: 'bg-blue-100 text-blue-700',
  client_user: 'bg-green-100 text-green-700',
}
