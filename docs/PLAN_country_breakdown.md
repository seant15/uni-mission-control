# Country breakdown — implementation plan (UB+ / Lumière)

Phoenix date: 2026-05-26. Scope: warehouse + Heated View attribution table (not a one-shot UI-only hack).

## Goal

Per client, per ad account, per calendar day: store **country** slices (spend, revenue, conversions, impressions, clicks) for Meta and Google, then expose a **Country** pill in Heated View next to Platforms / Device / Demographics — same table pattern as "Spend & revenue by platform".

## Phase 1 — Database (Supabase migration)

1. Extend `daily_performance_breakdown.dimension` CHECK to include `'country'`.
2. New migration file (do not rename existing migrations), e.g. `20260526120000_breakdown_country_dimension.sql`:
   - `ALTER TABLE ... DROP CONSTRAINT` / re-add CHECK with `country` in list.
   - Optional: index `(client_id, date, dimension)` already exists; confirm `dimension_value` stores ISO country code or Meta/Google label consistently.
3. Document grain: unchanged unique key `(client_id, date, platform, ad_account_id, dimension, dimension_value)`.

## Phase 2 — Meta sync (`ads_data_sync/execution/sync_performance_breakdowns.py`)

1. Add `("country", "country")` to `META_BREAKDOWNS`.
2. Reuse existing insights loop (account level, `time_increment=1`, same conversion extraction as device/age).
3. Map `dimension_value` from `row["country"]` (2-letter code when present).
4. Rate limits: one extra API call per account per day per dimension — batch with existing script; consider `--dimensions country` flag for partial runs during backfill.
5. Backfill: `python sync_performance_breakdowns.py --backfill-days 30 --client "Lumière"` after migration.

## Phase 3 — Google sync (same script)

1. Add GAQL template `country` using a supported resource, e.g. `geographic_view` or `user_location_view` with `segments.geo_target_country` / `geo_target_constant.country_code` (validate in a single customer sandbox first — invalid GAQL fails the whole day).
2. Normalize `dimension_value` to same country code scheme as Meta where possible (ISO 3166-1 alpha-2).
3. If Google country is campaign-location vs user-location, pick **one** definition and document it in migration COMMENT (match how brands read Ads Manager).

## Phase 4 — API + UI (`uni-mission-control`)

1. `db.getPerformanceBreakdowns` — already dimension-agnostic; allow `country` in allowed dimension list if validated server-side.
2. `AgencyInsightPies.tsx`:
   - Add `country` to `InsightDim` and pill order (after `platforms` or before demographics).
   - `DIM_DB.country = 'country'`.
   - Footnote: country respects client + date + **platform** filters; when platform = All, merge countries across Meta + Google (same as age/gender).
3. Heated View MER rule unchanged (country is attribution only).

## Phase 5 — Ops / verification

1. Supabase spot check:

```sql
SELECT client_id, date, platform, dimension, dimension_value, sum(cost), sum(revenue)
FROM daily_performance_breakdown
WHERE dimension = 'country' AND date >= current_date - 7
GROUP BY 1,2,3,4,5
ORDER BY sum(cost) DESC
LIMIT 50;
```

2. Compare top countries for one account vs Meta Ads Manager (same date, same attribution window).
3. CI: optional script `audit_breakdown_coverage.py` — % of daily spend with country rows vs `daily_performance`.

## Dependencies / risks

| Risk | Mitigation |
|------|------------|
| Meta 13-month retention on breakdowns | Backfill window ≤ 13 months for country |
| Google GAQL resource mismatch | Pilot one `google_ads_customer_id` before fleet backfill |
| Double-count if summing countries = account total | UI shows share %; doc that breakdowns are estimated |
| UB+ multi-account | `ad_account_id` column already on breakdown table |

## Out of scope (later)

- Shopify orders by shipping country (different table; not MER).
- Hourly-by-country (Meta restricts many hourly + breakdown combos).

## Suggested order of work

DB migration → Meta sync + 7d backfill → Google pilot → Google fleet → FE country pill → client UAT (UB+, Lumière).
