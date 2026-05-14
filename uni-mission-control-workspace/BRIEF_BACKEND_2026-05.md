# Backend brief — UNI Mission Control + Ads data (canonical, 2026-05)

This summarizes what the dashboard depends on from Supabase, RLS, and `ads_data_sync` / VPS jobs. Long SQL and alert-engine migration steps remain in `TEAM_BRIEF_BACKEND.md` at the OPENCLAW workspace root until you fold them into `ads_data_sync` docs.

## 1. Supabase migrations (run in order on the live project)

Paths: `uni-mission-control/supabase/migrations/`

| File | Purpose |
|------|---------|
| `20260516210000_job_runs.sql` | `job_runs` table + SELECT for `authenticated` (writes from service role on VPS). |
| `20260516213000_accessible_client_ids_roles.sql` | Replaces `public.accessible_client_ids()` so `media_buyer`, `partner`, and client-scoped roles resolve correct client sets for policies using `client_id IN (SELECT * FROM accessible_client_ids())`. |
| `20260516214000_app_users_expand_roles.sql` | Widens `app_users.role` CHECK for new role strings. |

If `accessible_client_ids()` never existed on a fork DB, apply the legacy user-permission migration first (see `uni-mission-control workspace 062026/database/migrations/20260312_user_permission_system.sql` or your canonical history).

## 2. `job_runs` and A/B cron

- Writer: `ads_data_sync/execution/ab_test_reports_and_notify.py` (one row per process exit).
- Typical columns: `job_name` (`ab_test_reports`), `scope`, `status` (`completed` / `failed`), `finished_at`, `duration_ms`, `exit_code`, `error_message`, `meta` (JSON counters such as `reports_written`, `slack_ok`, `dry_run`).
- Contract and cron text: `ads_data_sync/docs/AB_REPORTS_CRON.md`, `ads_data_sync/docs/BACKEND_TEAM_CONTRACTS.md`.

## 3. RLS vs frontend RBAC

- Client scoping for reads is driven by `accessible_client_ids()` and `app_users` (`role`, `primary_client_id`), not by ad-hoc JWT `app_metadata` in the current contract (see `docs/FRONTEND_DEV_ADAPTER_JOB_RUNS_RLS_2026-05-16.md` §3).
- `partner` may receive a broad client ID set at SQL; UI still hides Creative Performance and Mission Board for partners — tighten creative RLS only if you need defense in depth.

## 4. Alert engine refactor (long-form)

- Step-by-step SQL (enum extensions, policies, script split): `TEAM_BRIEF_BACKEND.md` (OPENCLAW root) and `MASTER_ALERT_REBUILD_PLAN.md`.
- As of 2026-05-16 note in that file: VPS may still invoke `evaluate_rules.py` / `generate_alerts.py` under original names; align `n8n_ssh_wrapper.sh`, `HANDOFF_VPS_MIGRATION.md`, and `BACKEND_CONSOLIDATED_REQUIREMENTS.md` before renaming only in Git.

## 5. Creative assets pipeline

- UI selects `image_url`, `thumbnail_url` from creatives API (`getMetaCreatives`). Prefer durable URLs (e.g. Storage public links); Meta CDN links expire — sync layer should refresh or store stable URLs (`sync_creative_data.py` mentioned in TEAM_BRIEF_BACKEND cross-notes).

## 6. Related paths (sibling repos / workspace)

- `ads_data_sync/docs/BACKEND_TEAM_CONTRACTS.md` — contracts A–D.
- `ads_data_sync/docs/BACKEND_CONSOLIDATED_REQUIREMENTS.md`
- `ads_data_sync/docs/PROJECT_STAGE_AND_SESSION_LOG.md` — stage log (replaces a tiny pointer file that lived at OPENCLAW root).
- `HANDOFF_VPS_MIGRATION.md` (OPENCLAW root).
- `AGENT_BRIEF_BACKEND_DEV.md` (OPENCLAW root) — broader backend agent instructions.
