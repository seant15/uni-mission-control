# Country breakdown — implementation plan (UB+ / Lumière)

Phoenix date: 2026-05-26. Status: Phase 1–4 in repo; apply migration + backfill on Supabase/VPS to populate data.

## Product decisions (locked)

1. **Geography definition:** user physical location (用户所在国), not campaign targeting geography.
   - Meta: `breakdowns=country` on account insights.
   - Google: `user_location_view` + `country_criterion_id` (not campaign location targets).
2. **UI placement:** inside Heated View **Attribution** block (same card as platform spend/revenue), left **Dimension** list order:
   - Platforms → **Country** → Devices → Demographics → Age → Gender.

## Database

Migration: `supabase/migrations/20260526140000_breakdown_country_dimension.sql`

- Extends `daily_performance_breakdown.dimension` CHECK to include `country`.
- Grain unchanged: `(client_id, date, platform, ad_account_id, dimension, dimension_value)`.

Apply in Supabase SQL Editor, then reload schema cache if needed.

## Data sync (`ads_data_sync/execution/sync_performance_breakdowns.py`)

- Meta: `("country", "country")` in `META_BREAKDOWNS`.
- Google: GAQL on `user_location_view` for the sync day.
- Backfill after migration:

```bash
cd ads_data_sync/execution
python sync_performance_breakdowns.py --backfill-days 30 --client "Lumière"
```

## Frontend (`AgencyInsightPies.tsx`)

- Country pill + title “Spend & revenue by country”.
- `db.getPerformanceBreakdownSlices({ dimensions: ['country'], ... })`.
- Google rows may show `Geo {criterion_id}` until optional geo name lookup is added.

## Verification

```sql
SELECT platform, dimension_value, SUM(cost) AS spend, SUM(revenue) AS revenue
FROM daily_performance_breakdown
WHERE dimension = 'country' AND date >= CURRENT_DATE - 7
GROUP BY 1, 2
ORDER BY spend DESC
LIMIT 30;
```

Compare top countries vs Meta Ads Manager / Google (user location report) for one account and day.

## Follow-up (optional)

- Map Google `country_criterion_id` → ISO-3166 via geo_target_constant table or static JSON.
- `audit_breakdown_coverage.py`: % account spend with country rows vs `daily_performance`.

## Out of scope

- Shopify shipping country (separate from ads MER).
- Hourly-by-country.
