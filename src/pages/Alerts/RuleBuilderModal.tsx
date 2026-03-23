import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Minus } from 'lucide-react'
import { db } from '../../lib/api'
import type { AlertRule, AlertTemplateType, AlertSeverity } from '../../types/alerts'

const TEMPLATE_DEFAULTS: Record<AlertTemplateType, Partial<AlertRule>> = {
  spend_spike:              { severity: 'high',     conditions: { ratio: 2.0, min_prior_spend: 1 } },
  spend_dead_zone:          { severity: 'high',     conditions: { consecutive_zero_hours: 3 } },
  ctr_cliff:                { severity: 'medium',   conditions: { ratio: 0.60, min_prior_impressions: 200 } },
  impression_collapse:      { severity: 'high',     conditions: { per_hour_drop_ratio: 0.60, min_baseline_impressions: 100 } },
  conversion_velocity_drop: { severity: 'high',     conditions: { ratio: 0.50, min_spend: 20 } },
  zero_impressions_sustained: { severity: 'critical', conditions: { consecutive_zero_hours: 6 } },
  zero_spend:               { severity: 'critical', conditions: {} },
  budget_pacing:            { severity: 'medium',   conditions: { over_ratio: 1.30, under_ratio: 0.40 } },
  ctr_anomaly:              { severity: 'medium',   conditions: { drop_ratio: 0.65, min_impressions: 1000 } },
  zero_conversions:         { severity: 'high',     conditions: { min_spend: 20, min_hour: 14 } },
  custom:                   { severity: 'medium',   conditions: {} },
}

const TEMPLATE_LABELS: Record<AlertTemplateType, string> = {
  spend_spike:              'Spend Spike (6h)',
  spend_dead_zone:          'Spend Dead Zone',
  ctr_cliff:                'CTR Cliff',
  impression_collapse:      'Impression Collapse',
  conversion_velocity_drop: 'Conversion Velocity Drop',
  zero_impressions_sustained: 'Zero Impressions (Sustained)',
  zero_spend:               'Zero Spend',
  budget_pacing:            'Budget Pacing',
  ctr_anomaly:              'CTR Anomaly',
  zero_conversions:         'Zero Conversions',
  custom:                   'Custom Rule',
}

interface Props {
  editRule?: AlertRule
  currentUserId: string
  onClose: () => void
}

export default function RuleBuilderModal({ editRule, currentUserId, onClose }: Props) {
  const queryClient = useQueryClient()

  const [name,          setName]          = useState(editRule?.name ?? '')
  const [templateType,  setTemplateType]  = useState<AlertTemplateType>(editRule?.template_type ?? 'spend_spike')
  const [clientId,      setClientId]      = useState(editRule?.client_id ?? '')
  const [platform,      setPlatform]      = useState<'google_ads' | 'meta_ads' | 'all'>(editRule?.platform ?? 'all')
  const [entityType,    setEntityType]    = useState<'account' | 'campaign' | 'ad_set' | 'ad'>(
    (editRule?.entity_type as 'account' | 'campaign' | 'ad_set' | 'ad') ?? 'account'
  )
  const [entityId,      setEntityId]      = useState(editRule?.entity_id ?? '')
  const [conditions,    setConditions]    = useState<Array<[string, unknown]>>(
    editRule ? Object.entries(editRule.conditions) : []
  )
  const [severity,      setSeverity]      = useState<AlertSeverity>(editRule?.severity ?? 'medium')
  const [isActive,      setIsActive]      = useState(editRule?.is_active ?? true)
  const [dateRangeStart, setDateRangeStart] = useState(editRule?.date_range_start ?? '')
  const [dateRangeEnd,   setDateRangeEnd]   = useState(editRule?.date_range_end ?? '')

  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn:  db.getClients.bind(db),
    staleTime: 300_000,
  })

  // When template changes, pre-fill conditions
  function applyTemplate(tt: AlertTemplateType) {
    setTemplateType(tt)
    const defaults = TEMPLATE_DEFAULTS[tt]
    if (defaults.severity) setSeverity(defaults.severity)
    if (defaults.conditions) setConditions(Object.entries(defaults.conditions as object))
  }

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const condObj = Object.fromEntries(conditions)
      const payload: Omit<AlertRule, 'id' | 'created_at' | 'updated_at'> = {
        name,
        template_type:  templateType,
        client_id:      clientId || undefined,
        created_by:     currentUserId,
        platform:       platform === 'all' ? 'all' : platform,
        entity_type:    entityType as AlertRule['entity_type'],
        entity_id:      entityId || undefined,
        conditions:     condObj,
        severity,
        is_active:      isActive,
        date_range_start: dateRangeStart || undefined,
        date_range_end:   dateRangeEnd   || undefined,
        display_order:  editRule?.display_order ?? 0,
      }
      if (editRule) {
        await db.updateAlertRule(editRule.id, payload)
      } else {
        await db.createAlertRule(payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{editRule ? 'Edit Rule' : 'New Alert Rule'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Template picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Template</label>
            <select
              value={templateType}
              onChange={e => applyTemplate(e.target.value as AlertTemplateType)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(Object.keys(TEMPLATE_LABELS) as AlertTemplateType[]).map(tt => (
                <option key={tt} value={tt}>{TEMPLATE_LABELS[tt]}</option>
              ))}
            </select>
          </div>

          {/* Rule Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Rule Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`e.g. ${TEMPLATE_LABELS[templateType]} — All Accounts`}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Client */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Client</label>
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Clients (Global Rule)</option>
              {(clients ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Platform + Entity Level */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Platform</label>
              <select
                value={platform}
                onChange={e => setPlatform(e.target.value as typeof platform)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Platforms</option>
                <option value="google_ads">Google Ads</option>
                <option value="meta_ads">Meta Ads</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Entity Level</label>
              <select
                value={entityType}
                onChange={e => setEntityType(e.target.value as 'account' | 'campaign' | 'ad_set' | 'ad')}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="account">Account</option>
                <option value="campaign">Campaign</option>
                <option value="ad_set">Ad Set</option>
                <option value="ad">Ad</option>
              </select>
            </div>
          </div>

          {/* Entity ID (if not account-level) */}
          {entityType !== 'account' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Entity ID
                <span className="ml-1 text-gray-400 font-normal normal-case">(campaign/adset/ad ID from platform)</span>
              </label>
              <input
                type="text"
                value={entityId}
                onChange={e => setEntityId(e.target.value)}
                placeholder="e.g. 23851234567890"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conditions (JSONB)</label>
              <button
                onClick={() => setConditions(c => [...c, ['', '']])}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {conditions.map(([k, v], i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={k}
                    onChange={e => setConditions(c => c.map((pair, idx) => idx === i ? [e.target.value, pair[1]] : pair))}
                    placeholder="key (e.g. ratio)"
                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={String(v)}
                    onChange={e => setConditions(c => c.map((pair, idx) => idx === i ? [pair[0], e.target.value] : pair))}
                    placeholder="value (e.g. 2.0)"
                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button onClick={() => setConditions(c => c.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400">
                    <Minus size={14} />
                  </button>
                </div>
              ))}
              {conditions.length === 0 && (
                <p className="text-xs text-gray-400 italic">No conditions — uses default rule thresholds.</p>
              )}
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Severity</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high', 'critical'] as AlertSeverity[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize border transition-colors ${
                    severity === s ? 'border-current' : 'border-gray-200 text-gray-400'
                  } ${
                    s === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                    s === 'high'     ? 'bg-orange-50 text-orange-700 border-orange-200' :
                    s === 'medium'   ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                       'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Active From</label>
              <input
                type="date"
                value={dateRangeStart}
                onChange={e => setDateRangeStart(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Expires On</label>
              <input
                type="date"
                value={dateRangeEnd}
                onChange={e => setDateRangeEnd(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsActive(a => !a)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
            <span className="text-sm text-gray-700">{isActive ? 'Active' : 'Inactive (saved as draft)'}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || saveMutation.isPending}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors font-medium"
          >
            {saveMutation.isPending ? 'Saving…' : (editRule ? 'Save Changes' : 'Create Rule')}
          </button>
        </div>
      </div>
    </div>
  )
}
