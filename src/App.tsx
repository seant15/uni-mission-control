import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LayoutDashboard, AlertTriangle, Users, Bell, Database, Settings, Activity, Layers, Megaphone, X, LogOut } from 'lucide-react'
import MarketingOverview from './pages/MarketingOverview'
import Alerts from './pages/Alerts'
import ClientsOverview from './pages/ClientsOverview'
import DataAnalytics from './pages/DataAnalytics'
import DashboardSettings from './pages/DashboardSettings'
import RealtimePerformance from './pages/RealtimePerformance'
import CreativePerformance from './pages/CreativePerformance'
import Login from './pages/Login'
import { getDashboardSettings } from './lib/settings'
import { useAuth } from './contexts/AuthContext'

const ANNOUNCEMENT_STYLES = {
  info:    { bar: 'bg-blue-600',   text: 'text-white',          icon: 'text-blue-200' },
  warning: { bar: 'bg-amber-500',  text: 'text-white',          icon: 'text-amber-200' },
  success: { bar: 'bg-green-600',  text: 'text-white',          icon: 'text-green-200' },
  neutral: { bar: 'bg-slate-700',  text: 'text-slate-100',      icon: 'text-slate-400' },
}

function AnnouncementBanner() {
  const [ann, setAnn] = useState<{ enabled: boolean; text: string; style: string } | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    const userId = user?.id || 'default_user'
    getDashboardSettings(userId).then(s => {
      setAnn({ enabled: s.announcementEnabled, text: s.announcementText, style: s.announcementStyle })
    })
  }, [user])

  if (!ann || !ann.enabled || !ann.text || dismissed) return null

  const st = ANNOUNCEMENT_STYLES[ann.style as keyof typeof ANNOUNCEMENT_STYLES] || ANNOUNCEMENT_STYLES.info

  return (
    <div className={`${st.bar} px-8 py-2 flex items-center gap-3 min-h-[40px]`}>
      <Megaphone size={15} className={st.icon} />
      <p className={`flex-1 text-sm font-medium ${st.text}`}
        dangerouslySetInnerHTML={{ __html: ann.text }}
      />
      <button onClick={() => setDismissed(true)} className={`${st.icon} hover:opacity-80`}>
        <X size={15} />
      </button>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <div className="text-slate-400">Loading...</div>
    </div>
  )
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
      </Routes>
    </Router>
  )
}

function AppShell() {
  const { appUser, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (e) {
      console.error('Sign out failed:', e)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar */}
        <aside className="w-72 bg-slate-900 text-white flex flex-col fixed h-full z-50">
          {/* Logo */}
          <div className="p-5 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <img
                src="/uni-logo.gif"
                alt="UNI"
                className="w-10 h-10 rounded-xl object-cover"
              />
              <div>
                <h1 className="font-bold text-lg tracking-tight">UNI Mission Control</h1>
                <p className="text-xs text-slate-400">Marketing Performance Hub</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4">
              Main
            </div>
            <NavLink to="/" icon={LayoutDashboard} label="UNI Overview" />
            <NavLink to="/alerts" icon={AlertTriangle} label="Alerts" />
            <NavLink to="/clients-overview" icon={Users} label="Clients Overview" />
            <NavLink to="/realtime-performance" icon={Activity} label="Real-time Performance" />
            <NavLink to="/data-analytics" icon={Database} label="Account Performance" />
            <NavLink to="/creative-performance" icon={Layers} label="Creative Performance" />

            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6 px-4">
              System
            </div>
            <NavLink to="/dashboard/settings" icon={Settings} label="Settings" />
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-sm font-semibold">
                {(appUser?.display_name || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{appUser?.display_name || 'User'}</p>
                <p className="text-xs text-slate-400 capitalize">{appUser?.role?.replace('_', ' ') || 'viewer'}</p>
              </div>
              <button onClick={handleSignOut} title="Sign out" className="text-slate-500 hover:text-slate-300 transition">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 ml-72 flex flex-col">
          {/* Top Header — announcement banner + bell */}
          <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
            <AnnouncementBanner />
            <div className="h-12 px-8 flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium tracking-wide uppercase select-none">
                UNI Mission Control
              </span>
              <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell size={18} />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
              </button>
            </div>
          </header>

          {/* Page Content */}
          <main className="p-8 max-w-7xl mx-auto w-full">
            <Routes>
              <Route path="/" element={<MarketingOverview />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/clients-overview" element={<ClientsOverview />} />
              <Route path="/realtime-performance" element={<RealtimePerformance />} />
              <Route path="/data-analytics" element={<DataAnalytics />} />
              <Route path="/creative-performance" element={<CreativePerformance />} />
              <Route path="/dashboard/settings" element={<DashboardSettings />} />
            </Routes>
          </main>
        </div>
      </div>
  )
}

function NavLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        isActive
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
      {isActive && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />}
    </Link>
  )
}

export default App
