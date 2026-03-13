// ============================================================
// Permissions API
// All DB calls for the user/permission system
// ============================================================
import { supabase } from './supabase'
import type {
  AppUser,
  AppUserWithAccess,
  UserClientAccess,
  ClientGranularAccess,
} from '../types/permissions'
import { STANDARD_ACCESS } from '../types/permissions'

// ── Read ────────────────────────────────────────────────────

/** Fetch all users (super_admin only) */
export async function getAllUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) { console.error('getAllUsers:', error); return [] }
  return data ?? []
}

/** Fetch one user with their client access grants */
export async function getUserWithAccess(userId: string): Promise<AppUserWithAccess | null> {
  const { data: user, error: ue } = await supabase
    .from('app_users')
    .select('*')
    .eq('id', userId)
    .single()
  if (ue || !user) return null

  const { data: access, error: ae } = await supabase
    .from('user_client_access')
    .select('*')
    .eq('user_id', userId)
  if (ae) { console.error('getUserWithAccess:', ae) }

  return { ...user, client_access: access ?? [] }
}

/** Fetch all users including their client_access grants (for admin panel) */
export async function getAllUsersWithAccess(): Promise<AppUserWithAccess[]> {
  const { data: users, error: ue } = await supabase
    .from('app_users')
    .select('*')
    .order('created_at', { ascending: true })
  if (ue || !users) { console.error('getAllUsersWithAccess:', ue); return [] }

  const { data: allAccess, error: ae } = await supabase
    .from('user_client_access')
    .select('*')
  if (ae) { console.error('getAllUsersWithAccess (access):', ae) }

  const accessByUser = (allAccess ?? []).reduce<Record<string, UserClientAccess[]>>((acc, row) => {
    if (!acc[row.user_id]) acc[row.user_id] = []
    acc[row.user_id].push(row)
    return acc
  }, {})

  return users.map(u => ({ ...u, client_access: accessByUser[u.id] ?? [] }))
}

/** Get access grants for a specific user */
export async function getUserClientAccess(userId: string): Promise<UserClientAccess[]> {
  const { data, error } = await supabase
    .from('user_client_access')
    .select('*')
    .eq('user_id', userId)
  if (error) { console.error('getUserClientAccess:', error); return [] }
  return data ?? []
}

// ── Write ───────────────────────────────────────────────────

/** Create a new user (super_admin only) */
export async function createUser(
  email: string,
  displayName: string,
  role: AppUser['role'],
  primaryClientId?: string
): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('app_users')
    .insert({
      email,
      display_name: displayName,
      role,
      primary_client_id: primaryClientId ?? null,
    })
    .select()
    .single()
  if (error) { console.error('createUser:', error); return null }
  return data
}

/** Update a user's role or active status */
export async function updateUser(
  userId: string,
  updates: Partial<Pick<AppUser, 'display_name' | 'role' | 'is_active' | 'notes' | 'primary_client_id'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('app_users')
    .update(updates)
    .eq('id', userId)
  if (error) { console.error('updateUser:', error); return false }
  return true
}

/** Deactivate (soft-delete) a user */
export async function deactivateUser(userId: string): Promise<boolean> {
  return updateUser(userId, { is_active: false })
}

/** Grant a team_member access to a client */
export async function grantClientAccess(
  userId: string,
  clientId: string,
  grantedBy: string,
  accessLevel: UserClientAccess['access_level'] = 'viewer',
  granular: Partial<ClientGranularAccess> = {}
): Promise<boolean> {
  const { error } = await supabase
    .from('user_client_access')
    .upsert({
      user_id: userId,
      client_id: clientId,
      access_level: accessLevel,
      granted_by: grantedBy,
      granted_at: new Date().toISOString(),
      ...STANDARD_ACCESS,
      ...granular,
    }, { onConflict: 'user_id,client_id' })
  if (error) { console.error('grantClientAccess:', error); return false }
  return true
}

/** Revoke a team_member's access to a client */
export async function revokeClientAccess(userId: string, clientId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_client_access')
    .delete()
    .eq('user_id', userId)
    .eq('client_id', clientId)
  if (error) { console.error('revokeClientAccess:', error); return false }
  return true
}

/** Update granular toggles for a user-client pair */
export async function updateClientAccessGranularity(
  userId: string,
  clientId: string,
  updates: Partial<ClientGranularAccess>
): Promise<boolean> {
  const { error } = await supabase
    .from('user_client_access')
    .update(updates)
    .eq('user_id', userId)
    .eq('client_id', clientId)
  if (error) { console.error('updateClientAccessGranularity:', error); return false }
  return true
}

/** Replace ALL client grants for a user in one call (used by admin panel save) */
export async function setUserClientAccess(
  userId: string,
  grants: Array<{ client_id: string; access_level: UserClientAccess['access_level']; granular: ClientGranularAccess }>,
  grantedBy: string
): Promise<boolean> {
  // Delete existing grants for this user
  const { error: delErr } = await supabase
    .from('user_client_access')
    .delete()
    .eq('user_id', userId)
  if (delErr) { console.error('setUserClientAccess (delete):', delErr); return false }

  if (grants.length === 0) return true

  const rows = grants.map(g => ({
    user_id: userId,
    client_id: g.client_id,
    access_level: g.access_level,
    granted_by: grantedBy,
    granted_at: new Date().toISOString(),
    ...g.granular,
  }))

  const { error: insErr } = await supabase
    .from('user_client_access')
    .insert(rows)
  if (insErr) { console.error('setUserClientAccess (insert):', insErr); return false }
  return true
}
