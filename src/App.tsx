import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { LayoutDashboard, Rocket, BarChart3, Settings } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import MissionControl from './pages/MissionControl'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full">
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-xl font-bold">UNI Mission Control</h1>
            <p className="text-xs text-slate-400 mt-1">v1.0.0</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            <NavLink to="/" icon={LayoutDashboard} label="Overview" />
            <NavLink to="/mission-control" icon={Rocket} label="Mission Control" />
            <NavLink to="/analytics" icon={BarChart3} label="Analytics" />
            <NavLink to="/settings" icon={Settings} label="Settings" />
          </nav>
          
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-semibold">
                S
              </div>
              <div>
                <p className="text-sm font-medium">Sean</p>
                <p className="text-xs text-slate-400">Admin</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64 p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/mission-control" element={<MissionControl />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

function NavLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  const isActive = location.pathname === to
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </Link>
  )
}

export default App
