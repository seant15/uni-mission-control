# uni-mission-control-workspace

Single handoff area for UNI Mission Control (dashboard + Supabase + VPS scripts). Prefer reading the three briefs here instead of scattered copies at the OPENCLAW workspace root.

## Canonical briefs (2026-05)

| File | Audience |
|------|----------|
| `BRIEF_FRONTEND_2026-05.md` | React app, Vercel, UX + what backend must supply |
| `BRIEF_BACKEND_2026-05.md` | Supabase, `ads_data_sync`, cron, RLS, alert engine |
| `BRIEF_FULL_STACK_2026-05.md` | One-page index + cross-links + verification |

## Archive

`archive/` holds a snapshot of `AGENT_BRIEF_FRONTEND_DEV` (2026-05-13) and `FRONTEND_DEV_ADAPTER_JOB_RUNS_RLS_2026-05-16.md` from the repo `docs/` tree. The OPENCLAW workspace root copies of `AGENT_BRIEF_FRONTEND_DEV.md` and `TEAM_BRIEF_FRONTEND.md` were removed after merge to reduce duplication; use the briefs above as canonical.

## Repo layout reminder

- Application: `uni-mission-control/` (this repo’s parent folder is the app root).
- Pipeline: sibling `ads_data_sync/` under the same OPENCLAW workspace when present.
- Legacy snapshot (do not treat as active): `../uni-mission-control workspace 062026/` (space in folder name).
