import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, AlertTriangle } from 'lucide-react'
import { db } from '../../lib/api'
import type { AlertRule, AlertTemplateType, AlertSeverity } from '../../types/alerts'

// ─── Per-template condition field definitions ────────────────────────────────

interface ConditionField {
  key: string
  label: string
  type: 'number' | 'select' | 'textarea'
  options?: { value: string; label: string }[]
  placeholder?: string
  hint?: string
  defaultValue: string | number
}

/** Default `conditions.metrics` for metrics_anomaly — must match generate_alerts.py shape: { metric, threshold (%), direction }. */
const DEFAULT_METRICS_ANOMALY_JSON = `[
  {"metric":"ctr","threshold":30,"direction":"under"},
  {"metric":"cpc","threshold":35,"direction":"over"}
]`

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
  roas_above_target: [
    {
      key: 'cooldown_hours',
      label: 'Cooldown (hours)',
      type: 'number',
      placeholder: '24',
      hint: 'generate_alerts.py: hours before same alert_type can fire again. Spend floor uses Minimum daily spend below (stored as min_spend_threshold; cond_min_spend prefers it over min_spend).',
      defaultValue: 24,
    },
  ],
  roas_below_target: [
    {
      key: 'cooldown_hours',
      label: 'Cooldown (hours)',
      type: 'number',
      placeholder: '12',
      hint: 'generate_alerts.py: re-fire suppression. Fires when today ROAS < clients.target_roas (ecommerce) and spend meets cond_min_spend (defaults 100 if unset).',
      defaultValue: 12,
    },
  ],
  roas_critical_drop: [
    {
      key: 'threshold_ratio',
      label: 'Critical threshold (× target ROAS)',
      type: 'number',
      placeholder: '0.5',
      hint: 'generate_alerts.py: alert when today ROAS < target_roas × this value (default 0.5).',
      defaultValue: 0.5,
    },
    {
      key: 'cooldown_hours',
      label: 'Cooldown (hours)',
      type: 'number',
      placeholder: '6',
      hint: 'generate_alerts.py: re-fire suppression window.',
      defaultValue: 6,
    },
  ],
  cpa_above_target: [
    {
      key: 'min_conversions',
      label: 'Min conversions (today)',
      type: 'number',
      placeholder: '3',
      hint: 'generate_alerts.py: require at least this many conversions before comparing CPA to clients.target_cpa.',
      defaultValue: 3,
    },
    {
      key: 'cooldown_hours',
      label: 'Cooldown (hours)',
      type: 'number',
      placeholder: '12',
      hint: 'generate_alerts.py: re-fire suppression.',
      defaultValue: 12,
    },
  ],
  zero_spend_technical: [
    {
      key: 'duration_hours',
      label: 'Consecutive zero-spend hours',
      type: 'number',
      placeholder: '6',
      hint: 'generate_alerts.py: trailing run of $0 cost hours required to fire.',
      defaultValue: 6,
    },
    {
      key: 'min_expected_daily_spend',
      label: 'Min baseline avg daily spend ($)',
      type: 'number',
      placeholder: '20',
      hint: 'generate_alerts.py: account_daily_baselines.avg_daily_cost must be at least this (active account filter).',
      defaultValue: 20,
    },
    {
      key: 'tc_min_hour',
      label: 'Business window start (local hour)',
      type: 'number',
      placeholder: '8',
      hint: 'Saved as conditions.time_constraints.min_hour_of_day.',
      defaultValue: 8,
    },
    {
      key: 'tc_max_hour',
      label: 'Business window end (local hour)',
      type: 'number',
      placeholder: '20',
      hint: 'Saved as conditions.time_constraints.max_hour_of_day.',
      defaultValue: 20,
    },
    {
      key: 'cooldown_hours',
      label: 'Cooldown (hours)',
      type: 'number',
      placeholder: '12',
      hint: 'generate_alerts.py: re-fire suppression.',
      defaultValue: 12,
    },
  ],
  metrics_anomaly: [
    {
      key: 'min_impressions',
      label: 'Min impressions (today)',
      type: 'number',
      placeholder: '1000',
      hint: 'generate_alerts.py: cumulative impressions gate.',
      defaultValue: 1000,
    },
    {
      key: 'cooldown_hours',
      label: 'Cooldown (hours)',
      type: 'number',
      placeholder: '8',
      hint: 'generate_alerts.py: re-fire suppression.',
      defaultValue: 8,
    },
    {
      key: 'metrics_json',
      label: 'Metrics (JSON array)',
      type: 'textarea',
      placeholder: '',
      hint: 'generate_alerts.py: each object { metric: ctr|cpc|cpm, threshold: number as percent e.g. 30, direction: under|over }. Stored as conditions.metrics.',
      defaultValue: DEFAULT_METRICS_ANOMALY_JSON,
    },
  ],
  account_delivery_stopped: [],
  budget_exhaustion_warning: [],
  budget_under_pacing: [],
  revenue_velocity_collapse: [],
  lead_volume_collapse: [],
  conversion_rate_collapse: [],
  zero_conversion_high_spend: [],
  roas_declining_trend: [],
  lead_volume_declining_trend: [],
  click_to_lead_rate_drop: [],
  cpa_critical_spike: [],
  creative_spend_domination: [],
  creative_fatigue_signal: [],
  creative_test_conclusion: [],
  week_over_week_decline: [],
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
  roas_above_target:      'ROAS Above Target',
  roas_below_target:      'ROAS Below Target',
  roas_critical_drop:     'ROAS Critical Drop',
  cpa_above_target:       'CPA Above Target',
  zero_spend_technical:   'Zero Spend (technical)',
  metrics_anomaly:        'Metrics Anomaly',
  account_delivery_stopped:      'Account Delivery Stopped',
  budget_exhaustion_warning:     'Budget Exhaustion Warning',
  budget_under_pacing:           'Budget Under-Pacing',
  revenue_velocity_collapse:     'Revenue Velocity Collapse',
  conversion_rate_collapse:      'Conversion Rate Collapse',
  zero_conversion_high_spend:    'Zero Conversions (High Spend)',
  roas_declining_trend:          'ROAS Declining Trend',
  lead_volume_collapse:          'Lead Volume Collapse',
  lead_volume_declining_trend:   'Lead Volume Declining Trend',
  click_to_lead_rate_drop:       'Click-to-Lead Rate Drop',
  cpa_critical_spike:            'CPA Critical Spike',
  creative_spend_domination:     'Creative Spend Domination (Meta)',
  creative_fatigue_signal:       'Creative Fatigue Signal (Meta)',
  creative_test_conclusion:      'Creative Test — Conclusion Ready (Meta)',
  week_over_week_decline:        'Week-over-Week Decline',
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
  roas_above_target:        'Ecommerce only: fires when today cumulative ROAS > clients.target_roas and spend passes cond_min_spend (see Minimum daily spend). Engine: ads_data_sync/execution/generate_alerts.py.',
  roas_below_target:        'Ecommerce only: fires when today ROAS < target (and critical-drop did not fire). Same spend gate as generate_alerts.py.',
  roas_critical_drop:       'Ecommerce only: fires when today ROAS < target_roas × conditions.threshold_ratio (default 0.5).',
  cpa_above_target:         'Lead gen only: fires when today CPA > clients.target_cpa with enough conversions (conditions.min_conversions).',
  zero_spend_technical:     'Consecutive zero-spend hours during conditions.time_constraints, for accounts with avg_daily_cost ≥ min_expected_daily_spend. generate_alerts.py.',
  metrics_anomaly:          'CTR/CPC/CPM vs 7-day daily_performance average per conditions.metrics[]. Engine: generate_alerts.py evaluate_metrics_anomaly.',
  account_delivery_stopped:
    'Hourly merged stop: no delivery / zero pipeline (replaces legacy spend dead zone + sustained zero impressions where applicable). Thresholds are engine-defined unless extended later.',
  budget_exhaustion_warning: 'Fires when daily or intraday spend approaches or exhausts the effective budget envelope. Engine: generate_alerts.py.',
  budget_under_pacing:      'Fires when spend is materially behind expected pace vs budget or forecast. Engine: generate_alerts.py.',
  revenue_velocity_collapse:'Fires when revenue rate vs baseline drops sharply in the evaluation window. Ecommerce-oriented. Engine: generate_alerts.py.',
  lead_volume_collapse:      'Fires when lead volume vs baseline drops sharply (lead gen). Engine: generate_alerts.py.',
  conversion_rate_collapse:  'Fires when conversion rate vs baseline collapses with sufficient volume. Engine: generate_alerts.py.',
  zero_conversion_high_spend:'Fires when spend is high but attributed conversions stay at zero past configured gates. Engine: generate_alerts.py.',
  roas_declining_trend:      'Multi-day trend: ROAS declining vs prior window. Engine: generate_alerts.py.',
  lead_volume_declining_trend: 'Multi-day trend: lead volume declining vs prior window. Engine: generate_alerts.py.',
  click_to_lead_rate_drop:    'Fires when click-to-lead rate drops vs baseline (lead gen). Engine: generate_alerts.py.',
  cpa_critical_spike:        'Fires when CPA spikes above target or critical multiple. Engine: generate_alerts.py.',
  creative_spend_domination: 'Meta: one creative consumes a dominant share of spend vs peers. Engine: generate_alerts.py.',
  creative_fatigue_signal:   'Meta: creative-level fatigue / decay signal from performance deltas. Engine: generate_alerts.py.',
  creative_test_conclusion:  'Meta: A/B or test cell ready for conclusion based on spend and stability rules. Engine: generate_alerts.py.',
  week_over_week_decline:    'Fires on week-over-week decline across configured KPIs. Engine: generate_alerts.py.',
  custom:                   'Define your own conditions using the fields below.',
}

function flattenConditionsForForm(
  conditions: Record<string, unknown> | undefined,
  templateType: AlertTemplateType
): Record<string, string> {
  const c = conditions ?? {}
  const fields = TEMPLATE_CONDITION_FIELDS[templateType]
  const out: Record<string, string> = {}
  for (const f of fields) {
    if (f.key === 'metrics_json') {
      const m = c.metrics
      out[f.key] = Array.isArray(m) ? JSON.stringify(m, null, 2) : String(f.defaultValue)
      continue
    }
    if (f.key === 'tc_min_hour') {
      const tc = c.time_constraints as Record<string, unknown> | undefined
      out[f.key] = String(tc?.min_hour_of_day ?? f.defaultValue)
      continue
    }
    if (f.key === 'tc_max_hour') {
      const tc = c.time_constraints as Record<string, unknown> | undefined
      out[f.key] = String(tc?.max_hour_of_day ?? f.defaultValue)
      continue
    }
    const v = c[f.key]
    if (v !== undefined && v !== null && v !== '') out[f.key] = String(v)
    else out[f.key] = String(f.defaultValue)
  }
  return out
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
  const [minSpendThreshold, setMinSpendThreshold] = useState(() => {
    const c = editRule?.conditions as Record<string, unknown> | undefined
    const m = c?.min_spend_threshold
    return m !== undefined && m !== null && String(m).trim() !== '' ? String(m) : '5'
  })
  const [slackRuleNotify, setSlackRuleNotify] = useState(false)
  const [slackRuleUrl, setSlackRuleUrl] = useState('')
  const [slackRuleChannel, setSlackRuleChannel] = useState('')

  // Condition values keyed by field key
  const [condValues, setCondValues] = useState<Record<string, string>>(() => {
    if (editRule) {
      return flattenConditionsForForm(editRule.conditions as Record<string, unknown>, editRule.template_type)
    }
    const fields = TEMPLATE_CONDITION_FIELDS['zero_spend']
    return Object.fromEntries(fields.map(f => [f.key, String(f.defaultValue)]))
  })

  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => db.getClients(),
    staleTime: 300_000,
  })

  const { data: delivery } = useQuery({
    queryKey: ['client-alert-delivery', clientId],
    queryFn: () => db.getClientAlertDelivery(clientId),
    enabled: !!clientId,
  })

  useEffect(() => {
    if (!delivery) {
      setSlackRuleNotify(false)
      setSlackRuleUrl('')
      setSlackRuleChannel('')
      return
    }
    setSlackRuleNotify(!!delivery.slack_notify_alert_rules)
    setSlackRuleUrl(delivery.slack_webhook_url ?? '')
    setSlackRuleChannel(delivery.slack_channel ?? '')
  }, [delivery])

  const SEVERITY_DEFAULTS: Record<AlertTemplateType, AlertSeverity> = {
    spend_spike: 'high', spend_dead_zone: 'high', ctr_cliff: 'medium',
    impression_collapse: 'high', conversion_velocity_drop: 'high',
    zero_impressions_sustained: 'critical', zero_spend: 'critical',
    budget_pacing: 'medium', ctr_anomaly: 'medium', zero_conversions: 'high',
    roas_above_target: 'low', roas_below_target: 'high', roas_critical_drop: 'critical',
    cpa_above_target: 'high', zero_spend_technical: 'high', metrics_anomaly: 'medium',
    account_delivery_stopped:    'critical',
    budget_exhaustion_warning:   'critical',
    budget_under_pacing:         'medium',
    revenue_velocity_collapse:   'critical',
    conversion_rate_collapse:    'high',
    zero_conversion_high_spend:  'high',
    roas_declining_trend:        'medium',
    lead_volume_collapse:        'high',
    lead_volume_declining_trend: 'medium',
    click_to_lead_rate_drop:     'medium',
    cpa_critical_spike:          'high',
    creative_spend_domination:   'medium',
    creative_fatigue_signal:     'medium',
    creative_test_conclusion:    'low',
    week_over_week_decline:      'medium',
    custom: 'medium',
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
        const raw = (condValues[f.key] ?? String(f.defaultValue)).trim()
        if (f.type === 'textarea' && f.key === 'metrics_json') {
          try {
            const parsed = JSON.parse(raw || '[]')
            if (!Array.isArray(parsed)) throw new Error('metrics must be a JSON array')
            condObj.metrics = parsed
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            throw new Error(`Invalid metrics JSON: ${msg}`)
          }
          continue
        }
        if (f.type === 'textarea') {
          condObj[f.key] = raw
          continue
        }
        const num = parseFloat(raw)
        condObj[f.key] = raw === '' ? f.defaultValue : (isNaN(num) ? raw : num)
      }

      if (templateType === 'zero_spend_technical') {
        const minH = Number(condObj.tc_min_hour)
        const maxH = Number(condObj.tc_max_hour)
        condObj.time_constraints = {
          min_hour_of_day: Number.isFinite(minH) ? minH : 8,
          max_hour_of_day: Number.isFinite(maxH) ? maxH : 20,
        }
        delete condObj.tc_min_hour
        delete condObj.tc_max_hour
      }

      const minNum = parseFloat(minSpendThreshold)
      condObj.min_spend_threshold = isNaN(minNum) ? 5 : minNum

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

      if (clientId) {
        const prev = await db.getClientAlertDelivery(clientId)
        await db.upsertClientAlertDelivery({
          client_id: clientId,
          notify_in_app: prev?.notify_in_app ?? true,
          slack_webhook_url: slackRuleNotify ? slackRuleUrl.trim() || null : prev?.slack_webhook_url ?? null,
          slack_channel: slackRuleNotify ? slackRuleChannel.trim() || null : prev?.slack_channel ?? null,
          slack_notify_alert_rules: slackRuleNotify,
          notify_emails: prev?.notify_emails ?? null,
          updated_by: currentUserId || null,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] })
      if (clientId) queryClient.invalidateQueries({ queryKey: ['client-alert-delivery', clientId] })
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
                {(['zero_spend', 'zero_spend_technical', 'budget_pacing', 'ctr_anomaly', 'zero_conversions', 'roas_above_target', 'roas_below_target', 'roas_critical_drop', 'cpa_above_target', 'metrics_anomaly'] as AlertTemplateType[]).map(tt => (
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
                    ) : f.type === 'textarea' ? (
                      <textarea
                        value={condValues[f.key] ?? String(f.defaultValue)}
                        onChange={e => setCondValue(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        rows={6}
                        className="w-full text-xs font-mono border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
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

          {/* Minimum daily spend (all templates) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Minimum daily spend ($)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={minSpendThreshold}
              onChange={e => setMinSpendThreshold(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Saved as <code className="text-gray-600">conditions.min_spend_threshold</code>. In{' '}
              <code className="text-gray-600">generate_alerts.py</code>, <code className="text-gray-600">cond_min_spend</code>{' '}
              uses this value first, then <code className="text-gray-600">min_spend</code> if present. ROAS / CPA / metrics_anomaly gates use it; hourly rules in{' '}
              <code className="text-gray-600">evaluate_rules.py</code> may differ.
            </p>
          </div>

          {/* Slack notify (per client delivery row) */}
          {!!clientId && (
            <div className="rounded-xl border border-gray-200 p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={slackRuleNotify}
                  onChange={e => setSlackRuleNotify(e.target.checked)}
                />
                Notify via Slack (alert rules)
              </label>
              {slackRuleNotify && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Slack incoming webhook URL</label>
                    <input
                      type="url"
                      value={slackRuleUrl}
                      onChange={e => setSlackRuleUrl(e.target.value)}
                      placeholder="https://hooks.slack.com/services/..."
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Channel name</label>
                    <input
                      type="text"
                      value={slackRuleChannel}
                      onChange={e => setSlackRuleChannel(e.target.value)}
                      placeholder="#alerts-client"
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                    />
                  </div>
                  <p className="text-xs text-gray-500">Saved to client delivery settings for backend jobs; the app does not call Slack.</p>
                </div>
              )}
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
