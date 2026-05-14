# Frontend dev adapter — job_runs, RLS roles, A/B observability (2026-05-16)

Audience: `uni-mission-control` React app. Backend/data work landed in this workspace: Supabase migrations + `ads_data_sync/execution/ab_test_reports_and_notify.py`.

## 1. Apply Supabase migrations (ops / backend)

On project `jcghdthijgjttmpthagj`, run in order (file names under `uni-mission-control/supabase/migrations/`):

1. `20260516210000_job_runs.sql` — table `job_runs` + SELECT RLS for `authenticated` (writes are service-role only from VPS).
2. `20260516213000_accessible_client_ids_roles.sql` — replaces `public.accessible_client_ids()` so `media_buyer`, `partner`, and `client` roles resolve to the correct client sets for existing policies that use `client_id IN (SELECT * FROM accessible_client_ids())`.
3. `20260516214000_app_users_expand_roles.sql` — widens `app_users.role` CHECK to allow the new role strings.

If `accessible_client_ids()` does not exist yet on a database, apply the legacy RLS migration set first (see `uni-mission-control workspace 062026/database/migrations/20260312_user_permission_system.sql` or your canonical history); migration 20260516213000 only replaces the function body.

## 2. Read `job_runs` from the dashboard (optional UI)

Each exit of `ab_test_reports_and_notify.py` inserts one row:

- `job_name`: currently always `ab_test_reports`
- `scope`: `full`, or flags joined with `+` (e.g. `daily-only`, `hourly-only`, `force`)
- `status`: `completed` or `failed`
- `finished_at`, `duration_ms`, `exit_code`, `error_message`
- `meta`: JSON with counters, e.g. `configs_active`, `reports_written`, `skipped_dedup`, `slack_ok`, `dry_run`

Suggested React Query fetch (add to `src/lib/api.ts` or similar):

```typescript
export async function getLastAbJobRun() {
  const { data, error } = await supabase
    .from('job_runs')
    .select('finished_at, duration_ms, exit_code, status, scope, meta, error_message')
    .eq('job_name', 'ab_test_reports')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}
```

UI copy ideas: show `finished_at` in the user’s locale; on `status === 'failed'` show `error_message` truncated; show `meta.reports_written` as “reports generated this run”.

## 3. RBAC vs RLS (security vs UX)

Frontend `AuthContext` already loads `app_users` by `auth_user_id`. Contract: RLS does not rely on JWT `app_metadata.client_id` today. Client scoping uses `public.accessible_client_ids()` which reads `app_users.role` and `primary_client_id` for roles `client` and `client_user`.

Important: `partner` receives all client IDs at the SQL layer (same as `media_buyer` for read scope). The product still hides Creative Performance and Mission Board for partners in the UI; tightening creative rows at RLS level is a follow-up if you need defense in depth.

## 4. Align with `AGENT_BRIEF_FRONTEND_DEV.md`

- P1 data fixes remain unchanged.
- When you add the `client` role in the UI, ensure each `app_users` row has `primary_client_id` set and `role` in (`client`, `client_user`) so RLS returns exactly one client.
- After migrations, smoke-test login as `team_member`, `media_buyer`, `partner`, and `client` against `daily_performance` SELECT.

## 5. References

- `ads_data_sync/docs/BACKEND_TEAM_CONTRACTS.md` — contracts A–D.
- `ads_data_sync/docs/AB_REPORTS_CRON.md` — cron + `job_runs` section.
- Root `AGENT_BRIEF_FRONTEND_DEV.md` — section 六 / 七.

## 6. Frontend implementation (this repo)

- `src/lib/api.ts`: `db.getLastAbJobRun()` — same query as suggested in §2.
- `src/pages/Alerts/AbTestDeliveryTab.tsx`: React Query `['job-runs-last-ab']` + summary card (finished time, status, scope, duration, exit code, `meta.reports_written`, truncated `error_message` on failure).
