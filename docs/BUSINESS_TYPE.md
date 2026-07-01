# Business type (ecommerce | leadgen)

Canonical values stored in `public.clients.business_type`:

- `ecommerce` — purchases, ROAS, Shopify / MER KPIs
- `leadgen` — leads, CPL/CPA, no Shopify attribution band

Legacy aliases (`lead_gen`, `lead_generation`, `local`) are normalized on read in Mission Control (`src/lib/businessType.ts`) and ads-data-sync (`execution/_business_type.py`). Only canonical values may be written after migration `20260701140000_business_type_canonical.sql`.

## RoboThink Franchise

- `clients.id`: `d6932ea8-87a9-48e5-a09d-9fefaed169a4`
- Set to `leadgen` with `target_cpa = 10` (2026-07-01)

## Where it drives UI

| Surface | Behavior |
|---------|----------|
| Overview KPI cards | `agencyKpiLayout.cardAppliesToBusiness` hides Shopify/MER for leadgen |
| Heated KPI strip | Leads + CPL vs Purchases + ROAS |
| Heated drill tables | `BUSINESS_TYPE_UI_REGISTRY` — leadgen hides ROAS, labels Leads/CPL |
| Meta ad sets | `MetaAdSetPerformanceTable` — CPL column, no Revenue/ROAS |
| Alerts (VPS) | ROAS rules → ecommerce; CPA rules → leadgen (`is_ecommerce` / `is_leadgen`) |

## Editing business type

Super admin: User Management → Client business type panel → Save (RPC `update_client_business_type`).

Creating clients: Add Client modal or `create_client_record` RPC (normalizes input).

## Session / filter sync

- Selecting a client from the dropdown resets `businessTypeManual` and loads type from DB.
- `dashboard_settings.default_business_type` applies only when filter is All Clients.
- Manual Lead Gen / eCommerce toggle still available; click Auto to follow client record.

## Probes

```bash
# After migration on Supabase
python execution/probe_business_type_consistency.py
```

## Related

- `docs/SYSTEM_CONSOLE_REGISTRY.md` — future unified settings console (column visibility, defaults)
