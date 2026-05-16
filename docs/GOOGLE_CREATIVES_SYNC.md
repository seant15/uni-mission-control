# Google Ads creatives in Supabase

1. Apply migration `supabase/migrations/20260518160000_google_ads_creatives.sql`.
2. On the sync host (same env as other `ads_data_sync` jobs):

```bash
cd ads_data_sync/execution
python sync_google_creatives.py --days 7
```

3. Frontend: Creative Performance is Meta-only today; wire `google_ads_ads` in a follow-up PR once data is flowing.

Table: `public.google_ads_ads` (daily grain per ad, creative URLs + metrics).
