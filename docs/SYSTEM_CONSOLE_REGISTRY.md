# System console registry (planned)

Sean approved direction (2026-07-01): a future Mission Control admin console to tune product behavior without code deploys. This file is the registry of settings that should eventually live there.

## Status

Not built in this round. Current round implements hard-coded defaults in code + DB fields where they already exist.

## Registry entries

### business_type.heated_drill.leadgen

- hideRoas: true (default)
- hideRevenue: true (default)
- conversionLabel: Leads
- cpaLabel: CPL
- Code: `src/lib/businessType.ts` → `BUSINESS_TYPE_UI_REGISTRY.heatedDrill.leadgen`

### business_type.heated_drill.ecommerce

- hideRoas: false
- hideRevenue: false
- conversionLabel: Conv.
- cpaLabel: CPA

### dashboard.default_business_type

- Today: `dashboard_settings.default_business_type` per user row (applies to All Clients view only after 2026-07-01 sync fix)
- Future console: agency-wide default + per-user override

### client.business_type

- Today: `clients.business_type` + User Management panel
- Future console: same UI surfaced in consolidated Client profile

### alerts.target_cpa / target_roas

- Today: `clients.target_cpa`, `clients.target_roas` columns; rules in `alert_rules`
- Future console: edit targets + enable/disable rule templates per client

### kpi.agency_layout

- Today: per-user `agency_kpi_cards` JSON in dashboard settings
- Future console: agency template + per-user overrides

## Implementation notes for future console

1. Store overrides in `system_settings` or extend `dashboard_settings` with JSON schema version.
2. Read path: `resolveSetting(key, { userId, agencyId, clientId })` with fallback chain client → agency → global → code default.
3. Mission Control UI tables should read from the same resolver as `BUSINESS_TYPE_UI_REGISTRY` so toggling hideRoas does not require a deploy.
4. Pure-local / non-ads clients: separate dashboard product (out of scope for `business_type` enum).
