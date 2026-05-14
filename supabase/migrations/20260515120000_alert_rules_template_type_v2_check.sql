-- Align alert_rules.template_type CHECK with v2 rule engine (20260405 seed).
-- Without this, INSERT/UPDATE of rules like roas_above_target can fail if Phase 1 CHECK is still present.
-- Safe to re-run: drops named constraint if present, then re-adds expanded CHECK.

ALTER TABLE public.alert_rules
  DROP CONSTRAINT IF EXISTS alert_rules_template_type_check;

ALTER TABLE public.alert_rules
  ADD CONSTRAINT alert_rules_template_type_check
  CHECK (template_type IN (
    'spend_spike',
    'spend_dead_zone',
    'ctr_cliff',
    'impression_collapse',
    'conversion_velocity_drop',
    'zero_impressions_sustained',
    'zero_spend',
    'budget_pacing',
    'ctr_anomaly',
    'zero_conversions',
    'custom',
    'roas_above_target',
    'roas_below_target',
    'roas_critical_drop',
    'cpa_above_target',
    'zero_spend_technical',
    'metrics_anomaly'
  ));

COMMENT ON CONSTRAINT alert_rules_template_type_check ON public.alert_rules IS
  'Keeps template_type in sync with ads_data_sync execution/generate_alerts.py and uni-mission-control seeds.';
