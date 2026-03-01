import { useState } from 'react'
import { Bell, Moon, Shield, Database } from 'lucide-react'

export default function Settings() {
  const [darkMode, setDarkMode] = useState(false)
  const [notifications, setNotifications] = useState(true)

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

      <div className="max-w-2xl space-y-6">
        {/* Appearance */}
        <section className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <Moon className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Appearance</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark Mode</p>
              <p className="text-sm text-gray-500">Toggle dark theme</p>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`} />
            </button>
          </div>
        </section>

        {/* Notifications */}
        <section className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Push Notifications</p>
              <p className="text-sm text-gray-500">Get alerts for important events</p>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`w-12 h-6 rounded-full transition-colors ${notifications ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${notifications ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`} />
            </button>
          </div>
        </section>

        {/* Database */}
        <section className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Database</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Supabase Connection</p>
                <p className="text-sm text-gray-500">Connected to: jcghdthijgjttmpthagj.supabase.co</p>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">Connected</span>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Security</h2>
          </div>
          <button className="text-blue-600 hover:underline">
            Change Password
          </button>
        </section>
      </div>
    </div>
  )
}
