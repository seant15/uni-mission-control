import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Rocket, BarChart3, Settings as SettingsIcon, Bell, Search, Database } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import MissionControl from './pages/MissionControl'
import DataAnalytics from './pages/DataAnalytics'
import TaskAnalytics from './pages/TaskAnalytics'
import SettingsPage from './pages/Settings'

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar */}
        <aside className="w-72 bg-slate-900 text-white flex flex-col fixed h-full z-50">
          {/* Logo */}
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg">
                U
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight">UNI Mission Control</h1>
                <p className="text-xs text-slate-400">Agent Fleet Management</p>
              </div>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4">
              Main
            </div>
            <NavLink to="/" icon={LayoutDashboard} label="Overview" />
            <NavLink to="/mission-control" icon={Rocket} label="Mission Control" />
            <NavLink to="/data-analytics" icon={Database} label="Data Analytics" />
            <NavLink to="/task-analytics" icon={BarChart3} label="Task Analytics" />
            
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6 px-4">
              System
            </div>
            <NavLink to="/settings" icon={SettingsIcon} label="Settings" />
          </nav>
          
          {/* User Profile */}
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-sm font-semibold">
                S
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Sean</p>
                <p className="text-xs text-slate-400">Administrator</p>
              </div>
              <div className="w-2 h-2 bg-green-500 rounded-full" />
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 ml-72">
          {/* Top Header */}
          <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-40 px-8 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search agents, tasks, or analytics..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
            </div>
          </header>

          {/* Page Content */}
          <main className="p-8 max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/mission-control" element={<MissionControl />} />
              <Route path="/data-analytics" element={<DataAnalytics />} />
              <Route path="/task-analytics" element={<TaskAnalytics />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
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
