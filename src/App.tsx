import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, AlertTriangle, Bell, Settings, Activity, Layers, Megaphone, X, DoorOpen, MessageSquarePlus, LayoutGrid, Menu, ChevronsLeft, ChevronsRight, Bot } from 'lucide-react'
import { db } from './lib/api'
import OverviewPage from './pages/OverviewPage'
import Alerts from './pages/Alerts'
import DashboardSettings from './pages/DashboardSettings'
import RealtimePerformance from './pages/RealtimePerformance'
import CreativePerformance from './pages/CreativePerformance'
import FeedbackAdmin from './pages/FeedbackAdmin'
import Login from './pages/Login'
import BottomRightAssistDock from './components/BottomRightAssistDock'
import ShellPreviewControl from './components/ShellPreviewControl'
import AgencySwitcher from './components/AgencySwitcher'
import UserAvatar from './components/UserAvatar'
import MissionBoard from './pages/MissionBoard'
import AIChatAdmin from './pages/AIChatAdmin'
import { RoleGuard } from './components/RoleGuard'
import { getDashboardSettings, GLOBAL_ANNOUNCEMENT_QUERY_KEY, APP_SHELL_SETTINGS_QUERY_KEY } from './lib/settings'
import { getShellPreviewUserId, setShellPreviewUserIdStorage } from './lib/shellPreviewStorage'
import { ShellPreviewProvider } from './contexts/ShellPreviewContext'
import { UiDensityProvider } from './contexts/UiDensityContext'
import { useAuth } from './contexts/AuthContext'
import {
  normalizeRole,
  canAccessMission,
  canAccessCreative,
  canAccessAlerts,
  canAccessSettings,
  scopedClientIdFromUser,
} from './lib/rbac'
import { Toaster } from 'sonner'
import { applyAccentToDocument, setStoredAccent } from './lib/themeAccent'
import { applyUiThemeToDocument, setStoredUiTheme, watchSystemTheme } from './lib/themePreference'

const ANNOUNCEMENT_STYLES = {
  info:    { bar: 'bg-[color-mix(in_oklab,var(--brand-100)_85%,white)] border-b border-[var(--brand-200)]/60', text: 'text-stone-800', icon: 'text-[var(--brand-700)]' },
  warning: { bar: 'bg-amber-100/95 border-b border-amber-200/80', text: 'text-amber-950', icon: 'text-amber-700' },
  success: { bar: 'bg-emerald-100/95 border-b border-emerald-200/80', text: 'text-emerald-950', icon: 'text-emerald-700' },
  neutral: { bar: 'bg-stone-200/90 border-b border-stone-300/80', text: 'text-stone-800', icon: 'text-stone-500' },
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
      <button onClick={() => setDismissed(true)} className={`${st.icon} hover:opacity-70 rounded-md p-0.5`}>
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
        {/* Never use path="/*" here: it competes with /login and can render AppShell instead of Login (RR v6). */}
        <Route path="*" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
      </Routes>
    </Router>
  )
}

function CreativePerformanceGate() {
  const { appUser } = useAuth()
  const scopedClientId = useMemo(() => scopedClientIdFromUser(appUser), [appUser])
  const role = normalizeRole(appUser?.role)

  const { data: metaAdAccounts, isLoading } = useQuery({
    queryKey: ['creative-meta-accounts', scopedClientId ?? ''],
    queryFn: () =>
      db.getAdAccounts({
        clientId: scopedClientId,
        platform: 'meta_ads',
        scopedClientId: scopedClientId || undefined,
      }),
    enabled: role === 'client' && !!scopedClientId,
    staleTime: 10 * 60_000,
  })

  const hasMetaAds = (metaAdAccounts?.length ?? 0) > 0

  if (canAccessCreative(appUser?.role, hasMetaAds)) {
    return <CreativePerformance />
  }
  if (role === 'client' && isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-500">
        Loading creative performance…
      </div>
    )
  }
  return <Navigate to="/" replace />
}

function AppShell() {
  const { appUser, signOut, user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const effRole = normalizeRole(appUser?.role)
  const scopedClientId = useMemo(() => scopedClientIdFromUser(appUser), [appUser])

  const { data: clientMetaAdAccounts } = useQuery({
    queryKey: ['nav-meta-accounts', scopedClientId ?? ''],
    queryFn: () =>
      db.getAdAccounts({
        clientId: scopedClientId,
        platform: 'meta_ads',
        scopedClientId: scopedClientId || undefined,
      }),
    enabled: effRole === 'client' && !!scopedClientId,
    staleTime: 10 * 60_000,
  })
  const clientHasMetaAds = (clientMetaAdAccounts?.length ?? 0) > 0
  const showCreativeNav = canAccessCreative(appUser?.role, clientHasMetaAds)

  const [shellPreviewUserId, setShellPreviewUserIdState] = useState<string | null>(() => getShellPreviewUserId())
  const shellPreviewValue = useMemo(
    () => ({
      previewUserId: shellPreviewUserId,
      setPreviewUserId: (id: string | null) => {
        setShellPreviewUserIdStorage(id)
        setShellPreviewUserIdState(id)
        void queryClient.invalidateQueries({ queryKey: [...APP_SHELL_SETTINGS_QUERY_KEY] })
      },
    }),
    [shellPreviewUserId, queryClient]
  )

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
    applyAccentToDocument()
  }, [])

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

  const effectiveShellUserId =
    appUser?.role === 'super_admin' && shellPreviewUserId ? shellPreviewUserId : user?.id || 'default_user'

  const { data: shellSettings } = useQuery({
    queryKey: [...APP_SHELL_SETTINGS_QUERY_KEY, user?.id ?? 'anon', shellPreviewUserId ?? ''],
    queryFn: () => getDashboardSettings(effectiveShellUserId),
    staleTime: 60_000,
  })

  const { data: myAppearance } = useQuery({
    queryKey: ['dashboard-settings', 'appearance', user?.id ?? 'anon'],
    queryFn: () => getDashboardSettings(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!myAppearance) return
    setStoredUiTheme(myAppearance.uiTheme)
    applyUiThemeToDocument(myAppearance.uiTheme)
    setStoredAccent(myAppearance.uiAccent)
  }, [myAppearance?.uiTheme, myAppearance?.uiAccent])

  useEffect(() => {
    if (!myAppearance || myAppearance.uiTheme !== 'system') return
    return watchSystemTheme(() => applyUiThemeToDocument('system'))
  }, [myAppearance?.uiTheme])

  const brandTitle = shellSettings?.appTitle?.trim() || 'UNI Mission Control'
  const brandSubtitle = shellSettings?.appSubtitle?.trim() || 'Marketing Performance Hub'
  const brandLogo = shellSettings?.appLogoUrl?.trim() || '/uni-logo.gif'
  const density = shellSettings?.uiDensity === 'compact' ? 'compact' : 'comfort'
  const mainPad = density === 'compact' ? 'p-2 sm:p-2.5 lg:p-3' : 'p-4 sm:p-5 lg:py-6 lg:px-8'

  const { data: openAlertCount } = useQuery({
    queryKey: ['alert-open-count'],
    queryFn:  db.getOpenAlertCount.bind(db),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  async function handleSignOut() {
    try {
      setShellPreviewUserIdStorage(null)
      setShellPreviewUserIdState(null)
      await signOut()
      navigate('/login', { replace: true })
    } catch (e) {
      console.error('Sign out failed:', e)
    }
  }

  return (
    <ShellPreviewProvider value={shellPreviewValue}>
    <div className="uni-app-shell flex min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/25 to-amber-50/40">
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
            fixed top-0 left-0 z-50 h-full text-slate-100 flex flex-col
            bg-slate-800/92 backdrop-blur-xl backdrop-saturate-150
            border-r border-white/10 shadow-[4px_0_24px_-8px_rgba(0,0,0,0.15)]
            transition-transform duration-200 ease-out
            w-[min(19rem,92vw)]
            ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0 lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:h-screen lg:overflow-y-auto
            ${sidebarCollapsed ? 'lg:w-[4.25rem]' : 'lg:w-[18.5rem]'}
          `}
        >
          <div
            className={`uni-sidebar-shell uni-sidebar-brand-block p-2 border-b border-white/10 flex items-center gap-2 ${
              sidebarCollapsed ? 'lg:flex-col lg:items-center lg:justify-center lg:gap-2 lg:py-3' : ''
            }`}
          >
            <div
              className={`flex items-center gap-2.5 min-w-0 px-1 ${
                sidebarCollapsed ? 'lg:flex-1 lg:flex-col lg:items-center lg:justify-center lg:w-full' : 'flex-1'
              }`}
            >
              <img
                src={brandLogo}
                alt=""
                onError={(e) => {
                  const el = e.target as HTMLImageElement
                  if (el.src.indexOf('/uni-logo.gif') === -1) el.src = '/uni-logo.gif'
                }}
                className={`w-9 h-9 rounded-xl object-cover flex-shrink-0 ring-1 ring-white/20 ${sidebarCollapsed ? 'lg:mx-auto' : 'mx-0.5'}`}
              />
              <div className={`min-w-0 flex-1 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                <h1 className="uni-sidebar-brand-title text-[12px] sm:text-[13px]">
                  {brandTitle}
                </h1>
                <p className="uni-sidebar-brand-subtitle text-[10px] mt-0.5">{brandSubtitle}</p>
                {appUser?.role === 'super_admin' && (
                  <>
                    <AgencySwitcher collapsed={sidebarCollapsed} />
                    <ShellPreviewControl
                      collapsed={sidebarCollapsed}
                      isSuperAdmin
                      currentUserId={user?.id}
                    />
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setSidebarCollapsed(c => !c)}
              className={`hidden lg:flex p-1.5 rounded-md text-slate-200 hover:text-white hover:bg-white/10 border border-white/15 flex-shrink-0 ${
                sidebarCollapsed ? 'lg:mx-auto' : ''
              }`}
            >
              {sidebarCollapsed ? <ChevronsRight size={18} aria-hidden /> : <ChevronsLeft size={18} aria-hidden />}
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

          <nav className="flex-1 p-1.5 space-y-0 overflow-y-auto">
            <div className={`uni-sidebar-nav-label text-[9px] uppercase tracking-wider mb-0.5 px-2.5 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
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
            {showCreativeNav && (
              <NavLink to="/creative-performance" icon={Layers} label="Creative Performance" collapsed={sidebarCollapsed} onNavigate={() => setMobileNavOpen(false)} />
            )}

            <div className={`mt-5 pt-3 border-t border-white/10 ${sidebarCollapsed ? 'lg:hidden' : ''}`} aria-hidden />
            <div className={`uni-sidebar-nav-label text-[9px] uppercase tracking-wider mb-0.5 px-2.5 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              System
            </div>
            {appUser?.role === 'super_admin' && (
              <NavLink to="/feedback" icon={MessageSquarePlus} label="Feedback" collapsed={sidebarCollapsed} onNavigate={() => setMobileNavOpen(false)} />
            )}
            {appUser?.role === 'super_admin' && (
              <NavLink to="/ai-chat" icon={Bot} label="AI Chat Log" collapsed={sidebarCollapsed} onNavigate={() => setMobileNavOpen(false)} />
            )}
            {canAccessSettings(appUser?.role) && (
              <NavLink to="/dashboard/settings" icon={Settings} label="Settings" collapsed={sidebarCollapsed} onNavigate={() => setMobileNavOpen(false)} />
            )}
          </nav>

          <div className="uni-sidebar-footer-block mt-auto p-2 space-y-2">
            <div
              className={`uni-sidebar-user-card flex items-center gap-2.5 p-2.5 rounded-xl shadow-sm ${
                sidebarCollapsed ? 'lg:flex-col lg:items-center' : ''
              }`}
            >
              <button
                type="button"
                title="Profile & avatar settings"
                onClick={() => {
                  setMobileNavOpen(false)
                  navigate('/dashboard/settings?tab=profile')
                }}
                className="uni-sidebar-avatar-ring rounded-full flex-shrink-0 ring-2 hover:brightness-110 transition"
              >
                <UserAvatar
                  displayName={appUser?.display_name}
                  avatarPreset={appUser?.avatar_preset}
                  size="md"
                />
              </button>
              <div className={`flex-1 min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                <Link
                  to="/dashboard/settings?tab=profile"
                  onClick={() => setMobileNavOpen(false)}
                  className="uni-sidebar-footer-link text-sm truncate tracking-tight block"
                >
                  {appUser?.display_name || 'User'}
                </Link>
                <p className="uni-sidebar-user-role text-[11px] capitalize leading-tight">{effRole.replace('_', ' ')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out of UNI Mission Control"
              className={`uni-sidebar-signout-btn w-full flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-semibold transition ${
                sidebarCollapsed ? 'lg:px-0' : ''
              }`}
            >
              <DoorOpen size={15} className="uni-sidebar-signout-icon shrink-0" aria-hidden />
              <span className={sidebarCollapsed ? 'lg:sr-only' : ''}>Sign out</span>
            </button>
          </div>
        </aside>

        <div
          className={`flex-1 flex flex-col min-w-0 w-full ${
            sidebarCollapsed ? 'lg:pl-[4.25rem]' : 'lg:pl-[18.5rem]'
          }`}
        >
          <header className="uni-app-header">
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
                <span className="uni-sidebar-brand-title text-sm sm:text-[13px] tracking-wide uppercase truncate select-none">
                  {brandTitle}
                </span>
              </div>
              {canAccessAlerts(appUser?.role) && (
                <button
                  onClick={() => navigate('/alerts')}
                  className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                  title="View alerts"
                >
                  <Bell size={18} />
                  {(openAlertCount ?? 0) > 0 && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
                  )}
                </button>
              )}
            </div>
          </header>

          <main className={`${mainPad} w-full min-w-0`}>
            <UiDensityProvider value={density}>
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/clients-overview" element={<Navigate to="/?tab=agency" replace />} />
              <Route path="/data-analytics" element={<Navigate to="/?tab=heated" replace />} />
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
              <Route path="/creative-performance" element={<CreativePerformanceGate />} />
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
              <Route
                path="/ai-chat"
                element={
                  <RoleGuard allowed={['super_admin']}>
                    <AIChatAdmin />
                  </RoleGuard>
                }
              />
            </Routes>
            </UiDensityProvider>
          </main>
        </div>

        <BottomRightAssistDock
          showFeedback={shellSettings?.assistFeedbackFabEnabled !== false}
          showAIChat={shellSettings?.assistAiChatFabEnabled !== false}
        />
      </div>
    </ShellPreviewProvider>
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
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all ${
        collapsed ? 'lg:justify-center lg:px-1.5' : ''
      } ${
        isActive
          ? 'uni-sidebar-nav-link-active bg-[var(--brand-600)] shadow-md shadow-black/20'
          : 'uni-sidebar-nav-link hover:bg-slate-800/80'
      }`}
    >
      <Icon size={18} className="flex-shrink-0" />
      <span className={`font-medium text-[13px] ${collapsed ? 'lg:hidden' : ''}`}>{label}</span>
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
