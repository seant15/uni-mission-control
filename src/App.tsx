import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LayoutDashboard, AlertTriangle, Bell, Settings, Activity, Layers, Megaphone, X, LogOut, MessageSquarePlus, LayoutGrid, Menu, PanelLeftClose, PanelLeft } from 'lucide-react'
import { db } from './lib/api'
import OverviewPage from './pages/OverviewPage'
import Alerts from './pages/Alerts'
import DashboardSettings from './pages/DashboardSettings'
import RealtimePerformance from './pages/RealtimePerformance'
import CreativePerformance from './pages/CreativePerformance'
import FeedbackAdmin from './pages/FeedbackAdmin'
import Login from './pages/Login'
import FeedbackWidget from './components/FeedbackWidget'
import OpenClawChatWidget from './components/OpenClawChatWidget'
import MissionBoard from './pages/MissionBoard'
import { RoleGuard } from './components/RoleGuard'
import { getDashboardSettings, GLOBAL_ANNOUNCEMENT_QUERY_KEY } from './lib/settings'
import { useAuth } from './contexts/AuthContext'
import {
  normalizeRole,
  canAccessMission,
  canAccessCreative,
  canAccessAlerts,
  canAccessSettings,
} from './lib/rbac'
import { Toaster } from 'sonner'

const ANNOUNCEMENT_STYLES = {
  info:    { bar: 'bg-blue-600',   text: 'text-white',          icon: 'text-blue-200' },
  warning: { bar: 'bg-amber-500',  text: 'text-white',          icon: 'text-amber-200' },
  success: { bar: 'bg-green-600',  text: 'text-white',          icon: 'text-green-200' },
  neutral: { bar: 'bg-slate-700',  text: 'text-slate-100',      icon: 'text-slate-400' },
}

function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false)
  const { data: ann } = useQuery({
    queryKey: GLOBAL_ANNOUNCEMENT_QUERY_KEY,
    queryFn: async () => {
      const s = await getDashboardSettings('default_user')
      return { enabled: s.announcementEnabled, text: s.announcementText ?? '', style: s.announcementStyle }
    },
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const textTrim = (ann?.text ?? '').trim()
  if (!ann || !ann.enabled || !textTrim || dismissed) return null

  const st = ANNOUNCEMENT_STYLES[ann.style as keyof typeof ANNOUNCEMENT_STYLES] || ANNOUNCEMENT_STYLES.info

  return (
    <div className={`${st.bar} px-8 py-2 flex items-center gap-3 min-h-[40px]`}>
      <Megaphone size={15} className={st.icon} />
      <p className={`flex-1 text-sm font-medium ${st.text}`}
        dangerouslySetInnerHTML={{ __html: ann.text.trim() }}
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
      <Toaster position="top-right" richColors />
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
  const effRole = normalizeRole(appUser?.role)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('uni_sidebar_collapsed') === '1'
    } catch {
      return false
    }
  })
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('uni_sidebar_collapsed', sidebarCollapsed ? '1' : '0')
    } catch { /* ignore */ }
  }, [sidebarCollapsed])

  useEffect(() => {
    if (!mobileNavOpen) return
    const onResize = () => {
      if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
        setMobileNavOpen(false)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mobileNavOpen])

  const { data: openAlertCount } = useQuery({
    queryKey: ['alert-open-count'],
    queryFn:  db.getOpenAlertCount.bind(db),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

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
        {mobileNavOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        <aside
          className={`
            fixed top-0 left-0 z-50 h-full bg-slate-900 text-white flex flex-col
            transition-transform duration-200 ease-out
            w-[min(18rem,88vw)]
            ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0 lg:static lg:z-auto
            ${sidebarCollapsed ? 'lg:w-[4.5rem]' : 'lg:w-72'}
          `}
        >
          <div className={`p-3 border-b border-slate-800 flex items-center gap-2 ${sidebarCollapsed ? 'lg:flex-col lg:items-stretch' : ''}`}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <img src="/uni-logo.gif" alt="UNI" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
              <div className={`min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                <h1 className="font-bold text-sm tracking-tight truncate">UNI Mission Control</h1>
                <p className="text-[10px] text-slate-400 truncate">Marketing Performance Hub</p>
              </div>
            </div>
            <button
              type="button"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setSidebarCollapsed(c => !c)}
              className="hidden lg:flex p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex-shrink-0"
            >
              {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <button
              type="button"
              title="Close menu"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden ml-auto"
              onClick={() => setMobileNavOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            <div className={`text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 px-3 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              Main
            </div>
            <NavLink to="/" icon={LayoutDashboard} label="Overview" collapsed={sidebarCollapsed} onNavigate={() => setMobileNavOpen(false)} />
            {canAccessMission(appUser?.role) && (
              <NavLink to="/mission" icon={LayoutGrid} label="Mission Board" collapsed={sidebarCollapsed} onNavigate={() => setMobileNavOpen(false)} />
            )}
            {canAccessAlerts(appUser?.role) && (
              <NavLink to="/alerts" icon={AlertTriangle} label="Alerts" collapsed={sidebarCollapsed} onNavigate={() => setMobileNavOpen(false)} badge={openAlertCount ?? 0} />
            )}
            <NavLink to="/realtime-performance" icon={Activity} label="Real-time Performance" collapsed={sidebarCollapsed} onNavigate={() => setMobileNavOpen(false)} />
            {canAccessCreative(appUser?.role) && (
              <NavLink to="/creative-performance" icon={Layers} label="Creative Performance" collapsed={sidebarCollapsed} onNavigate={() => setMobileNavOpen(false)} />
            )}

            <div className={`text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 mt-4 px-3 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              System
            </div>
            {appUser?.role === 'super_admin' && (
              <NavLink to="/feedback" icon={MessageSquarePlus} label="Feedback" collapsed={sidebarCollapsed} onNavigate={() => setMobileNavOpen(false)} />
            )}
            {canAccessSettings(appUser?.role) && (
              <NavLink to="/dashboard/settings" icon={Settings} label="Settings" collapsed={sidebarCollapsed} onNavigate={() => setMobileNavOpen(false)} />
            )}
          </nav>

          <div className="p-2 border-t border-slate-800">
            <div className={`flex items-center gap-2 p-2 rounded-xl bg-slate-800/50 ${sidebarCollapsed ? 'lg:flex-col lg:items-center' : ''}`}>
              <Link
                to="/dashboard/settings?tab=profile"
                title="Edit profile"
                onClick={() => setMobileNavOpen(false)}
                className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-semibold hover:opacity-80 transition flex-shrink-0"
              >
                {(appUser?.display_name || 'U')[0].toUpperCase()}
              </Link>
              <div className={`flex-1 min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                <p className="text-xs font-medium truncate">{appUser?.display_name || 'User'}</p>
                <p className="text-[10px] text-slate-400 capitalize">{effRole.replace('_', ' ')}</p>
              </div>
              <button onClick={handleSignOut} title="Sign out" className="text-slate-500 hover:text-slate-300 transition flex-shrink-0 p-1">
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </aside>

        <div className={`flex-1 flex flex-col min-w-0 w-full ${sidebarCollapsed ? 'lg:ml-[4.5rem]' : 'lg:ml-72'}`}>
          <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
            <AnnouncementBanner />
            <div className="h-12 px-4 sm:px-8 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                  aria-label="Open menu"
                  onClick={() => setMobileNavOpen(true)}
                >
                  <Menu size={20} />
                </button>
                <span className="text-xs text-gray-400 font-medium tracking-wide uppercase truncate select-none">
                  UNI Mission Control
                </span>
              </div>
              <button
                onClick={() => navigate(canAccessAlerts(appUser?.role) ? '/alerts' : '/')}
                className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                title={canAccessAlerts(appUser?.role) ? 'View alerts' : 'Home'}
              >
                <Bell size={18} />
                {(openAlertCount ?? 0) > 0 && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
                )}
              </button>
            </div>
          </header>

          <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/clients-overview" element={<Navigate to="/?tab=by-client" replace />} />
              <Route path="/data-analytics" element={<Navigate to="/?tab=by-account" replace />} />
              <Route
                path="/mission"
                element={
                  <RoleGuard allowed={['super_admin', 'media_buyer']}>
                    <MissionBoard />
                  </RoleGuard>
                }
              />
              <Route
                path="/alerts"
                element={
                  <RoleGuard allowed={['super_admin', 'media_buyer', 'partner']}>
                    <Alerts />
                  </RoleGuard>
                }
              />
              <Route path="/realtime-performance" element={<RealtimePerformance />} />
              <Route
                path="/creative-performance"
                element={
                  <RoleGuard allowed={['super_admin', 'media_buyer']}>
                    <CreativePerformance />
                  </RoleGuard>
                }
              />
              <Route
                path="/dashboard/settings"
                element={
                  <RoleGuard allowed={['super_admin', 'media_buyer', 'client']}>
                    <DashboardSettings />
                  </RoleGuard>
                }
              />
              <Route
                path="/feedback"
                element={
                  <RoleGuard allowed={['super_admin']}>
                    <FeedbackAdmin />
                  </RoleGuard>
                }
              />
            </Routes>
          </main>
        </div>

        {/* Feedback FAB — persists on every authenticated page */}
        <OpenClawChatWidget />
        <FeedbackWidget />
      </div>
  )
}

function NavLink({
  to,
  icon: Icon,
  label,
  badge,
  collapsed,
  onNavigate,
}: {
  to: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  label: string
  badge?: number
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <Link
      to={to}
      title={label}
      onClick={() => onNavigate?.()}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
        collapsed ? 'lg:justify-center lg:px-2' : ''
      } ${
        isActive
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon size={20} className="flex-shrink-0" />
      <span className={`font-medium text-sm ${collapsed ? 'lg:hidden' : ''}`}>{label}</span>
      {badge !== undefined && badge > 0 ? (
        <span className={`ml-auto px-1.5 py-0.5 rounded-full text-xs font-bold min-w-[20px] text-center ${
          collapsed ? 'lg:hidden' : ''
        } ${
          isActive ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
        }`}>
          {badge > 99 ? '99+' : badge}
        </span>
      ) : (
        isActive && <div className={`ml-auto w-1.5 h-1.5 bg-white rounded-full ${collapsed ? 'lg:hidden' : ''}`} />
      )}
    </Link>
  )
}

export default App
