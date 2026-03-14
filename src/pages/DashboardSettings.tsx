import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Settings as SettingsIcon, Save, ArrowLeft, Check, Users, UserCircle } from 'lucide-react'
import { getDashboardSettings, saveDashboardSettings, DEFAULT_SETTINGS, DashboardSettings } from '../lib/settings'
import UserManagement from './UserManagement'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

type SettingsTab = 'dashboard' | 'users' | 'profile'

export default function DashboardSettingsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, appUser } = useAuth()
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    (searchParams.get('tab') as SettingsTab) || 'profile'
  )
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  // Profile tab state
  const [profileName, setProfileName] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')

  useEffect(() => {
    if (appUser) setProfileName(appUser.display_name)
  }, [appUser])

  useEffect(() => {
    const loadSettings = async () => {
      const userId = user?.id || 'default_user'
      const loaded = await getDashboardSettings(userId)
      setSettings(loaded)
      setLoading(false)
    }
    loadSettings()
  }, [user])

  const handleSave = async () => {
    const userId = user?.id || 'default_user'
    const success = await saveDashboardSettings(userId, settings)
    if (success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      alert('Failed to save settings. Please try again.')
    }
  }

  async function handleProfileSave() {
    if (!appUser || !profileName.trim()) return
    setProfileSaving(true)
    setProfileError('')
    const { error } = await supabase
      .from('app_users')
      .update({ display_name: profileName.trim() })
      .eq('id', appUser.id)
    setProfileSaving(false)
    if (error) {
      setProfileError('Failed to save. Please try again.')
    } else {
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/data-analytics')}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <SettingsIcon className="text-blue-600" />
              Settings
            </h1>
            <p className="text-gray-500 mt-1">Dashboard preferences and user access control</p>
          </div>
        </div>
        {activeTab === 'dashboard' && (
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saved ? <Check size={18} /> : <Save size={18} />}
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
            activeTab === 'profile'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserCircle size={15} />
          My Profile
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
            activeTab === 'dashboard'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <SettingsIcon size={15} />
          Performance Dashboard
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users size={15} />
          Users & Access
        </button>
      </div>

      {/* Users tab */}
      {activeTab === 'users' && <UserManagement />}

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <div className="max-w-lg space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">My Profile</h2>

            {/* Avatar preview */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                {(profileName || appUser?.display_name || 'U')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Profile Avatar</p>
                <p className="text-xs text-gray-400">Your initials are used as your avatar</p>
              </div>
            </div>

            {/* Display name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
              <input
                type="text"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Your name"
              />
              <p className="text-xs text-gray-400 mt-1">Shown in the sidebar and used as your avatar initial</p>
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="text"
                value={user?.email || ''}
                readOnly
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed here</p>
            </div>

            {/* Role (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <input
                type="text"
                value={appUser?.role?.replace(/_/g, ' ') || ''}
                readOnly
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed capitalize"
              />
            </div>

            {profileError && (
              <p className="text-sm text-red-600">{profileError}</p>
            )}

            <button
              onClick={handleProfileSave}
              disabled={profileSaving || !profileName.trim()}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-white font-medium ${
                profileSaved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50`}
            >
              {profileSaved ? <Check size={16} /> : <Save size={16} />}
              {profileSaving ? 'Saving…' : profileSaved ? 'Saved!' : 'Save Profile'}
            </button>
          </div>
        </div>
      )}

      {/* Dashboard tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Display Preferences */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Display Preferences</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Business Type
                  </label>
                  <select
                    value={settings.defaultBusinessType}
                    onChange={(e) => setSettings({...settings, defaultBusinessType: e.target.value as 'leadgen' | 'ecommerce'})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="leadgen">Lead Gen</option>
                    <option value="ecommerce">eCommerce</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Default mode when opening the dashboard</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Date Range (Days)
                  </label>
                  <select
                    value={settings.defaultDateRange}
                    onChange={(e) => setSettings({...settings, defaultDateRange: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="7">Last 7 Days</option>
                    <option value="14">Last 14 Days</option>
                    <option value="30">Last 30 Days</option>
                    <option value="90">Last 90 Days</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Default time period for data display</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Default Chart Metric
                  </label>
                  <select
                    value={settings.defaultMetric}
                    onChange={(e) => setSettings({...settings, defaultMetric: e.target.value as any})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="spend">Spend</option>
                    <option value="ctr">CTR</option>
                    <option value="conversions">Conversions</option>
                    <option value="costperconv">Cost Per Conversion</option>
                    <option value="roas">ROAS</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Which metric to show in the chart by default</p>
                </div>
              </div>
            </div>

            {/* Chart Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Chart Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chart Height (px)
                  </label>
                  <input
                    type="number"
                    value={settings.chartHeight}
                    onChange={(e) => setSettings({...settings, chartHeight: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="200"
                    max="600"
                    step="50"
                  />
                  <p className="text-xs text-gray-500 mt-1">Height of the trend chart (200-600px)</p>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Show Grid Lines</span>
                    <p className="text-xs text-gray-500">Display grid lines on charts</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showGridLines}
                    onChange={(e) => setSettings({...settings, showGridLines: e.target.checked})}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Animate Charts</span>
                    <p className="text-xs text-gray-500">Smooth animations when loading</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.animateChart}
                    onChange={(e) => setSettings({...settings, animateChart: e.target.checked})}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Table Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Table Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rows Per Page
                  </label>
                  <select
                    value={settings.rowsPerPage}
                    onChange={(e) => setSettings({...settings, rowsPerPage: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Number of rows to display in data tables</p>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Show Platform Badges</span>
                    <p className="text-xs text-gray-500">Colorful badges for platforms</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showPlatformBadge}
                    onChange={(e) => setSettings({...settings, showPlatformBadge: e.target.checked})}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Data Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cache Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    value={settings.cacheTimeout}
                    onChange={(e) => setSettings({...settings, cacheTimeout: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="60"
                  />
                  <p className="text-xs text-gray-500 mt-1">How long to cache data before refetching</p>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Auto Refresh</span>
                    <p className="text-xs text-gray-500">Automatically refresh data</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoRefresh}
                    onChange={(e) => setSettings({...settings, autoRefresh: e.target.checked})}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {settings.autoRefresh && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Refresh Interval (seconds)
                    </label>
                    <input
                      type="number"
                      value={settings.refreshInterval}
                      onChange={(e) => setSettings({...settings, refreshInterval: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="30"
                      max="300"
                    />
                    <p className="text-xs text-gray-500 mt-1">How often to refresh (30-300 seconds)</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Announcement Banner */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📢 Announcement Banner</h2>
            <p className="text-sm text-gray-500 mb-4">
              Display a banner at the top of every page. Supports basic HTML (e.g.{' '}
              <code className="bg-gray-100 px-1 rounded">&lt;b&gt;bold&lt;/b&gt;</code>,{' '}
              <code className="bg-gray-100 px-1 rounded">&lt;a href="..."&gt;link&lt;/a&gt;</code>).
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <span className="text-sm font-medium text-gray-700">Enable Banner</span>
                  <p className="text-xs text-gray-500">Show the announcement bar at the top</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.announcementEnabled}
                  onChange={(e) => setSettings({...settings, announcementEnabled: e.target.checked})}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Banner Style</label>
                <div className="flex gap-2">
                  {(['info', 'warning', 'success', 'neutral'] as const).map(style => {
                    const colors = {
                      info: 'bg-blue-600 text-white',
                      warning: 'bg-amber-500 text-white',
                      success: 'bg-green-600 text-white',
                      neutral: 'bg-slate-700 text-slate-100',
                    }
                    return (
                      <button
                        key={style}
                        onClick={() => setSettings({...settings, announcementStyle: style})}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                          settings.announcementStyle === style
                            ? colors[style] + ' ring-2 ring-offset-1 ring-blue-400'
                            : colors[style] + ' opacity-50'
                        }`}
                      >
                        {style}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Banner Text</label>
                <textarea
                  value={settings.announcementText}
                  onChange={(e) => setSettings({...settings, announcementText: e.target.value})}
                  rows={3}
                  placeholder='e.g. 🚀 <b>Q1 Reporting Week</b> — All accounts reviewed by Friday.'
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-mono resize-y"
                />
                <p className="text-xs text-gray-400 mt-1">Rendered as HTML. Keep it concise — one line is best.</p>
              </div>

              {settings.announcementEnabled && settings.announcementText && (
                <div>
                  <p className="text-xs text-gray-500 mb-2">Preview:</p>
                  <div className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                    settings.announcementStyle === 'info' ? 'bg-blue-600 text-white' :
                    settings.announcementStyle === 'warning' ? 'bg-amber-500 text-white' :
                    settings.announcementStyle === 'success' ? 'bg-green-600 text-white' :
                    'bg-slate-700 text-slate-100'
                  }`}>
                    <span className="text-sm font-medium" dangerouslySetInnerHTML={{ __html: settings.announcementText }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reset to Defaults */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Reset Settings</h2>
            <p className="text-sm text-gray-600 mb-4">Restore all settings to their default values</p>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to reset all settings to defaults?')) {
                  setSettings(DEFAULT_SETTINGS)
                }
              }}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
