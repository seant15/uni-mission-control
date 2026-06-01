/**
 * Dashboard RBAC helpers. DB may still send legacy roles (`team_member`, `client_user`).
 * Effective roles match AGENT_BRIEF_FRONTEND_DEV.md.
 */

export type EffectiveRole = 'super_admin' | 'media_buyer' | 'partner' | 'client'

export function normalizeRole(role: string | undefined | null): EffectiveRole {
  if (!role) return 'media_buyer'
  if (role === 'super_admin') return 'super_admin'
  if (role === 'partner') return 'partner'
  if (role === 'client' || role === 'client_user') return 'client'
  if (role === 'media_buyer' || role === 'team_member') return 'media_buyer'
  return 'media_buyer'
}

export function scopedClientIdFromUser(
  appUser: { role?: string; primary_client_id?: string | null } | null | undefined
): string | undefined {
  if (!appUser) return undefined
  if (normalizeRole(appUser.role) !== 'client') return undefined
  const id = appUser.primary_client_id
  return id && id.trim() ? id : undefined
}

export function canMutateAlerts(role: string | undefined | null): boolean {
  const r = normalizeRole(role)
  return r === 'super_admin' || r === 'media_buyer'
}

export function canAccessMission(role: string | undefined | null): boolean {
  const r = normalizeRole(role)
  return r === 'super_admin' || r === 'media_buyer'
}

/** Agency roles always; client users when their account has Meta ad accounts connected. */
export function canAccessCreative(role: string | undefined | null, hasMetaAds?: boolean): boolean {
  const r = normalizeRole(role)
  if (r === 'super_admin' || r === 'media_buyer') return true
  if (r === 'client' && hasMetaAds) return true
  return false
}

/** Client role cannot open Alerts at all (brief matrix). */
export function canAccessAlerts(role: string | undefined | null): boolean {
  return normalizeRole(role) !== 'client'
}

export function canAccessSettings(role: string | undefined | null): boolean {
  return normalizeRole(role) !== 'partner'
}

export function canAccessClientsByClientTab(role: string | undefined | null): boolean {
  return normalizeRole(role) !== 'partner'
}

/** UNI AI Assistant — agency/internal roles only; client and client_user excluded. */
export function canAccessAIChat(role: string | undefined | null): boolean {
  return normalizeRole(role) !== 'client'
}
