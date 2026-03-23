import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import {
  CheckCircle, Clock, X, UserPlus, ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react'
import { db } from '../../lib/api'
import NoteThread from './NoteThread'
import type { Alert } from '../../types/alerts'

interface Props {
  alert: Alert
  currentUserId: string
  currentUserRole: string
}

const SNOOZE_PRESETS = [
  { label: '1 hour',          hours: 1 },
  { label: '4 hours',         hours: 4 },
  { label: 'Tomorrow 9am',    hours: null },  // computed specially
  { label: 'Custom…',         hours: -1 },
]

function getPlatformDeepLink(alert: Alert): string | null {
  if (!alert.account_id) return null
  if (alert.platform === 'google_ads') {
    return `https://ads.google.com/aw/campaigns?ocid=${alert.account_id}`
  }
  if (alert.platform === 'meta_ads') {
    const id = alert.account_id.replace(/^act_/, '')
    return `https://www.facebook.com/adsmanager/manage/campaigns?act=${id}`
  }
  return null
}

export default function AlertActionPanel({ alert, currentUserId, currentUserRole }: Props) {
  const [showSnooze,   setShowSnooze]   = useState(false)
  const [showAssign,   setShowAssign]   = useState(false)
  const [customSnooze, setCustomSnooze] = useState('')
  const [showNotes,    setShowNotes]    = useState(true)
  const queryClient = useQueryClient()

  const isAdmin = ['super_admin', 'team_member'].includes(currentUserRole)

  const { data: teamMembers } = useQuery({
    queryKey: ['team-members'],
    queryFn:  db.getTeamMembers.bind(db),
    staleTime: 300_000,
    enabled: showAssign,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['alerts'] })
    queryClient.invalidateQueries({ queryKey: ['alert-counts'] })
    queryClient.invalidateQueries({ queryKey: ['alert-open-count'] })
  }

  const resolveMutation = useMutation({
    mutationFn: () => db.resolveAlert(alert.id, currentUserId),
    onSuccess: invalidate,
  })

  const snoozeMutation = useMutation({
    mutationFn: (until: string) => db.snoozeAlert(alert.id, until),
    onSuccess: () => { invalidate(); setShowSnooze(false) },
  })

  const dismissMutation = useMutation({
    mutationFn: () => db.dismissAlert(alert.id, currentUserId),
    onSuccess: invalidate,
  })

  const assignMutation = useMutation({
    mutationFn: (userId: string) => db.assignAlert(alert.id, userId),
    onSuccess: () => { invalidate(); setShowAssign(false) },
  })

  const reopenMutation = useMutation({
    mutationFn: () => db.reopenAlert(alert.id),
    onSuccess: invalidate,
  })

  function handleSnoozePreset(preset: typeof SNOOZE_PRESETS[number]) {
    if (preset.hours === -1) return // custom — let user pick datetime
    const now = new Date()
    let until: Date
    if (preset.hours === null) {
      // Tomorrow 9am local
      until = new Date(now)
      until.setDate(until.getDate() + 1)
      until.setHours(9, 0, 0, 0)
    } else {
      until = new Date(now.getTime() + preset.hours * 60 * 60 * 1000)
    }
    snoozeMutation.mutate(until.toISOString())
  }

  const deepLink = getPlatformDeepLink(alert)
  const isTerminal = ['resolved', 'dismissed', 'ignored'].includes(alert.status)

  return (
    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 space-y-4">
      {/* Quick actions row */}
      <div className="flex items-center gap-2 flex-wrap">
        {!isTerminal && (
          <button
            onClick={() => resolveMutation.mutate()}
            disabled={resolveMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircle size={14} /> Resolve
          </button>
        )}

        {!isTerminal && (
          <div className="relative">
            <button
              onClick={() => setShowSnooze(!showSnooze)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition-colors"
            >
              <Clock size={14} /> Snooze {showSnooze ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showSnooze && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[160px]">
                {SNOOZE_PRESETS.map(p => (
                  p.hours === -1 ? (
                    <div key={p.label} className="px-3 py-2 border-t border-gray-100">
                      <input
                        type="datetime-local"
                        value={customSnooze}
                        onChange={e => setCustomSnooze(e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1"
                      />
                      <button
                        onClick={() => customSnooze && snoozeMutation.mutate(new Date(customSnooze).toISOString())}
                        disabled={!customSnooze}
                        className="mt-1 w-full text-xs bg-amber-500 text-white rounded px-2 py-1 disabled:opacity-40"
                      >
                        Set custom snooze
                      </button>
                    </div>
                  ) : (
                    <button
                      key={p.label}
                      onClick={() => handleSnoozePreset(p)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                    >
                      {p.label}
                    </button>
                  )
                ))}
              </div>
            )}
          </div>
        )}

        {isAdmin && !isTerminal && (
          <div className="relative">
            <button
              onClick={() => setShowAssign(!showAssign)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              <UserPlus size={14} /> Assign {showAssign ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showAssign && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px]">
                {(teamMembers ?? []).map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => assignMutation.mutate(m.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                  >
                    {m.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {isAdmin && !isTerminal && (
          <button
            onClick={() => dismissMutation.mutate()}
            disabled={dismissMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 disabled:opacity-50 transition-colors"
          >
            <X size={14} /> Dismiss
          </button>
        )}

        {isTerminal && (
          <button
            onClick={() => reopenMutation.mutate()}
            disabled={reopenMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            Reopen
          </button>
        )}

        {deepLink && (
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            <ExternalLink size={14} /> View in {alert.platform === 'google_ads' ? 'Google Ads' : 'Meta Ads'}
          </a>
        )}
      </div>

      {/* Notes thread */}
      <div>
        <button
          onClick={() => setShowNotes(!showNotes)}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"
        >
          Notes {showNotes ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {showNotes && (
          <NoteThread alertId={alert.id} currentUserId={currentUserId} />
        )}
      </div>
    </div>
  )
}
