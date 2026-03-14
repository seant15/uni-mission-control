import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  Users, Plus, ChevronDown, ChevronUp,
  Check, X, Save, AlertCircle, Key, Eye, EyeOff
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  getAllUsersWithAccess, createUser, updateUser,
  setUserClientAccess
} from '../lib/permissions'
import type { AppUserWithAccess, UserClientAccess, ClientGranularAccess, AppRole } from '../types/permissions'
import { ROLE_LABELS, ROLE_COLORS, STANDARD_ACCESS, FULL_ACCESS, MINIMAL_ACCESS } from '../types/permissions'

async function setUserPassword(
  appUserId: string,
  email: string,
  password: string,
  displayName: string,
  authUserId: string | null
): Promise<{ success: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { success: false, error: 'Not authenticated' }

  const supabaseUrl = 'https://jcghdthijgjttmpthagj.supabase.co'
  const fnUrl = `${supabaseUrl}/functions/v1/create-auth-user`

  const body = authUserId
    ? { action: 'reset_password', auth_user_id: authUserId, password }
    : { action: 'create', email, password, display_name: displayName, app_user_id: appUserId }

  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok || json.error) return { success: false, error: json.error || 'Request failed' }
  return { success: true }
}

// Granular toggle labels
const GRANULAR_LABELS: { key: keyof ClientGranularAccess; label: string; description: string }[] = [
  { key: 'can_see_daily_summary',   label: 'Daily Summary',    description: 'Overall spend, impressions, conversions' },
  { key: 'can_see_campaign_detail', label: 'Campaign Detail',  description: 'Campaign-level breakdown' },
  { key: 'can_see_ad_detail',       label: 'Ad Creatives',     description: 'Individual ad performance & creatives' },
  { key: 'can_see_keywords',        label: 'Keywords',         description: 'Google Ads keyword data' },
  { key: 'can_see_search_terms',    label: 'Search Terms',     description: 'Actual user search queries (sensitive)' },
  { key: 'can_see_hourly',          label: 'Real-time / Hourly', description: 'Intraday performance tab' },
  { key: 'can_see_alerts',          label: 'Alerts',           description: 'Performance alert notifications' },
]

// ── Sub-component: client access row ────────────────────────

interface ClientRowProps {
  client: { id: string; name: string }
  grant: UserClientAccess | null
  onChange: (clientId: string, grant: UserClientAccess | null) => void
}

function ClientAccessRow({ client, grant, onChange }: ClientRowProps) {
  const isGranted = grant !== null
  const [expanded, setExpanded] = useState(false)

  function toggleClient() {
    if (isGranted) {
      onChange(client.id, null)
      setExpanded(false)
    } else {
      onChange(client.id, {
        id: '',
        user_id: '',
        client_id: client.id,
        access_level: 'viewer',
        granted_by: null,
        granted_at: new Date().toISOString(),
        ...STANDARD_ACCESS,
      })
    }
  }

  function updateGranular(key: keyof ClientGranularAccess, value: boolean) {
    if (!grant) return
    onChange(client.id, { ...grant, [key]: value })
  }

  function applyPreset(preset: 'full' | 'standard' | 'minimal') {
    if (!grant) return
    const map = { full: FULL_ACCESS, standard: STANDARD_ACCESS, minimal: MINIMAL_ACCESS }
    onChange(client.id, { ...grant, ...map[preset] })
  }

  return (
    <div className={`border rounded-lg transition-all ${isGranted ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
      {/* Client header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Toggle on/off */}
        <button
          onClick={toggleClient}
          className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 ${isGranted ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 ${isGranted ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>

        <span className={`flex-1 text-sm font-medium ${isGranted ? 'text-gray-900' : 'text-gray-400'}`}>
          {client.name}
        </span>

        {isGranted && (
          <>
            {/* Access level selector */}
            <select
              value={grant.access_level}
              onChange={e => onChange(client.id, { ...grant!, access_level: e.target.value as 'viewer' | 'editor' })}
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
              onClick={e => e.stopPropagation()}
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>

            {/* Expand/collapse granular */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </>
        )}
      </div>

      {/* Granular toggles (expanded) */}
      {isGranted && expanded && (
        <div className="border-t border-blue-100 px-4 py-3 space-y-2">
          {/* Presets */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-gray-500 mr-1">Preset:</span>
            {(['full', 'standard', 'minimal'] as const).map(p => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 capitalize"
              >
                {p}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {GRANULAR_LABELS.map(({ key, label, description }) => (
              <label key={key} className="flex items-start gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={grant[key] as boolean}
                  onChange={e => updateGranular(key, e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-blue-600 rounded"
                />
                <div>
                  <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">{label}</span>
                  <p className="text-xs text-gray-400">{description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-component: user card ─────────────────────────────────

interface UserCardProps {
  user: AppUserWithAccess
  clients: { id: string; name: string }[]
  currentAdminId: string
  onSaved: () => void
}

function UserCard({ user, clients, currentAdminId, onSaved }: UserCardProps) {
  useAuth()
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Password section
  const [showPwSection, setShowPwSection] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwResult, setPwResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // Local editable state
  const [displayName, setDisplayName] = useState(user.display_name)
  const [role, setRole] = useState<AppRole>(user.role)
  const [isActive, setIsActive] = useState(user.is_active)
  const [notes, setNotes] = useState(user.notes ?? '')
  const [primaryClientId, setPrimaryClientId] = useState(user.primary_client_id ?? '')

  // Grants: keyed by client_id
  const [grants, setGrants] = useState<Record<string, UserClientAccess | null>>(() => {
    const map: Record<string, UserClientAccess | null> = {}
    user.client_access.forEach(g => { map[g.client_id] = g })
    return map
  })

  function handleGrantChange(clientId: string, grant: UserClientAccess | null) {
    setGrants(prev => ({ ...prev, [clientId]: grant }))
  }

  async function handleSetPassword() {
    if (!newPassword || newPassword.length < 6) {
      setPwResult({ ok: false, msg: 'Password must be at least 6 characters.' })
      return
    }
    setPwSaving(true)
    setPwResult(null)
    const result = await setUserPassword(user.id, user.email, newPassword, user.display_name, user.auth_user_id ?? null)
    setPwSaving(false)
    if (result.success) {
      setPwResult({ ok: true, msg: user.auth_user_id ? 'Password updated!' : 'Account activated! User can now log in.' })
      setNewPassword('')
      onSaved()
    } else {
      setPwResult({ ok: false, msg: result.error || 'Failed.' })
    }
  }

  async function handleSave() {
    setSaving(true)
    const userUpdates: Parameters<typeof updateUser>[1] = {
      display_name: displayName,
      role,
      is_active: isActive,
      notes: notes || null,
      primary_client_id: role === 'client_user' ? (primaryClientId || null) : null,
    }
    const ok1 = await updateUser(user.id, userUpdates)

    // Only team_member uses user_client_access table
    let ok2 = true
    if (role === 'team_member') {
      const activeGrants = Object.entries(grants)
        .filter(([, g]) => g !== null)
        .map(([, g]) => ({
          client_id: g!.client_id,
          access_level: g!.access_level,
          granular: {
            can_see_daily_summary: g!.can_see_daily_summary,
            can_see_campaign_detail: g!.can_see_campaign_detail,
            can_see_ad_detail: g!.can_see_ad_detail,
            can_see_keywords: g!.can_see_keywords,
            can_see_search_terms: g!.can_see_search_terms,
            can_see_hourly: g!.can_see_hourly,
            can_see_alerts: g!.can_see_alerts,
          },
        }))
      ok2 = await setUserClientAccess(user.id, activeGrants, currentAdminId)
    }

    setSaving(false)
    if (ok1 && ok2) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      onSaved()
    }
  }

  const assignedCount = Object.values(grants).filter(g => g !== null).length
  const isClientUser = role === 'client_user'
  const isTeamMember = role === 'team_member'

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {user.display_name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 truncate">{user.display_name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role]}`}>
              {ROLE_LABELS[user.role]}
            </span>
            {!user.is_active && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate">{user.email}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {isTeamMember && (
            <span className="text-xs text-gray-400">
              {assignedCount} / {clients.length} clients
            </span>
          )}
          {isClientUser && user.primary_client_id && (
            <span className="text-xs text-gray-400">
              {clients.find(c => c.id === user.primary_client_id)?.name ?? 'Unknown client'}
            </span>
          )}
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-5">

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Display Name</label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as AppRole)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="team_member">Team Member</option>
                <option value="client_user">Client</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>

          {/* client_user: pick one client */}
          {isClientUser && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Account</label>
              <select
                value={primaryClientId}
                onChange={e => setPrimaryClientId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">— Select a client —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Client users only see data for this account.</p>
            </div>
          )}

          {/* team_member: client visibility matrix */}
          {isTeamMember && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">Client Visibility</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const all: Record<string, UserClientAccess> = {}
                      clients.forEach(c => {
                        all[c.id] = grants[c.id] ?? {
                          id: '', user_id: '', client_id: c.id,
                          access_level: 'viewer', granted_by: null, granted_at: new Date().toISOString(),
                          ...STANDARD_ACCESS,
                        }
                      })
                      setGrants(all)
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Grant all
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => setGrants({})}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Revoke all
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {clients.map(c => (
                  <ClientAccessRow
                    key={c.id}
                    client={c}
                    grant={grants[c.id] ?? null}
                    onChange={handleGrantChange}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Password / Auth Account */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowPwSection(!showPwSection)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition text-sm"
            >
              <span className="flex items-center gap-2 font-medium text-gray-700">
                <Key size={14} />
                {user.auth_user_id ? 'Change Password' : 'Set Password & Activate Account'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${user.auth_user_id ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {user.auth_user_id ? 'Active' : 'No login yet'}
              </span>
            </button>
            {showPwSection && (
              <div className="px-4 py-3 space-y-3">
                {!user.auth_user_id && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
                    This user has no login account. Set a password to activate their access.
                  </p>
                )}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="New password (min 6 chars)"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-10 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button
                    onClick={handleSetPassword}
                    disabled={pwSaving || !newPassword}
                    className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {pwSaving ? 'Saving…' : user.auth_user_id ? 'Update Password' : 'Activate'}
                  </button>
                </div>
                {pwResult && (
                  <p className={`text-xs flex items-center gap-1 ${pwResult.ok ? 'text-green-700' : 'text-red-600'}`}>
                    {pwResult.ok ? <Check size={12} /> : <AlertCircle size={12} />}
                    {pwResult.msg}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Internal Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Handles SESUNG + Lumiere accounts. Do not share search terms."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          {/* Active toggle + save */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">Account active</span>
            </label>

            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                saved
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {saved ? <Check size={15} /> : <Save size={15} />}
              {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────

export default function UserManagement() {
  const { appUser } = useAuth()
  const [users, setUsers] = useState<AppUserWithAccess[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<AppRole>('team_member')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const CURRENT_ADMIN_ID = appUser?.id || ''

  async function loadData() {
    setLoading(true)
    const [usersData, clientsData] = await Promise.all([
      getAllUsersWithAccess(),
      supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    ])
    setUsers(usersData)
    setClients(clientsData.data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function handleAddUser() {
    if (!newEmail || !newName) { setAddError('Email and name are required.'); return }
    setAdding(true)
    setAddError('')
    const created = await createUser(newEmail.trim().toLowerCase(), newName.trim(), newRole)
    setAdding(false)
    if (!created) {
      setAddError('Failed to create user. Email may already exist.')
      return
    }
    setNewEmail('')
    setNewName('')
    setNewRole('team_member')
    setShowAddForm(false)
    loadData()
  }

  const activeUsers = users.filter(u => u.is_active)
  const inactiveUsers = users.filter(u => !u.is_active)

  // Still loading auth context — don't block yet
  if (appUser === null && loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Loading users…
      </div>
    )
  }

  if (appUser === null) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500">Profile not found</p>
          <p className="text-sm mt-1 text-gray-400">
            Your account isn't linked to an app_users record yet.
          </p>
          <p className="text-xs mt-2 text-gray-300">
            Run the Supabase SQL to link your auth_user_id, then sign out and back in.
          </p>
        </div>
      </div>
    )
  }

  if (appUser.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500">Access Restricted</p>
          <p className="text-sm mt-1">Only administrators can manage users and access.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Loading users…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users size={20} className="text-blue-600" />
            User Management
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Control which users can see which clients and what data.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          <Plus size={15} />
          Add User
        </button>
      </div>

      {/* Add user form */}
      {showAddForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-blue-800">New User</h3>
          <div className="grid grid-cols-3 gap-3">
            <input
              placeholder="Email address"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <input
              placeholder="Display name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value as AppRole)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="team_member">Team Member</option>
              <option value="client_user">Client</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          {addError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle size={13} /> {addError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAddUser}
              disabled={adding}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Check size={13} /> {adding ? 'Creating…' : 'Create User'}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setAddError('') }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-lg hover:bg-gray-50"
            >
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Role legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" /> Super Admin — full access</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Team Member — assigned clients only</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> Client — their own account only (read-only)</span>
      </div>

      {/* Active users */}
      {activeUsers.length > 0 && (
        <div className="space-y-3">
          {activeUsers.map(u => (
            <UserCard
              key={u.id}
              user={u}
              clients={clients}
              currentAdminId={CURRENT_ADMIN_ID}
              onSaved={loadData}
            />
          ))}
        </div>
      )}

      {activeUsers.length === 0 && (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          No users yet. Add the first one above.
        </div>
      )}

      {/* Inactive users (collapsed) */}
      {inactiveUsers.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 list-none">
            <ChevronDown size={13} className="group-open:rotate-180 transition-transform" />
            {inactiveUsers.length} inactive user{inactiveUsers.length > 1 ? 's' : ''}
          </summary>
          <div className="mt-3 space-y-3 opacity-60">
            {inactiveUsers.map(u => (
              <UserCard
                key={u.id}
                user={u}
                clients={clients}
                currentAdminId={CURRENT_ADMIN_ID}
                onSaved={loadData}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
