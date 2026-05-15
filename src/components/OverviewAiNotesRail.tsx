import { Link } from 'react-router-dom'
import { AlertCircle, Clock, CheckCircle, X } from 'lucide-react'
import AlertSystemGuideLink from './AlertSystemGuideLink'

type AlertRow = {
  id: string
  severity: string
  status: string
  created_at: string
  account_name?: string | null
  message?: string | null
}

export default function OverviewAiNotesRail({
  alerts,
  alertSummary,
}: {
  alerts: AlertRow[]
  alertSummary: { total: number; new: number; critical: number; high: number }
}) {
  const getSeverityColor = (s: string) =>
    s === 'critical' ? 'bg-red-100 text-red-700' :
    s === 'high' ? 'bg-orange-100 text-orange-700' :
    s === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-700'

  const getStatusIcon = (s: string) =>
    s === 'new' ? <AlertCircle size={14} /> :
    s === 'in_progress' ? <Clock size={14} /> :
    s === 'resolved' ? <CheckCircle size={14} /> : <X size={14} />

  return (
    <aside
      className="hidden xl:flex flex-col gap-2.5 w-full min-w-0 max-h-[calc(100vh-5rem)] sticky top-16 self-start"
      aria-label="AI notes and alerts"
    >
      <div className="rounded-xl border border-dashed border-slate-300/90 bg-gradient-to-b from-[var(--brand-50)]/90 to-white p-2.5 text-[11px] text-slate-600 shadow-sm">
        <span className="font-semibold text-[var(--brand-700)] uppercase tracking-wide text-[10px]">AI notes</span>
        <p className="mt-1.5 leading-snug text-slate-600">
          Reserved for auto summaries and next actions. Your notes can render above or below this block later.
        </p>
      </div>

      <AlertSystemGuideLink variant="rail" />

      <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm flex flex-col min-h-0 flex-1 overflow-hidden">
        <div className="flex items-center justify-between gap-1 mb-2 shrink-0">
          <span className="font-semibold text-slate-700 uppercase tracking-wide text-[10px]">Alerts</span>
          <Link to="/alerts" className="text-[10px] text-[var(--brand-600)] hover:opacity-90 font-semibold whitespace-nowrap">
            Open →
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-1 mb-2 shrink-0 text-center">
          <div className="rounded-md bg-slate-50 px-0.5 py-1 border border-slate-100">
            <div className="text-[11px] font-bold text-slate-900 leading-none">{alertSummary.total}</div>
            <div className="text-[8px] text-slate-500 leading-tight mt-0.5">Tot</div>
          </div>
          <div className="rounded-md bg-red-50 px-0.5 py-1 border border-red-100">
            <div className="text-[11px] font-bold text-red-700 leading-none">{alertSummary.new}</div>
            <div className="text-[8px] text-red-600 leading-tight mt-0.5">New</div>
          </div>
          <div className="rounded-md bg-red-50 px-0.5 py-1 border border-red-100">
            <div className="text-[11px] font-bold text-red-700 leading-none">{alertSummary.critical}</div>
            <div className="text-[8px] text-red-600 leading-tight mt-0.5">Crit</div>
          </div>
          <div className="rounded-md bg-orange-50 px-0.5 py-1 border border-orange-100">
            <div className="text-[11px] font-bold text-orange-800 leading-none">{alertSummary.high}</div>
            <div className="text-[8px] text-orange-700 leading-tight mt-0.5">High</div>
          </div>
        </div>
        <div className="overflow-y-auto min-h-0 flex-1 space-y-1.5 pr-0.5">
          {alerts.length > 0 ? (
            alerts.map(alert => (
              <div
                key={alert.id}
                className="rounded-lg border border-slate-100 bg-slate-50/80 p-1.5 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-1 flex-wrap">
                  <span className={`text-[9px] font-semibold uppercase px-1 py-0 rounded ${getSeverityColor(alert.severity)}`}>
                    {alert.severity}
                  </span>
                  <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                    {getStatusIcon(alert.status)}
                    {new Date(alert.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="text-[10px] font-semibold text-slate-800 truncate mt-0.5" title={alert.account_name || ''}>
                  {alert.account_name}
                </div>
                <p className="text-[10px] text-slate-600 leading-snug line-clamp-2 mt-0.5" title={alert.message || ''}>
                  {alert.message}
                </p>
              </div>
            ))
          ) : (
            <p className="text-[10px] text-slate-400 text-center py-3">No alerts in scope</p>
          )}
        </div>
      </div>
    </aside>
  )
}
