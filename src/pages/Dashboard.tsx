import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity, Users, Zap, Clock, ArrowRight,
  BarChart3, AlertCircle, Rocket, Database
} from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [error, setError] = useState<string | null>(null)

  // Agent data with error handling
  const { data: agentHealth } = useQuery({
    queryKey: ['agentHealth'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('agent_health').select('*')
        if (error) {
          setError(`Agent health error: ${error.message}`)
          return []
        }
        return data || []
      } catch (err: any) {
        setError(`Agent health exception: ${err.message}`)
        return []
      }
    },
  })

  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from('agent_tasks').select('*')
        if (error) {
          setError(`Tasks error: ${error.message}`)
          return []
        }
        return data || []
      } catch (err: any) {
        setError(`Tasks exception: ${err.message}`)
        return []
      }
    },
  })

  const onlineAgents = agentHealth?.filter(a => a.consecutive_failures === 0).length || 0
  const pendingTasks = tasks?.filter(t => t.status === 'pending').length || 0
  const activeTasks = tasks?.filter(t => t.status === 'claimed').length || 0

  return (
    <div className="space-y-10 pb-12">
      {/* Error Notification */}
      {error && (
        <div className="bg-red-50/80 backdrop-blur-md border border-red-200/50 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
          <AlertCircle className="text-red-600" size={20} />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 transition-colors">✕</button>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative flex items-center justify-between bg-white/40 backdrop-blur-xl border border-white/40 rounded-3xl p-8 shadow-sm">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
              Dashboard <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Overview</span>
            </h1>
            <p className="text-slate-500 mt-2 text-lg font-medium">Unified command for your AI agent fleet</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="px-5 py-2.5 bg-emerald-50 text-emerald-700 rounded-2xl text-sm font-bold flex items-center gap-2 border border-emerald-100/50 shadow-sm shadow-emerald-100">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              Operational
            </div>
            <p className="text-xs text-slate-400 font-medium mr-1">Last sync: Just now</p>
          </div>
        </div>
      </div>

      {/* AGENT FLEET SECTION */}
      <section>
        <div className="flex items-center justify-between mb-6 px-2">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
              <Users size={18} />
            </div>
            Global Fleet Status
          </h2>
          <button className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">View details →</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Online Agents"
            value={onlineAgents}
            total={6}
            icon={Users}
            color="blue"
            subtitle="Ready to deploy"
          />
          <StatCard
            title="Queued Tasks"
            value={pendingTasks}
            icon={Clock}
            color="amber"
            subtitle="Awaiting allocation"
          />
          <StatCard
            title="Live Sessions"
            value={activeTasks}
            icon={Zap}
            color="emerald"
            subtitle="Currently processing"
          />
          <StatCard
            title="Performance"
            value="98.4%"
            icon={Activity}
            color="violet"
            subtitle="Success rate 24h"
          />
        </div>
      </section>

      {/* AGENT STATUS CARDS */}
      <section>
        <h2 className="text-xl font-bold text-slate-800 mb-6 px-2 flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
            <Users size={18} />
          </div>
          Individual Agent Nodes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {['clover', 'mary', 'openclaw', 'nexus', 'writer', 'kimi'].map((agentName) => {
            const health = agentHealth?.find(h => h.agent_name === agentName)
            const agentTasks = tasks?.filter(t => t.to_agent === agentName)
            const activeCount = agentTasks?.filter(t => t.status === 'claimed').length || 0
            const emojiMap: Record<string, string> = {
              clover: '🍀', mary: '📡', openclaw: '🛡️',
              nexus: '🔗', writer: '✍️', kimi: '🧪'
            }

            return (
              <div key={agentName} className="group relative">
                <div className="absolute -inset-0.5 bg-gradient-to-br from-slate-200 to-slate-300 rounded-3xl opacity-0 group-hover:opacity-100 transition duration-500 blur-sm"></div>
                <div className="relative bg-white/70 backdrop-blur-md rounded-3xl border border-white/80 p-6 transition-all duration-300 group-hover:translate-y-[-4px] shadow-sm hover:shadow-xl">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                        {emojiMap[agentName]}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg capitalize tracking-tight">{agentName}</h3>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${health?.consecutive_failures === 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 animate-pulse'}`} />
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            {health?.consecutive_failures === 0 ? 'Optimal' : 'Checking'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-100 p-2 rounded-xl text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                      <ArrowRight size={18} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active</p>
                      <p className="text-xl font-bold text-slate-700">{activeCount}</p>
                    </div>
                    <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total</p>
                      <p className="text-xl font-bold text-slate-700">{agentTasks?.length || 0}</p>
                    </div>
                  </div>

                  <div className="mt-5 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden p-[1px]">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${Math.min(100, (activeCount / 5) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* SYSTEM MODULES (Quick Links) */}
      <section>
        <h2 className="text-xl font-bold text-slate-800 mb-6 px-2 flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
            <Database size={18} />
          </div>
          Integrated Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <ModuleCard
            title="Mission Control"
            subtitle="Fleet orchestration & command"
            description="Direct oversight of task queues and agent session management."
            link="/mission-control"
            icon={Rocket}
            color="from-blue-600 to-indigo-600"
            lightColor="bg-blue-50 text-blue-600"
          />
          <ModuleCard
            title="Data Analytics"
            subtitle="Marketing performance hive"
            description="Deep dive into cross-platform performance metrics and ROAS."
            link="/data-analytics"
            icon={Database}
            color="from-emerald-600 to-teal-600"
            lightColor="bg-emerald-50 text-emerald-600"
          />
          <ModuleCard
            title="Task Analytics"
            subtitle="Operational throughput"
            description="Analyze agent efficiency, task latency, and system health trends."
            link="/task-analytics"
            icon={BarChart3}
            color="from-violet-600 to-purple-600"
            lightColor="bg-violet-50 text-violet-600"
          />
        </div>
      </section>
    </div>
  )
}

// Components
interface StatCardProps {
  title: string
  value: string | number
  total?: number
  icon: any
  color: 'blue' | 'amber' | 'emerald' | 'violet' | 'indigo' | 'rose'
  subtitle: string
}

function StatCard({ title, value, total, icon: Icon, color, subtitle }: StatCardProps) {
  const colorSchemes = {
    blue: { bg: 'bg-blue-500/10', icon: 'text-blue-600', border: 'border-blue-100', glow: 'shadow-blue-500/20' },
    amber: { bg: 'bg-amber-500/10', icon: 'text-amber-600', border: 'border-amber-100', glow: 'shadow-amber-500/20' },
    emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-600', border: 'border-emerald-100', glow: 'shadow-emerald-500/20' },
    violet: { bg: 'bg-violet-500/10', icon: 'text-violet-600', border: 'border-violet-100', glow: 'shadow-violet-500/20' },
    indigo: { bg: 'bg-indigo-500/10', icon: 'text-indigo-600', border: 'border-indigo-100', glow: 'shadow-indigo-500/20' },
    rose: { bg: 'bg-rose-500/10', icon: 'text-rose-600', border: 'border-rose-100', glow: 'shadow-rose-500/20' },
  }

  const scheme = colorSchemes[color]

  return (
    <div className={`relative bg-white/80 backdrop-blur-md rounded-3xl border ${scheme.border} p-6 shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden`}>
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${scheme.bg} blur-3xl -mr-12 -mt-12 transition-transform duration-500 group-hover:scale-150 opacity-50`} />
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {value}
              {total && <span className="text-lg text-slate-300 font-medium tracking-normal ml-0.5">/{total}</span>}
            </h3>
          </div>
          <p className="text-xs font-medium text-slate-400 mt-2 flex items-center gap-1.5 italic">
            {subtitle}
          </p>
        </div>
        <div className={`p-4 rounded-2xl ${scheme.bg} ${scheme.icon} group-hover:scale-110 transition-transform duration-300 shadow-sm ${scheme.glow}`}>
          <Icon size={24} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  )
}

function ModuleCard({ title, subtitle, description, link, icon: Icon, color, lightColor }: any) {
  return (
    <div className="group relative">
      <div className={`absolute -inset-0.5 bg-gradient-to-r ${color} rounded-[2rem] blur opacity-10 group-hover:opacity-25 transition duration-500`}></div>
      <div className="relative bg-white/70 backdrop-blur-md border border-white/80 rounded-[2rem] p-8 shadow-sm group-hover:shadow-2xl transition-all duration-500 flex flex-col items-start h-full">
        <div className={`p-4 rounded-2xl ${lightColor} mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-sm shadow-black/5`}>
          <Icon size={28} strokeWidth={2.2} />
        </div>
        <div>
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">{title}</h3>
          <p className={`text-sm font-bold uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r ${color} mb-4`}>
            {subtitle}
          </p>
          <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
            {description}
          </p>
        </div>
        <div className="mt-auto w-full">
          <a
            href={link}
            className={`w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r ${color} text-white font-bold px-6 py-3.5 rounded-2xl transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:translate-y-[-2px] active:translate-y-[0px]`}
          >
            Launch System
            <ArrowRight size={18} />
          </a>
        </div>
      </div>
    </div>
  )
}
