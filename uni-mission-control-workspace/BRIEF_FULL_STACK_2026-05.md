# Full-stack handoff — UNI Mission Control (2026-05)

One page to orient PM, frontend, and backend. Detailed splits live in the sibling files in this folder.

## Where to read

- Frontend implementation + UX gaps: `BRIEF_FRONTEND_2026-05.md`
- Supabase, RLS, cron, alert engine, pipelines: `BRIEF_BACKEND_2026-05.md`
- Archived originals merged into these briefs: `archive/` (when present)

## Cross-cutting truths

1. Dashboard reads Supabase with the anon key — RLS must enforce tenant boundaries; UI role guards are not sufficient alone.
2. Hourly and daily numbers were aligned by fixing merge keys and filter parity; any remaining “same day different total” complaints need explicit filter + timezone documentation (`daily_performance.data_timezone` vs UTC hourly buckets).
3. Real-time page: data is UTC hour slices; changing “Time display” to alter numeric windows requires backend API and ingestion rules — see frontend brief §Realtime note.
4. A/B job visibility: after `job_runs` migration, the A/B & delivery tab shows the latest `ab_test_reports` run; failures surface `error_message` (truncated in UI).
5. OpenClaw: parent app + embed target must agree on HTTPS, CSP `frame-ancestors`, and env `VITE_OPENCLAW_CHAT_URL`.

## Repository map (OPENCLAW workspace)

- `uni-mission-control/` — React app (this `uni-mission-control-workspace` folder lives inside it for git).
- `ads_data_sync/` — Python sync, alerts, A/B reports, contracts (when cloned beside the app).
- `uni-mission-control workspace 062026/` — legacy snapshot; do not treat as current migrations source of truth.

## Verification checklist (release)

- Supabase: three migrations in §1 of backend brief applied on staging + prod.
- App: `npm run build`; login smoke as `super_admin`, `media_buyer`, `partner`, `client`/`client_user`.
- Alerts: create rule, receive alert, bulk archive/delete/mission where permitted.
- Data: Overview agency vs heated; Realtime window switch shows different row counts when data exists for that window length.
- A/B tab: last job row appears when VPS has written `job_runs`.

## Document hygiene (2026-05 cleanup)

Canonical narrative for this wave is under `uni-mission-control-workspace/`. Long SQL alert rebuild content stays in `TEAM_BRIEF_BACKEND.md` and `MASTER_ALERT_REBUILD_PLAN.md` at OPENCLAW root until ported into `ads_data_sync/docs/`.
