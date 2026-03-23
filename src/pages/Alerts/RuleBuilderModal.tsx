import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, AlertTriangle } from 'lucide-react'
import { db } from '../../lib/api'
import type { AlertRule, AlertTemplateType, AlertSeverity } from '../../types/alerts'

// ─── Per-template condition field definitions ────────────────────────────────

interface ConditionField {
  key: string
  label: string
  type: 'number' | 'select'
  options?: { value: string; label: string }[]
  placeholder?: string
  hint?: string
  defaultValue: string | number
}

const TEMPLATE_CONDITION_FIELDS: Record<AlertTemplateType, ConditionField[]> = {
  spend_spike: [
    { key: 'ratio',            label: 'Spike Ratio (×)',         type: 'number', placeholder: '2.0', hint: 'Alert if current 6h spend is this many times higher than the 7-day avg', defaultValue: 2.0 },
    { key: 'min_prior_spend',  label: 'Min Baseline Spend ($)',  type: 'number', placeholder: '1',   hint: 'Skip alert if prior avg was under this amount (avoids false spikes from $0 baseline)', defaultValue: 1 },
  ],
  spend_dead_zone: [
    { key: 'consecutive_zero_hours', label: 'Consecutive Zero-Spend Hours', type: 'number', placeholder: '3', hint: 'Fire alert after this many consecutive hours with $0 spend', defaultValue: 3 },
  ],
  ctr_cliff: [
    { key: 'ratio',                label: 'CTR Drop Ratio',            type: 'number', placeholder: '0.60', hint: 'Alert if current CTR is below this fraction of the 7-day avg (e.g. 0.60 = 40% drop)', defaultValue: 0.60 },
    { key: 'min_prior_impressions', label: 'Min Baseline Impressions',  type: 'number', placeholder: '200',  hint: 'Skip if baseline had fewer impressions (avoids noise on low-traffic hours)', defaultValue: 200 },
  ],
  impression_collapse: [
    { key: 'per_hour_drop_ratio',       label: 'Impression Drop Ratio',      type: 'number', placeholder: '0.60', hint: 'Alert if impressions dropped to below this fraction of baseline (e.g. 0.60 = 40% drop)', defaultValue: 0.60 },
    { key: 'min_baseline_impressions',  label: 'Min Baseline Impressions',   type: 'number', placeholder: '100',  hint: 'Only fire if baseline had at least this many impressions per hour', defaultValue: 100 },
  ],
  conversion_velocity_drop: [
    { key: 'ratio',      label: 'Conv. Velocity Drop Ratio', type: 'number', placeholder: '0.50', hint: 'Alert if conversion rate dropped to below this fraction of 7-day same-window avg', defaultValue: 0.50 },
    { key: 'min_spend',  label: 'Min Window Spend ($)',      type: 'number', placeholder: '20',   hint: 'Only fire if at least this much was spent in the 6h window', defaultValue: 20 },
  ],
  zero_impressions_sustained: [
    { key: 'consecutive_zero_hours', label: 'Consecutive Zero-Impression Hours', type: 'number', placeholder: '6', hint: 'Fire after this many consecutive hours with 0 impressions', defaultValue: 6 },
  ],
  zero_spend: [],   // no configurable thresholds — fires at threshold hour
  budget_pacing: [
    { key: 'over_ratio',   label: 'Overpacing Threshold',   type: 'number', placeholder: '1.30', hint: 'Alert if today spend ÷ (30-day avg × time weight) exceeds this ratio (e.g. 1.30 = 30% over)', defaultValue: 1.30 },
    { key: 'under_ratio',  label: 'Underpacing Threshold',  type: 'number', placeholder: '0.40', hint: 'Alert if today spend is below this ratio (e.g. 0.40 = only 40% of expected by this hour)', defaultValue: 0.40 },
  ],
  ctr_anomaly: [
    { key: 'drop_ratio',       label: 'CTR Drop Ratio vs 30-day',  type: 'number', placeholder: '0.65', hint: 'Alert if today CTR is below this fraction of the 30-day baseline', defaultValue: 0.65 },
    { key: 'min_impressions',  label: 'Min Impressions (today)',    type: 'number', placeholder: '1000', hint: 'Only fire if today already has this many impressions', defaultValue: 1000 },
  ],
  zero_conversions: [
    { key: 'min_spend',  label: 'Min Cumulative Spend ($)',  type: 'number', placeholder: '20', hint: 'Only fire if today spend exceeds this before triggering', defaultValue: 20 },
    { key: 'min_hour',   label: 'Safe Until Hour (local)',   type: 'number', placeholder: '14', hint: 'Do not fire before this hour of the day (conversions need time to register)', defaultValue: 14 },
  ],
  custom: [],
}

const TEMPLATE_LABELS: Record<AlertTemplateType, string> = {
  spend_spike:              'Spend Spike (6h window)',
  spend_dead_zone:          'Spend Dead Zone',
  ctr_cliff:                'CTR Cliff (6h window)',
  impression_collapse:      'Impression Collapse (6h window)',
  conversion_velocity_drop: 'Conversion Velocity Drop (6h window)',
  zero_impressions_sustained: 'Zero Impressions Sustained',
  zero_spend:               'Zero Spend (daily)',
  budget_pacing:            'Budget Pacing (daily)',
  ctr_anomaly:              'CTR Anomaly (daily)',
  zero_conversions:         'Zero Conversions with Spend (daily)',
  custom:                   'Custom Rule',
}

const TEMPLATE_DESCRIPTIONS: Record<AlertTemplateType, string> = {
  spend_spike:              'Fires when the last 6 hours of spend is significantly higher than the same window over the prior 7 days.',
  spend_dead_zone:          'Fires when spend has been $0 for N consecutive hours during active hours.',
  ctr_cliff:                'Fires when CTR in the last 6 hours drops sharply vs the 7-day same-window average.',
  impression_collapse:      'Fires when hourly impressions collapse well below the 7-day baseline for that hour.',
  conversion_velocity_drop: 'Fires when conversions per dollar in the 6h window drop sharply vs the 7-day same-window avg.',
  zero_impressions_sustained: 'Fires when impressions are 0 for N or more consecutive hours.',
  zero_spend:               'Fires once per day if cumulative spend is $0 past a threshold hour.',
  budget_pacing:            'Fires when today\'s spend is significantly above or below the expected pace, based on 30-day avg × time-of-day weight.',
  ctr_anomaly:              'Fires when today\'s overall CTR drops well below the 30-day daily baseline.',
  zero_conversions:         'Fires once per day when spend is high but conversions are 0 past the safe window.',
  custom:                   'Define your own conditions using the fields below.',
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  editRule?: AlertRule
  currentUserId: string
  onClose: () => void
}

export default function RuleBuilderModal({ editRule, currentUserId, onClose }: Props) {
  const queryClient = useQueryClient()

  const [name,           setName]           = useState(editRule?.name ?? '')
  const [templateType,   setTemplateType]   = useState<AlertTemplateType>(editRule?.template_type ?? 'zero_spend')
  const [clientId,       setClientId]       = useState(editRule?.client_id ?? '')
  const [platform,       setPlatform]       = useState<'google_ads' | 'meta_ads' | 'all'>(editRule?.platform ?? 'all')
  const [entityType,     setEntityType]     = useState<'account' | 'campaign' | 'ad_set' | 'ad'>(
    (editRule?.entity_type as 'account' | 'campaign' | 'ad_set' | 'ad') ?? 'account'
  )
  const [entityId,       setEntityId]       = useState(editRule?.entity_id ?? '')
  const [severity,       setSeverity]       = useState<AlertSeverity>(editRule?.severity ?? 'high')
  const [isActive,       setIsActive]       = useState(editRule?.is_active ?? true)
  const [dateRangeStart, setDateRangeStart] = useState(editRule?.date_range_start ?? '')
  const [dateRangeEnd,   setDateRangeEnd]   = useState(editRule?.date_range_end ?? '')
  const [errorMsg,       setErrorMsg]       = useState<string | null>(null)

  // Condition values keyed by field key
  const [condValues, setCondValues] = useState<Record<string, string>>(() => {
    if (editRule) {
      return Object.fromEntries(
        Object.entries(editRule.conditions as Record<string, unknown>).map(([k, v]) => [k, String(v)])
      )
    }
    // Pre-fill from template defaults
    const fields = TEMPLATE_CONDITION_FIELDS['zero_spend']
    return Object.fromEntries(fields.map(f => [f.key, String(f.defaultValue)]))
  })

  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn:  db.getClients.bind(db),
    staleTime: 300_000,
  })

  const SEVERITY_DEFAULTS: Record<AlertTemplateType, AlertSeverity> = {
    spend_spike: 'high', spend_dead_zone: 'high', ctr_cliff: 'medium',
    impression_collapse: 'high', conversion_velocity_drop: 'high',
    zero_impressions_sustained: 'critical', zero_spend: 'critical',
    budget_pacing: 'medium', ctr_anomaly: 'medium', zero_conversions: 'high', custom: 'medium',
  }

  function applyTemplate(tt: AlertTemplateType) {
    setTemplateType(tt)
    setSeverity(SEVERITY_DEFAULTS[tt])
    const fields = TEMPLATE_CONDITION_FIELDS[tt]
    setCondValues(Object.fromEntries(fields.map(f => [f.key, String(f.defaultValue)])))
  }

  function setCondValue(key: string, value: string) {
    setCondValues(prev => ({ ...prev, [key]: value }))
  }

  const fields = TEMPLATE_CONDITION_FIELDS[templateType]

  const saveMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      // Build conditions object — parse numbers where possible
      const condObj: Record<string, unknown> = {}
      for (const f of fields) {
        const raw = condValues[f.key] ?? String(f.defaultValue)
        const num = parseFloat(raw)
        condObj[f.key] = isNaN(num) ? raw : num
      }

      const payload: Omit<AlertRule, 'id' | 'created_at' | 'updated_at'> = {
        name:             name.trim(),
        template_type:    templateType,
        client_id:        clientId || undefined,
        created_by:       currentUserId,
        platform,
        entity_type:      entityType as AlertRule['entity_type'],
        entity_id:        entityId || undefined,
        conditions:       condObj,
        severity,
        is_active:        isActive,
        date_range_start: dateRangeStart || undefined,
        date_range_end:   dateRangeEnd   || undefined,
        display_order:    editRule?.display_order ?? 0,
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
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(msg)
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{editRule ? 'Edit Rule' : 'New Alert Rule'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">

          {/* Template picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Template</label>
            <select
              value={templateType}
              onChange={e => applyTemplate(e.target.value as AlertTemplateType)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <optgroup label="Daily Rules">
                {(['zero_spend', 'budget_pacing', 'ctr_anomaly', 'zero_conversions'] as AlertTemplateType[]).map(tt => (
                  <option key={tt} value={tt}>{TEMPLATE_LABELS[tt]}</option>
                ))}
              </optgroup>
              <optgroup label="6-Hour Sliding Window">
                {(['spend_spike', 'spend_dead_zone', 'ctr_cliff', 'impression_collapse', 'conversion_velocity_drop', 'zero_impressions_sustained'] as AlertTemplateType[]).map(tt => (
                  <option key={tt} value={tt}>{TEMPLATE_LABELS[tt]}</option>
                ))}
              </optgroup>
              <optgroup label="Advanced">
                <option value="custom">Custom Rule</option>
              </optgroup>
            </select>
            {/* Template description */}
            <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{TEMPLATE_DESCRIPTIONS[templateType]}</p>
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

          {/* Client + Platform */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Client</label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Clients</option>
                {(clients ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
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
          </div>

          {/* Entity Level */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Entity Level</label>
              <select
                value={entityType}
                onChange={e => setEntityType(e.target.value as 'account' | 'campaign' | 'ad_set' | 'ad')}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="account">Account (default)</option>
                <option value="campaign">Campaign</option>
                <option value="ad_set">Ad Set</option>
                <option value="ad">Ad</option>
              </select>
            </div>
            {entityType !== 'account' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Entity ID <span className="font-normal text-gray-400 normal-case">(from platform)</span>
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
          </div>

          {/* Condition fields — structured per template */}
          {fields.length > 0 ? (
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Thresholds</label>
              <div className="space-y-3 bg-gray-50 rounded-xl p-4">
                {fields.map(f => (
                  <div key={f.key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-700">{f.label}</label>
                    </div>
                    {f.type === 'select' ? (
                      <select
                        value={condValues[f.key] ?? String(f.defaultValue)}
                        onChange={e => setCondValue(f.key, e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {(f.options ?? []).map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        step="any"
                        value={condValues[f.key] ?? String(f.defaultValue)}
                        onChange={e => setCondValue(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                    {f.hint && <p className="text-xs text-gray-400 mt-1 leading-snug">{f.hint}</p>}
                  </div>
                ))}
              </div>
            </div>
          ) : templateType !== 'custom' ? (
            <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
              No configurable thresholds — this rule uses fixed logic from the evaluation engine.
            </div>
          ) : (
            <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700">
              Custom rules don't have a built-in evaluation engine template. You'll need to implement custom logic in <code>evaluate_rules.py</code>.
            </div>
          )}

          {/* Severity */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Severity</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high', 'critical'] as AlertSeverity[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize border-2 transition-all ${
                    severity === s
                      ? s === 'critical' ? 'bg-red-100 text-red-700 border-red-400'
                        : s === 'high'   ? 'bg-orange-100 text-orange-700 border-orange-400'
                        : s === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-400'
                        :                  'bg-blue-100 text-blue-700 border-blue-400'
                      : 'bg-white text-gray-400 border-gray-200'
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
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Active From <span className="font-normal text-gray-400 normal-case">(optional)</span></label>
              <input type="date" value={dateRangeStart} onChange={e => setDateRangeStart(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Expires On <span className="font-normal text-gray-400 normal-case">(optional)</span></label>
              <input type="date" value={dateRangeEnd} onChange={e => setDateRangeEnd(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
            <span className="text-sm text-gray-700">{isActive ? 'Active — will be evaluated on next run' : 'Inactive (saved as draft)'}</span>
          </div>

          {/* Error message */}
          {errorMsg && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 leading-relaxed">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            onClick={() => { setErrorMsg(null); saveMutation.mutate() }}
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
