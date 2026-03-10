import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings as SettingsIcon, Save, ArrowLeft, Check } from 'lucide-react'
import { getDashboardSettings, saveDashboardSettings, DEFAULT_SETTINGS, DashboardSettings } from '../lib/settings'

export default function DashboardSettingsPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSettings = async () => {
      const userId = 'default_user' // TODO: Get from auth
      const loaded = await getDashboardSettings(userId)
      setSettings(loaded)
      setLoading(false)
    }
    loadSettings()
  }, [])

  const handleSave = async () => {
    const userId = 'default_user' // TODO: Get from auth
    const success = await saveDashboardSettings(userId, settings)

    if (success) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      alert('Failed to save settings. Please try again.')
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
              Dashboard Settings
            </h1>
            <p className="text-gray-500 mt-1">Configure your analytics dashboard preferences</p>
          </div>
        </div>
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
      </div>

      {/* Settings Sections */}
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
              <p className="text-xs text-gray-500 mt-1">
                Default mode when opening the dashboard
              </p>
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
              <p className="text-xs text-gray-500 mt-1">
                Default time period for data display
              </p>
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
              <p className="text-xs text-gray-500 mt-1">
                Which metric to show in the chart by default
              </p>
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
              <p className="text-xs text-gray-500 mt-1">
                Height of the trend chart (200-600px)
              </p>
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
              <p className="text-xs text-gray-500 mt-1">
                Number of rows to display in data tables
              </p>
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
              <p className="text-xs text-gray-500 mt-1">
                How long to cache data before refetching
              </p>
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
                <p className="text-xs text-gray-500 mt-1">
                  How often to refresh (30-300 seconds)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reset to Defaults */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Reset Settings</h2>
        <p className="text-sm text-gray-600 mb-4">
          Restore all settings to their default values
        </p>
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
  )
}
